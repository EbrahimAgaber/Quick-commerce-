# Empirical Adversarial Challenge Report: Security, Cryptography & Saudi Compliance (M2)

**Challenger:** Challenger 2 (Security, Cryptography & Compliance Verifier)  
**Target Documents:**
- `docs/architecture/e2e_benchmark_study/03_enterprise_security_compliance_zatca.md` (Doc 03)
- `docs/architecture/e2e_benchmark_study/06_quick_ecommerce_gap_analysis_and_roadmap.md` (Doc 06)  
**Target Codebase:** `src/utils/zatca.ts`, `src/components/storefront/MoyasarPaymentModal.tsx`, `api/moyasarWebhook.ts`, `firestore.rules`, `src/services/storeManager.ts`, `api/_security.ts`, `vite.config.ts`, `firebase.json`, `vercel.json`  
**Execution Date:** 2026-10-22T23:10:00Z  
**Verification Harness:** `scripts/verify_zatca_compliance_empirically.cjs`  
**Gate Verdict:** **REQUEST_CHANGES**

---

## Executive Summary

As Challenger 2, an empirical verification and stress harness was executed against the cryptographic, architectural, and regulatory compliance specifications detailed in **Doc 03** (Enterprise Security & ZATCA) and the forensic audit claims in **Doc 06** (Quick-ecomerece Gap Analysis & Roadmap).

While both documents represent exceptional, high-caliber engineering specifications, our empirical testing surfaced **one critical cryptographic error in ZATCA Phase 2 Genesis hash calculation**, **one structural TLV length ambiguity that causes byte overflow under standard X.509 certificates**, **payment script integrity and CSP policy drift violations under PCI-DSS v4.0.1**, and **one minor file path citation error**.

Because following the genesis hash in Doc 03 line 551 would cause **immediate Schematron rejection by the ZATCA FATOORA Portal API for all newly onboarded EGS solution units**, this report issues a gate verdict of **REQUEST_CHANGES** with precise, drop-in mathematical corrections.

---

## Challenge Summary

**Overall Risk Assessment:** **HIGH** (Cryptographic Invalidation on ZATCA FATOORA Clearance API; PCI-DSS v4.0.1 Script Tampering Drift)

| Challenge ID | Target | Severity | Domain | Issue Summary | Impact |
|:---|:---|:---|:---|:---|:---|
| **CH-SEC-01** | Doc 03 §4.3 (line 551) | **CRITICAL** | Cryptography / ZATCA | Genesis PIH SHA-256 hash has 14-hex-char corruption | FATOORA Schematron rejection of Invoice #1 |
| **CH-SEC-02** | Doc 03 §4.5 (lines 698, 737) | **HIGH** | TLV Binary Encoding | 1-Byte length field wraps modulo 256 on X.509 CA cert | Binary TLV parser truncation & corruption |
| **CH-SEC-03** | Doc 03 §2.3 vs Workspace | **HIGH** | PCI-DSS v4.0.1 / SAQ A | Missing SRI hash in Moyasar modal; CSP drift in `vercel.json` | Magecart vulnerability; CSP script block risk |
| **CH-SEC-04** | `src/utils/zatca.ts` | **MEDIUM** | Codebase Conformance | `generateInvoiceHash` uses mock string; missing binary TLV | Workspace is Phase 1 prototype, not Phase 2 |
| **CH-SEC-05** | Doc 06 §3.1 (Gap G7) | **LOW** | Forensic Accuracy | File path typo: `src/components/cart/` vs `src/components/storefront/` | Minor citation discrepancy; lines match |

---

## Detailed Empirical Challenges

### [Critical] CH-SEC-01: ZATCA Phase 2 Genesis Previous Invoice Hash (PIH) Cryptographic Corruption

#### 1. Target Specification
In `docs/architecture/e2e_benchmark_study/03_enterprise_security_compliance_zatca.md`, Section 4.3 (lines 549–551) and Section 4.4 (line 593):
```markdown
549: - For **Invoice #1** (the genesis invoice of an EGS unit): The PIH value is defined by ZATCA as the SHA-256 hash of the ASCII string `"0"`, Base64 encoded:
550:   $$\text{SHA-256}(\text{"0"}) = \text{0x5f...548f}$$
551:   $$\text{PIH}_{\text{genesis}} = \text{NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjhhZTU4NDhmNmRkNTQ4Zg==}$$
```

