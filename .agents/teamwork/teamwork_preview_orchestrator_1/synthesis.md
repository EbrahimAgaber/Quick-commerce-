# StoreLink Platform Evaluation: Master Rubric, Scorecard & Synthesis

**Audit Date**: 2026-10-20  
**Target Codebase**: `c:\Users\User\Desktop\Quick-ecomerece`  
**Live Target**: `https://quick-ecommerce-saas-app.web.app`  
**Evaluation Standard**: Enterprise Tier-1 E-Commerce Matrix (Baymard Institute, Google Web.dev/Core Web Vitals, OWASP ASVS 4.0, Saudi E-Commerce Law, ZATCA Phase 1/2, Tier-1 SaaS Operations)

---

## 1. Executive Summary & Composite Scorecard

The platform achieves a composite rating of **67.24 / 100.00** (**Grade: C+ / Functional with Critical Architectural & Compliance Gaps**).

StoreLink provides an impressively smooth, mobile-first Arabic RTL consumer journey with frictionless guest checkout, rich multi-touchpoint WhatsApp integration, instant Saudi phone digit normalization, 7-day statutory return enforcement, and high-ergonomics zero-app courier dispatch with daily COD ledger reconciliation.

However, the evaluation exposed **critical vulnerabilities and systemic compliance gaps**:
1. **Critical Payment & Firestore Security Exposure (P0)**: Live Firebase Hosting SPA rewrites (`firebase.json:14-19`) route all `/api/*` endpoints to `index.html`. Consequently, backend order creation and payment verification endpoints fail, causing the frontend to fall back to direct, unauthenticated client Firestore writes (`storeManager.ts:836`). Firestore rules (`firestore.rules:114`) permit unauthenticated order creation without catalog price or total verification and permit unauthenticated order status overrides to `Cancelled` or `Delivered`. When Moyasar card verification fails over the unrouted API, the client-side catch block fails open, marking orders as `status: 'Paid'` unconditionally.
2. **Missing Saudi Statutory Disclosures & Tax Transparency (P0)**: The global storefront footer (`Footer.tsx`) completely omits the merchant Commercial Registration (CR) number, VAT registration number, physical address, and Saudi Business Center (SBC) credentials. Catalog cards, PDP modals, and checkout review screens omit mandatory "الأسعار شاملة ضريبة القيمة المضافة 15%" disclosures and fail to itemize VAT in order totals or persist it to Firestore.
3. **Substandard Mobile Touch Targets (P0)**: Primary interactive controls (Quick Add `36px`, PDP/Cart quantity buttons `24px–28px`, search clear `<30px`) fail WCAG / Baymard minimums (>=48px) by up to 50%.
4. **TypeScript Compilation Error (P0)**: `OrderTrackerModal.tsx:124,133` calls `useMemo` without importing it, causing TypeScript error TS2304 and unmounting the modal to the ErrorBoundary at runtime.

### Composite Scorecard Breakdown

| Pillar | Focus Area | Weight | Raw Score (1–5) | Percentage | Weighted Points | Grade |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Pillar 1** | **UX & Customer Journey Usability** | **20%** | **3.525 / 5.0** | **70.50%** | **14.10 / 20.00** | **B-** |
| **Pillar 2** | **Technical Architecture & Core Web Vitals** | **15%** | **3.000 / 5.0** | **60.00%** | **9.00 / 15.00** | **C** |
| **Pillar 3** | **Security, Privacy & Data Integrity** | **20%** | **2.600 / 5.0** | **52.00%** | **10.40 / 20.00** | **D+** |
| **Pillar 4** | **Saudi Compliance & Regionalization** | **15%** | **3.540 / 5.0** | **70.80%** | **10.62 / 15.00** | **B-** |
| **Pillar 5** | **Merchant Operations & Ergonomics** | **15%** | **3.907 / 5.0** | **78.13%** | **11.72 / 15.00** | **B+** |
| **Pillar 6** | **Conversion Rate Optimization & Trust** | **15%** | **3.800 / 5.0** | **76.00%** | **11.40 / 15.00** | **B** |
| **TOTAL** | **StoreLink Enterprise Platform Rating** | **100%** | **3.362 / 5.0** | **67.24%** | **67.24 / 100.00** | **C+** |

---

