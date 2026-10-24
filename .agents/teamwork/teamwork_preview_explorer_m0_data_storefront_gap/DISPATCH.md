## 2026-10-22T22:21:32Z
You are Explorer 3 (Data Storage, Flash-Sale Concurrency, Storefront UI/UX & Quick-ecomerece Stack Audit).
Your working directory is: c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_data_storefront_gap
Mandatory inputs to read:
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_orchestrator_2\PROJECT.md
- Inspect the codebase at `c:\Users\User\Desktop\Quick-ecomerece` (package.json, src/, firestore.rules, etc.)

Your Mission:
Conduct deep technical benchmarking for Requirements R3, R4, and R5:
1. Data Storage, Event Streaming & Inventory State Consistency (R3):
   - Database topologies: Polyglot persistence, Postgres with read replicas and connection pooling (PgBouncer), document stores vs relational tables for product catalogs vs orders.
   - Distributed inventory reservation & flash-sale concurrency: Preventing overselling under 50k+ orders/min. Detailed algorithmic pseudocode and implementation comparison: Redis Redlock / Lua scripts with atomic decrement (`DECRBY`) & TTL vs Postgres row-level pessimistic locking (`SELECT ... FOR UPDATE`) vs Firestore optimistic concurrency control (transactions).
   - Event streaming & transactional messaging: Transactional Outbox pattern with Debezium/Kafka or polling publisher, idempotency keys, Dead Letter Queues (DLQ), eventual consistency reconciliation workers.
2. Modern UI/UX Architecture & Storefront Core Web Vitals (R4):
   - Headless storefronts (Next.js App Router / Hydrogen Remix) vs Edge-rendered themes (Liquid in Shopify, Twilight in Salla).
   - Design system tokenization (CSS variables, Tailwind tokens), bidirectional RTL/LTR layout mechanics, typography (Cairo, IBM Plex Arabic).
   - Checkout UX: Single-page frictionless checkout, address auto-completion (Saudi National Address API), guest checkout, progressive form disclosure.
   - Core Web Vitals performance budgets: P95 TTFB < 200ms, LCP < 1.2s, INP < 100ms, CLS < 0.05. Techniques: Server-side streaming, asset prefetching, image CDN AVIF/WebP.
3. Quick-ecomerece Deep Codebase Audit & Gap Analysis (R5):
   - Audit the existing Quick-ecomerece repository: analyze Vite SPA, React architecture, Firebase Auth, Firestore data models, Firestore security rules, client-side queries, lack of backend API server / edge layer, inventory decrement patterns, payment handling.
   - Categorize all bottlenecks and risks with severity (Critical, High, Medium).
   - Detail a 3-Phase modernization roadmap (Phase 1: Security/Hardening, Phase 2: Performance/Edge & Backend Gateway, Phase 3: Headless/Multi-tenant scaling) with concrete milestone definitions.
4. Concrete ASCII/Mermaid architectural diagrams for: Flash-sale inventory locking flow and Quick-ecomerece target state architecture.

Output Requirements:
Write your comprehensive technical analysis to:
c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_data_storefront_gap\analysis.md
and a complete handoff to:
c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_data_storefront_gap\handoff.md
When finished, send a completion message to parent.
