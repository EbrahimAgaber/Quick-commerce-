# Technical Architecture, Performance & Security Audit Report (Pillars 2 & 3)

**Target Evaluated**: StoreLink Platform (`c:\Users\User\Desktop\Quick-ecomerece` and `https://quick-ecommerce-saas-app.web.app`)  
**Auditor**: Cloud & Security Architect (`teamwork_preview_explorer_m1_tech_sec`)  
**Evaluation Scope**: 
- **Pillar 2**: Technical Architecture & Core Web Vitals (Weight: 15%)
- **Pillar 3**: Security, Privacy & Data Integrity (Weight: 20%)  
**Audit Date**: 2026-10-20  
**Overall Status**: Functional with High Architectural & Security Gaps (Score: 19.40 / 35.00 | 55.43%)

---

## Executive Summary & Scorecard

| Pillar | Weight | Sub-Criteria Score (1-5 Scale) | Weighted Score | Grade | Status |
| :--- | :---: | :--- | :---: | :---: | :---: |
| **Pillar 2: Technical Architecture & Core Web Vitals** | **15%** | • React 19 Architecture & Hook Hygiene: **2.0 / 5**<br>• Vite Bundle & Optimization: **3.0 / 5**<br>• Core Web Vitals (LCP, INP, CLS): **3.0 / 5**<br>• State & Firebase SDK Hygiene: **4.0 / 5**<br>• Error Boundaries & Resilience: **3.0 / 5** | **9.00 / 15.00**<br>*(60.0%)* | **C** | Functional with Gaps |
| **Pillar 3: Security, Privacy & Data Integrity** | **20%** | • Firestore Security Rules Rigor: **2.0 / 5**<br>• Authentication & Session Security: **2.0 / 5**<br>• Sensitive Customer PII Protection: **3.0 / 5**<br>• Injection, XSS & Input Sanitization: **4.0 / 5**<br>• Payment Integrity & Webhook Verification: **2.0 / 5** | **10.40 / 20.00**<br>*(52.0%)* | **D+** | Critical Vulnerabilities Identified |
| **Combined Pillars 2 & 3 Subtotal** | **35%** | **Raw Composite: 2.78 / 5.00** | **19.40 / 35.00**<br>*(55.43%)* | **C-** | High Priority Remediations Needed |

---

## 1. Observation

Direct observations with file paths, line numbers, tool commands, and verbatim outputs:

### 1.1 Live Hosting Architecture Bifurcation & Serverless Bypass
- **File**: `firebase.json:6-19`
  ```json
  "hosting": {
    "site": "quick-ecommerce-saas-app",
    "public": "dist",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
  ```
- **File**: `vercel.json:58-67`
  ```json
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
  ```
- **Command & Live Response**: `read_url_content(Url: "https://quick-ecommerce-saas-app.web.app/api/createOrder")`
  - Output returned: `<!doctype html><html lang="ar" dir="rtl"><head>...` (the SPA `index.html` shell).
  - Verbatim Log: `api/` serverless functions are completely unrouted on the production Firebase Hosting live site.
- **File**: `src/services/storeManager.ts:1190-1231`
  - Lines 1207-1226:
    ```typescript
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      ...
    }
    // If response is HTML (e.g. Firebase hosting SPA rewrite to /index.html) or non-JSON,
    // proceed safely to verified fallback order engine below.
    ```
  - When `fetch('/api/createOrder')` returns HTML from Firebase Hosting, it silently executes Step 3: `Verified Local Order Engine`.
  - Lines 836-838:
    ```typescript
    const orderRef = doc(db, 'stores', storeId, 'orders', order.id);
    const sanitizedOrder = JSON.parse(JSON.stringify(order));
    await setDoc(orderRef, sanitizedOrder);
    ```
    The browser client writes directly to Firestore via client SDK `setDoc()`.

### 1.2 Firestore Rules Client Write Validation Deficits
- **File**: `firestore.rules:39-49`
  ```javascript
  function isValidNewOrder(data, orderId) {
    return data.keys().hasAll(['id', 'customerName', 'customerPhone', 'city', 'deliveryAddress', 'itemsSummary', 'items', 'subtotal', 'shippingFee', 'grandTotal', 'status', 'paymentMethod']) &&
           data.id is string && (data.id == orderId || orderId.matches('^[a-zA-Z0-9_\\-]+$')) &&
           data.customerName is string && data.customerName.size() > 0 && data.customerName.size() <= 120 &&
           data.customerPhone is string && data.customerPhone.size() >= 8 && data.customerPhone.size() <= 30 &&
           data.city is string && data.city.size() <= 100 &&
           data.deliveryAddress is string && data.deliveryAddress.size() <= 300 &&
           data.grandTotal is number && data.grandTotal >= 0 &&
           data.status in ['Received', 'In Progress', 'Paid'] &&
           data.items is list && data.items.size() > 0 && data.items.size() <= 100;
  }
  ```