#### 2. Empirical Test & Proof of Bug
Using our empirical verification script `scripts/verify_zatca_compliance_empirically.cjs`, we computed the exact SHA-256 digest of ASCII string `"0"` (1 byte: `0x30`):

```javascript
const crypto = require('crypto');
const rawDigest = crypto.createHash('sha256').update('0', 'utf8').digest();
const hexDigest = rawDigest.toString('hex');
const b64OfHex = Buffer.from(hexDigest, 'utf8').toString('base64');
const b64OfRaw = rawDigest.toString('base64');
```

**Results:**
1. **Actual SHA-256("0") Hex (64 chars):**
   `5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9`
2. **Actual Base64 of 64-char Hex String (88 chars):**
   `NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==`
3. **Actual Base64 of 32-byte Raw Binary Digest (44 chars):**
   `X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=`
4. **Decoded Hex from Doc 03 line 551 (`NWZl...48f`):**
   `5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b468ae5848f6dd548f`

**Discrepancy Analysis:**
Comparing the decoded hex in Doc 03 against the real SHA-256:
- **First 49 characters:** Identical (`5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b4...`)
- **Last 15 characters:**
  - Doc 03: `...68ae5848f6dd548f`
  - Real SHA-256("0"): `...6729d73a27fb57e9`
- **Result:** Character differences count = 14.

#### 3. Blast Radius & Regulatory Impact
Under ZATCA Phase 2 FATOORA Schematron validation rules (`BR-KSA-39` / `BR-KSA-70`):
- For any invoice where Invoice Counter Value $\text{ICV} = 1$, the FATOORA API validates the contents of `/Invoice/cac:AdditionalDocumentReference[cbc:ID='PIH']/cac:Attachment/cac:ExternalReference/cbc:URI`.
- If the URI does not strictly equal the authentic Base64 hash of `"0"`, the ZATCA Clearance / Reporting API immediately halts with an unrecoverable validation error: `[KSA-25] The previous invoice hash for the first invoice must be the hash of '0'`.
- Any EGS unit implementing the Doc 03 string will fail compliance testing (CCSID to PCSID migration) and cannot clear commercial invoices.

#### 4. Required Remediation
In `docs/architecture/e2e_benchmark_study/03_enterprise_security_compliance_zatca.md`, lines 550, 551, and 593:
Replace:
$$\text{PIH}_{\text{genesis}} = \text{NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjhhZTU4NDhmNmRkNTQ4Zg==}$$
With the mathematically correct Base64 string:
$$\text{PIH}_{\text{genesis}} = \text{NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==}$$
*(And note in §4.3 that if raw 32-byte digest Base64 representation is configured per schema variant, the value is `X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=`)*.

---

### [High] CH-SEC-02: TLV 1-Byte Length Overflow on Tag 9 (ZATCA CA Certificate vs Digital Signature)

#### 1. Target Specification
In Doc 03 §4.5 (lines 698, 707–745):
Table line 698:
`| 9 | ZATCA CA Certificate Stamp | Binary | Digital Certificate issued by ZATCA CA |`
Implementation function `buildZatcaPhase2TLV` (line 738):
```typescript
for (const { tag, value } of tags) {
  buffer[offset++] = tag;
  buffer[offset++] = value.length; // Writes 1 single byte for length!
  buffer.set(value, offset);
  offset += value.length;
}
```

#### 2. Empirical Stress Test & Proof of Failure
In standard X.509 PKI, a digital certificate (containing issuer DN, subject DN, validity period, RSA/EC public key, extensions, and CA signature) ranges from **600 to 1,500 bytes**.
We executed an empirical test passing a realistic 850-byte certificate buffer into a 1-byte length TLV encoder:
```typescript
const cert = Buffer.alloc(850, 0xcc);
const lengthByte = (cert.length) & 0xff; // 850 mod 256 = 82
```
**Empirical Observation:**
- The length byte recorded in the buffer is `82` instead of `850` (truncation modulo 256).
- When a decoder reads Tag 9, it advances `82` bytes rather than `850` bytes, corrupting the stream and causing an unhandled parsing error.