## 2. Master Tier-1 E-Commerce Evaluation Rubric

This reusable evaluation rubric maps qualitative criterion evaluations to a standard 1–5 scoring scale:
- **5 (Enterprise Exemplary)**: 95%–100% adherence to global tier-1 standards, zero defects, resilient fail-safe architecture.
- **4 (Strong Production)**: 80%–94% adherence, minor non-blocking UI/UX inconsistencies, robust operational stability.
- **3 (Functional with Gaps)**: 65%–79% adherence, core features functional but noticeable UX friction, architectural compromises, or missing optimizations.
- **2 (Flawed / High Friction)**: 45%–64% adherence, severe conversion barriers, security vulnerabilities, or legal/regulatory non-compliance.
- **1 (Critical Failure / Absent)**: 0%–44% adherence, broken functionality, critical security breach, or complete omission of mandatory requirements.

### Rubric Breakdown by Pillar

#### Pillar 1: UX & Customer Journey Usability (Weight: 20%)
- **1.1 Mobile-First RTL Ergonomics & Touch Targets (25%)**:
  - *5*: Full native RTL typography (Cairo/Readex), all tap targets >= 48px, sticky bottom action bar, thumb-zone optimized.
  - *3*: Native RTL present, but key interactive controls measure between 28px–36px; occasional mis-taps.
  - *1*: Broken RTL mirroring, unreadable fonts, touch targets < 24px causing constant mis-taps.
  - *StoreLink Score*: **3.5 / 5.0** (Native RTL, sticky mobile bar, but touch targets 24px–36px in `ProductCard.tsx:172` and `CartDrawer.tsx:294`).
- **1.2 Product Discovery, Search & Multi-Attribute Filtering (25%)**:
  - *5*: Instant search autocomplete with product thumbnails, spelling correction, faceted multi-attribute filters (price slider, sizes, stock).
  - *3*: Basic search with diacritic normalization, single-category tab navigation, lacks live autocomplete and multi-attribute filters.
  - *1*: Exact-match search only, no normalization, no category filtering.
  - *StoreLink Score*: **3.0 / 5.0** (High-quality Arabic normalization in `arabicSearch.ts`, but no search autocomplete dropdown and no faceted filters).
- **1.3 Product Detail Page (PDP) Information Density & Clarity (20%)**:
  - *5*: Dedicated route (`/product/:slug`), multi-image gallery, interactive variant swatches, verified customer reviews, clear VAT & delivery notices.
  - *3*: Modal-only PDP (`ProductModal.tsx`), variant pills present, stock scarcity badge, but lacks reviews and VAT label; mobile nested scroll issues.
  - *1*: Incomplete product descriptions, broken images, no stock indicators.
  - *StoreLink Score*: **3.5 / 5.0** (Rich variant selection & urgency flame badge, but modal-only PDP and no reviews or VAT disclosure).
- **1.4 Cart Usability & Inline Feedback (15%)**:
  - *5*: Milestone free shipping progress bar, instant recalculation, coupon validation with inline error messaging, cart upsell recommendations.
  - *3*: Functional cart with free shipping bar and coupon support, but small quantity buttons and no upsells.
  - *1*: Page reload on quantity change, silent coupon failures, confusing empty states.
  - *StoreLink Score*: **4.0 / 5.0** (Exemplary animated free shipping meter in `CartDrawer.tsx:185`, inline coupon validation, but 24px quantity buttons).
- **1.5 Checkout Flow Speed & Form Field Minimization (15%)**:
  - *5*: 1-page accordion or single-screen guest checkout, live phone formatting, GPS pin-drop, zero forced registration.
  - *3*: Guest checkout supported, but requires 3 modal steps + gateway modal; basic address fields.
  - *1*: Mandatory account registration before checkout, >6 input fields, confusing validation.
  - *StoreLink Score*: **4.0 / 5.0** (100% guest-friendly, GPS location capture, Saudi phone normalization, but multi-modal progression).