- **File**: `firestore.rules:113-115`
  ```javascript
  match /orders/{orderId} {
    allow create: if isValidId(orderId) && isValidNewOrder(request.resource.data, orderId);
    allow get, list: if isStoreOwner(storeId);
  ```
  - `data.status in ['Received', 'In Progress', 'Paid']`: An unauthenticated client can create an order with `status: 'Paid'` directly in Firestore without any gateway verification.
  - No assertion validates item prices against product catalog prices: `data.grandTotal` is only required to be `number >= 0`. An attacker can submit an order with grandTotal = `0.01` SAR.
  - In `firestore.rules:125-128`:
    ```javascript
    (request.resource.data.diff(resource.data).affectedKeys().hasOnly([
       'status', 'driverDeliveredAt', 'driverCashCollected',
       'returnEligibleUntil', 'trackingNotes', 'updatedAt'
     ]) && request.resource.data.status in ['Out for Delivery', 'Delivered', 'Cancelled'])
    ```
    Allows ANY unauthenticated client to update order status to `Cancelled` or `Delivered` and modify `driverCashCollected` without credentials or signed tokens.

### 1.3 TypeScript Compilation Failures in Storefront
- **Command**: `npm run lint` (`tsc --noEmit`)
  - Verbatim Output:
    ```
    src/components/storefront/OrderTrackerModal.tsx(124,28): error TS2304: Cannot find name 'useMemo'.
    src/components/storefront/OrderTrackerModal.tsx(133,34): error TS2304: Cannot find name 'useMemo'.
    src/components/builder/StoreDashboard.tsx(603,22): error TS2345: Argument of type ... is not assignable to parameter of type 'Order[]'. Types of property 'returnStatus' are incompatible.
    api/updateOrderStatus.ts(282,27): error TS2339: Property 'status' does not exist on type '{ id: any; }'.
    tests/returnsAndDeliveryE2E.test.ts(31,9): error TS2739: Type ... is missing properties from type 'Product'.
    tests/returnsAndDeliveryE2E.test.ts(74,7): error TS2353: Object literal may only specify known properties, and 'enableCOD' does not exist in type 'StoreSettings'.
    ```
  - In `src/components/storefront/OrderTrackerModal.tsx:1`:
    `import React, { useState, useEffect } from 'react';` (missing `useMemo`).
  - At runtime, opening the OrderTrackerModal triggers `ReferenceError: useMemo is not defined`, unmounting the component tree to the global `ErrorBoundary`.

### 1.4 Bundle Distribution & Chunk Splitting
- **Command**: `npm run build` (`vite build`)
  - Chunks generated:
    - `dist/assets/firebase-firestore-CYfPB8SX.js`: **458.96 kB** (gzip: 137.33 kB)
    - `dist/assets/react-vendor-C68K-DXb.js`: **210.91 kB** (gzip: 65.85 kB)
    - `dist/assets/index-D0FnN5SS.js`: **206.25 kB** (gzip: 57.96 kB)
    - `dist/assets/StoreDashboard-DuGUGC-u.js`: **128.61 kB** (gzip: 26.00 kB)
    - `dist/assets/firebase-auth-D9IJXjbE.js`: **108.02 kB** (gzip: 32.49 kB)
    - `dist/assets/icons-D6EwsMdq.js`: **28.06 kB** (gzip: 10.25 kB)
    - `dist/assets/index-BST9eaIP.css`: **70.76 kB** (gzip: 12.16 kB)
  - Initial JS payload required on root visit: **~904 kB uncompressed** (~265 kB gzipped).
  - Code splitting via `React.lazy()` in `App.tsx:37-63` successfully isolates `StoreDashboard`, `StoreOnboardingWizard`, `BrandCustomizerModal`, `DriverDispatchView`, `AuthModal`, `CheckoutModal`, `OrderTrackerModal`.

