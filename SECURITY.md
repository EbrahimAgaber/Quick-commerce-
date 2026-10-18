# Security Architecture & Threat Model (StoreLink)

This document describes the security policies, access controls, threat mitigation, and production hardening implemented in **Quick E-Commerce (StoreLink)**.

---

## 1. Zero-Trust Server Authoritative Model

### Client-Trust Elimination (S1, S5)
In earlier versions, the browser client calculated prices, discounts, shipping fees, and updated stock directly in Firestore.
**In Production:**
- Clients **never** write directly to the `/orders` collection.
- All order creation is delegated to the serverless function [`api/createOrder.ts`](file:///c:/Users/User/Desktop/Quick-ecomerece/api/createOrder.ts).
- The server reads the catalog directly from Firestore, evaluates product prices, applies server-side promo code logic, calculates shipping fees and 15% VAT, validates stock availability, and runs an atomic transaction that reserves/decrements stock and persists the order.

### Rate Limiting & Denial-of-Wallet Defense (S2)
- Rate limits per IP and per customer phone (maximum 5 orders per 10 minutes) mitigate spam and inventory denial-of-wallet attacks.
- String length caps and honeypot field checks reject bot submissions before running Firestore transactions.

---

## 2. Authentication & Credential Security (S3, S9)

- **Firebase ID Token Verification**: All authenticated endpoints (`/api/generate`, `/api/refundOrder`) verify the caller's Firebase ID token via the Firebase Admin SDK (`getAdminAuth().verifyIdToken()`).
- **CORS Protection**: Serverless APIs fail closed or enforce strict allow-lists (`ALLOWED_ORIGIN`) rather than wildcard `*`.
- **Password Policy**: Minimum 8 characters enforced.
- **Email Verification**: Store owners must verify their email before taking storefronts live.
- **Local Fallback Guard**: LocalStorage-based auth is strictly restricted to local demo environments (`VITE_DEMO_MODE=true`).

---

## 3. Data Isolation & Firestore Rules Hierarchy (S4, S6, S7)

- **Public vs. Private Subcollections**:
  - `/stores/{id}`: Contains only public storefront branding, name, catalog, and public policies.
  - `/stores/{id}/private/config`: Contains sensitive merchant configuration (promo codes, notification email, bank details) accessible strictly by the verified store owner.
- **Slug Claiming & ID Randomization**:
  - Global slugs are mapped atomically in `/slugs/{slug}` to prevent duplicate or hostile takeover.
  - Reserved slugs (`admin`, `api`, `app`, `login`, `aurora`, `storelink`) are blocked.
  - Store IDs are generated using `crypto.randomUUID()`.
- **Order Tracking & PII Redaction**:
  - Public `/tracking/{orderId}` projection contains only delivery status, ETA, and courier name. Full customer phone, name, and street address are never returned without authentication.

---

## 4. Payment Gateway Security (Moyasar Multi-Tenant)

- **Webhook Signature Verification**: Moyasar webhook payloads in [`api/moyasarWebhook.ts`](file:///c:/Users/User/Desktop/Quick-ecomerece/api/moyasarWebhook.ts) are authenticated using HMAC SHA-256 signatures or secret token verification.
- **Server-Side Re-fetch**: Upon receiving a webhook event, the server uses the merchant's secret key to fetch the payment record directly from `https://api.moyasar.com/v1/payments/{id}`.
- **Halala Precision & Amount Validation**: The server compares the exact payment amount in halalas (`grandTotal * 100`) against the verified invoice total.
- **Idempotency & Replay Protection**: Webhooks check previous payment records; replayed events are acknowledged with `200 OK` as no-ops without altering stock or balances twice.

---

## 5. ZATCA E-Invoicing Compliance (Saudi Arabia)

- Implements Phase 1 Simplified Tax Invoice specifications:
  - Tag 1: Seller Name
  - Tag 2: VAT Registration Number (15 digits)
  - Tag 3: ISO 8601 Timestamp
  - Tag 4: Invoice Total (with VAT)
  - Tag 5: Total 15% VAT Amount
- Encoded as TLV (Tag-Length-Value) and Base64 formatted QR payload rendered client-side on A4 and 80mm thermal receipts.

---

## 6. Reporting Security Vulnerabilities

To report a vulnerability, please contact the security team directly at `security@storelink.sa` or open a private advisory on GitHub. Do not file public issues for active vulnerabilities.