#### 3. Regulatory Clarification
According to ZATCA E-Invoicing Security Features & QR Code Specification §3.2:
- Tag 9 is **NOT** the full X.509 CA Certificate!
- Tag 9 is specifically: **"The ECDSA signature of the cryptographic stamp's public key by ZATCA technical CA"**.
- This is an ECDSA digital signature in ASN.1 DER format, which has a length of **64 to 72 bytes**, safely fitting well within the 1-byte length limit ($72 \le 255$).

#### 4. Required Remediation
In Doc 03 §4.5, Table line 698 and code comments:
Change Field Name from:
`ZATCA CA Certificate Stamp (Digital Certificate issued by ZATCA CA)`
To:
`ZATCA CA Public Key Digital Signature (ASN.1 DER signature of EGS public key by ZATCA CA, 64-72 bytes)`.
Explicitly document:
> *Warning: Tag 9 must contain only the ZATCA CA's cryptographic digital signature of the public key (64–72 bytes), NOT the full X.509 digital certificate. Embedding a full X.509 certificate exceeds 255 bytes and breaks 1-byte TLV parsers.*

---

### [High] CH-SEC-03: PCI-DSS v4.0.1 Script Integrity (SRI) Absence & CSP Policy Drift

#### 1. Forensic Observation in Workspace Codebase
An empirical audit of the checkout components and hosting configurations revealed:
1. **No Subresource Integrity (SRI) on Payment SDK:**
   In `src/components/storefront/MoyasarPaymentModal.tsx` (lines 106–114):
   ```typescript
   const script = document.createElement('script');
   script.src = MOYASAR_JS_URL; // https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.3.0/dist/moyasar.umd.min.js
   script.async = true;
   script.onload = initForm;
   document.body.appendChild(script);
   ```
   The `script` element does **not** set `.integrity` (SRI hash). This directly violates **PCI-DSS v4.0.1 Requirement 6.4.3**, which mandates that merchants confirm the integrity of each script executing on consumer payment pages.
2. **CSP Policy Drift in `vercel.json` vs `firebase.json`:**
   - In `vercel.json` (line 27), the configured Content Security Policy defines:
     `script-src 'self' 'unsafe-inline' https://apis.google.com https://*.firebaseapp.com https://cdn.moyasar.com;`
     Notice that **`https://cdn.jsdelivr.net` is missing from `script-src`**! If this CSP is applied, the browser blocks `moyasar.umd.min.js`, breaking online checkout.
     Furthermore, `script-src` contains `'unsafe-inline'`, which defeats CSP tamper-resistance.
   - In `firebase.json`, **no CSP headers are configured at all**.
3. **Insecure Client-Side State Fallback in Payment Modal:**
   In `src/components/storefront/MoyasarPaymentModal.tsx` (lines 201–245 and 259–266):
   If `/api/verifyPayment` fails, the browser directly updates the order status to `'Paid'` via `StoreManager.updateOrderInStore`. In test mode, clicking "Simulate Sandbox Approval" directly marks orders as paid from the client browser without gateway verification.

#### 2. Remediation
1. Add explicit SHA-384 SRI hash to dynamically created script elements in `MoyasarPaymentModal.tsx`.
2. Align `vercel.json` and `firebase.json` CSP headers to include `https://cdn.jsdelivr.net` (or self-host the Moyasar bundle) and remove `'unsafe-inline'` in production using nonce-based execution.
3. Eliminate client-side order status updates to `'Paid'`; order settlement must strictly occur via the authoritative serverless webhook `api/moyasarWebhook.ts`.

---

### [Medium] CH-SEC-04: Workspace `src/utils/zatca.ts` Implementation Audit

#### 1. Forensic Observation
While Doc 03 specifies full UBL 2.1 XML serialization, ECDSA `secp256k1` signing, and SHA-256 hash chaining, an inspection of `src/utils/zatca.ts` revealed:
- `generateInvoiceHash` (lines 177–186) does not compute SHA-256; it generates a mock string using a simple 32-bit shift:
  ```typescript
  return `hash_zatca_p2_${hex}_${Date.now().toString(16)}`;
  ```
- `ZatcaInvoiceData` defines `invoiceHash`, `digitalSignature`, `publicKey`, and `certificateSignature` as optional `string` fields. When passed to `toTLV`, string values are encoded as UTF-8 ASCII bytes instead of raw cryptographic byte arrays.
- There is no UBL 2.1 XML builder, no C14N 1.1 canonicalization engine, and no ECDSA signing in the current workspace.