### 1.5 Authentication Local Fallback Vulnerability
- **File**: `src/services/authService.ts:37-44, 106-137, 145-180`
  ```typescript
  async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`storelink_salt_${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  ```
  - When Firebase Auth returns `network-request-failed` or `api-key-not-valid`, code falls back to `getLocalAccounts()` and saves user accounts in `localStorage` under `storelink_local_accounts_v2`.
  - Password hashing uses static salt and client-side SHA-256 (insecure against rainbow tables / GPU cracking).
  - Code does NOT check `isDemoMode` before falling back to local accounts.

### 1.6 Payment Verification Fail-Open Behavior
- **File**: `src/components/storefront/MoyasarPaymentModal.tsx:196-238`
  - In `handlePaymentCompletion`:
    ```typescript
    try {
      const verifyRes = await fetch('/api/verifyPayment', ...);
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        if (data.success) serverVerified = true;
      }
    } catch (e) {
      // Fallback to local verified order update
    }
    const updatedOrder: Order = { ...order, status: 'Paid', paymentId };
    await StoreManager.updateOrderInStore(targetStoreId, updatedOrder);
    setPaymentSuccess(true);
    onPaymentSuccess(updatedOrder);
    ```
  - If `/api/verifyPayment` fails or is unreachable (which it is on Firebase Hosting), `serverVerified` remains false, yet the order is unconditionally marked as `'Paid'` and confirmed to the customer and merchant.

### 1.7 Positive Implementations (Observed Strengths)
- **Version Watcher & Stale Chunk Auto-Recovery** (`src/utils/versionWatcher.ts:1-113`): Catches `vite:preloadError`, dynamic import errors, and checks `/version.json` on tab focus with sessionStorage debouncing.
- **Customer PII Redaction in Tracking Projection** (`src/services/storeManager.ts:842-856, 893-917`): Public collection `/tracking/{orderId}` explicitly masks phone numbers (`***-****-1234`) and excludes customer street address, real name, and notes.
- **XSS Immunity**: Zero `dangerouslySetInnerHTML`, zero `eval()`, zero unvalidated DOM injections.
- **URL Protocol Sanitization** (`src/utils/security.ts:9-31`): `isValidSafeUrl()` strictly blocks `javascript:`, `data:`, `vbscript:`.
- **CLS Image Guards** (`src/components/storefront/ProductCard.tsx:60`): Locks aspect ratio with `aspect-4/3` and skeleton background.

---

## 2. Logic Chain

1. **Premise 1 (Deployment Configuration)**:
   - `firebase.json:14-19` specifies a single SPA rewrite: `{"source": "**", "destination": "/index.html"}`.
   - Live HTTP probe to `https://quick-ecommerce-saas-app.web.app/api/createOrder` confirms that all `/api/*` endpoints return `text/html`.
   - Therefore, no serverless functions execute on the production Firebase Hosting environment.

2. **Premise 2 (Runtime Fallback Execution)**:
   - `src/services/storeManager.ts:1207-1229` inspects the response Content-Type from `/api/createOrder`. When it is HTML (as on Firebase Hosting), it drops into Step 3 (`Verified Local Order Engine`).
   - In Step 3, the browser client calculates order pricing and calls `setDoc(doc(db, 'stores', storeId, 'orders', order.id), sanitizedOrder)`.
   - Therefore, the client browser performs direct client-side database writes to Firestore in production.

3. **Premise 3 (Security Rules Inadequacy)**:
   - `firestore.rules:114` allows unauthenticated creation of orders via `isValidNewOrder()`.
   - `isValidNewOrder()` only checks structural types (e.g., `data.grandTotal >= 0`, `data.status in ['Received', 'In Progress', 'Paid']`).
   - It cannot cross-reference product document prices in `/stores/{storeId}/products/{productId}` or calculate math sums across array maps.
   - Therefore, an unauthenticated client can craft a direct Firestore SDK write with an arbitrary item price (e.g., 0.01 SAR) or `status: 'Paid'`, bypassing payment and inventory controls.

4. **Premise 4 (Payment Gateway Bypass)**:
   - `MoyasarPaymentModal.tsx:196-227` attempts to call `/api/verifyPayment`.
   - Because `/api/verifyPayment` returns HTML on Firebase Hosting, the `fetch` triggers an error or non-JSON response.
   - The catch block executes: the application updates the order status to `status: 'Paid'`, writes it to the local store and Firestore, and fires `onPaymentSuccess()`.
   - Therefore, payment verification fails open, allowing unpaid or simulated orders to be registered as Paid.