#### Pillar 2: Technical Architecture & Core Web Vitals (Weight: 15%)
- **2.1 React 19 Architecture & Hook Hygiene (20%)**:
  - *5*: React 19 Compiler enabled, clean Context domain separation, zero compiler errors, optimal re-render boundaries.
  - *3*: React 19 installed, but lacks compiler plugin; monolithic state in top-level component; minor hook warnings.
  - *1*: Compilation errors preventing build, runtime hook crashes, excessive un-memoized full-page re-renders.
  - *StoreLink Score*: **2.0 / 5.0** (Monolithic `App.tsx` state with 0 Contexts; TS2304 compilation error for missing `useMemo` in `OrderTrackerModal.tsx:124,133`).
- **2.2 Vite Bundle Configuration & Chunk Optimization (20%)**:
  - *5*: Strategic manual chunking, route-based dynamic imports, vendor isolation, initial bundle < 350 kB uncompressed.
  - *3*: Manual chunks configured for vendor libraries, heavy modals lazy loaded, but initial JS payload > 800 kB uncompressed.
  - *1*: Single monolithic bundle > 1.5 MB, no dynamic imports, uncompressed vendor code.
  - *StoreLink Score*: **3.0 / 5.0** (`manualChunks` and `React.lazy` active, but initial bundle ~904 kB due to eager `firebase-firestore` 459 kB chunk).
- **2.3 Core Web Vitals (LCP, INP, CLS) (20%)**:
  - *5*: LCP < 2.5s (critical images preloaded), INP < 200ms, CLS < 0.1 (all media dimensioned), font preloads.
  - *3*: CLS protected via aspect ratio classes, font display swap active, but LCP delayed by universal lazy loading on hero/above-fold images.
  - *1*: CLS > 0.25, un-dimensioned layout shifts, blocking script execution stalling user input.
  - *StoreLink Score*: **3.0 / 5.0** (CLS protected via `aspect-4/3` on product cards; LCP compromised by `loading="lazy"` on above-the-fold cards).
- **2.4 State Management & Firebase SDK Hygiene (20%)**:
  - *5*: Real-time listeners cleaned up on unmount, query result limits, local storage caching with auto-repair, stale chunk auto-recovery.
  - *3*: Basic cleanup present, Firestore queries capped, standard local storage usage.
  - *1*: Memory leaks from orphaned snapshot listeners, uncapped queries fetching thousands of documents.
  - *StoreLink Score*: **4.0 / 5.0** (Exemplary `versionWatcher.ts` for stale chunk recovery, clean Firestore unsubscribe hooks, `limit(100)` query caps).
- **2.5 Error Boundaries & Crash Resilience (20%)**:
  - *5*: Hierarchical Error Boundaries wrapping individual modules/modals, localized recovery actions, telemetry logging.
  - *3*: Global Error Boundary with reset button, but lacks modular sub-tree boundaries.
  - *1*: No Error Boundaries; unhandled JavaScript exception causes blank white screen of death.
  - *StoreLink Score*: **3.0 / 5.0** (Global Arabic Error Boundary with data repair action, but secondary modal crashes bring down entire app).

#### Pillar 3: Security, Privacy & Data Integrity (Weight: 20%)
- **3.1 Firestore Security Rules Rigor (20%)**:
  - *5*: Comprehensive RBAC, server-side price validation, unauthenticated writes strictly blocked, field-level schema assertions.
  - *3*: Multi-tenant store owner isolation enforced, but unauthenticated client writes permitted on orders with structural validation only.
  - *1*: Open read/write rules (`allow read, write: if true`), data leakage between tenants.
  - *StoreLink Score*: **2.0 / 5.0** (CRITICAL: `firestore.rules:114` allows unauthenticated direct order creation without price check; lines 125-128 allow unauthenticated status updates to `Cancelled`/`Delivered`).
- **3.2 Authentication & Session Security (20%)**:
  - *5*: Secure OAuth/Firebase Auth, token expiry handling, encrypted session cookies, no plain/static credentials.
  - *3*: Firebase Auth standard integration, but insecure fallback to client `localStorage` with weak hashing.
  - *1*: Cleartext password storage, easily hijackable sessions.
  - *StoreLink Score*: **2.0 / 5.0** (Silent fallback to `localStorage` user accounts with static salt SHA-256 passwords when Firebase Auth is unavailable without checking `isDemoMode`).
