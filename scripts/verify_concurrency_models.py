"""
Empirical Verification & Stress Test Suite for Concurrency, Queueing,
Redis Lua Inventory, and Distributed Systems Models (Doc 02 & Doc 04).
Challenger 1: Concurrency & Little's Law Stress Verifier
"""

import math
import random
import time
import sys

def test_throughput_math():
    print("=== TEST 1: Throughput & Little's Law Math Verification ===")
    orders_per_min = 50000
    committed_tps = orders_per_min / 60.0
    print(f"50,000 orders/min -> {committed_tps:.4f} committed TPS")
    assert abs(committed_tps - 833.3333) < 0.001, "Committed TPS math failed"

    # Little's Law: L = lambda * W
    # Scenario A: DB Connection Pool (Doc 04 §2.3)
    # lambda = 1000 tx/sec, W = 10ms = 0.01s
    lam_tx = 1000.0
    w_tx = 0.010
    l_conn = lam_tx * w_tx
    print(f"Scenario A (Doc 04): lambda={lam_tx}/s, W={w_tx*1000}ms -> Active Conns L = {l_conn:.1f}")
    assert abs(l_conn - 10.0) < 1e-6

    # Scenario B: What if P99 latency spikes under batch inserts or lock contention?
    w_spikes = [0.020, 0.050, 0.100, 0.120, 0.200]
    for w in w_spikes:
        l_needed = lam_tx * w
        max_tps_100_conns = 100.0 / w
        print(f"  If W = {w*1000:.0f}ms -> Required Conns = {l_needed:.1f} | Max TPS with 100 conns = {max_tps_100_conns:.1f}")
    
    # Critical threshold for 100 connections at 833.3 TPS:
    w_threshold = 100.0 / committed_tps
    print(f"  Maximum permissible transaction latency before 100-conn pool saturates at 833.3 TPS: {w_threshold*1000:.2f}ms")

    # Scenario C: Waiting Room Concurrency (Doc 02 §3.3)
    # Capacity = 1000 checkouts/s, Duration = 120s
    lam_shopper = 1000.0
    w_shopper = 120.0
    n_active = lam_shopper * w_shopper
    print(f"Scenario C (Doc 02): lambda={lam_shopper}/s, W={w_shopper}s -> N_active = {n_active:.0f} shoppers")
    assert abs(n_active - 120000.0) < 1e-6
    
    # Stress query: If 120,000 shoppers are active and each makes 1 request every 5s:
    rps_active = n_active / 5.0
    print(f"  If 120,000 active shoppers poll/request every 5s: Ingress = {rps_active:.0f} RPS.")
    print(f"  Doc 02 §3.3 claims 'Origin Checkout API Tier (Paced: 1,000 RPS)' -> Understated by factor of {rps_active / 1000:.1f}x!")
    print("TEST 1 PASSED\n")


def test_row_lock_physics():
    print("=== TEST 2: Single-Row Lock Contention vs Redis Lua ===")
    # Doc 02 §3.2: T_tx = 0.005s (5ms) -> Max single-row TPS = 1 / 0.005 = 200 TPS
    t_tx = 0.005
    max_single_row_tps = 1.0 / t_tx
    print(f"Doc 02 §3.2: T_tx = {t_tx*1000}ms -> Max Single-Row TPS = {max_single_row_tps:.0f} TPS")
    assert abs(max_single_row_tps - 200.0) < 1e-6

    # Doc 04 §3.2 claims: "PostgreSQL Pessimistic Lock: 400 - 1,200 orders/sec"
    t_tx_1200 = 1.0 / 1200.0
    print(f"Doc 04 §3.2 claim of 1,200 orders/sec requires T_tx = {t_tx_1200*1000:.3f}ms on a single row lock!")
    print(f"Discrepancy identified: Doc 02 says 200 TPS max, Doc 04 claims 400 - 1,200 TPS.")

    # Simulate M/M/1 queueing delay under lock contention
    # With service rate mu = 200 TPS, let's see response time as arrival rate approaches 200
    print("Queueing delay under row lock (mu = 200 TPS):")
    for lam in [50, 100, 150, 180, 195, 199]:
        rho = lam / 200.0
        w_q = (rho / (200.0 * (1.0 - rho))) * 1000.0  # ms
        w_total = w_q + (t_tx * 1000.0)
        print(f"  lambda = {lam:3d} TPS (rho = {rho:.3f}) -> Queue Wait = {w_q:8.2f}ms | Total Tx Time = {w_total:8.2f}ms")
    print("At lambda = 199 TPS, wait time explodes to 995ms. At lambda >= 200 TPS, queue grows infinitely.")
    print("TEST 2 PASSED\n")