#### 2. Assessment
This confirms the finding in Doc 06 §2: the current Quick-ecomerece workspace is a **Phase 1 prototype** with mock Phase 2 stubs. The enterprise blueprint in Doc 03 correctly identifies these as target Phase 3 milestones.

---

### [Low] CH-SEC-05: Minor File Path Discrepancy in Doc 06 Gap G7

#### 1. Forensic Observation
In `docs/architecture/e2e_benchmark_study/06_quick_ecommerce_gap_analysis_and_roadmap.md`:
- Section 3.1 Table line 122: Cites `src/components/cart/CheckoutModal.ts` (lines 39–60, 463–520).
- Section 3.2.7 line 276: Cites `src/components/cart/CheckoutModal.tsx` (lines 39–60, 463–520).
- Actual workspace location: `src/components/storefront/CheckoutModal.tsx`.

#### 2. Verification Result
The line numbers (39–60 for `DEFAULT_CITIES` and 463–520 for city selection/address entry) and code contents are **100% accurate**. The directory path contains a harmless typo (`cart` instead of `storefront`).

---

## Forensic Citations Audit Table (Doc 06)

Every code citation in Doc 06 was verified against the repository files:

| Gap ID | Citation in Doc 06 | Actual File in Workspace | Verified Lines | Result |
|:---|:---|:---|:---|:---|
| **G1** | `firestore.rules`: lines 113-115, 39-49 | `firestore.rules` | 113-115, 39-49 | **VERIFIED (Exact Match)** |
| **G1** | `src/services/storeManager.ts`: 1336-1342, 1504-1506 | `src/services/storeManager.ts` | 1336-1342, 1504-1506 | **VERIFIED (Exact Match)** |
| **G2** | `api/createOrder.ts`: 115-200, 351 | `api/createOrder.ts` | 115-200, 351 | **VERIFIED (Exact Match)** |
| **G2** | `src/services/storeManager.ts`: 886-940, 1305, 913, 937, 946 | `src/services/storeManager.ts` | 886-940, 1305, 913, 937, 946 | **VERIFIED (Exact Match)** |
| **G3** | `api/_security.ts`: lines 8, 56-74 | `api/_security.ts` | 8, 56-74 | **VERIFIED (Exact Match)** |
| **G4** | `vite.config.ts`: lines 35-52 | `vite.config.ts` | 35-52 | **VERIFIED (Exact Match)** |
| **G4** | `StoreDashboard.tsx`: 202,909 bytes | `src/components/builder/StoreDashboard.tsx` | Exactly 202,909 bytes | **VERIFIED (Exact Byte Match)** |
| **G5** | `firebase.json`: lines 14-19 | `firebase.json` | 14-19 | **VERIFIED (Exact Match)** |
| **G5** | `vercel.json`: lines 58-67 | `vercel.json` | 58-67 | **VERIFIED (Exact Match)** |
| **G6** | `src/services/storeManager.ts`: 510-549 | `src/services/storeManager.ts` | 510-549 | **VERIFIED (Exact Match)** |
| **G7** | `CheckoutModal.tsx`: lines 39-60, 463-520 | `src/components/storefront/CheckoutModal.tsx` | 39-60, 463-520 | **VERIFIED (Lines match; path is `storefront`)** |
| **G8** | `src/services/storeManager.ts`: 1507-1514 | `src/services/storeManager.ts` | 1507-1514 | **VERIFIED (Exact Match)** |

---

## Gate Verdict & Required Action Items

### Verdict: **REQUEST_CHANGES**

Before final synthesis approval, the following 3 remediation items must be updated in `docs/architecture/e2e_benchmark_study/03_enterprise_security_compliance_zatca.md` and `docs/architecture/e2e_benchmark_study/06_quick_ecommerce_gap_analysis_and_roadmap.md`:

1. **Doc 03 §4.3 (Genesis PIH):**
   Update Genesis PIH in line 551 and line 593 to:
   `NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==`
2. **Doc 03 §4.5 (Tag 9 TLV Definition):**
   Clarify that Tag 9 is the ECDSA digital signature of the public key issued by ZATCA CA (64–72 bytes), not the full X.509 certificate.
3. **Doc 06 §3.1 & §3.2.7 (CheckoutModal Path):**
   Update file path reference from `src/components/cart/CheckoutModal.ts[x]` to `src/components/storefront/CheckoutModal.tsx`.