- **3.3 Customer PII Protection (20%)**:
  - *5*: Zero customer PII exposure, masked phone numbers on public tracking URLs, encrypted at rest.
  - *3*: Private order subcollections restricted to store owners, public tracking masks phone numbers, but driver WhatsApp links expose full customer PII.
  - *1*: Publicly queryable customer names, phone numbers, and home addresses.
  - *StoreLink Score*: **3.0 / 5.0** (Public `/tracking/{id}` projection properly masks phone and hides street address; driver WhatsApp URL transmits unencrypted PII).
- **3.4 Injection, XSS & Input Sanitization (20%)**:
  - *5*: Strict CSP headers, safe URL protocol whitelisting, zero `dangerouslySetInnerHTML`, sanitized user inputs.
  - *3*: Clean React JSX escaping, safe URL protocol checks, but CSP missing in hosting configuration.
  - *1*: Direct DOM injection (`innerHTML`), raw URL `href` injection, executable script tags.
  - *StoreLink Score*: **4.0 / 5.0** (Zero `dangerouslySetInnerHTML`, `isValidSafeUrl()` blocks dangerous protocols; CSP configured in `vercel.json` but missing in `firebase.json`).
- **3.5 Payment Integrity & Webhook Verification (20%)**:
  - *5*: Server-side webhook HMAC signature verification, atomic order status update, fail-closed payment state machine.
  - *3*: Serverless webhook written, but hosting rewrites prevent execution; client-side fail-open marks unpaid orders as Paid.
  - *1*: Client controls payment confirmation with zero verification, client sets price and status.
  - *StoreLink Score*: **2.0 / 5.0** (CRITICAL: Firebase Hosting rewrites `/api/*` to `index.html`; client `MoyasarPaymentModal.tsx:196-227` fails open, setting `status: 'Paid'` when API fails).

#### Pillar 4: Saudi Compliance & Regionalization (Weight: 15%)
- **4.1 ZATCA E-Invoicing Phase 1/2 QR Code Compliance (25%)**:
  - *5*: Full Phase 1 TLV Base64 QR code, Phase 2 UBL XML invoice generation, ECDSA cryptographic signatures, FATOORA portal reporting.
  - *3*: Phase 1 TLV Base64 QR code generated and verified, A4 and 80mm thermal receipt formats, but Phase 2 UBL XML/ECDSA absent.
  - *1*: Plain text or non-TLV QR code, missing mandatory seller/VAT fields, non-compliant invoice.
  - *StoreLink Score*: **3.5 / 5.0** (Phase 1 TLV Base64 verified in `zatca.ts`, A4 & 80mm receipt printing in `InvoiceModal.tsx`, but Phase 2 completely absent).
- **4.2 Saudi E-Commerce Law Storefront Disclosures (20%)**:
  - *5*: Commercial Registration (CR), VAT number, registered headquarters address, and Saudi Business Center (SBC) badge prominently displayed in global footer.
  - *3*: Store settings capture CR and VAT numbers, but footer omits them from public storefront rendering.
  - *1*: No legal identification, anonymous merchant storefront.
  - *StoreLink Score*: **2.8 / 5.0** (`Footer.tsx` completely omits CR number, VAT number, physical address, and SBC/Maroof credentials).
- **4.3 Statutory 7-Day Return/Exchange Transparency (20%)**:
  - *5*: 7-day right of withdrawal clearly disclosed during checkout and footer, enforced in backend, rich consumer RMA portal.
  - *3*: Backend enforces 7-day deadline from delivery date, RMA modal active, but minor policy text discrepancy and missing checkout disclosure.
  - *1*: No return policy, refusal of statutory returns, violation of consumer protection regulations.
  - *StoreLink Score*: **4.0 / 5.0** (Backend computes `returnEligibleUntil = deliveryDate + 7 days` in `updateOrderStatus.ts:159`; RMA modal displays Ministry of Commerce legal rights).
- **4.4 Arabic RTL Typography, Localization & SAR Currency (20%)**:
  - *5*: Root RTL mirroring, Cairo/Tajawal font weights, Eastern Arabic digit conversion, diacritic-tolerant search, localized SAR currency formatting.
  - *3*: Proper RTL layout and Arabic search normalization, but inconsistent currency symbol strings across fixtures.
  - *1*: Broken LTR layout, mixed English/Arabic phrases, untranslated checkout.
  - *StoreLink Score*: **4.5 / 5.0** (Exemplary Cairo typography, diacritic normalization in `arabicSearch.ts`, Eastern Arabic digit conversion in `digits.ts`).