5. **Premise 5 (Frontend Architecture & Performance)**:
   - `src/App.tsx` contains 1,257 lines of code with over 20 top-level `useState` hooks and 0 React Context providers.
   - Any state change in the shopping cart (`cartCount`), search query (`searchQuery`), or active category (`activeCategory`) forces a re-render of `App.tsx` and all child components (`Navbar`, `ProductGrid`, `HeroBanner`, `CartDrawer`).
   - The initial uncompressed JavaScript bundle is ~904 kB because `firebase-firestore` (458.96 kB) is eagerly bundled into the entry dependency graph.
   - All product images in `ProductCard.tsx:65` specify `loading="lazy"`, which delays the Largest Contentful Paint (LCP) for above-the-fold cards.
   - `OrderTrackerModal.tsx` calls `useMemo` without importing it, causing a compilation error and potential runtime crash.

---

## 3. Caveats

1. **Vercel vs. Firebase Hosting Dual Deployment**:
   - The codebase contains both `firebase.json` and `vercel.json`. `vercel.json` contains proper rewrites for `/api/(.*)` to serverless functions.
   - If StoreLink is deployed to Vercel with Node.js runtime and environment variables configured, the serverless endpoints in `api/` would execute.
   - However, the authoritative live production target specified for this audit is `https://quick-ecommerce-saas-app.web.app` (Firebase Hosting), where the serverless endpoints fail completely.
2. **Third-Party Rate Limits**:
   - Moyasar live API calls could not be tested against live Saudi bank cards due to audit safety guidelines; analysis was based on static code tracing of `api/moyasarWebhook.ts`, `api/verifyPayment.ts`, and `MoyasarPaymentModal.tsx`.
3. **No Firestore Emulator Unit Tests Executed**:
   - While `@firebase/rules-unit-testing` is installed in `devDependencies`, existing access control tests in `tests/accessControl.test.ts` only performed regex checks on `firestore.rules`. Live emulator execution was not configured in CI.

---

## 4. Conclusion & Detailed Scores

StoreLink possesses a sophisticated feature set, responsive RTL mobile layout, resilient client-side storage recovery, and well-designed serverless code in `api/`. However, an architectural disconnect exists between the Firebase Hosting deployment and the backend APIs, creating severe security vulnerabilities where the client writes directly to Firestore without server-authoritative price or payment enforcement.

### 4.1 Pillar 2: Technical Architecture & Core Web Vitals (Score: 9.00 / 15.00 | 60.0%)

| Sub-Criterion | Score (1-5) | Weight | Weighted Score | Key Findings & Evidence |
| :--- | :---: | :---: | :---: | :--- |
| **2.1 React 19 Architecture & Hook Hygiene** | **2.0** | 20% | 0.40 | React 19 is installed (`package.json:33`), but React Compiler (`babel-plugin-react-compiler`) is not configured in `vite.config.ts`. Missing `useMemo` import in `OrderTrackerModal.tsx:124,133` causes TypeScript compilation error TS2304. Monolithic state management in `App.tsx` (1,257 lines) with 0 Context providers causes top-down re-render thrashing. |
| **2.2 Vite Bundle Configuration & Splitting** | **3.0** | 20% | 0.60 | `vite.config.ts:37-51` implements `manualChunks` for `react-vendor`, `firebase-auth`, `firebase-firestore`, and `icons`. `App.tsx:37-63` code-splits heavy modals via `React.lazy()`. However, initial uncompressed bundle is ~904 kB (~265 kB gzip) due to eager inclusion of Firebase Firestore (458.96 kB). |
| **2.3 Core Web Vitals (LCP, INP, CLS)** | **3.0** | 20% | 0.60 | **CLS**: Excellent aspect-ratio protection (`ProductCard.tsx:60` aspect-4/3). **Fonts**: Cairo font loaded via Google Fonts with `display=swap` (`index.html:17`), but lacks `<link rel="preload">` for font files. **LCP**: All product cards use `loading="lazy"` (`ProductCard.tsx:65`), which delays loading above-the-fold images. **INP**: Cart modifications and typing in search cause synchronous full-tree reconciliations. |
| **2.4 State Management & Firebase SDK Hygiene** | **4.0** | 20% | 0.80 | Clean event listener and auth subscription teardown in `App.tsx:183-188, 212-214`. Firestore queries capped with `limit(100)` (`storeManager.ts:752`). Stale chunk auto-recovery and version monitoring via `versionWatcher.ts`. Robust local storage caching with corruption repair (`StoreStorage.resetToDefault()`). |
| **2.5 Error Boundaries & Crash Resilience** | **3.0** | 20% | 0.60 | Global `ErrorBoundary` (`main.tsx:11`) provides localized Arabic UI, error logs, and one-click data repair (`handleRepairAndReset`). However, lack of granular component/modal ErrorBoundaries means a single unhandled error in a secondary modal unmounts the entire storefront. |
| **Pillar 2 Total** | **3.00 / 5.0** | **15%** | **9.00 / 15.00** | **Functional with Gaps** |

