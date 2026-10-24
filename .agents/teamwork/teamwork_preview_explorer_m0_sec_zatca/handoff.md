# Handoff Report — Explorer 2 (Enterprise Security, Compliance & Saudi Localization)

**Workspace Directory**: `c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_sec_zatca`  
**Milestone**: M0 (Exploration, Benchmarking & Technical Specifications)  
**Requirement Focus**: Requirement R2 (Enterprise Security, Payment Compliance & Tenant Data Isolation)  
**Primary Deliverable**: `c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_sec_zatca\analysis.md`  

---

## 1. Observation

Direct observations from codebase inspection, regulatory frameworks, and technical benchmarking:

1. **Payment Gateway & Tokenization Implementation**:
   - `src/components/storefront/MoyasarPaymentModal.tsx` (Lines 151–180): Embeds Moyasar JS/CSS SDK hosted elements into container `#mysr-form-container`. The form operates under SAQ A boundaries with client-side event `on_completed` returning an opaque payment ID (`pay_...`).
   - `src/components/storefront/MoyasarPaymentModal.tsx` (Lines 220–245): Contains a local fallback mechanism that updates order status to `'Paid'` directly via `StoreManager.updateOrderInStore` if the serverless verification endpoint fails. This represents a client-authoritative vulnerability if not disabled in production.
   - `api/moyasarWebhook.ts` (Lines 71–85): Verifies webhook authorization by comparing header `x-moyasar-secret` or query parameter `secret` against merchant config, but does not calculate a cryptographic HMAC-SHA256 signature across the raw request body, nor does it enforce a timestamp tolerance window (e.g. $\le 300\text{s}$) to prevent replay attacks.
   - `api/moyasarWebhook.ts` (Lines 131–148): Verifies that currency is `'SAR'` and that `actualAmountHalalas === Math.round(order.grandTotal * 100)`.

2. **Saudi Localization & E-Commerce Law**:
   - `firestore.rules` (Lines 116–134): Allows order updates for return workflows (`returnEligibleUntil`, `returnRequestedAt`, `returnReason`, `returnStatus`) when status is `'Delivered'`.
   - `src/types/store.ts` (Lines 198–208): Defines return claim fields adhering to Saudi E-Commerce Law Article 13 & 14 (7-day statutory return window).
   - `src/components/storefront/MoyasarPaymentModal.tsx` (Lines 136–140): Enforces sanitization of the Apple Pay store label to ASCII characters (`/^[\x20-\x7E]+$/`), avoiding runtime crashes in Apple's WebKit payment session engine.

3. **ZATCA FATOORA E-Invoicing**:
   - `src/utils/zatca.ts` (Lines 68–111): Encodes TLV tags into binary byte arrays and outputs Base64. Handles Tags 1–5 (Phase 1) and optional Tags 6–9 (Phase 2).
   - `src/utils/zatca.ts` (Lines 177–186): Function `generateInvoiceHash` is currently a simulated mock hash (`hash_zatca_p2_${hex}_${Date.now().toString(16)}`), not a SHA-256 digest of canonicalized UBL 2.1 XML.
   - `tests/zatcaComplianceTiers.test.ts` & `tests/moyasar.test.ts`: 22 unit tests verify VAT calculation (inclusive 15% VAT: $\text{Net} = \text{Total}/1.15$), TLV encoding/decoding, and 3 registration tiers (`non_registered`, `phase_1`, `phase_2`). All 22 tests pass in 264ms.

4. **Tenant Data Isolation & Identity**:
   - `firestore.rules` (Lines 89–135): Enforces isolation through path hierarchy (`/stores/{storeId}/orders/{orderId}`). Reads and writes to `/stores/{storeId}/private/{docId}` require `isStoreOwner(storeId)` (`request.auth.uid == store.ownerId`).
   - `src/services/authService.ts` (Lines 63–180): Uses Firebase Client Auth with a fallback to `localStorage` (`storelink_current_merchant`).
   - `src/types/store.ts` (Lines 223–230): `MerchantUser` schema lacks multi-role attributes (`Manager`, `Cashier`, `Driver`) and granular permission scopes.

---

## 2. Logic Chain

1. **Minimizing PCI-DSS Compliance Burden**:
   - *Premise*: Handling raw PAN or CVV on merchant application servers triggers PCI-DSS SAQ D with over 300 requirements and annual QSA audits.
   - *Deduction*: By utilizing third-party Hosted Fields / secure iframes (Moyasar Form, Stripe Elements, Checkout.com Flow), CHD is captured directly into gateway vaults. Quick-ecomerece qualifies for **SAQ A** (under 35 requirements).
   - *Inference*: To defend against client-side script injection (Magecart) under PCI-DSS v4.0.1, strict Content Security Policy (CSP) with nonces and Subresource Integrity (SRI) must be mandated on all checkout routes.

2. **Ensuring Transaction Integrity & Anti-Fraud**:
   - *Premise*: Webhooks operating without cryptographic body signing or timestamp tolerance windows are susceptible to replay attacks and man-in-the-middle forging.
   - *Deduction*: Adding HMAC-SHA256 signature verification over raw request buffers, a 300-second timestamp tolerance window, and Redis-backed distributed idempotency locks (`idempotency:webhook:{eventId}`) guarantees that every payment event is authenticated, current, and executed exactly once.