def test_redis_cluster_hash_tags():
    print("=== TEST 3: Redis Cluster Sharding & Hash Tag Slot Analysis ===")
    # Redis CRC16 algorithm implementation
    def crc16(data: bytes) -> int:
        crc = 0
        for byte in data:
            crc ^= (byte << 8)
            for _ in range(8):
                if crc & 0x8000:
                    crc = ((crc << 1) ^ 0x1021) & 0xFFFF
                else:
                    crc = (crc << 1) & 0xFFFF
        return crc

    def get_redis_slot(key: str) -> int:
        # Check for hash tag {...}
        s = key.find('{')
        if s != -1:
            e = key.find('}', s + 1)
            if e != -1 and e != s + 1:
                key = key[s + 1:e]
        return crc16(key.encode('utf-8')) % 16384

    # Test keys from Doc 04 §3.5 lines 709-711:
    # keyAvailable = `inv:${req.tenantId}:${req.sku}:available`
    # keyResHash = `inv:${req.tenantId}:${req.sku}:reservations`
    # keyToken = `res:${req.tenantId}:${token}`
    tenant_id = "tenant_aurora_01"
    sku = "SKU-ALPHA-100"
    token = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"

    key1 = f"inv:{tenant_id}:{sku}:available"
    key2 = f"inv:{tenant_id}:{sku}:reservations"
    key3 = f"res:{tenant_id}:{token}"

    slot1 = get_redis_slot(key1)
    slot2 = get_redis_slot(key2)
    slot3 = get_redis_slot(key3)
    print(f"Without Hash Tags (as written in TypeScript §3.5 lines 709-711):")
    print(f"  KEY1: {key1} -> Slot {slot1}")
    print(f"  KEY2: {key2} -> Slot {slot2}")
    print(f"  KEY3: {key3} -> Slot {slot3}")
    cross_slot = (slot1 != slot2) or (slot1 != slot3)
    print(f"  Slots Identical? {not cross_slot} (CROSSSLOT ERROR in Redis Cluster!)")
    assert cross_slot, "Expected cross-slot mismatch without hash tags"

    # Now test with proper hash tag {tenant_id:sku}
    ht_key1 = f"inv:{{{tenant_id}:{sku}}}:available"
    ht_key2 = f"inv:{{{tenant_id}:{sku}}}:reservations"
    ht_key3 = f"res:{{{tenant_id}:{sku}}}:{token}"
    ht_slot1 = get_redis_slot(ht_key1)
    ht_slot2 = get_redis_slot(ht_key2)
    ht_slot3 = get_redis_slot(ht_key3)
    print(f"With Proper Hash Tags {{{tenant_id}:{sku}}}:")
    print(f"  HT_KEY1: {ht_key1} -> Slot {ht_slot1}")
    print(f"  HT_KEY2: {ht_key2} -> Slot {ht_slot2}")
    print(f"  HT_KEY3: {ht_key3} -> Slot {ht_slot3}")
    assert ht_slot1 == ht_slot2 == ht_slot3, "Hash tag slots must match"
    print("  Slots Identical? TRUE (Redis Cluster Multi-Key Safe)")
    print("TEST 3 PASSED\n")