- **4.5 Saudi National Address & 15% VAT Display (15%)**:
  - *5*: Structured 4-letter Short Code National Address capture, building number, district; "الأسعار شاملة ضريبة القيمة المضافة 15%" on all prices, itemized VAT in checkout.
  - *3*: City dropdown with GPS pin capture, but unstructured address text; VAT omitted in checkout summary and order database record.
  - *1*: Generic non-Saudi address fields, hidden fees, misleading tax calculations.
  - *StoreLink Score*: **2.7 / 5.0** (Unstructured address textarea, catalog and PDP omit "شامل الضريبة", checkout summary omits 15% VAT line item, `createOrder.ts` omits `vatAmount`).

#### Pillar 5: Merchant Operations & Ergonomics (Weight: 15%)
- **5.1 Order Lifecycle State Machine & Transitions (20%)**:
  - *5*: Formal Finite State Machine (FSM) enforcing legal state transitions, comprehensive immutable audit trail (`statusHistory`).
  - *3*: Courier transitions guarded, but merchant status changes lack FSM validation; single timestamps without audit log array.
  - *1*: Arbitrary status strings, no validation, missing state tracking.
  - *StoreLink Score*: **3.2 / 5.0** (Standard order states defined in `store.ts`, courier actions restricted, but merchant transitions unconstrained and no audit history log).
- **5.2 Return & Exchange Workflow, RMA & Restocking (20%)**:
  - *5*: Rich customer RMA modal, reason categorization, automatic inventory restocking on return, financial refund reconciliation.
  - *3*: Exemplary customer RMA modal, automated restocking when order marked `Returned`, but electronic refund via gateway omits restocking.
  - *1*: No return workflow, manual offline returns only.
  - *StoreLink Score*: **3.8 / 5.0** (Rich RMA modal in `ReturnRequestModal.tsx`, automated restocking in `updateOrderStatus.ts`, but `refundOrder.ts` omits restocking).
- **5.3 Driver Dispatch, GPS Routing & WhatsApp (25%)**:
  - *5*: Zero-app mobile web driver interface, dual-point GPS navigation, COD cash collection instructions, daily driver cash settlement ledger.
  - *3*: Driver dispatch web view present, WhatsApp notifications sent, basic cash tracking.
  - *1*: No courier dispatch tools, merchant manually coordinates deliveries.
  - *StoreLink Score*: **4.6 / 5.0** (Enterprise-grade `DriverDispatchView.tsx`, 1-tap WhatsApp driver link, `DriverSettlementModal.tsx` for daily COD reconciliation).
- **5.4 Inventory Synchronization & Stock Guards (20%)**:
  - *5*: Atomic Firestore transaction stock deductions, out-of-stock CTA disabling, low-stock urgency alerts, multi-warehouse support.
  - *3*: Atomic stock decrements in `createOrder.ts`, out-of-stock badges, urgency flame badge on low stock.
  - *1*: No inventory tracking, frequent overselling.
  - *StoreLink Score*: **4.0 / 5.0** (Atomic decrements in `api/createOrder.ts:175-189`, stock scarcity badges, but legacy store array updates omitted).
- **5.5 Multi-Store Isolation, Ergonomics & Audit (15%)**:
  - *5*: Strict database-level multi-tenant isolation, granular staff RBAC roles, live merchant analytics, multi-channel notifications.
  - *3*: Firestore rules isolate store orders, store switcher in navbar, multi-channel notifications (audio, Telegram, OS), but single owner role only.
  - *1*: Cross-tenant data leakage, confusing merchant interface.
  - *StoreLink Score*: **3.7 / 5.0** (Firestore rules isolate orders by `ownerId`, store switcher in `Navbar.tsx`, order export CSV, audio alerts).

#### Pillar 6: Conversion Rate Optimization & Trust (Weight: 15%)
- **6.1 High-Trust Payment & Security Badges (20%)**:
  - *5*: Mada, Visa, Mastercard, Apple Pay, SAMA, and PCI-DSS badges prominently displayed across header, PDP, cart, checkout, and footer.
  - *3*: Prominent badges inside Checkout and Moyasar modals, but completely omitted from global footer.
  - *1*: No payment logos, generic unbranded checkout, suspicious appearance.
  - *StoreLink Score*: **3.5 / 5.0** (Mada/Visa/Apple Pay badges in `CheckoutModal.tsx:660` and `MoyasarPaymentModal.tsx:376`, but zero badges in `Footer.tsx`).