3. **Achieving ZATCA Phase 2 Production Readiness**:
   - *Premise*: ZATCA Phase 2 integration requires Universal Business Language (UBL 2.1) XML generation, SHA-256 canonical hashing (C14N 1.1), previous invoice hash (PIH) chaining, ECDSA `secp256k1` digital signing, and 9-tag Base64 TLV QR generation.
   - *Deduction*: While Quick-ecomerece currently implements Phase 1 and 9-tag TLV formatting, moving to production clearance and reporting requires deploying an EGS unit capable of generating UBL 2.1 XML and executing ECDSA cryptographic stamps using certificates issued during the CCSID/PCSID onboarding lifecycle.

4. **Guaranteed Multi-Tenant Isolation**:
   - *Premise*: In shared database architectures, relying solely on developer query discipline invites catastrophic data leaks across merchants.
   - *Deduction*: Isolation must be enforced deterministically at the infrastructure tier. For PostgreSQL, Row-Level Security (RLS) with connection pool session resets (`SET LOCAL app.current_tenant_id` followed by `RESET ALL`) ensures hardware-level row scoping. For NoSQL/Firestore, path-scoped subcollection rules (`/stores/{storeId}/...`) ensure strict cross-tenant segmentation.

---

## 3. Caveats

1. **Hardware Security Module (HSM) vs. Software Key Storage**:
   In high-volume enterprise deployments (>100,000 invoices/day), ZATCA private keys for EGS units should reside in an HSM (FIPS 140-2 Level 2/3) or cloud KMS (AWS CloudHSM, Google Cloud KMS) rather than environment variables or filesystem storage.
2. **Apple Pay Web Domain Verification in Non-Production**:
   Apple Pay merchant validation requires a live HTTPS domain hosting the `/.well-known/apple-developer-merchantid-domain-association` file. It cannot be verified on `localhost` without tunneling (e.g. Cloudflare Tunnels).
3. **No Project Source Modification in Milestone M0**:
   In compliance with Explorer read-only protocol, zero application code was modified; all findings, schemas, SQL policies, and implementation code snippets are documented within `analysis.md`.

---

## 4. Conclusion

Requirement R2 for Quick-ecomerece is technically benchmarked and architecturally specified:
1. **PCI-DSS Scope Minimization**: Standardized on SAQ A using Hosted Fields, with full CSP v4.0.1 and SRI specifications.
2. **Saudi Localization**: Fully aligned with Saudi E-Commerce Law (Articles 13 & 14 7-day return engine, transparent SAR pricing, 15-day delivery cancel threshold) and SAMA payment routing directives (Mada domestic BIN switch, Apple Pay mTLS merchant validation, Tabby/Tamara BNPL auth/capture flows).
3. **ZATCA Phase 2 E-Invoicing**: Comprehensive specification of UBL 2.1 XML, ECDSA `secp256k1` signing, SHA-256 hash chaining, 9-tag Base64 TLV QR generation, Clearance vs. Reporting APIs, and CCSID/PCSID onboarding.
4. **Tenant Isolation & Enterprise Identity**: Dual-tier isolation (Postgres RLS with PgBouncer session hygiene + Firestore rules), 15-minute JWTs with cryptographically bound refresh token families and automatic replay breach isolation, and hybrid RBAC/ABAC policy engines.
5. **Architectural Blueprints**: Complete ASCII and Mermaid diagrams delivered for both Multi-Tenant Security Isolation and the ZATCA Phase 2 Clearance/Reporting Flow.

---

## 5. Verification Method

To independently verify the facts, schemas, algorithms, and tests cited in this report:

1. **Execute Unit Tests**:
   Run the project test suite covering Moyasar payment validations, halala calculations, and ZATCA compliance tiers:
   ```bash
   npx vitest run tests/zatcaComplianceTiers.test.ts tests/moyasar.test.ts
   ```
   *Expected Result*: 22 tests pass in < 500ms.

2. **Inspect Existing Workspace Implementations**:
   - Payment modal & Apple Pay label sanitation: `src/components/storefront/MoyasarPaymentModal.tsx`
   - Moyasar webhook amount & halala assertions: `api/moyasarWebhook.ts`
   - ZATCA TLV encoding & compliance tiers: `src/utils/zatca.ts`
   - Multi-tenant Firestore security rules: `firestore.rules`
   - Server-side security & CORS utils: `api/_security.ts`

3. **Verify Primary Technical Analysis**:
   Inspect the comprehensive benchmark and architectural blueprint at:
   `c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_sec_zatca\analysis.md`

4. **Invalidation Conditions**:
   - If ZATCA amends Resolution 04-02-21 to adopt alternative elliptic curves beyond `secp256k1`.
   - If PCI SSC updates SAQ A requirements regarding hosted elements in subsequent revisions of v4.0.
   - If SAMA alters domestic Mada interchange fee caps or co-branded domestic routing directives.
