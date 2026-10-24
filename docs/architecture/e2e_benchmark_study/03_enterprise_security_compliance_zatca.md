# Enterprise Security, Compliance & Saudi Localization Architecture
## Requirement R2 Technical Engineering Blueprint for Quick-ecomerece

**Document ID:** ARCH-E2E-003  
**Classification:** Technical Architecture & Compliance Specification  
**Target Scope:** Requirement R2 (Enterprise Security, Payment Compliance & Saudi Localization)  
**Author:** Worker 1 (Architecture Blueprint Author - Deliverables Part 1)  
**Status:** Approved Technical Engineering Specification  

---

## Table of Contents
1. [Executive Summary & Regulatory Scope](#1-executive-summary--regulatory-scope)
2. [PCI-DSS Level 1 Compliance & Payment Tokenization Boundaries](#2-pci-dss-level-1-compliance--payment-tokenization-boundaries)
   - 2.1 [Scope Minimization: SAQ A vs SAQ A-EP vs SAQ D](#21-scope-minimization-saq-a-vs-saq-a-ep-vs-saq-d)
   - 2.2 [Hosted Fields & Secure Iframe Tokenization Architecture](#22-hosted-fields--secure-iframe-tokenization-architecture)
   - 2.3 [PCI DSS v4.0.1 Client-Side Script Hardening (CSP & SRI) for Hosted Fields](#23-pci-dss-v401-client-side-script-hardening-csp--sri-for-hosted-fields)
   - 2.4 [Payment Webhook Security, HMAC-SHA256 Signing & Replay Protection](#24-payment-webhook-security-hmac-sha256-signing--replay-protection)
3. [Saudi & MENA Localization & Regulatory Compliance](#3-saudi--mena-localization--regulatory-compliance)
   - 3.1 [Saudi E-Commerce Law & Ministry of Commerce Mandates](#31-saudi-e-commerce-law--ministry-of-commerce-mandates)
   - 3.2 [Automated Statutory 7-Day Return Engine (Articles 13 & 14)](#32-automated-statutory-7-day-return-engine-articles-13--14)
   - 3.3 [SAMA Domestic Card Routing (Mada) & Fee Cap Governance](#33-sama-domestic-card-routing-mada--fee-cap-governance)
   - 3.4 [Apple Pay on the Web: Web Merchant Validation Architecture](#34-apple-pay-on-the-web-web-merchant-validation-architecture)
   - 3.5 [Buy Now Pay Later (BNPL) Integration Patterns (Tabby & Tamara)](#35-buy-now-pay-later-bnpl-integration-patterns-tabby--tamara)
4. [ZATCA FATOORA Phase 2 E-Invoicing Technical Specification](#4-zatca-fatoora-phase-2-e-invoicing-technical-specification)
   - 4.1 [Regulatory Architecture: Clearance (B2B) vs Reporting (B2C)](#41-regulatory-architecture-clearance-b2b-vs-reporting-b2c)
   - 4.2 [Cryptographic Foundations: ECDSA secp256k1 & SHA-256](#42-cryptographic-foundations-ecdsa-secp256k1--sha-256)
   - 4.3 [Previous Invoice Hash (PIH) Chaining & Genesis Seed](#43-previous-invoice-hash-pih-chaining--genesis-seed)
   - 4.4 [Canonical XML UBL 2.1 Schema Specification](#44-canonical-xml-ubl-21-schema-specification)
   - 4.5 [The 9-Tag Base64 TLV QR Code Encoding Engine](#45-the-9-tag-base64-tlv-qr-code-encoding-engine)
   - 4.6 [Cryptographic CSID Onboarding Lifecycle (CCSID & PCSID)](#46-cryptographic-csid-onboarding-lifecycle-ccsid--pcsid)
5. [Multi-Tenant Data Isolation & Enterprise Identity Architecture](#5-multi-tenant-data-isolation--enterprise-identity-architecture)
   - 5.1 [Application-Layer Tenant Context Enforcement (AsyncLocalStorage)](#51-application-layer-tenant-context-enforcement-asynclocalstorage)
   - 5.2 [Dual-Tier Database Isolation: PostgreSQL RLS with PgBouncer Sanitization & Firestore Rules](#52-dual-tier-database-isolation-postgresql-rls-with-pgbouncer-sanitization--firestore-rules)
   - 5.3 [Authentication & Session Security: Token Families & Replay Detection](#53-authentication--session-security-token-families--replay-detection)
   - 5.4 [Granular RBAC & ABAC Store Staff Access Control Engine](#54-granular-rbac--abac-store-staff-access-control-engine)
6. [Architectural Diagram Specifications](#6-architectural-diagram-specifications)
   - 6.1 [Multi-Tenant Security Isolation Boundary (ASCII & Mermaid)](#61-multi-tenant-security-isolation-boundary-ascii--mermaid)
   - 6.2 [ZATCA Phase 2 Clearance & Reporting Flow (ASCII & Mermaid)](#62-zatca-phase-2-clearance--reporting-flow-ascii--mermaid)

---

## 1. Executive Summary & Regulatory Scope

Operating an enterprise e-commerce platform in the Kingdom of Saudi Arabia requires meeting stringent regulatory, cryptographic, and data isolation mandates. Compliance is not an ancillary feature or post-deployment checklist; it must be engineered directly into the core transactional and persistence pipeline.

This technical blueprint establishes the architectural specifications for **Requirement R2: Enterprise Security, Payment Compliance & Saudi Localization**, governed by four core frameworks:
1. **PCI-DSS Level 1 (v4.0.1):** Achieving strict **SAQ A** scope minimization via Hosted Fields and secure iframe tokenization, guaranteeing zero Cardholder Data (CHD) traverses application servers.
2. **Saudi Regulatory & Consumer Protection Frameworks:** Conforming to the **Saudi E-Commerce Law** (Royal Decree M/126), **Personal Data Protection Law (PDPL)**, and **Saudi Central Bank (SAMA)** mandates governing domestic **Mada** card switch routing and Apple Pay Web mTLS sessions.
3. **ZATCA FATOORA Phase 2 E-Invoicing:** Full technical implementation of UBL 2.1 XML documents, ECDSA `secp256k1` digital stamping, SHA-256 canonical hash chaining, 9-tag Base64 TLV QR generation, and automated Clearance / Reporting API integration.
4. **Defense-in-Depth Multi-Tenancy:** Hard tenant isolation enforced across application runtimes (`AsyncLocalStorage`), database engines (PostgreSQL RLS with PgBouncer session sanitization), cryptographic JWT token families with automated replay invalidation, and granular hybrid RBAC/ABAC policy engines.

---

## 2. PCI-DSS Level 1 Compliance & Payment Tokenization Boundaries

### 2.1 Scope Minimization: SAQ A vs SAQ A-EP vs SAQ D

Compliance overhead, annual audit costs, and legal threat exposure scale directly with an application's physical and logical proximity to Cardholder Data (CHD) and Sensitive Authentication Data (SAD):

```
+----------------------------------------------------------------------------------------------------+
|                                  PCI-DSS SCOPE & THREAT EXPOSURE SPECTRUM                          |
+-------------+--------------------------+--------------------+--------------------+-----------------+
| Scope Level | Implementation Pattern   | Servers Touch CHD? | Web Attack Surface | PCI Controls    |
+-------------+--------------------------+--------------------+--------------------+-----------------+
| SAQ A       | Hosted Fields / Iframes  | NO (Zero exposure) | LOW (Confined to   | ~24-33 reqs     |
| (Selected)  | (Moyasar, Stripe)        |                    | script tampering)  | (Self-audit)    |
|-------------+--------------------------+--------------------+--------------------+-----------------|
| SAQ A-EP    | Merchant form with direct| NO (Browser posts  | HIGH (Payment page | ~190+ reqs      |
|             | JS API dispatch to vault | direct to gateway) | compromise risks)  | (ASV scan req)  |
|-------------+--------------------------+--------------------+--------------------+-----------------|
| SAQ D       | Direct API / Server-side | YES (Touches,      | MAXIMUM (Direct    | All 300+ reqs   |
|             | card processing          | routes, or stores) | database/host leak)| (Annual QSA)    |
+-------------+--------------------------+--------------------+--------------------+-----------------+
```

#### Strict SAQ A Architecture (The Quick-ecomerece Standard):
- All payment inputs—Primary Account Number (PAN), Card Verification Value (CVV/CVC), and Expiration Date—render strictly inside cross-origin `<iframe>` elements hosted directly on PCI-DSS Level 1 certified domains (e.g., `https://api.moyasar.com`, `https://js.stripe.com`, `https://flow.checkout.com`).
- The merchant storefront application never has Document Object Model (DOM) access to input fields. The parent window interacts with the iframe exclusively via `window.postMessage` encrypted channels managed by the gateway's client SDK.
- The merchant web server serves only static orchestration code. Upon tokenization, the gateway returns a single-use opaque payment token (e.g., `tok_live_89a7f...`). Only this token and non-sensitive card metadata (brand, last 4 digits, expiry month/year) are transmitted to the backend.

---

### 2.2 Hosted Fields & Secure Iframe Tokenization Architecture

```
[ Customer Browser ]
        │
        │ 1. Card data entered into PCI-Level 1 iFrame (PAN, CVV, Exp)
        ▼
[ Gateway Vault (Moyasar / Stripe / Checkout.com) ]
        │
        │ 2. Returns Opaque Single-Use Token: `tok_live_89a7f...`
        ▼
[ Customer Browser ]
        │
        │ 3. Submits Order + `tok_live_...` to Application Backend
        ▼
[ Quick-ecomerece API Server ] ── (Zero Card Data Touched)
        │
        │ 4. Server-to-Server Charge: Authorization + Capture
        ▼
[ Gateway REST API ]
```

#### Gateway Implementation Matrix:
| Gateway | Tokenization Mechanism | SAQ Boundary | Supported Saudi Schemes | Apple Pay Integration Flow |
| :--- | :--- | :--- | :--- | :--- |
| **Moyasar Form** | Dynamic Secure Iframe (`#mysr-form-container`) | SAQ A | Mada, Visa, Mastercard, Apple Pay, STC Pay | Native JS SDK + Apple Pay Web Session API |
| **Stripe Elements** | Isolated Secure Elements (`cardElement`, `paymentElement`)| SAQ A | Visa, Mastercard, Amex (Mada supported via local entity)| Payment Request Button / Apple Pay Web API |
| **Checkout.com Flow**| Frames / Hosted Fields / Unified Component | SAQ A | Mada, Visa, Mastercard, Apple Pay, Tabby, Tamara | Apple Pay Web Certificate Session Handshake |

---

### 2.3 PCI DSS v4.0.1 Client-Side Script Hardening (CSP & SRI) for Hosted Fields

Under PCI DSS v4.0.1 (effective March 31, 2025 as mandatory), digital skimming attacks (Magecart, form-jacking, and client-side supply-chain compromise) must be actively mitigated on all checkout and payment surfaces:
- **Requirement 6.4.3:** All scripts loaded on consumer-facing checkout pages must be cataloged in an authorized inventory with documented business justification, confirmed authorized, and continuously monitored for integrity.
- **Requirement 11.6.1:** An automated tampering-detection mechanism must monitor HTTP response headers and client-side page contents to alert security operations within 7 days (or continuously) on unauthorized alterations or script additions.

#### Best Practices for Hosted Fields Script Loading:

1. **Subresource Integrity (SRI) on Dynamic Script Ingestion:**
   In single-page applications (React, Vite, Next.js), payment SDKs (e.g. Moyasar, Stripe Elements, Checkout.com Frames) are frequently loaded dynamically when checkout modals mount. Calling `document.createElement('script')` without setting cryptographic integrity properties violates Requirement 6.4.3.
   
   Every dynamically injected payment script element **must** enforce cryptographic SHA-384 integrity and CORS anonymous attributes prior to DOM insertion:
   ```typescript
   // Production-Hardened Dynamic Hosted Fields Script Loader
   export function loadPaymentSdk(src: string, expectedSriHash: string): Promise<void> {
     return new Promise((resolve, reject) => {
       const existingScript = document.querySelector(`script[src="${src}"]`);
       if (existingScript) {
         return resolve();
       }

       const script = document.createElement('script');
       script.src = src;
       script.integrity = expectedSriHash; // e.g., 'sha384-OCiM...'
       script.crossOrigin = 'anonymous';   // MANDATORY: Enables CORS cryptographic validation
       script.async = true;

       script.onload = () => resolve();
       script.onerror = () => reject(new Error(`Failed to load payment SDK from ${src} (CSP/SRI rejection)`));

       document.head.appendChild(script);
     });
   }
   ```
   *Alternative Immutable Pattern:* Where feasible, self-host vendor SDK bundles or bundle pinned dependencies into the application build artifact, guaranteeing that code deployed in production cannot be altered by third-party CDN compromises.

2. **Zero-Trust Content Security Policy (CSP) Directives:**
   The HTTP `Content-Security-Policy` header must strictly whitelist authorized domains, prevent script execution drift across hosting environments (e.g., Vercel vs Firebase vs Cloudflare), and eliminate unsafe directives:
   - **Eliminate `'unsafe-inline'` and `'unsafe-eval'`:** Checkout routes must use cryptographic per-request nonces (`'nonce-{random}'`) or SHA-256 script hashes.
   - **Host Origin Whitelist Integrity:** Ensure `script-src`, `frame-src`, and `connect-src` explicitly include all required vendor origins (`https://cdn.jsdelivr.net`, `https://api.moyasar.com`, `https://cdn.moyasar.com`, `https://js.stripe.com`, `https://apple-pay-gateway.apple.com`). Omitting a CDN or API host in hosting configuration (such as `vercel.json` or `firebase.json`) will cause the browser to block checkout initialization, breaking customer payment.

#### Enforced Content Security Policy (CSP) Header for Checkout:
```http
Content-Security-Policy: default-src 'self'; \
  script-src 'self' 'nonce-rAnd0m1234' https://cdn.jsdelivr.net https://cdn.moyasar.com https://api.moyasar.com https://js.stripe.com; \
  frame-src https://api.moyasar.com https://js.stripe.com https://apple-pay-gateway.apple.com; \
  connect-src 'self' https://api.moyasar.com https://api.stripe.com https://apple-pay-gateway.apple.com; \
  style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; \
  img-src 'self' data: https:; \
  object-src 'none'; \
  base-uri 'self'; \
  require-trusted-types-for 'script'; \
  report-uri /api/security/csp-report;
```

#### Authorized Script Inventory & Supply-Chain CI/CD Gate:
- Maintain an explicit `checkout-scripts-manifest.json` containing each approved script's URL, semver tag, business purpose, and cryptographic SHA-384 hash.
- Build-time CI/CD workflows run automated hash verification to catch upstream vendor modifications or compromised CDN mirrors before release.
- Real-time tampering reports from the browser's CSP engine (`report-uri /api/security/csp-report`) pipe into a dedicated SIEM handler, satisfying Requirement 11.6.1 alerting.

#### Strict Authoritative Settlement (Zero Client-Side Trust):
Client-side payment modals must never have write access to order payment statuses. If client verification encounters network timeouts or errors, the frontend must display a pending state and await asynchronous confirmation; order status transitions to `'Paid'` must be executed exclusively by the authenticated serverless webhook (`api/moyasarWebhook.ts`) after cryptographic HMAC-SHA256 signature validation.

---

### 2.4 Payment Webhook Security, HMAC-SHA256 Signing & Replay Protection

Gateway webhooks notify the application server of asynchronous payment outcomes (3DS authorization success, bank settlement, chargeback). Strict defensive mechanisms are enforced to prevent replay attacks, payload spoofing, and duplicate execution:

```
Incoming Webhook Request
         │
         ▼
[ 1. Check HTTP Header Signature: HMAC-SHA256(rawBody, secret) ]
         ├── (Invalid) ──> HTTP 401 Unauthorized (Log Security Incident)
         │
         ▼ (Valid)
[ 2. Timestamp Tolerance Window Check: |now - event_time| <= 300s ]
         ├── (Exceeded) ──> HTTP 400 Bad Request (Stale / Replay Attack)
         │
         ▼ (In Window)
[ 3. Distributed Idempotency Lock: Redis SETNX (lock:webhook:{eventId}, TTL 24h) ]
         ├── (Key Exists) ──> HTTP 200 OK (Acknowledge Duplicate Event Idempotently)
         │
         ▼ (Lock Acquired)
[ 4. Outbound Authoritative Re-Verification ]
         │
         +──> Server calls GET https://api.gateway.com/v1/payments/{payment_id}
         │    using Merchant's Encrypted Secret Key (mTLS/HTTPS)
         ▼
[ 5. Exact Amount & Currency Sanity Assertion ]
         │
         +──> Verify: `actual_amount_halalas === order.grandTotal * 100`
         +──> Verify: `currency === 'SAR'`
         │
         ▼
[ 6. Atomic State Transition & Ledger Append ]
         │
         +──> Mark Order Status = 'Paid'
         +──> Commit Transaction & Release Redis Lock
         +──> Return HTTP 200 OK
```

#### Hardened Webhook Processor Implementation:
```typescript
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { redisClient } from '../services/redis';
import { db } from '../services/database';

export async function handlePaymentWebhook(req: Request, res: Response) {
  const signatureHeader = req.headers['x-moyasar-signature'] as string;
  const rawBody = (req as any).rawBody; // Preserved raw buffer before JSON parsing
  const webhookSecret = process.env.MOYASAR_WEBHOOK_SECRET!;

  // 1. Cryptographic HMAC-SHA256 Signature Validation
  const computedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const signatureMatches = crypto.timingSafeEqual(
    Buffer.from(signatureHeader || '', 'hex'),
    Buffer.from(computedSignature, 'hex')
  );

  if (!signatureMatches) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  const event = req.body;
  const eventTimestamp = new Date(event.created_at).getTime();
  const currentTimestamp = Date.now();

  // 2. Replay Tolerance Window (5 minutes / 300,000 ms)
  if (Math.abs(currentTimestamp - eventTimestamp) > 300_000) {
    return res.status(400).json({ error: 'Webhook event outside timestamp tolerance window' });
  }

  // 3. Distributed Idempotency Key via Redis
  const idempotencyKey = `idempotency:webhook:${event.id}`;
  const isUnique = await redisClient.set(idempotencyKey, 'LOCKED', 'EX', 86400, 'NX');
  if (!isUnique) {
    return res.status(200).json({ status: 'Already processed (idempotent duplicate)' });
  }

  try {
    const paymentId = event.data.id;
    const storeId = event.data.metadata.storeId;
    const orderId = event.data.metadata.orderId;

    // 4. Outbound Authoritative Re-fetch directly from Gateway API
    const verifiedPayment = await fetchGatewayPayment(paymentId, storeId);

    // 5. Strict Amount & Currency Invariant Assertions
    const order = await db.orders.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ error: 'Referenced order not found' });
    }

    const expectedHalalas = Math.round(order.grandTotal * 100);
    if (verifiedPayment.currency !== 'SAR' || verifiedPayment.amount !== expectedHalalas) {
      await db.orders.update({
        where: { id: orderId },
        data: {
          status: 'Payment Mismatch',
          paymentNotes: `Fraud flag: Gateway amount ${verifiedPayment.amount} halalas != Expected ${expectedHalalas} halalas`,
        },
      });
      return res.status(400).json({ error: 'Amount or currency mismatch detected' });
    }

    // 6. State Machine Update
    if (verifiedPayment.status === 'paid') {
      await db.$transaction([
        db.orders.update({
          where: { id: orderId },
          data: {
            status: 'Paid',
            paymentId: verifiedPayment.id,
            paidAt: new Date(verifiedPayment.created_at),
          },
        }),
        db.paymentEvents.create({
          data: {
            id: event.id,
            orderId: order.id,
            paymentId: verifiedPayment.id,
            amount: verifiedPayment.amount,
            status: verifiedPayment.status,
            rawPayload: event,
          },
        }),
      ]);
    }

    return res.status(200).json({ status: 'Processed successfully' });
  } catch (error) {
    await redisClient.del(idempotencyKey);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
```

---

## 3. Saudi & MENA Localization & Regulatory Compliance

### 3.1 Saudi E-Commerce Law & Ministry of Commerce Mandates

Under the **Saudi E-Commerce Law** (promulgated by Royal Decree No. M/126) and executive regulations overseen by the **Ministry of Commerce (MOC)** and the **Saudi Business Center (SBC)**, e-commerce platforms operating in the Kingdom must adhere to statutory requirements:

```
+----------------------------------------------------------------------------------------------------+
| SAUDI E-COMMERCE STATUTORY REQUIREMENTS MATRIX                                                     |
+------------------------+------------------------------------------+--------------------------------+
| Statutory Domain       | Legal Clause / Executive Article         | Technical Implementation       |
+------------------------+------------------------------------------+--------------------------------+
| Merchant Transparency  | Article 4 & 5 (Legal Identification)     | Mandatory footer & checkout:   |
|                        | Commercial Registration (CR) or          | - Legal Business Name          |
|                        | Freelance Certificate (وثيقة العمل الحر),| - CR Number / Freelance Doc ID |
|                        | 15-digit VAT number, contact email/phone | - 15-Digit VAT Tax Number      |
|                        | and physical address.                    | - SBC / Maroof verification QR |
|------------------------+------------------------------------------+--------------------------------+
| Statutory Right of     | Articles 13 & 14 (Right of Withdrawal)   | Automated 7-day return window  |
| Withdrawal (Returns)   | Consumers are entitled to return goods   | calculated from `deliveredAt`. |
|                        | within 7 days of receipt without penalty | Explicit legal exclusion flags |
|                        | unless statutory exceptions apply.       | for custom goods, sealed items.|
|------------------------+------------------------------------------+--------------------------------+
| Delivery Commitment &  | Article 14 (Delay & Cancellation)        | If delivery exceeds 15 days    |
| Right to Cancel        | If delivery is delayed beyond 15 days    | past agreed date, automated    |
|                        | past promised date, consumer has the     | single-click full cancellation |
|                        | right to terminate contract & full refund| and refund trigger initiates.  |
|------------------------+------------------------------------------+--------------------------------+
| Data Protection &      | Personal Data Protection Law (PDPL)      | - Explicit opt-in for SMS/mail |
| Privacy Compliance     | Royal Decree No. M/19 (2021 as amended). | - Right to erasure (tombstone) |
|                        | Strict restrictions on data retention.   | - Zero unconsented tracking    |
|------------------------+------------------------------------------+--------------------------------+
| Arabic First & Pricing | Consumer Protection & Arabic Language    | Arabic UI (RTL) canonical, all |
| Presentation           | Regulations: Total prices must include   | prices displayed in SAR with   |
|                        | statutory 15% VAT breakdown.             | breakdown: Net + 15% VAT.      |
+------------------------+------------------------------------------+--------------------------------+
```

---

### 3.2 Automated Statutory 7-Day Return Engine (Articles 13 & 14)

```typescript
export function evaluateReturnEligibility(order: {
  status: string;
  deliveredAt?: string | null;
  items: Array<{ isCustomProduct?: boolean; isPerishable?: boolean; isUnsealedSoftware?: boolean }>;
}): { eligible: boolean; deadline?: string; reason?: string } {
  if (order.status !== 'Delivered' || !order.deliveredAt) {
    return { eligible: false, reason: 'Order has not been delivered yet.' };
  }

  const deliveryTimestamp = new Date(order.deliveredAt).getTime();
  const statutoryWindowMs = 7 * 24 * 60 * 60 * 1000; // 7 statutory days
  const expirationTimestamp = deliveryTimestamp + statutoryWindowMs;

  if (Date.now() > expirationTimestamp) {
    return { 
      eligible: false, 
      deadline: new Date(expirationTimestamp).toISOString(),
      reason: 'The statutory 7-day return window under Saudi E-Commerce Law Article 13 has elapsed.' 
    };
  }

  // Statutory Non-Returnable Exceptions Check (Article 13(2))
  const hasIneligibleItems = order.items.some(
    (item) => item.isCustomProduct || item.isPerishable || item.isUnsealedSoftware
  );

  if (hasIneligibleItems) {
    return {
      eligible: false,
      reason: 'Order contains customized or exempt goods excluded under statutory return regulations.',
    };
  }

  return {
    eligible: true,
    deadline: new Date(expirationTimestamp).toISOString(),
  };
}
```

---

### 3.3 SAMA Domestic Card Routing (Mada) & Fee Cap Governance

**Mada (مدى)** is the national electronic payment switch in Saudi Arabia, governed by the **Saudi Central Bank (SAMA)**:
1. **Domestic Routing Mandate:** Under SAMA directives, any card issued by a Saudi domestic bank bearing the co-badged scheme (Mada/Visa or Mada/Mastercard) **must be routed through the domestic Mada switch** for domestic SAR settlements.
2. **Interchange Fee Caps:** Mada domestic processing fees are regulated and capped by SAMA (typically 1.0% + SAR 1.00 capped at a maximum of SAR 100 for debit transactions, or 0.8% for digital wallets), whereas international Visa/Mastercard interchange fees range from 2.2% to 3.5% + fixed fee.
3. **BIN Range Detection:** Gateways automatically detect Bank Identification Numbers (BINs) belonging to the Saudi national Mada range (e.g., `417633`, `446393`, `484783`, `588845`, `968201`...) and force domestic switch routing.
4. **Mandatory 3DS2 Challenge:** All domestic online card transactions require 3DS2 challenge or frictionless authentication with an OTP challenge via their issuing bank's SMS/App banking push channel.

---

### 3.4 Apple Pay on the Web: Web Merchant Validation Architecture

Integrating Apple Pay on Safari/iOS Web in Saudi Arabia requires an Apple-validated two-way TLS (mTLS) merchant session handshake:

```
[ Customer Browser (Safari) ]         [ Quick-ecomerece Server ]          [ Apple Pay Gateway ]
              │                                   │                                │
1. ApplePaySession.onvalidatemerchant             │                                │
   provides `validationURL`                       │                                │
              │──────────────────────────────────>│                                │
              │  POST /api/applepay/validate-session                               │
              │  { validationURL: "https://..." } │                                │
              │                                   │ 2. Outbound mTLS POST          │
              │                                   │    using Apple Merchant ID     │
              │                                   │    Certificate (.pem / .key)   │
              │                                   │───────────────────────────────>│
              │                                   │                                │
              │                                   │ 3. Returns Opaque              │
              │                                   │    Encrypted Merchant Session  │
              │                                   │<───────────────────────────────│
              │ 4. Returns Merchant Session Payload                                │
              │<──────────────────────────────────│                                │
5. session.completeMerchantValidation(session)    │                                │
              │                                   │                                │
6. Customer authorizes via FaceID/TouchID         │                                │
              │                                   │                                │
7. ApplePaySession.onpaymentauthorized            │                                │
   provides Payment Token (DPAN / cryptogram)     │                                │
              │──────────────────────────────────>│ 8. Dispatches token to gateway │
```

#### Strict Constraints for Saudi Apple Pay Web Processing:
1. **Domain Association File:** Hosted at `https://<store-domain>/.well-known/apple-developer-merchantid-domain-association`. The file contains the signed PKCS#7 certificate signature provided by the Apple Developer Portal.
2. **Supported Payment Networks:** Must include `'mada'`, `'visa'`, `'masterCard'`.
3. **Critical ASCII Label Constraint:** Apple's WebKit runtime rejects Apple Pay initialization if `total.label` contains Arabic Unicode characters! The platform must sanitize storefront names to clean ASCII or use a normalized brand slug:
   ```javascript
   const paymentRequest = {
     countryCode: 'SA',
     currencyCode: 'SAR',
     supportedNetworks: ['mada', 'visa', 'masterCard'],
     merchantCapabilities: ['supports3DS'],
     total: {
       label: 'StoreLink Merchant', // MUST BE STRICT ASCII: /^[\x20-\x7E]+$/
       amount: (order.grandTotal).toFixed(2),
     },
   };
   ```

---

### 3.5 Buy Now Pay Later (BNPL) Integration Patterns (Tabby & Tamara)

BNPL providers in Saudi Arabia are licensed under SAMA’s finance regulations. Integration follows a strict two-phase authorization/capture pattern:

```
[ Shopper Checkout ]
         │
         │ 1. Selects Tabby or Tamara (Pay in 4 / 3 installments)
         ▼
[ Merchant Backend ]
         │
         │ 2. POST /checkout { amount: "200.00", currency: "SAR", items: [...] }
         ▼
[ BNPL Gateway (Tamara / Tabby) ]
         │
         │ 3. Returns checkout_url + checkout_id
         ▼
[ Shopper Redirect / SDK Modal ] ───> Completes OTP & ID Check
         │
         │ 4. Success Callback / Webhook: `order.approved`
         ▼
[ Merchant Backend: Authorization Hold ]
         │
         │ 5. Merchant Ships Order (Out for Delivery)
         ▼
[ Merchant Backend: POST /orders/{id}/capture ]
         │
         │ 6. Funds Captured to Merchant Account; BNPL payment schedule begins
         ▼
[ Refund Handling: POST /orders/{id}/refunds ]
         │
         +───> Gateway reverses outstanding customer installments automatically
```

---

## 4. ZATCA FATOORA Phase 2 E-Invoicing Technical Specification

### 4.1 Regulatory Architecture: Clearance (B2B) vs Reporting (B2C)

The **Zakat, Tax and Customs Authority (ZATCA)** e-invoicing mandate is governed by the E-Invoicing Regulation (Resolution No. 04-02-21).
- **Phase 1 (Generation Phase):** Offline generation of structured invoices and 5-tag QR codes.
- **Phase 2 (Integration & Clearance Phase):** Real-time cryptographic integration with the central **ZATCA FATOORA Portal**.

```
                           +-------------------------------------+
                           |    ZATCA FATOORA Phase 2 Invoicing   |
                           +-------------------------------------+
                                              │
                     +------------------------+------------------------+
                     │                                                 │
                     ▼                                                 ▼
      [ Standard Tax Invoice (B2B / B2G) ]            [ Simplified Tax Invoice (B2C) ]
      InvoiceTypeCode: 0100000                        InvoiceTypeCode: 0200000
                     │                                                 │
                     ▼                                                 ▼
          Synchronous CLEARANCE                             Asynchronous REPORTING
          Must be cleared by ZATCA API                      Must be reported to ZATCA API
          BEFORE sharing with buyer.                        within 24 HOURS of issuance.
                     │                                                 │
         POST /invoices/clearance/single                   POST /invoices/reporting/single
                     │                                                 │
     Response includes:                                Response includes:
     - Cleared XML with ZATCA Cryptographic Stamp      - Reporting validation receipt
     - ZATCA QR Code Payload                           - Buyer gets invoice immediately
```

---

### 4.2 Cryptographic Foundations: ECDSA secp256k1 & SHA-256

ZATCA enforces asymmetric cryptography for invoice signing:
1. **Asymmetric Key Algorithm:** **ECDSA (Elliptic Curve Digital Signature Algorithm)**.
2. **Mandated Curve:** `secp256k1` (Koblitz curve over 256-bit prime field).
3. **Hashing Algorithm:** **SHA-256** (FIPS 180-4).

#### Cryptographic Invoice Signing Pipeline:
```
[ Raw UBL 2.1 XML Invoice ]
         │
         │ 1. Strip signature placeholder nodes:
         │    - <ext:UBLExtensions>...</ext:UBLExtensions>
         │    - <cac:Signature>...</cac:Signature>
         │    - <cac:AdditionalDocumentReference> for QR
         ▼
[ Canonicalized XML (C14N 1.1) ]
         │
         │ 2. Compute SHA-256 Hash of canonicalized bytes
         ▼
[ Invoice Digest / Hash (Base64) ] ───> Embed in <ds:DigestValue>
         │
         │ 3. Construct SignedProperties element & compute SignedProperties Digest
         ▼
[ Compute ECDSA secp256k1 Signature using EGS Private Key ]
         │
         │ 4. Format signature as ASN.1 DER / IEEE P1363 (Base64)
         ▼
[ Embed in <ds:SignatureValue> inside <ext:UBLExtensions> ]
```

---

### 4.3 Previous Invoice Hash (PIH) Chaining & Genesis Seed

To guarantee sequential integrity and prevent backdating or invoice deletion, ZATCA mandates an append-only cryptographic hash chain:

```
[ Invoice #1 ] ──────────────────────────────> [ Invoice #2 ] ──────────────────────────────> [ Invoice #3 ]
ICV: 1                                        ICV: 2                                        ICV: 3
PIH: Base64(SHA-256("0"))                     PIH: Hash of Invoice #1                       PIH: Hash of Invoice #2
Hash: Hash_1 = SHA-256(Inv1_canonical)        Hash: Hash_2 = SHA-256(Inv2_canonical)        Hash: Hash_3 = SHA-256(Inv3_canonical)
```

1. **Invoice Counter Value (ICV):** Every E-Invoicing Generation Solution (EGS) unit must maintain a strict sequential integer counter: `1, 2, 3, ...` with zero gaps.
2. **Previous Invoice Hash (PIH):**
   - For **Invoice #1** (the genesis invoice of an EGS unit): The PIH value is defined by ZATCA Schematron rule `[KSA-25]` / `BR-KSA-39` as the SHA-256 hash of the character `"0"` (binary zero `0x00` in cryptographic specification context, ASCII character `'0'` / `0x30`), Base64 encoded:
     - Authentic 64-character lowercase hexadecimal digest:
       $$\text{SHA-256}(\text{"0"}) = \text{5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9}$$
     - Authentic 88-character Base64 encoding of the hex string (strictly validated by ZATCA Schematron rule `[KSA-25]`):
       $$\text{PIH}_{\text{genesis}} = \text{NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==}$$
     - *(Note on raw binary digest variant: If encoded as the Base64 of the raw 32-byte binary digest rather than the 64-character hex string, the value is `X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=`. However, standard ZATCA Schematron rule `[KSA-25]` strictly asserts against the 88-character Base64 hex string `NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==`).*
   - For all subsequent invoices ($n > 1$):
     $$\text{PIH}_n = \text{Base64}(\text{SHA-256}(\text{Canonicalized XML of Invoice } n-1))$$

---

### 4.4 Canonical XML UBL 2.1 Schema Specification

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    
    <!-- Extension Component containing XAdES ECDSA Digital Signature -->
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
            <ext:ExtensionContent>
                <!-- Embedded ds:Signature generated by ECDSA secp256k1 -->
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>

    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>INV-2026-00042</cbc:ID>
    <cbc:UUID>3c9a4192-b8f1-4df2-8cb2-2f3b9249e011</cbc:UUID>
    <cbc:IssueDate>2026-10-22</cbc:IssueDate>
    <cbc:IssueTime>14:32:00</cbc:IssueTime>
    
    <!-- InvoiceTypeCode: 0200000 = Simplified Tax Invoice; 0100000 = Standard Tax Invoice -->
    <!-- Name attribute: 388 = Tax Invoice, 381 = Credit Note, 383 = Debit Note -->
    <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>

    <!-- Previous Invoice Hash Chaining -->
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cac:ExternalReference>
                <cbc:URI>NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==</cbc:URI>
            </cac:ExternalReference>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>

    <!-- Invoice Counter Value (ICV) -->
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>42</cbc:UUID>
    </cac:AdditionalDocumentReference>

    <!-- Supplier (Seller) Party -->
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">1010123456</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>King Fahd Road</cbc:StreetName>
                <cbc:BuildingNumber>1234</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>Al Olaya</cbc:CitySubdivisionName>
                <cbc:CityName>Riyadh</cbc:CityName>
                <cbc:PostalZone>12211</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>SA</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>300000000000003</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>متجر المتجر السريع لتقنية المعلومات</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>

    <!-- Tax Total Block (Mandatory 15% VAT Breakdown) -->
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">15.00</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">100.00</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">15.00</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>

    <!-- Legal Monetary Totals -->
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">100.00</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">100.00</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">115.00</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="SAR">115.00</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>

    <!-- Invoice Line Item -->
    <cac:InvoiceLine>
        <cbc:ID>1</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">1.00</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">100.00</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Name>عطر شرقي فاخر 100 مل</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">100.00</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>
</Invoice>
```

---

### 4.5 The 9-Tag Base64 TLV QR Code Encoding Engine

In Phase 2, QR codes printed on physical receipts or embedded in PDFs encode **all 9 tags** using Tag-Length-Value (TLV) binary representation:

```
+----------------------------------------------------------------------------------------------------+
| ZATCA PHASE 2 TLV STRUCTURE (9 TAGS)                                                               |
+-----+---------------------------------------+---------------+--------------------------------------+
| Tag | Field Name                            | Type          | Encoding / Format                    |
+-----+---------------------------------------+---------------+--------------------------------------+
| 1   | Seller's Name                         | String        | UTF-8 Encoded String                 |
| 2   | VAT Registration Number               | String        | 15-digit number (starts/ends with 3) |
| 3   | Timestamp                             | String        | ISO-8601 (YYYY-MM-DDTHH:MM:SSZ)      |
| 4   | Invoice Total (with VAT)              | String        | Decimal string without currency      |
| 5   | Total VAT Amount                      | String        | Decimal string without currency      |
| 6   | XML Invoice Hash                      | Binary        | SHA-256 Digest (32 bytes raw)        |
| 7   | ECDSA Digital Signature               | Binary        | ECDSA Signature (ASN.1 DER, 70-72 B) |
| 8   | ECDSA Public Key                      | Binary        | Uncompressed EC Public Key (65 bytes)|
| 9   | ZATCA CA Public Key Digital Signature | Binary        | ASN.1 DER signature of EGS public key|
|     |                                       |               | by ZATCA CA (64–72 bytes)            |
+-----+---------------------------------------+---------------+--------------------------------------+
```

> ⚠️ **CRITICAL ARCHITECTURAL WARNING: Tag 9 Payload vs 1-Byte TLV Length Overflow**  
> In standard X.509 PKI, a complete digital certificate (issuer DN, subject DN, validity period, RSA/EC keys, extensions, and root CA signature) spans **600 to 1,500 bytes** (typically $\sim 850$ bytes).  
> The ZATCA binary TLV specification mandates a **1-byte unsigned integer** ($0 \le \text{Length} \le 255$) for each tag's length field. If an implementation erroneously embeds the entire $\sim 850$-byte X.509 digital certificate into Tag 9:
> $$\text{Length Byte} = 850 \pmod{256} = 82$$
> The single-byte length counter overflows and records `82` instead of `850`. A compliant TLV parser reading the resulting QR code will ingest only the first 82 bytes, subsequently interpreting the remaining 768 bytes of certificate payload as garbage TLV tags. This catastrophically corrupts the binary stream, causing 100% rejection across all official ZATCA mobile verifiers and clearance portals.  
> **Tag 9 is strictly defined as the 64–72 byte ASN.1 DER ECDSA signature generated by the ZATCA CA over the EGS public key during CCSID/PCSID onboarding, NOT the complete X.509 certificate.**

#### Binary TLV Construction Algorithm:
Each tag entry is formed as:
$$\text{Tag Block} = [\text{Tag ID (1 Byte)}] + [\text{Length of Value (1 Byte)}] + [\text{Value (N Bytes)}]$$

```typescript
export function buildZatcaPhase2TLV(fields: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  invoiceTotal: string;
  vatTotal: string;
  invoiceHash: Uint8Array; // 32 bytes SHA-256
  ecdsaSignature: Uint8Array; // ASN.1 DER signature (70-72 bytes)
  publicKey: Uint8Array; // EGS Public Key (65 bytes uncompressed 0x04)
  caSignature: Uint8Array; // ZATCA CA Digital Signature of Public Key in ASN.1 DER format (64-72 bytes, NOT full X.509 cert)
}): string {
  const encoder = new TextEncoder();
  
  const tags: Array<{ tag: number; value: Uint8Array }> = [
    { tag: 1, value: encoder.encode(fields.sellerName) },
    { tag: 2, value: encoder.encode(fields.vatNumber) },
    { tag: 3, value: encoder.encode(fields.timestamp) },
    { tag: 4, value: encoder.encode(fields.invoiceTotal) },
    { tag: 5, value: encoder.encode(fields.vatTotal) },
    { tag: 6, value: fields.invoiceHash },
    { tag: 7, value: fields.ecdsaSignature },
    { tag: 8, value: fields.publicKey },
    { tag: 9, value: fields.caSignature },
  ];

  const totalLength = tags.reduce((acc, t) => acc + 2 + t.value.length, 0);
  const buffer = new Uint8Array(totalLength);

  let offset = 0;
  for (const { tag, value } of tags) {
    // Defensive check: prevent 1-byte length overflow wrapping modulo 256
    if (value.length > 255) {
      throw new Error(
        `TLV Tag ${tag} payload length (${value.length} bytes) exceeds single-byte TLV limit (255 bytes). ` +
        `Tag 9 must be the 64-72 byte ASN.1 DER signature of the public key, NOT the full ~850-byte X.509 certificate.`
      );
    }
    buffer[offset++] = tag;
    buffer[offset++] = value.length;
    buffer.set(value, offset);
    offset += value.length;
  }

  return Buffer.from(buffer).toString('base64');
}
```

---

### 4.6 Cryptographic CSID Onboarding Lifecycle (CCSID & PCSID)

```
[ Step 1: EGS Key Generation ]
Generate secp256k1 EC Private Key + CSR (Certificate Signing Request).
CSR includes: Common Name, Organization Identifier (15-digit VAT), Serial Number (EGS Solution Name).
              │
              ▼
[ Step 2: Request Compliance CSID (CCSID) ]
Merchant requests OTP from ZATCA FATOORA portal.
EGS calls: POST /compliance (passes CSR + OTP in HTTP Header).
ZATCA returns: CCSID (Compliance Cryptographic Stamp Identifier) + Secret Key.
              │
              ▼
[ Step 3: Automated Compliance Testing (Simulation) ]
EGS signs and submits required test invoice scenarios:
- Standard Tax Invoice
- Simplified Tax Invoice
- Credit Note (Standard & Simplified)
- Debit Note (Standard & Simplified)
EGS calls: POST /compliance/invoices. All Schematron (BR-KSA) checks must pass.
              │
              ▼
[ Step 4: Request Production CSID (PCSID) ]
Upon passing 100% of compliance test cases:
EGS calls: POST /production/csids (using CCSID auth).
ZATCA returns: PCSID (Production Cryptographic Stamp Identifier).
              │
              ▼
[ Step 5: Live Invoice Clearance & Reporting ]
EGS signs commercial invoices using PCSID private key and submits to:
- POST /invoices/clearance/single (Standard)
- POST /invoices/reporting/single (Simplified)
PCSID certificate renewed every 1-2 years prior to expiration.
```

---

## 5. Multi-Tenant Data Isolation & Enterprise Identity Architecture

### 5.1 Application-Layer Tenant Context Enforcement (AsyncLocalStorage)

In a multi-tenant platform, tenant context must never rely on developers remembering to manually append `WHERE tenant_id = ?` to queries. The context is injected and enforced at the infrastructure/ORM runtime layer:

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';

export interface TenantContext {
  tenantId: string;
  storeSlug: string;
  userId?: string;
  userRole?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function tenantContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.headers['x-tenant-id'] as string || extractTenantFromHost(req.hostname);
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context could not be resolved' });
  }

  const context: TenantContext = {
    tenantId,
    storeSlug: req.headers['x-store-slug'] as string || 'default',
    userId: (req as any).user?.uid,
    userRole: (req as any).user?.role,
  };

  tenantStorage.run(context, () => {
    next();
  });
}
```

---

### 5.2 Dual-Tier Database Isolation: PostgreSQL RLS with PgBouncer Sanitization & Firestore Rules

#### 1. PostgreSQL Row-Level Security (RLS) with Session Hygiene:
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_orders ON orders
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

**Critical PgBouncer Session Sanitization Hygiene:**
```typescript
export async function withTenantDb<T>(tenantId: string, operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Sanitizes session state before releasing connection back to pool
    await client.query('RESET ALL');
    client.release();
  }
}
```

#### 2. Firestore Multi-Tenant Security Rules Isolation:
```javascript
function isStoreOwner(storeId) {
  return request.auth != null &&
         exists(/databases/$(database)/documents/stores/$(storeId)) &&
         get(/databases/$(database)/documents/stores/$(storeId)).data.ownerId == request.auth.uid;
}

match /stores/{storeId}/orders/{orderId} {
  allow create: if isValidId(orderId) && isValidNewOrder(request.resource.data, orderId);
  allow get, list: if isStoreOwner(storeId);
  allow update: if isStoreOwner(storeId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
    'status', 'trackingNotes', 'courierName', 'courierPhone', 'updatedAt'
  ]);
  allow delete: if false; // Zero hard deletions allowed
}
```

---

### 5.3 Authentication & Session Security: Token Families & Replay Detection

```
[ Client Application ]                           [ Identity Provider (IdP) ]
         │                                                   │
         │ 1. POST /auth/token (Authorization Code + PKCE)   │
         │──────────────────────────────────────────────────>│
         │                                                   │
         │ 2. Returns Access Token (15m JWT)                 │
         │    + Refresh Token (HttpOnly Cookie, Family A-1)  │
         │<──────────────────────────────────────────────────│
         │
         │ (15 Minutes Later - Access Token Expires)
         │
         │ 3. POST /auth/refresh (Cookie: RefreshToken A-1)  │
         │──────────────────────────────────────────────────>│
         │                                                   │ Validates A-1, marks A-1 "Used"
         │                                                   │ Generates A-2 (Family A)
         │ 4. Returns New Access Token (15m JWT)             │
         │    + New Refresh Token (Cookie: A-2)              │
         │<──────────────────────────────────────────────────│
         │
    [ ATTACK SCENARIO: Stolen Refresh Token A-1 Replayed ]
         │
         │ 5. Attacker sends previously used Refresh Token A-1
         │──────────────────────────────────────────────────>│
         │                                                   │ ALARM: Replay Detected!
         │                                                   │ Token A-1 was already rotated to A-2!
         │                                                   │ Revoke ENTIRE Family A (A-1, A-2, etc.)
         │ 6. HTTP 401 Unauthorized                          │ Broadcast Revocation to Redis Cache
         │<──────────────────────────────────────────────────│
```

#### Token Family Storage Schema:
```sql
CREATE TABLE refresh_token_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of refresh token
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_hash ON refresh_token_families(token_hash);
CREATE INDEX idx_family_id ON refresh_token_families(family_id);
```

#### Automated Replay Defense Logic:
```typescript
export async function rotateRefreshToken(oldTokenRaw: string, clientIp: string, userAgent: string) {
  const tokenHash = crypto.createHash('sha256').update(oldTokenRaw).digest('hex');

  const tokenRecord = await db.refreshTokenFamilies.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!tokenRecord) {
    throw new Error('Invalid refresh token');
  }

  // REPLAY DETECTION: Token was already marked as used!
  if (tokenRecord.is_used || tokenRecord.is_revoked) {
    // Immediate Breach Protocol: Invalidate the entire family
    await db.refreshTokenFamilies.updateMany({
      where: { family_id: tokenRecord.family_id },
      data: { is_revoked: true },
    });
    // Add user sessions to Redis revocation list
    await redisClient.set(`revoked:user:${tokenRecord.user_id}`, Date.now().toString(), 'EX', 86400);
    throw new SecurityBreachError('Token replay detected. All active sessions in family revoked.');
  }

  // Mark current token as used
  await db.refreshTokenFamilies.update({
    where: { id: tokenRecord.id },
    data: { is_used: true },
  });

  // Issue new token in same family
  const newRawToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');

  await db.refreshTokenFamilies.create({
    data: {
      user_id: tokenRecord.user_id,
      tenant_id: tokenRecord.tenant_id,
      family_id: tokenRecord.family_id,
      token_hash: newTokenHash,
      ip_address: clientIp,
      user_agent: userAgent,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  const newAccessToken = issueJwt({
    sub: tokenRecord.user_id,
    tenant_id: tokenRecord.tenant_id,
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  });

  return { newAccessToken, newRefreshToken: newRawToken };
}
```

---

### 5.4 Granular RBAC & ABAC Store Staff Access Control Engine

```
+----------------------------------------------------------------------------------------------------+
| ROLE-BASED ACCESS CONTROL (RBAC) STORE ROLE PERMISSION MATRIX                                      |
+-----------------------+----------------+-----------------+-----------------+-----------------------+
| Permission Scope      | Owner          | Store Manager   | Cashier / POS   | Fulfillment / Driver  |
+-----------------------+----------------+-----------------+-----------------+-----------------------+
| Store Branding & URLs | FULL (RW)      | READ ONLY       | NO ACCESS       | NO ACCESS             |
| Bank Details & Payouts| FULL (RW)      | NO ACCESS       | NO ACCESS       | NO ACCESS             |
| API Keys & Webhooks   | FULL (RW)      | NO ACCESS       | NO ACCESS       | NO ACCESS             |
| Staff & Roles Admin   | FULL (RW)      | NO ACCESS       | NO ACCESS       | NO ACCESS             |
| Catalog & Pricing     | FULL (RW)      | FULL (RW)       | READ ONLY       | READ ONLY             |
| Order Management      | FULL (RW)      | FULL (RW)       | CREATE / READ   | UPDATE STATUS ONLY    |
| Customer Full PII     | FULL (RW)      | FULL (RW)       | REDACTED (Last4)| REDACTED (Phone only) |
| Process Refunds       | UNLIMITED (RW) | UP TO SAR 1,000 | NO ACCESS       | NO ACCESS             |
| Driver PIN Settlement | FULL (RW)      | FULL (RW)       | FULL (RW)       | CONFIRM PIN ONLY      |
| ZATCA E-Invoicing Ops | FULL (RW)      | VIEW INVOICES   | ISSUE SIMPLIFIED| NO ACCESS             |
+-----------------------+----------------+-----------------+-----------------+-----------------------+
```

#### Attribute-Based Access Control (ABAC) Dynamic Rules Engine:
```typescript
export interface AbacPolicyContext {
  subject: {
    userId: string;
    role: 'Owner' | 'Manager' | 'Cashier' | 'Driver';
    branchId: string;
    refundLimitSar: number;
  };
  resource: {
    type: 'Order' | 'Product' | 'Payout';
    branchId?: string;
    amount?: number;
    status?: string;
  };
  action: 'create' | 'read' | 'update' | 'refund' | 'export';
  environment: {
    clientIp: string;
    timestamp: Date;
    isCorporateVpn: boolean;
  };
}

export function evaluateAbacPolicy(ctx: AbacPolicyContext): boolean {
  // Rule 1: Owners have universal access
  if (ctx.subject.role === 'Owner') return true;

  // Rule 2: Refund Execution Policy
  if (ctx.action === 'refund' && ctx.resource.type === 'Order') {
    if (ctx.subject.role !== 'Manager') return false;
    if (ctx.resource.branchId && ctx.resource.branchId !== ctx.subject.branchId) return false;
    if ((ctx.resource.amount || 0) > ctx.subject.refundLimitSar) return false;
    return true;
  }

  // Rule 3: PII Export Policy (Strictly forbidden over public IP, requires VPN or Store IP)
  if (ctx.action === 'export' && ctx.resource.type === 'Order') {
    if (ctx.subject.role !== 'Manager') return false;
    if (!ctx.environment.isCorporateVpn) return false;
    return true;
  }

  // Rule 4: Driver Dispatch updates restricted to assigned shipments
  if (ctx.subject.role === 'Driver') {
    return ctx.action === 'update' && ctx.resource.status === 'Out for Delivery';
  }

  return false;
}
```

---

## 6. Architectural Diagram Specifications

### 6.1 Multi-Tenant Security Isolation Boundary (ASCII & Mermaid)

#### ASCII Diagram:
```
+--------------------------------------------------------------------------------------------------------+
|                                  EDGE & PERIMETER SECURITY LAYER                                       |
|  - Cloudflare / AWS CloudFront WAF: DDoS Shield, Bot Management, Rate Limiting (Token Bucket)          |
|  - TLS 1.3 Termination, Strict Transport Security (HSTS), Content Security Policy (CSP v4.0.1)        |
+--------------------------------------------------------------------------------------------------------+
                                                    │
                                                    ▼
+--------------------------------------------------------------------------------------------------------+
|                               API GATEWAY & IDENTITY PROVIDER (IdP)                                    |
|  - OIDC / OAuth 2.0 PKCE Verification                                                                 |
|  - Asymmetric JWT Validation (RS256 Public Key) -> Decodes: { sub, tenant_id, role, branch_id }       |
|  - Distributed Redis Token Revocation Blacklist & Family Replay Check                                  |
+--------------------------------------------------------------------------------------------------------+
                                                    │
                                                    ▼
+--------------------------------------------------------------------------------------------------------+
|                               APPLICATION RUNTIME EXECUTION CONTEXT                                    |
|  - AsyncLocalStorage Context Injection: Locks active request to `tenant_id`                            |
|  - Hybrid RBAC / ABAC Dynamic Policy Enforcement Engine (Evaluates Subject, Resource, Action, Context) |
|  - Zero-Trust Input Sanitization & Domain Event Dispatch                                               |
+--------------------------------------------------------------------------------------------------------+
                          │                                                │
                          ▼                                                ▼
+----------------------------------------------------+   +-----------------------------------------------+
|             RELATIONAL POSTGRES RLS LAYER          |   |            NO-SQL FIRESTORE RULES LAYER       |
|  - Session Context: `SET LOCAL app.tenant_id = ?`  |   |  - Hierarchical Path Scoping:                 |
|  - Row-Level Security Policies ON ALL TABLES:      |   |    `/stores/{storeId}/orders/{orderId}`       |
|    `USING (tenant_id = current_setting(...))`      |   |  - Strict Diff Key Invariant Checks           |
|  - Connection Pool Sanitation: `RESET ALL`         |   |  - Zero Cross-Tenant Document Access          |
+----------------------------------------------------+   +-----------------------------------------------+
                          │                                                │
                          +-----------------------+------------------------+
                                                  │
                                                  ▼
+--------------------------------------------------------------------------------------------------------+
|                                   DATA ENCRYPTION AT REST & KMS                                        |
|  - AES-256 GCM Envelope Encryption per Tenant via AWS KMS / Google Cloud KMS                           |
|  - Isolated Tenant Customer PII Storage (Encrypted PAN-last4, Phone, National Address)                |
+--------------------------------------------------------------------------------------------------------+
```

#### Mermaid Diagram:
```mermaid
graph TD
    subgraph Perimeter["Perimeter & Edge Layer"]
        UserBrowser["Shopper / Merchant Browser"] -->|HTTPS / TLS 1.3| EdgeWAF["Cloudflare Edge WAF\n(DDoS, Bot Management, Rate Limiter)"]
        EdgeWAF -->|Validated Ingress| ApiGateway["API Gateway / Reverse Proxy"]
    end

    subgraph Identity["Identity & Authentication Layer"]
        ApiGateway -->|Bearer JWT / Session Cookie| AuthZ["Identity & Token Verification\n(RS256 JWT, Revocation Check)"]
        AuthZ -->|Tenant Context Extracted| ContextMiddleware["Tenant Context Middleware\n(AsyncLocalStorage Injection)"]
    end

    subgraph Application["Application & Policy Engine"]
        ContextMiddleware -->|Enforced tenant_id| AbacEngine["RBAC / ABAC Policy Engine\n(Subject, Resource, Action, Environment)"]
        AbacEngine -->|Authorized Execution| ServiceLayer["E-Commerce Core Services\n(Orders, Catalog, Payments, ZATCA)"]
    end

    subgraph DataIsolation["Multi-Tenant Data Isolation Tier"]
        ServiceLayer -->|Transaction with Session Variable| PgPool["PgBouncer Pool\nSET LOCAL app.current_tenant_id = X"]
        PgPool --> PostgresRLS["PostgreSQL RLS\nWHERE tenant_id = current_setting('app.current_tenant_id')"]
        
        ServiceLayer -->|Scoped Firestore Query| FirestoreRules["Cloud Firestore Security Rules\n/stores/{storeId}/orders/{orderId}"]
    end

    subgraph KMS["Storage & Encryption at Rest"]
        PostgresRLS --> DBStorage["Encrypted Database Volume (AES-256)"]
        FirestoreRules --> CloudStorage["Google Cloud KMS Encryption"]
    end
```

---

### 6.2 ZATCA Phase 2 Clearance & Reporting Flow (ASCII & Mermaid)

#### ASCII Diagram:
```
+--------------------------------------------------------------------------------------------------------+
| QUICK-ECOMERCE EGS (E-INVOICING GENERATION SOLUTION) UNIT                                              |
|                                                                                                        |
| [ 1. Order Completed & Paid ]                                                                          |
|              │                                                                                         |
|              ▼                                                                                         |
| [ 2. Increment Invoice Counter (ICV = n) & Read Previous Invoice Hash (PIH = Hash_{n-1}) ]             |
|              │                                                                                         |
|              ▼                                                                                         |
| [ 3. Generate Canonical UBL 2.1 XML (ISO/IEC 19845:2015) with 15% VAT Breakdown ]                      |
|              │                                                                                         |
|              ▼                                                                                         |
| [ 4. Compute XML Digest: SHA-256 of Canonicalized XML (C14N 1.1) ]                                     |
|              │                                                                                         |
|              ▼                                                                                         |
| [ 5. Sign Digest with EGS Private Key via ECDSA secp256k1 -> Generate XAdES Signature ]                |
|              │                                                                                         |
|              ▼                                                                                         |
| [ 6. Construct 9-Tag Base64 TLV QR Code (Tags 1-9 including Hash, Signature, PubKey, CA Cert) ]        |
+--------------------------------------------------------------------------------------------------------+
                                                    │
                                                    │ Branch on Invoice Type
                         +--------------------------+--------------------------+
                         │                                                     │
                         ▼                                                     ▼
         [ Standard Tax Invoice (B2B/B2G) ]                   [ Simplified Tax Invoice (B2C) ]
                         │                                                     │
                         │ Synchronous CLEARANCE                               │ Issue to Shopper IMMEDIATELY
                         │ (Must clear prior to delivery)                      │ (Print / PDF with 9-Tag QR)
                         ▼                                                     ▼
             POST /invoices/clearance/single                       [ Shopper Receives Invoice ]
                         │                                                     │
                         ▼                                                     │ Asynchronous REPORTING
             +-----------------------+                                         │ (Within 24 Hours)
             │ ZATCA FATOORA PORTAL  │                                         ▼
             │ - Schematron Rules    │                             POST /invoices/reporting/single
             │ - Cryptographic Check │                                         │
             │ - Digital Timestamp   │                                         ▼
             +-----------------------+                             +-----------------------+
                         │                                         │ ZATCA FATOORA PORTAL  │
                         ▼                                         │ - Async Schema Audit  │
             [ Cleared XML Returned ]                              │ - Validation Status   │
                         │                                         +-----------------------+
                         ▼                                                     │
             [ Deliver to Corporate Buyer ]                                    ▼
                                                                   [ Mark Reported in DB ]
```

#### Mermaid Diagram:
```mermaid
sequenceDiagram
    autonumber
    participant App as Quick-ecomerece EGS
    participant Crypto as Cryptographic Engine (secp256k1)
    participant QR as Base64 TLV QR Generator
    participant Shopper as Shopper / Buyer
    participant ZATCA as ZATCA FATOORA Gateway

    Note over App,Crypto: 1. Order Finalized & Tax Calculated (15% VAT)
    App->>App: Retrieve Next ICV & Last Invoice Hash (PIH)
    App->>App: Construct UBL 2.1 XML Invoice Document
    App->>Crypto: Canonicalize XML (C14N 1.1) & Hash (SHA-256)
    Crypto-->>App: Return Invoice Digest (Tag 6)
    App->>Crypto: Sign Digest with EGS Private Key (ECDSA secp256k1)
    Crypto-->>App: Return Digital Signature (Tag 7) & Embed XAdES
    
    App->>QR: Assemble 9-Tag Binary TLV (Tags 1 to 9) & Base64 Encode
    QR-->>App: Return Base64 Encoded QR Code Payload

    alt Simplified Tax Invoice (B2C - Code 0200000)
        App->>Shopper: Issue Thermal Receipt / PDF Invoice with QR Code Immediately
        Note over App,ZATCA: Asynchronous Reporting Window (within 24 Hours)
        App->>ZATCA: POST /invoices/reporting/single (Base64 Cleared XML)
        ZATCA-->>App: HTTP 200 OK: Status = REPORTED (Validation Warnings/Success)
        App->>App: Store Reporting Receipt & Audit Log
    else Standard Tax Invoice (B2B - Code 0100000)
        Note over App,ZATCA: Synchronous Clearance Window (Real-time Pre-issuance)
        App->>ZATCA: POST /invoices/clearance/single (Signed UBL XML)
        ZATCA->>ZATCA: Validate Schematron (BR-KSA), Cryptographic Stamp, Tax Totals
        ZATCA-->>App: HTTP 200 OK: Cleared XML + ZATCA Cryptographic Stamp
        App->>Shopper: Deliver Officially Cleared Standard Invoice (XML + PDF/A-3)
    end
```