- **6.2 WhatsApp 1-Tap Ordering & Support (20%)**:
  - *5*: Floating WhatsApp support widget on all pages, pre-filled inquiry on PDP, automated order receipt with clickable tracking link.
  - *3*: WhatsApp links in Hero, PDP, Success, and Tracker, but lacks floating corner widget; WhatsApp invoice lacks clickable URL.
  - *1*: No direct support channel, slow email contact only.
  - *StoreLink Score*: **4.0 / 5.0** (Deep WhatsApp touchpoints across the funnel, but lacks persistent floating widget and URL in `whatsappInvoice.ts:75`).
- **6.3 Frictionless Checkout & Phone Formatting (20%)**:
  - *5*: Zero-login guest checkout, live Saudi phone formatting (+966/05), automated abandoned cart recovery via WhatsApp/SMS.
  - *3*: 100% guest checkout, live phone validation, but abandoned cart recovery functions are orphaned and unused.
  - *1*: Forced registration, rigid phone formatting causing form abandonment, zero cart recovery.
  - *StoreLink Score*: **4.0 / 5.0** (100% unblocked guest checkout, `normalizeSaudiPhoneNumber()`, but `cartRecovery.ts` utility is completely orphaned).
- **6.4 Transparent Delivery Fees & Zero Surprise Costs (20%)**:
  - *5*: Upfront delivery fee calculation, free shipping progress bar, "شامل ضريبة القيمة المضافة 15%" on all prices, zero checkout surprises.
  - *3*: Free shipping progress meter, upfront delivery fee, but total omission of VAT-inclusive text.
  - *1*: Hidden delivery fees revealed only at final payment step, unexpected surcharges.
  - *StoreLink Score*: **3.5 / 5.0** (Clear delivery fee and free shipping bar, but missing mandatory VAT-inclusive notices).
- **6.5 Post-Purchase Tracking & Confirmation (20%)**:
  - *5*: Animated celebration modal, 4-step live order tracker with courier status, 1-tap WhatsApp receipt with direct tracking link.
  - *3*: Clean confirmation modal and tracker modal, but shopper must manually copy order ID; receipt lacks direct tracking URL.
  - *1*: Generic "Order Placed" text, no tracking mechanism, high customer support inquiry volume.
  - *StoreLink Score*: **4.0 / 5.0** (4-step tracker in `OrderTrackerModal.tsx`, WhatsApp receipt generation, but customer must copy order ID).

---

## 3. Prioritized P0 / P1 / P2 Remediation Action Plan

### P0 (Critical / Immediate — Fix within 24–48 Hours)
1. **Fix Firebase Hosting API Routing**:
   - Update `firebase.json` to route `/api/**` to Cloud Functions or Cloud Run so that `/api/createOrder`, `/api/verifyPayment`, `/api/moyasarWebhook`, and `/api/updateOrderStatus` execute server-side instead of returning the SPA `index.html` shell.
2. **Eliminate Unauthenticated Client Direct Order Writes in Firestore**:
   - In `firestore.rules:113-115`, change `allow create:` on `/orders/{orderId}` to `if false;`. Force 100% of order creation through atomic serverless endpoint (`api/createOrder.ts`) with price validation.
3. **Close Payment Verification Fail-Open Loophole**:
   - In `src/components/storefront/MoyasarPaymentModal.tsx:196-227`, remove the catch-block fallback that unconditionally sets `status: 'Paid'`. Fail closed with a clear error if server payment verification does not return `success: true`.
4. **Fix Missing `useMemo` Import in `OrderTrackerModal.tsx`**:
   - In `src/components/storefront/OrderTrackerModal.tsx:1`, add `useMemo` to the React import statement to eliminate TypeScript TS2304 compilation error.
5. **Mandatory Saudi E-Commerce Law Disclosures in Footer**:
   - In `src/components/layout/Footer.tsx`, render merchant Commercial Registration (CR) number, VAT number, physical address, and Saudi Business Center (SBC) / Maroof authentication badges.
