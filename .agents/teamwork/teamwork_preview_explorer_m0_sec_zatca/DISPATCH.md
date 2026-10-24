## 2026-10-22T22:21:32Z
You are Explorer 2 (Enterprise Security, Compliance & Saudi Localization).
Your working directory is: c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_sec_zatca
Mandatory inputs to read:
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_orchestrator_2\PROJECT.md

Your Mission:
Conduct deep technical benchmarking for Requirement R2 (Enterprise Security, Payment Compliance & Tenant Data Isolation):
1. PCI-DSS Level 1 compliance & payment tokenization boundaries: Hosted Fields / iFrames / Secure Elements (Stripe Elements, Moyasar Form, Checkout.com Flow), SAQ A vs SAQ A-EP vs SAQ D scope minimization, zero cardholder data on application servers, end-to-end webhook signing and replay protection.
2. Saudi & MENA localization & regulatory compliance:
   - Saudi E-Commerce Law & Ministry of Commerce requirements.
   - Saudi Payments / Mada network routing, Apple Pay web merchant validation with SAR currency processing, Tabby/Tamara BNPL integration patterns.
   - ZATCA (Zakat, Tax and Customs Authority) FATOORA Phase 2 E-Invoicing: Cryptographic Stamp (ECDSA secp256k1), Invoice Hash (SHA-256), Previous Invoice Hash chaining, XML UBL 2.1 invoice generation, Base64 TLV QR Code generation (Tag 1: Seller Name, Tag 2: VAT Reg, Tag 3: Timestamp, Tag 4: Total, Tag 5: VAT Total, Tag 6: Hash, Tag 7: ECDSA Signature, Tag 8: ECDSA Public Key, Tag 9: Stamp Certificate), Clearance vs Reporting APIs, CSID onboarding (CCSID & PCSID).
3. Tenant Data Isolation & Enterprise Identity:
   - Multi-tenant security boundaries: Application-layer tenant context enforcement, Postgres Row-Level Security (RLS) policies, Firestore security rules isolation vs dedicated tenant collections.
   - Authentication & Session Security: OIDC/OAuth2, short-lived JWTs (15 min) + secure HttpOnly refresh token rotation with token families & revocation lists, session binding (IP/User-Agent fingerprinting), brute force protection.
   - Granular RBAC & ABAC: Role-based and attribute-based permissions for merchant staff, store roles (Owner, Manager, Cashier, Fulfillment), API scopes for third-party marketplace apps.
4. Concrete ASCII/Mermaid architectural diagram specifications for: Multi-tenant security isolation boundary and ZATCA Phase 2 clearance/reporting flow.

Output Requirements:
Write your comprehensive technical analysis to:
c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_sec_zatca\analysis.md
and a complete handoff to:
c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m0_sec_zatca\handoff.md
When finished, send a completion message to parent.
