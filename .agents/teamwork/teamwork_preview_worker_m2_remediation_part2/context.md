# Remediation Worker Part 2 Context
Files to update:
- docs/architecture/e2e_benchmark_study/04_data_storage_event_streaming_inventory.md
- docs/architecture/e2e_benchmark_study/06_quick_ecommerce_gap_analysis_and_roadmap.md
Inputs:
- Challenger 1 report: .agents/teamwork/teamwork_preview_challenger_m2_1/challenge.md
- Challenger 2 report: .agents/teamwork/teamwork_preview_challenger_m2_2/challenge.md
Fixes:
1. Doc 04 §3.3 & §3.5: Apply Redis Cluster hash tags `{tenant:sku}` to all multi-key operations to prevent CROSSSLOT errors.
2. Doc 04 §3.3: In release_inventory.lua, ensure stock is restored even if token key has expired (prevent inventory leaks on cart abandonment).
3. Doc 04 §3.4: In TypeScript reservation manager, guard the heartbeat interval with max renewal timeout.
4. Doc 04 §3.3: In reserve_inventory.lua, add check: if qty <= 0 then return {0, "INVALID_QUANTITY"} to prevent negative inventory injection.
5. Doc 04 §4.3: In Kafka event streaming, clarify partition key strategy: partition order events by `order_id` (or `order_id` hash) for uniform partition distribution across consumer threads during merchant flash sales, and use partition key `order_id` for CDC outbox events.
6. Doc 04 §4.4: In DLQ retry backoff, fix full-jitter formula to `sleep = Math.random() * Math.min(maxBackoff, baseBackoff * Math.pow(2, attempt))`.
7. Doc 06 §1.7: Fix path typo in G7 from `src/components/cart/CheckoutModal.tsx` to `src/components/storefront/CheckoutModal.tsx`.