6. **Mandatory 15% VAT Transparency**:
   - Add `"الأسعار شاملة ضريبة القيمة المضافة (15%)"` label to `ProductCard.tsx`, `ProductModal.tsx`, `CartDrawer.tsx`, and `CheckoutModal.tsx`.
   - Add itemized 15% VAT line item in checkout review summary (`CheckoutModal.tsx:741`).
   - Persist `vatAmount`, `vatRate`, and `netAmount` on order documents in `api/createOrder.ts`.
7. **Secure Authentication Fallback**:
   - In `src/services/authService.ts:106, 145`, restrict local account creation and login behind `if (isDemoMode)`. Fail closed in production if Firebase Auth is unreachable.

### P1 (High Priority / Near-Term — Next Release Cycle)
1. **Enlarge Mobile Touch Targets to >= 48px**:
   - Upgrade Quick Add button in `ProductCard.tsx:172` from `w-9 h-9` (36px) to `w-12 h-12` (48px).
   - Upgrade quantity buttons in `CartDrawer.tsx:294` from `w-6 h-6` (24px) to `w-10 h-10` (40px with padding).
   - Upgrade PDP quantity buttons in `ProductModal.tsx:285` from `w-7 h-7` (28px) to `w-10 h-10`.
   - Expand search clear button in `Navbar.tsx:344` to `py-2 px-3`.
2. **Activate Abandoned Cart Recovery**:
   - Wire `saveCartForRecovery()` in `src/App.tsx` or `CartDrawer.tsx` on cart changes.
   - Wire `clearCartRecovery()` in `CheckoutModal.tsx` upon successful order completion.
3. **Fix Electronic Refund Restocking Bug**:
   - Update `api/refundOrder.ts:112-147` to execute inventory replenishment when full refunds are processed.
4. **Implement Search Autocomplete Popover**:
   - Upgrade `Navbar.tsx` search inputs to display recent searches, popular categories, and top product matches with thumbnails upon input focus.
5. **Add Multi-Attribute Faceted Filtering**:
   - Introduce an expandable filter drawer in `ProductGrid.tsx` with price range slider, in-stock toggle, and size/color swatches.
6. **Include Clickable Live Tracking URL in WhatsApp Receipts**:
   - In `src/utils/whatsappInvoice.ts:75`, append direct tracking URL: `${window.location.origin}/?store=${settings.slug || ''}&track=${order.id}`.
7. **Embed Payment Trust Badges in Global Footer**:
   - Render official SVG badges for Mada, Visa, Mastercard, and Apple Pay in `src/components/layout/Footer.tsx`.
8. **Split Monolithic `App.tsx` via React Context**:
   - Decompose `App.tsx` (1,257 lines) into `StoreContext`, `CartContext`, `AuthContext`, and `UIModalContext`.
9. **Optimize Core Web Vitals (LCP & Fonts)**:
   - Remove `loading="lazy"` on the first 4 products in `ProductCard.tsx` to optimize LCP.
   - Preload Cairo font files in `index.html`.
10. **Finite State Machine & Status Audit Trail**:
    - Introduce state transition validation matrix in `api/updateOrderStatus.ts`.
    - Add `statusHistory` array (`[{ status, timestamp, changedBy, note }]`) to order records.

### P2 (Strategic / Future Architecture)
1. **ZATCA Phase 2 FATOORA Integration**:
   - Implement UBL 2.1 XML schema generation, ECDSA P-256 cryptographic signing, and automated clearance/reporting with ZATCA FATOORA API.
2. **Transition PDP from Modal to Dedicated Route**:
   - Refactor `ProductModal.tsx` into a dedicated full-page route (`/product/:slug`) with OpenGraph metadata.
3. **Live Carrier Shipping Integrations**:
   - Connect live APIs for SMSA Express, Torod, and Naqel with automated waybill printing.
4. **Enable React 19 Compiler**:
   - Configure `babel-plugin-react-compiler` in `vite.config.ts`.
5. **Lazy-Load Firebase Firestore SDK**:
   - Dynamically import `firebase/firestore` only when opening checkout or merchant dashboard, reducing initial bundle by ~458 kB.
6. **Granular Multi-User Store RBAC**:
   - Support staff sub-accounts (`owner`, `manager`, `courier`, `cashier`) with scoped Firestore permissions.