### 4.2 Pillar 3: Security, Privacy & Data Integrity (Score: 10.40 / 20.00 | 52.0%)

| Sub-Criterion | Score (1-5) | Weight | Weighted Score | Key Findings & Evidence |
| :--- | :---: | :---: | :---: | :--- |
| **3.1 Firestore Security Rules Rigor** | **2.0** | 20% | 0.40 | **Critical**: `firestore.rules:114` allows unauthenticated clients to create orders directly via `isValidNewOrder()`. Rules do not validate product prices or compute order totals. `firestore.rules:125-128` permits unauthenticated clients to update order status to `Cancelled` or `Delivered` and modify `driverCashCollected`. Multi-tenant store owner isolation on `/merchants` and `/stores/{id}/private` is well-implemented (lines 53, 99). |
| **3.2 Authentication & Session Security** | **2.0** | 20% | 0.40 | Firebase Auth handles Google and Email/Password (`firebase.ts:103-145`). However, `authService.ts:106-137` silently falls back to unencrypted `localStorage` password storage (`storelink_local_accounts_v2`) using a static salt and SHA-256 without checking `isDemoMode`. Local fallback users have no Firebase ID token, causing cloud writes to fail. |
| **3.3 Customer PII Protection** | **3.0** | 20% | 0.60 | **Positive**: Public tracking projection `/tracking/{orderId}` redacts customer name, address, and masks phone (`***-****-1234`). Subcollection `/orders` restricts `get, list` to store owner (`firestore.rules:115`). **Weakness**: `generateDriverWhatsAppMessage` (`driverDispatch.ts:31-36`) transmits raw customer name, phone, full address, and GPS link over unencrypted WhatsApp URL parameters. |
| **3.4 Injection, XSS & Input Sanitization** | **4.0** | 20% | 0.80 | Zero `dangerouslySetInnerHTML`, zero `eval()`. Safe URL protocol enforcement via `isValidSafeUrl()` (`security.ts:9-31`). Phone and Arabic-Indic digit normalization (`security.ts:36-58`). **Weakness**: Content-Security-Policy (CSP) is configured in `vercel.json` but completely absent from `firebase.json` headers. |
| **3.5 Payment Integrity & Verification** | **2.0** | 20% | 0.40 | Serverless webhook and verify scripts (`api/moyasarWebhook.ts`, `api/verifyPayment.ts`) are well-architected. However, because `firebase.json` does not route `/api/*`, client-side fallback in `MoyasarPaymentModal.tsx:196-227` fails open: when `/api/verifyPayment` fails, the client marks the order as `status: 'Paid'` anyway. |
| **Pillar 3 Total** | **2.60 / 5.0** | **20%** | **10.40 / 20.00** | **Critical Security Flaws Identified** |

---

## 5. Prioritized Remediation Roadmap (P0 / P1 / P2)

### P0 (Critical / Immediate — Fix within 24-48 hours)
1. **Fix Live API Routing on Firebase Hosting**:
   - Update `firebase.json` to route `/api/**` to Cloud Functions or Cloud Run:
     ```json
     "rewrites": [
       { "source": "/api/**", "function": "api" },
       { "source": "**", "destination": "/index.html" }
     ]
     ```
   - Alternatively, deploy the full application to Vercel where `vercel.json` correctly routes `/api/(.*)`.
2. **Eliminate Client-Side Direct Order Creation in Firestore**:
   - In `firestore.rules:113-115`, change `allow create:` on `/orders/{orderId}` to `if false;`.
   - Force 100% of orders through the serverless `api/createOrder.ts` endpoint where prices, stock, VAT, and promo codes are verified in an atomic transaction.
3. **Close Payment Verification Fail-Open Loophole**:
   - In `src/components/storefront/MoyasarPaymentModal.tsx:196-227`, remove the catch-block fallback that sets `status: 'Paid'`. If server verification does not return `success: true`, reject order confirmation and prompt the user to contact support with their payment reference.
