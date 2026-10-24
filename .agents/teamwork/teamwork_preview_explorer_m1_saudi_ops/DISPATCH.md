## 2026-10-20T13:39:32Z
You are the Regional E-Commerce & Operations Specialist (teamwork_preview_explorer_m1_saudi_ops) evaluating the StoreLink platform.

Your working directory is:
`c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m1_saudi_ops`

MANDATORY INPUTS (Read these first):
1. `c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\ORIGINAL_REQUEST.md` (authoritative user request)
2. `C:\Users\User\.gemini\antigravity\brain\e2cde627-aa0c-4ccd-836a-cd2a79ac7e21\prompt_draft.md` (matrix specification)
3. `c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_orchestrator_1\PROJECT.md` (project plan)

TARGET TO AUDIT:
- Codebase Repository: `c:\Users\User\Desktop\Quick-ecomerece` (specifically checkout, invoicing, order management, merchant dashboard, driver routing, localization files)
- Live Deployment: `https://quick-ecommerce-saas-app.web.app`

YOUR AUDIT SCOPE:
Conduct an in-depth, evidence-based evaluation of:
1. PILLAR 4: Saudi Compliance & Regionalization (Weight: 15%)
   - ZATCA e-invoicing Phase 1/2 compliance: TLV-encoded Base64 QR code generation, mandatory fields (seller, VAT number, timestamp, total, VAT), tax invoice format
   - Saudi E-Commerce Law: CR number, VAT registration disclosure, contact details, terms of service
   - Statutory 7-day return/exchange window and consumer protection rights transparency
   - Arabic RTL localization: Arabic typography, RTL directionality, SAR currency representation (SAR / ر.س)
   - Saudi National Address capture (Short Code, building, district, city) vs unstructured text, and 15% VAT display (tax-inclusive pricing vs itemized VAT breakdown)

2. PILLAR 5: Merchant Operations & Ergonomics (Weight: 15%)
   - Full order lifecycle state machine (Pending -> Processing -> Out for Delivery -> Delivered -> Returned/Cancelled)
   - Return & exchange workflow handling, merchant RMA dashboard, stock restocking logic
   - Driver dispatch system: courier assignment, GPS routing, delivery status updates, driver WhatsApp communications
   - Inventory synchronization: real-time stock deductions, low-stock alerts, out-of-stock guards
   - Merchant multi-store isolation, merchant dashboard ergonomics, performance, and audit trails

EVALUATION METHODOLOGY & OUTPUT:
- Score every sub-criterion on a 1-5 scale:
  5 = Enterprise Exemplary
  4 = Strong Production
  3 = Functional with Gaps
  2 = Flawed / High Friction
  1 = Critical Failure / Absent
- Calculate weighted subtotal for Pillar 4 and Pillar 5.
- Provide explicit file paths and line numbers (`file:line`) for every finding.
- Document positive implementations (strengths) and compliance/operational deficiencies (weaknesses).
- Formulate prioritized remediation recommendations (P0/P1/P2).
- Maintain `progress.md` with timestamps during your work.
- Write your complete handoff report to:
  `c:\Users\User\Desktop\Quick-ecomerece\.agents\teamwork\teamwork_preview_explorer_m1_saudi_ops\handoff.md`
- Once written, send a message to parent (`39fa7c41-a8a5-40a7-9879-4a082f04e993`) notifying completion.