def test_redis_lua_simulation():
    print("=== TEST 4: Redis Lua Script Simulation & State Machine Edge Cases ===")
    class MockRedis:
        def __init__(self):
            self.strings = {}
            self.hashes = {}
            self.ttls = {}
            self.current_time = 1000

        def get(self, key):
            return self.strings.get(key, None)

        def decrby(self, key, amount):
            val = int(self.strings.get(key, 0)) - amount
            self.strings[key] = str(val)
            return val

        def incrby(self, key, amount):
            val = int(self.strings.get(key, 0)) + amount
            self.strings[key] = str(val)
            return val

        def exists(self, key):
            return 1 if (key in self.strings or key in self.hashes) else 0

        def hget(self, key, field):
            return self.hashes.get(key, {}).get(field, None)

        def hset(self, key, *args):
            if key not in self.hashes:
                self.hashes[key] = {}
            if len(args) == 2:
                self.hashes[key][args[0]] = str(args[1])
            else:
                for i in range(0, len(args), 2):
                    self.hashes[key][args[i]] = str(args[i+1])

        def hdel(self, key, field):
            if key in self.hashes and field in self.hashes[key]:
                del self.hashes[key][field]

        def expire(self, key, seconds):
            self.ttls[key] = self.current_time + seconds

        def advance_time(self, seconds):
            self.current_time += seconds
            # Expire keys whose TTL has passed
            expired = [k for k, exp in self.ttls.items() if exp <= self.current_time]
            for k in expired:
                if k in self.strings:
                    del self.strings[k]
                if k in self.hashes:
                    del self.hashes[k]
                del self.ttls[k]

    # Implement Doc 04 Lua script logic
    def reserve_lua(redis: MockRedis, keys, argv):
        key_available, key_reservations, key_res_token = keys
        requested_qty = int(argv[0])
        res_token = argv[1]
        ttl_seconds = int(argv[2])
        customer_id = argv[3]
        current_time = argv[4]

        # 1. Idempotency Check
        if redis.exists(key_res_token) == 1:
            existing_status = redis.hget(key_res_token, 'status')
            existing_qty = redis.hget(key_res_token, 'qty')
            return [2, int(existing_qty), existing_status, "IDEMPOTENT_HIT"]

        # 2. Inspect Available Inventory
        raw_stock = redis.get(key_available)
        current_stock = int(raw_stock if raw_stock is not None else 0)

        if current_stock < requested_qty:
            return [0, current_stock, "OUT_OF_STOCK", "INSUFFICIENT_QUANTITY"]

        # 3. Decrement Inventory
        remaining_stock = redis.decrby(key_available, requested_qty)

        # 4. Record Active Reservation
        redis.hset(key_reservations, res_token, requested_qty)

        # 5. Store Detailed Record with TTL
        redis.hset(key_res_token,
            'token', res_token,
            'sku_key', key_available,
            'qty', requested_qty,
            'customer_id', customer_id,
            'status', 'HOLD',
            'created_at', current_time
        )
        redis.expire(key_res_token, ttl_seconds)

        return [1, remaining_stock, "HOLD", res_token]

    def release_lua(redis: MockRedis, keys, argv):
        key_available, key_reservations, key_res_token = keys
        res_token = argv[0]
        reason = argv[1]

        res_status = redis.hget(key_res_token, 'status')
        if not res_status or res_status != 'HOLD':
            return [0, "INVALID_OR_ALREADY_RESOLVED"]

        reserved_qty = int(redis.hget(key_res_token, 'qty') or 0)
        new_available = redis.incrby(key_available, reserved_qty)
        redis.hdel(key_reservations, res_token)
        redis.hset(key_res_token, 'status', 'RELEASED', 'release_reason', reason)
        redis.expire(key_res_token, 300)
        return [1, new_available, "RELEASED"]

    redis = MockRedis()
    key_avail = "inv:{t1:sku1}:available"
    key_res_hash = "inv:{t1:sku1}:reservations"
    keys = lambda tok: [key_avail, key_res_hash, f"res:{{t1:sku1}}:{tok}"]

    # Setup initial stock
    redis.strings[key_avail] = "10"

    # Test 4.1: Normal reservation & exhaustion
    print("Test 4.1: Stock depletion to 0")
    for i in range(10):
        tok = f"tok_{i}"
        res = reserve_lua(redis, keys(tok), [1, tok, 900, f"cust_{i}", 1000])
        assert res[0] == 1, f"Failed at reservation {i}"
    print(f"  After 10 reservations: Available stock = {redis.get(key_avail)}")
    assert int(redis.get(key_avail)) == 0

    # 11th reservation must fail
    res_fail = reserve_lua(redis, keys("tok_10"), [1, "tok_10", 900, "cust_10", 1000])
    assert res_fail[0] == 0 and res_fail[2] == "OUT_OF_STOCK"
    print("  11th reservation correctly rejected with OUT_OF_STOCK.")

    # Test 4.2: Idempotency
    print("Test 4.2: Idempotent replay of tok_0")
    res_idem = reserve_lua(redis, keys("tok_0"), [1, "tok_0", 900, "cust_0", 1000])
    assert res_idem[0] == 2 and res_idem[3] == "IDEMPOTENT_HIT"
    print("  Idempotent replay correctly identified with code 2.")

    # Test 4.3: Negative quantity exploit (VULNERABILITY!)
    print("Test 4.3: Negative quantity test")
    res_neg = reserve_lua(redis, keys("tok_neg"), [-5, "tok_neg", 900, "attacker", 1000])
    print(f"  Attacker requested -5 quantity. Result: {res_neg}")
    new_stock = int(redis.get(key_avail))
    print(f"  Stock after negative reservation: {new_stock}")
    if new_stock > 0:
        print("  CRITICAL BUG CONFIRMED: Negative quantity inflated inventory from 0 to", new_stock)

    # Test 4.4: TTL Expiration and Reconciliation Bug (VULNERABILITY!)
    print("Test 4.4: TTL Expiration and Stock Leak Bug")
    # Reset stock to 5
    redis.strings[key_avail] = "5"
    tok_leak = "tok_leak_1"
    reserve_lua(redis, keys(tok_leak), [1, tok_leak, 900, "cust_leak", 1000])
    print(f"  Reserved 1 item. Stock is now: {redis.get(key_avail)}") # 4
    assert int(redis.get(key_avail)) == 4

    # Advance time by 901 seconds (TTL expires)
    print("  Advancing time by 901 seconds (TTL expires for res_token)...")
    redis.advance_time(901)
    assert redis.exists(keys(tok_leak)[2]) == 0, "Token key should be expired and deleted"

    # Now reconciliation worker tries to release this reservation
    print("  Reconciliation worker calls release_lua for expired token...")
    rel_res = release_lua(redis, keys(tok_leak), [tok_leak, "TTL_EXPIRED"])
    print(f"  release_lua returned: {rel_res}")
    stock_after_rel = int(redis.get(key_avail))
    print(f"  Stock after release attempt: {stock_after_rel}")
    assert stock_after_rel == 4, "Stock was NOT restored because token key was expired!"
    print("  CRITICAL BUG CONFIRMED: Stock remained 4 instead of returning to 5! In-memory inventory is permanently lost!")
    print("TEST 4 PASSED\n")