4. **Fix Missing `useMemo` Import in `OrderTrackerModal.tsx`**:
   - In `src/components/storefront/OrderTrackerModal.tsx:1`, change import to:
     `import React, { useState, useEffect, useMemo } from 'react';`
5. **Secure Authentication Fallback**:
   - In `src/services/authService.ts:106, 145`, strictly gate local account creation and login behind `if (isDemoMode)`. In production, fail closed with a user-friendly error message if Firebase Auth is unreachable.

### P1 (High Priority / Near-Term — Next Release Cycle)
1. **Split Monolithic `App.tsx` via React Context**:
   - Extract state into domain contexts: `StoreContext`, `CartContext`, `AuthContext`, and `UIModalContext`.
   - Prevent whole-tree re-renders when shoppers add items to cart or filter catalog categories.
2. **Add Content Security Policy (CSP) to `firebase.json`**:
   - Port the robust CSP header defined in `vercel.json:26-28` into `firebase.json` headers for `quick-ecommerce-saas-app.web.app`.
3. **Optimize Core Web Vitals (LCP & Fonts)**:
   - In `src/components/storefront/ProductCard.tsx:65`, remove `loading="lazy"` for the first 4 products rendered in the grid, or add `priority={index < 4}`.
   - Preload Cairo font files in `index.html` to eliminate FOIT/FOUT.
4. **Driver Dispatch Token Authentication**:
   - Replace open unauthenticated status updates in `firestore.rules:125-128` with a signed single-use dispatch token verified via `api/updateOrderStatus.ts`.
5. **Granular Error Boundaries**:
   - Wrap secondary modals (`OrderTrackerModal`, `CheckoutModal`, `BrandCustomizerModal`) in isolated `<ErrorBoundary>` wrappers so unexpected modal crashes do not unmount the storefront.

### P2 (Strategic / Future Architecture)
1. **Enable React 19 Compiler**:
   - Configure `babel-plugin-react-compiler` in `vite.config.ts` to automatically memoize component props and hooks without manual `useMemo` / `useCallback`.
2. **Lazy-Load Firebase Firestore SDK**:
   - Refactor `src/services/firebase.ts` to dynamically import `firebase/firestore` only when the shopper opens checkout or when a merchant logs into the dashboard, reducing initial JavaScript download by ~458 kB.
3. **Automated Firestore Rules CI Emulation**:
   - Implement automated unit tests using `@firebase/rules-unit-testing` in GitHub Actions to assert that unauthenticated client tampering of order prices and status updates fails at the security rules layer.

---

## 6. Verification Method

To independently verify these findings, execute the following commands in the workspace root (`c:\Users\User\Desktop\Quick-ecomerece`):

1. **Verify TypeScript compilation errors**:
   ```powershell
   npm run lint
   ```
   *Expected Result*: Fails with code 1 showing `TS2304: Cannot find name 'useMemo'` at `src/components/storefront/OrderTrackerModal.tsx:124,133`.

2. **Verify live Firebase Hosting API rewrite bypass**:
   ```powershell
   curl -I https://quick-ecommerce-saas-app.web.app/api/createOrder
   ```
   *Expected Result*: Returns `HTTP/2 200` with `content-type: text/html; charset=utf-8` instead of `application/json`, proving that API endpoints are unhandled and rewritten to SPA `index.html`.

3. **Verify Vite bundle chunk output**:
   ```powershell
   npm run build
   ```
   *Expected Result*: Outputs bundle assets including `firebase-firestore-*.js` (458.96 kB), `react-vendor-*.js` (210.91 kB), and `index-*.js` (206.25 kB).

4. **Verify test suite behavior**:
   ```powershell
   npm run test
   ```
   *Expected Result*: Vitest runs 14 test files (101 tests pass). Review stderr logs to observe:
   `API /api/createOrder offline or unreachable, using verified local order engine: Failed to parse URL from /api/createOrder`.

5. **Files to Inspect Directly**:
   - `firestore.rules`: lines 39-49 (`isValidNewOrder`), lines 113-135 (`match /orders/{orderId}`).
   - `firebase.json`: lines 14-19 (rewrites to `/index.html`).
   - `src/services/storeManager.ts`: lines 836-838 (direct Firestore `setDoc`), lines 1190-1231 (`submitOrderToServer` HTML fallback).
   - `src/components/storefront/MoyasarPaymentModal.tsx`: lines 196-227 (payment verification fail-open).
   - `src/services/authService.ts`: lines 106-137 (`storelink_local_accounts_v2` fallback).
