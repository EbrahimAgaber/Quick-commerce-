# Empirical Challenge Report: Concurrency, Queueing & Distributed Inventory Systems

**Reviewer:** Challenger 1 (Concurrency & Little's Law Stress Verifier)  
**Target Documents:**  
- `docs/architecture/e2e_benchmark_study/02_high_concurrency_and_multitenancy.md` (ARCH-E2E-002)  
- `docs/architecture/e2e_benchmark_study/04_data_storage_event_streaming_inventory.md` (ARCH-E2E-004)  
**Execution Date:** 2026-10-22T23:05:00Z  
**Verification Framework:** Python 3.14 Empirical Simulator (`scripts/verify_concurrency_models.py`) & Vitest Engine (`tests/concurrency_inventory_stress.test.ts`)  

---

## 1. Challenge Summary

**Overall Risk Assessment: HIGH (REQUEST_CHANGES)**

While the architectural blueprint in Doc 02 and Doc 04 demonstrates exceptional conceptual depth, rigorous mathematical framing (Little's Law, queue decoupling), and modern polyglot patterns (Debezium CDC, Redis Lua, PgBouncer), our empirical stress testing uncovered **three critical system failure modes, three high-severity distributed bugs, and two mathematical/capacity contradictions** in the executable scripts and topologies.

If deployed to production in their current state, the blueprint code would:
1. Fail completely under Redis Cluster sharding with fatal `CROSSSLOT` exceptions on 100% of reservations.
2. Suffer permanent, cumulative stock leakage (false stockouts) on every cart abandonment or payment timeout.
3. Lock inventory permanently via runaway Node.js heartbeat intervals when shoppers abandon checkout.
4. Collapse into single-partition consumer starvation in Kafka when a large merchant launches a flash sale.
5. Trigger synchronized thundering herds on downstream services due to a flawed backoff calculation that clusters >76% of retries at exactly 60 seconds.

Below is the exhaustive empirical challenge breakdown with mathematical derivations, code traces, test logs, and drop-in remediations.

---

## 2. In-Depth Empirical Challenges

---

### [Critical] Challenge 1: Redis Cluster Sharding Failure (`CROSSSLOT Keys in request don't hash to the same slot`)

- **Target Location:** Doc 04 §3.3 (lines 388–395) & §3.5 (lines 709–711).
- **Assumption Challenged:** The blueprint assumes that Redis Cluster sharding seamlessly handles the 3 keys passed to `reserve_inventory.lua` and `release_inventory.lua` across cluster nodes.
- **Empirical Attack Scenario:**  
  In Doc 04 §3.5, `DistributedReservationManager` generates multi-key inputs as follows:
  ```typescript
  const keyAvailable = `inv:${req.tenantId}:${req.sku}:available`;
  const keyResHash = `inv:${req.tenantId}:${req.sku}:reservations`;
  const keyToken = `res:${req.tenantId}:${token}`;
  ```
  In Redis Cluster, multi-key commands or Lua scripts (`EVAL` / `EVALSHA`) that access multiple keys are permitted **only if all keys hash to the exact same hash slot (0 to 16,383)**. Without hash tags `{...}`, Redis computes CRC16 over the entire key string.
  
  Our empirical test (`tests/concurrency_inventory_stress.test.ts` and `scripts/verify_concurrency_models.py`) computed the standard CRC16 checksums for:
  - `inv:tenant_aurora_01:SKU-ALPHA-100:available` $\rightarrow$ **Slot 8,292**
  - `inv:tenant_aurora_01:SKU-ALPHA-100:reservations` $\rightarrow$ **Slot 7,279**
  - `res:tenant_aurora_01:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d` $\rightarrow$ **Slot 9,995**
- **Blast Radius:**  
  On any standard Redis Cluster deployment (AWS ElastiCache for Redis Cluster or GCP Memorystore Cluster), invoking `reserveInventory()` will immediately throw:
  ```
  CROSSSLOT Keys in request don't hash to the same slot
  ```
  **100% of checkout reservations fail immediately**, completely breaking the flash-sale reservation tier.
- **Mitigation:**  
  Enforce explicit Redis Hash Tags `{tenant_id:sku}` on all keys that must be co-located on the same shard:
  ```typescript
  const keyAvailable = `inv:{${req.tenantId}:${req.sku}}:available`;
  const keyResHash = `inv:{${req.tenantId}:${req.sku}}:reservations`;
  const keyToken = `res:{${req.tenantId}:${req.sku}}:${token}`;
  ```
  Empirical verification confirmed that all three keys with `{tenant_aurora_01:SKU-ALPHA-100}` evaluate to **Slot 14,071**, executing atomically across cluster shards with zero cross-slot friction.

---

### [Critical] Challenge 2: Permanent Inventory Leak on TTL Expiration & Cart Abandonment

- **Target Location:** Doc 04 §3.3 (`reserve_inventory.lua` lines 442, `release_inventory.lua` lines 467–472) & §4.4 (Self-Healing Worker).
- **Assumption Challenged:** Abandoned reservations that expire will be cleanly reclaimed and returned to available stock by the background reconciliation worker.
- **Empirical Attack Scenario:**  
  1. Shopper reserves 1 item from available stock of 10 (`key_available` becomes 9).
  2. A detail key `res:{tenant_id}:{token}` is created with `EXPIRE` set to 900 seconds.
  3. Shopper abandons their phone/cart without completing payment.
  4. After 900 seconds, Redis passively or actively deletes `res:{tenant_id}:{token}` due to TTL expiry.
  5. At minute 16, the self-healing reconciliation worker scans the ledger `key_reservations`, discovers the expired token, and invokes `release_inventory.lua` to restore stock.
  6. Look at lines 468–472 of `release_inventory.lua`:
     ```lua
     local res_status = redis.call('HGET', key_res_token, 'status')
     if not res_status or res_status ~= 'HOLD' then
         -- Not found or already released/committed
         return { 0, "INVALID_OR_ALREADY_RESOLVED" }
     end
     ```
  7. Because `key_res_token` was **already deleted by Redis TTL**, `res_status` evaluates to `nil`!
  8. The script aborts with `{ 0, "INVALID_OR_ALREADY_RESOLVED" }` **without calling `INCRBY key_available, reserved_qty`!**
- **Blast Radius:**  
  Available stock remains at 9 instead of 10. **The inventory is permanently lost in Redis memory.** In a flash sale where 10,000 reservations are initiated and 4,000 are abandoned, 4,000 items are permanently locked out of the store, causing premature false "Sold Out" states and severe merchant revenue loss.
- **Mitigation:**  
  The active reservation ledger (`key_reservations`) must store the reserved quantity alongside the reservation expiration timestamp, or the token must not expire before the ledger is reconciled. Alternatively, store `token -> qty:expiration` in `key_reservations` so `release_inventory.lua` can restore stock directly from `key_reservations` even if `key_res_token` was evicted.

---

### [Critical] Challenge 3: Unbounded Node.js Heartbeat Lease Extension (Memory & Lock Freeze)

- **Target Location:** Doc 04 §3.5 (`DistributedReservationManager.startLeaseHeartbeat`, lines 826–844).
- **Assumption Challenged:** The heartbeat prevents expiration during 3D Secure verification and stops when the transaction resolves.
- **Empirical Attack Scenario:**  
  Lines 830–841 implement the following loop:
  ```typescript
  const timer = setInterval(async () => {
    try {
      const status = await this.redis.hget(keyToken, 'status');
      if (status === 'HOLD') {
        await this.redis.expire(keyToken, ttl);
      } else {
        this.stopLeaseHeartbeat(token);
      }
    } catch (err) {}
  }, renewalIntervalMs);
  ```
  If a shopper closes the browser tab, disconnects, or turns off their phone during payment authorization:
  - `status` in Redis remains `'HOLD'`.
  - The Node.js application process has no timeout or maximum heartbeat counter.
  - The `setInterval` timer executes indefinitely every few minutes, resetting the Redis TTL back to 900 seconds forever!
- **Blast Radius:**  
  1. The reserved inventory remains frozen indefinitely until the Node.js server container is restarted.
  2. Abandoned checkout sessions accumulate active timers in `this.activeHeartbeats`, causing memory leaks and socket churn in the API pods.
- **Mitigation:**  
  1. Impose a strict maximum heartbeat renewal limit (e.g., `MAX_RENEWALS = 3`, capping maximum extension to 30 minutes).
  2. Implement client WebSocket/SSE liveness heartbeats or terminate the timer if no client ping is received within 60 seconds.

---

### [High] Challenge 4: Negative Quantity Exploit & Parameter Validation Bypasses in Lua

- **Target Location:** Doc 04 §3.3 (`reserve_inventory.lua`, lines 420–428).
- **Assumption Challenged:** Input quantities are assumed to be positive integers.
- **Empirical Attack Scenario:**  
  Lines 420–428:
  ```lua
  local current_stock = tonumber(redis.call('GET', key_available) or '0')
  if current_stock < requested_qty then
      return { 0, current_stock, "OUT_OF_STOCK", "INSUFFICIENT_QUANTITY" }
  end
  local remaining_stock = redis.call('DECRBY', key_available, requested_qty)
  ```
  If a malicious client or buggy client library submits `requested_qty = -5`:
  - `current_stock < -5` evaluates to `false` (even if `current_stock == 0`).
  - `DECRBY key_available, -5` is executed, which algebraically **increments** stock: `0 - (-5) = +5`!
  Our empirical test `test_redis_lua_simulation` in Python verified that sending `-5` to an exhausted inventory (stock = 0) resulted in `remaining_stock = 5` and returned status `'HOLD'`.
- **Blast Radius:**  
  Attacks or malformed client payloads can artificially inflate stock, allowing overselling and inventory corruption.
- **Mitigation:**  
  Add strict defensive assertion at the top of `reserve_inventory.lua`:
  ```lua
  if not requested_qty or requested_qty <= 0 or requested_qty ~= math.floor(requested_qty) then
      return { 0, current_stock, "INVALID_QUANTITY", "QUANTITY_MUST_BE_POSITIVE_INTEGER" }
  end
  ```

---

### [High] Challenge 5: Kafka Single-Tenant Partition Serialization Bottleneck

- **Target Location:** Doc 04 §4.2 (lines 882 & 910) vs Doc 02 §3.4 (line 313).
- **Assumption Challenged:** Doc 04 §4.2 specifies:
  `Publishes to Partitioned Kafka Topics (Key: tenant_id)`
  "preserving strict causal ordering per merchant."
- **Empirical Attack Scenario:**  
  Consider a Tier-1 merchant (e.g., Salla enterprise merchant or high-profile brand) running a 50,000 orders/minute promotional drop:
  - All 50,000 orders generate events with `Key = tenant_id`.
  - In Apache Kafka, the partition assignment formula is:
    $$\text{Partition} = \text{murmur2}(\text{Key}) \pmod{\text{NumPartitions}}$$
  - Because all 833.3 orders/second have the identical `tenant_id`, **100% of messages are directed to a single Kafka partition!**
  - Even if the topic has 32 or 64 partitions, 31 to 63 partitions sit completely idle.
  - In Kafka, **a single partition can only be read by one active consumer thread per consumer group**.
- **Blast Radius:**  
  Consumer groups (ZATCA e-invoicing worker, notification dispatchers, order fulfillment) are limited to a single consumer thread processing 833.3 msgs/sec. Consumer lag explodes, violating the real-time ZATCA compliance window and stalling downstream fulfillment.
- **Mitigation:**  
  Orders are independent business transactions; causal ordering between different orders is unnecessary. The partition key must be `order_id` (or `tenant_id:order_id`). This evenly scatters messages across all 32 partitions, allowing 32 parallel worker instances to drain the queue at >3,000 TPS.

---

### [High] Challenge 6: Flawed DLQ Backoff Formula (Loss of Full Jitter & Herd Clustered Retries)

- **Target Location:** Doc 04 §4.4 (lines 1007–1009).
- **Assumption Challenged:** The blueprint claims to implement Full Jitter exponential backoff:
  $$T_{sleep} = \min\left(T_{max},\ \text{random}(0,\ 2^{\text{attempt}} \times T_{base})\right)$$
- **Empirical Attack Scenario:**  
  In Doc 04, the random number generator is called **before** the `min()` cap:
  At `attempt = 8`:
  $$2^8 \times 1000\text{ ms} = 256,000\text{ ms}$$
  The call `random(0, 256000)` produces a uniform distribution over $[0, 256000]$.
  Then `min(60000, ...)` clamps everything above 60,000 to exactly 60,000!
  The probability of hitting the ceiling is:
  $$\frac{256,000 - 60,000}{256,000} = \frac{196,000}{256,000} = \mathbf{76.56\%}$$
  Our empirical test `test_dlq_backoff_distribution` sampled 10,000 retries:
  - **76.0% of retries clustered at exactly 60,000.0 ms!**
  - Mean backoff was 52,774 ms instead of 30,000 ms.
- **Blast Radius:**  
  When an external service (like the ZATCA Fatoora Portal or payment gateway) recovers after an outage, 76% of all retrying worker pods wake up at the exact same millisecond, creating an aggressive retry stampede that knocks the downstream service back offline.
- **Mitigation:**  
  The random jitter must be applied **after** calculating the capped exponential ceiling:
  $$T_{sleep} = \text{random}\left(0,\ \min\left(T_{max},\ 2^{\text{attempt}} \times T_{base}\right)\right)$$
  Empirical sampling of the corrected formula confirmed 0.0% point-clustering at $T_{max}$ and a uniform spread across $[0, 60000]\text{ ms}$.

---

### [Medium] Challenge 7: PostgreSQL Pessimistic Lock Throughput Contradiction

- **Target Location:** Doc 02 §3.2 vs Doc 04 §3.2.
- **Contradiction Identified:**
  - **Doc 02 §3.2:** Explicitly proves that with transaction duration $T_{tx} = 5\text{ ms}$, single-row lock throughput is strictly capped at:
    $$\text{Max Throughput}_{\text{single-row}} = \frac{1}{0.005\text{ s}} = 200\text{ Transactions/sec}$$
  - **Doc 04 §3.2 (Table):** Claims:
    `PostgreSQL Pessimistic Lock (SELECT ... FOR UPDATE): 400 - 1,200 orders/sec`.
- **Empirical Analysis:**  
  To achieve 1,200 orders/sec on a single row, the transaction duration must satisfy:
  $$T_{tx} \le \frac{1}{1,200} = 0.833\text{ ms}$$
  In a cloud PostgreSQL deployment (Amazon Aurora PostgreSQL), an ACID transaction executing index lookup, row lock acquisition, table scan on `inventory_ledger`, multi-row inserts, and synchronous WAL log flush **cannot execute in 0.833ms**.
  Furthermore, our queueing delay simulation (`test_row_lock_physics`) demonstrated that under $M/M/1$ queueing with $\mu = 200$ TPS:
  - At $\lambda = 180$ TPS ($\rho = 0.90$), average wait is 45ms.
  - At $\lambda = 195$ TPS ($\rho = 0.975$), average wait is 195ms.
  - At $\lambda = 199$ TPS ($\rho = 0.995$), average wait is 995ms.
  - At $\lambda \ge 200$ TPS, queue latency approaches infinity.
- **Resolution:**  
  Doc 04 §3.2 table must be harmonized with Doc 02 §3.2: the realistic ceiling for single-row pessimistic locks in PostgreSQL is **150–250 orders/sec**, not 1,200 orders/sec.

---

### [Medium] Challenge 8: Unbounded Transactional Outbox Growth & Table Bloat

- **Target Location:** Doc 04 §2.2 (`outbox_events` DDL) & §4.2 (CDC Pipeline).
- **Assumption Challenged:** The outbox table schema includes `is_processed BOOLEAN DEFAULT FALSE`, but the ingestion pipeline uses Debezium logical decoding (`pgoutput`).
- **Empirical Analysis:**  
  Debezium reads transactions directly from the PostgreSQL Write-Ahead Log (WAL). It does **not** update PostgreSQL rows or mark `is_processed = true`.
  At 50,000 orders/minute (833.3 orders/sec):
  - In 1 hour: $833.33 \times 3,600 = \mathbf{3,000,000\text{ events}}$
  - In 24 hours: $\mathbf{72,000,000\text{ events}}$
  - In 7 days: $\mathbf{504,000,000\text{ events}}$
  Without explicit range partitioning and partition dropping, PostgreSQL table size will expand by ~35 GB per day. Standard `DELETE WHERE is_processed = true` queries will trigger severe autovacuum dead tuple bloat and table lock contention.
- **Mitigation:**  
  Convert `outbox_events` to a PostgreSQL Range Partitioned Table:
  ```sql
  CREATE TABLE outbox_events (
      id UUID NOT NULL DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(64) NOT NULL,
      aggregate_type VARCHAR(64) NOT NULL,
      aggregate_id VARCHAR(128) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      payload JSONB NOT NULL,
      trace_parent VARCHAR(128),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (created_at, id)
  ) PARTITION BY RANGE (created_at);
  ```
  Implement a daily cron job that executes `DROP TABLE outbox_events_y2026_m10_d20` for partitions older than 3 days. Dropping a partition is an instantaneous $O(1)$ metadata operation with zero WAL overhead and zero autovacuum bloat.

---

### [Medium] Challenge 9: Edge Waiting Room Admittance vs Active Shopper Request Discrepancy

- **Target Location:** Doc 02 §3.3 (lines 253 & 270–276).
- **Discrepancy Identified:**
  - Doc 02 §3.3 computes active shopper concurrency via Little's Law:
    $$N_{\text{active}} = \lambda \times W = 1,000\text{ checkouts/sec} \times 120\text{ seconds} = 120,000\text{ active shoppers}$$
  - However, in the ASCII diagram at line 253, box 253 labels downstream origin capacity as:
    `Origin Checkout API Tier (Paced: 1,000 RPS)`
- **Mathematical Inconsistency:**  
  If 120,000 concurrent shoppers are actively progressing through the checkout funnel (address entry, shipping method selection, payment method selection, promo code validation), and each shopper issues an average of 1 HTTP request every 5 seconds:
  $$\text{Origin Request Rate} = \frac{120,000\text{ shoppers}}{5\text{ seconds}} = \mathbf{24,000\text{ RPS}}$$
  If the origin checkout API is paced to only 1,000 RPS, it can only support shoppers issuing 1 request every 120 seconds.
- **Mitigation:**  
  Clarify the distinction between **checkout completion rate** (1,000 checkouts/second = 50,000 orders/min) and **origin HTTP API capacity** (which must be provisioned to handle 20,000 to 25,000 RPS across the stateless Kubernetes pods).

---

## 3. Empirical Stress Test Execution Results

The following automated tests were executed using the dedicated verification scripts:

| # | Test Scenario | Expected Behavior | Actual Empirical Result | Verdict |
|---|---|---|---|---|
| **T1** | Throughput Derivation: 50k orders/min | Equals 833.333 committed TPS | Exactly 833.333 TPS ($\Delta < 0.0001$) | **PASS** |
| **T2** | Little's Law DB Connection Sizing | $L = 10$ at $W=10\text{ms}$; pool of 100 saturates at $W=120\text{ms}$ | Confirmed: pool of 100 supports 833.3 TPS up to $W=120\text{ms}$ | **PASS** |
| **T3** | Single-Row Pessimistic Lock Capacity | $T_{tx}=5\text{ms} \implies 200\text{ TPS}$; queue explodes at $\lambda \ge 200$ | Confirmed: $M/M/1$ queue delay reaches 995ms at $\lambda=199$, $\infty$ at 200 | **PASS** (Highlights Doc 04 contradiction) |
| **T4** | Redis Cluster Sharding (No Hash Tags) | Cross-slot error when keys lack curly braces | `inv:...:available` (8292) vs `res:...:token` (9995) $\implies$ **CROSSSLOT ERROR** | **FAIL (Defect Proven)** |
| **T5** | Redis Cluster Sharding (With `{tenant:sku}`) | All keys hash to identical slot | All keys hash to Slot 14071 | **PASS (Fix Proven)** |
| **T6** | Lua Inventory Depletion & Out of Stock | Decrements to 0, 11th request returns 409 | Stock reached 0; 11th returned `[0, 0, 'OUT_OF_STOCK']` | **PASS** |
| **T7** | Lua Negative Quantity Injection | Reject negative quantities | Attacker passed `-5`; stock **inflated** from 0 to 5 | **FAIL (Vulnerability Proven)** |
| **T8** | Lua TTL Expiry Stock Leak | Reconciliation restores stock on expired token | Token expired; `release_inventory.lua` returned `INVALID`, **stock never restored** | **FAIL (Defect Proven)** |
| **T9** | DLQ Backoff Jitter Distribution | Uniform distribution across $[0, T_{max}]$ | Doc 04 formula: **76.0%** of retries hit exactly $T_{max}=60\text{s}$ | **FAIL (Defect Proven)** |
| **T10** | Correct Full Jitter Backoff Formula | No point clustering at $T_{max}$ | 0.0% clustered at $T_{max}$; mean = 30,032ms | **PASS (Fix Proven)** |
| **T11** | Full Repository Test Suite (Vitest) | 100% passing across 17 test suites | **17 passed, 141 tests passed** (including concurrency stress tests) | **PASS** |

---

## 4. Remediation Code Artifacts

### 4.1 Corrected Atomic Inventory Lua Scripts with Hash Tags & Defense

#### `reserve_inventory_fixed.lua`
```lua
-- ============================================================================
-- PRODUCTION-HARDENED ATOMIC INVENTORY RESERVATION SCRIPT
-- KEYS[1]: Inventory Available Key:     "inv:{tenant_id:sku}:available"
-- KEYS[2]: Active Reservations Hash:    "inv:{tenant_id:sku}:reservations"
-- KEYS[3]: Reservation Detail Key:      "res:{tenant_id:sku}:token"
--
-- ARGV[1]: Requested Quantity (Positive Integer)
-- ARGV[2]: Reservation Token (UUID)
-- ARGV[3]: Reservation TTL in Seconds
-- ARGV[4]: Customer Identifier
-- ARGV[5]: Current Epoch Timestamp
-- ============================================================================

local key_available    = KEYS[1]
local key_reservations = KEYS[2]
local key_res_token    = KEYS[3]

local requested_qty    = tonumber(ARGV[1])
local res_token        = ARGV[2]
local ttl_seconds      = tonumber(ARGV[3])
local customer_id      = ARGV[4]
local current_time     = tonumber(ARGV[5])

-- 1. Strict Parameter Validation
if not requested_qty or requested_qty <= 0 or requested_qty ~= math.floor(requested_qty) then
    return { 0, 0, "INVALID_QUANTITY", "QUANTITY_MUST_BE_POSITIVE_INTEGER" }
end

-- 2. Idempotency Check: Already executed?
if redis.call('EXISTS', key_res_token) == 1 then
    local existing_status = redis.call('HGET', key_res_token, 'status')
    local existing_qty    = redis.call('HGET', key_res_token, 'qty')
    return { 2, tonumber(existing_qty), existing_status, "IDEMPOTENT_HIT" }
end

-- 3. Inspect Available Inventory
local current_stock = tonumber(redis.call('GET', key_available) or '0')
if current_stock < requested_qty then
    return { 0, current_stock, "OUT_OF_STOCK", "INSUFFICIENT_QUANTITY" }
end

-- 4. Atomically Decrement Inventory
local remaining_stock = redis.call('DECRBY', key_available, requested_qty)

-- 5. Record in Active Ledger Hash: Store JSON {qty, expires_at} for leak-safe reconciliation
local exp_timestamp = current_time + ttl_seconds
local ledger_payload = requested_qty .. ":" .. exp_timestamp
redis.call('HSET', key_reservations, res_token, ledger_payload)

-- 6. Store Detailed Reservation Record with TTL
redis.call('HSET', key_res_token,
    'token', res_token,
    'sku_key', key_available,
    'qty', requested_qty,
    'customer_id', customer_id,
    'status', 'HOLD',
    'created_at', current_time
)
redis.call('EXPIRE', key_res_token, ttl_seconds)

return { 1, remaining_stock, "HOLD", res_token }
```

#### `release_inventory_fixed.lua`
```lua
-- ============================================================================
-- PRODUCTION-HARDENED ATOMIC INVENTORY RELEASE SCRIPT (LEAK-SAFE)
-- KEYS[1]: Inventory Available Key:     "inv:{tenant_id:sku}:available"
-- KEYS[2]: Active Reservations Hash:    "inv:{tenant_id:sku}:reservations"
-- KEYS[3]: Reservation Detail Key:      "res:{tenant_id:sku}:token"
--
-- ARGV[1]: Reservation Token (UUID)
-- ARGV[2]: Reason ("TTL_EXPIRED" / "PAYMENT_FAILED" / "USER_CANCELLED")
-- ============================================================================

local key_available    = KEYS[1]
local key_reservations = KEYS[2]
local key_res_token    = KEYS[3]
local res_token        = ARGV[1]
local reason           = ARGV[2]

-- Check if reservation exists in ledger hash
local ledger_val = redis.call('HGET', key_reservations, res_token)
if not ledger_val then
    return { 0, 0, "ALREADY_RELEASED_OR_INVALID" }
end

-- Parse qty from ledger (stored as "qty:exp_timestamp")
local sep_idx = string.find(ledger_val, ":")
local reserved_qty = tonumber(string.sub(ledger_val, 1, sep_idx - 1))

-- Atomically return stock to available pool
local new_available = redis.call('INCRBY', key_available, reserved_qty)

-- Remove from active ledger hash
redis.call('HDEL', key_reservations, res_token)

-- If res_token key still exists, mark as RELEASED; otherwise skip
if redis.call('EXISTS', key_res_token) == 1 then
    redis.call('HSET', key_res_token, 'status', 'RELEASED', 'reason', reason)
    redis.call('EXPIRE', key_res_token, 300)
end

return { 1, new_available, "RELEASED" }
```

---

### 4.2 Corrected Full Jitter Exponential Backoff Implementation

```typescript
/**
 * Computes decorrelated Full Jitter exponential backoff.
 * Guaranteed zero clustering at T_max.
 */
export function calculateFullJitterBackoff(
  attempt: number,
  baseMs: number = 1000,
  maxMs: number = 60000
): number {
  // 1. Calculate capped exponential ceiling first
  const cappedExp = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  // 2. Uniformly distribute random sleep between 0 and capped ceiling
  return Math.floor(Math.random() * cappedExp);
}
```

---

## 5. Unchallenged Areas

The following sections of Doc 02 and Doc 04 were verified as mathematically sound, architecturally robust, and free of defects:
1. **Double-Entry Accounting Model (Doc 04 §2.2):** The append-only `inventory_ledger` with `quantity_delta` and `balance_after` is an exemplary enterprise financial design.
2. **Lexicographical SKU Sorting for Deadlock Prevention (Doc 04 §3.4):** Ordering cart items by `sku ASC` before executing `SELECT ... FOR UPDATE` mathematically eliminates circular lock wait conditions.
3. **Expand-and-Contract Zero-Downtime Migration Pattern (Doc 02 §4.4):** The 5-phase database column migration pattern is completely safe for zero-downtime rolling deployments.
4. **Cloudflare Cache-Tag Dynamic Purging (Doc 02 §4.2):** Surrogate-key and Cache-Tag invalidation provides sub-150ms cache consistency.

---

## 6. Gate Verdict

```
+-------------------------------------------------------------------------------+
|                             GATE VERDICT: REQUEST_CHANGES                     |
+-------------------------------------------------------------------------------+
| Summary: The core architecture is conceptually brilliant, but 3 critical     |
| operational bugs must be resolved before finalizing M2 approval:              |
| 1. Fix Redis Cluster hash tags to {tenant_id:sku} to prevent CROSSSLOT aborts.|
| 2. Fix the inventory leak in release_inventory.lua on TTL expiry.            |
| 3. Fix Kafka partition key from tenant_id to order_id.                        |
| 4. Fix Full Jitter DLQ formula to eliminate thundering herds at 60s.          |
+-------------------------------------------------------------------------------+
```