def test_dlq_backoff_distribution():
    print("=== TEST 5: DLQ Backoff Formula Analysis (Full Jitter Bug) ===")
    t_base = 1000.0  # ms
    t_max = 60000.0  # ms

    # Formula in Doc 04 §4.4:
    # T_sleep = min(T_max, random(0, 2^attempt * T_base))
    # Correct formula:
    # T_sleep = random(0, min(T_max, 2^attempt * T_base))

    print("Simulating 10,000 retry samples at attempt = 8:")
    attempt = 8
    raw_exp = (2 ** attempt) * t_base  # 256,000 ms

    doc_samples = []
    correct_samples = []
    for _ in range(10000):
        # Doc 04 formula
        r_doc = min(t_max, random.uniform(0, raw_exp))
        doc_samples.append(r_doc)

        # Correct Full Jitter formula
        r_correct = random.uniform(0, min(t_max, raw_exp))
        correct_samples.append(r_correct)

    pct_capped_doc = sum(1 for s in doc_samples if s >= t_max) / len(doc_samples) * 100.0
    pct_capped_correct = sum(1 for s in correct_samples if s >= t_max) / len(correct_samples) * 100.0

    print(f"  Doc 04 formula: {pct_capped_doc:.1f}% of retries hit EXACTLY T_max ({t_max}ms)!")
    print(f"  Correct Full Jitter: {pct_capped_correct:.1f}% of retries hit T_max.")
    print(f"  Doc 04 mean backoff: {sum(doc_samples)/len(doc_samples):.1f}ms (heavily clustered at {t_max}ms)")
    print(f"  Correct mean backoff: {sum(correct_samples)/len(correct_samples):.1f}ms (uniformly spread across [0, {t_max}ms])")
    print("  BUG CONFIRMED: Doc 04 formula clusters >76% of workers at exact 60s, triggering thundering herds!")
    print("TEST 5 PASSED\n")


if __name__ == "__main__":
    test_throughput_math()
    test_row_lock_physics()
    test_redis_cluster_hash_tags()
    test_redis_lua_simulation()
    test_dlq_backoff_distribution()
    print("ALL EMPIRICAL TESTS COMPLETED.")
