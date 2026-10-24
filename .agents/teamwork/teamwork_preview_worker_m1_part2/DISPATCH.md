## 2026-10-22T22:36:14Z
You are Worker 2 (Architecture Blueprint Author - Deliverables Part 2).
Your working directory is: c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_worker_m1_part2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mandatory inputs to read:
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_orchestrator_2\PROJECT.md
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_platform_scale\analysis.md
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_sec_zatca\analysis.md
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_data_storefront_gap\analysis.md

Your Exclusive Write Ownership:
You own and MUST author the following 3 production-grade deliverables in `c:\Users\User\Desktop\Quick-ecomerece\docs\architecture\e2e_benchmark_study\`:
1. `04_data_storage_event_streaming_inventory.md`:
   - Requirement R3 comprehensive technical blueprint.
   - Polyglot persistence: PostgreSQL primary with read replicas and PgBouncer connection pooling for ACID financial orders, document stores (Firestore/MongoDB) for dynamic product catalogs, and Redis for volatile caches.
   - Distributed inventory reservation & flash-sale concurrency: Detailed comparison of Redis Redlock & Lua atomic script (`DECRBY` with reservation TTL) vs PostgreSQL row-level pessimistic locking (`SELECT ... FOR UPDATE`) vs Firestore optimistic concurrency control (transactions).
   - Complete algorithmic pseudocode and executable implementation snippets for:
     (1) Redis Lua atomic inventory reservation script with TTL and rollbacks,
     (2) PostgreSQL row-level locking transaction,
     (3) Distributed lock reservation manager in TypeScript/Node.js with lease renewal and idempotency.
   - Asynchronous event streaming & Transactional Outbox pattern: Outbox table in PostgreSQL, Debezium CDC / Kafka / AWS EventBridge streaming, Dead Letter Queues (DLQ), idempotency keys, and eventual consistency reconciliation workers.
   - Concrete ASCII and Mermaid architectural diagrams for: Flash-sale inventory locking and reservation lifecycle.

2. `05_storefront_uiux_performance_cwv.md`:
   - Requirement R4 comprehensive technical blueprint.
   - Storefront architecture: Headless storefronts (Next.js App Router RSC / Hydrogen Remix) vs Edge-rendered themes (Shopify Liquid, Salla Twilight). Tradeoffs in developer experience, TTFB, caching, and customizability.
   - Design system tokenization (CSS variables, Tailwind tokens), bidirectional RTL/LTR layout mechanics using CSS logical properties (`margin-inline`, `padding-inline`), and icon mirroring rules.
   - Arabic typography engineering: Self-hosted subsetted Cairo WOFF2 with `font-display: swap` and CSS `size-adjust` overrides to achieve CLS = 0.
   - Checkout UX friction elimination: Single-page progressive disclosure checkout, Saudi National Address API (SPL) 4-letter short code auto-completion (building number, street, postal code, district), guest checkout, and one-touch Apple Pay sheet.
   - Core Web Vitals performance budgets: Target thresholds (P95 TTFB < 200ms, LCP < 1.2s, INP < 100ms, CLS < 0.05). Optimization playbook: Edge SSR streaming, responsive image CDN with AVIF/WebP, bundle splitting, and client-side hydration pruning.

3. `06_quick_ecommerce_gap_analysis_and_roadmap.md`:
   - Requirement R5 comprehensive technical blueprint and gap analysis.
   - Forensic audit and gap analysis table evaluating the current Quick-ecomerece workspace stack against top-tier architectural benchmarks with risk ratings (Critical / High / Medium). Detail the specific code locations and mechanisms:
     - G1 (CRITICAL): `firestore.rules` client-side order writing without catalog price check; client fallback allows price spoofing.
     - G2 (CRITICAL): Under flash sales, Firestore transaction contention triggers timeout, falling back to client-side order creation with zero cloud inventory decrement, leading to infinite overselling.
     - G3 (HIGH): In-memory rate limiting in `api/_security.ts` fails across serverless instances.
     - G4 (HIGH): Monolithic bundle including 202KB `StoreDashboard.tsx` in storefront, degrading mobile LCP.
     - G5 (MEDIUM): `firebase.json` lacks rewrites for `/api/*` to Cloud Functions.
   - Phased Modernization Roadmap:
     - Phase 1: Security & Hardening (Immediate P0 fixes, lockdown Firestore rules, server-authoritative pricing, CSP headers, HMAC webhook verification).
     - Phase 2: Performance, Edge & BFF Gateway (Next.js/Edge BFF, code-splitting merchant admin, SPL address auto-complete, Redis cache layer).
     - Phase 3: Multi-Tenant Headless & High-Concurrency Scaling (PostgreSQL migration with RLS, Redis Lua inventory reservation, Kafka event streaming, ZATCA Phase 2 EGS clearance unit).
   - Target State Enterprise Architecture diagram (ASCII and Mermaid).
