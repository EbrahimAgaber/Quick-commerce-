# Master Critical Code Review & Architectural Vulnerability Audit: Quick-eCommerce Platform

**Document Version:** 1.0.0  
**Audit Classification:** Technical Audit / Security & Business Logic Review  
**Target System:** Quick-eCommerce Enterprise SaaS (`c:\Users\User\Desktop\Quick-ecomerece`)  
**Evaluation Scope:** Frontend SPA (React 19 / Vite), Serverless API Handlers (`api/*`), Database Security Rules (`firestore.rules`), Business Services (`src/services/*`), and Accounting Utilities (`src/utils/*`)  
**Date:** October 24, 2026  
**Auditor:** Teamwork Preview Audit Synthesis Working Group  

---

## 1. Executive Summary & Audit Scope

### 1.1 Context & Objectives
An exhaustive, forensic code review was executed across the entire Quick-eCommerce repository to evaluate role boundary enforcement, confidentiality guarantees, hardcoded stubs, and financial calculation integrity. Quick-eCommerce operates as a multi-tenant e-commerce platform and on-demand delivery network serving Saudi Arabian merchants and local couriers ("captains").

The audit investigated three core pillars:
1. **Requirement R1 (Confidentiality & Access Control):** Information leakage between platform owners, merchants, delivery couriers, and customers, specifically the unauthorized exposure of the Platform Owner's delivery commission margin (1.0% – 2.5%) inside merchant-facing management views, along with role overexposure in database security rules.
2. **Requirement R2 (Hardcoded Entities & Mock Data):** Discovery and forensic cataloging of hardcoded driver profiles, bypass activation tokens, static geolocation waypoints, hardcoded sandbox secrets, test payment fallbacks, truncated crypto keys, and mock catalog/review datasets.
3. **Requirement R3 (Business Logic, Registration & Fee Calculation):** Systematic review of the driver onboarding lifecycle, dispatch settlement ledgers, shipping fee schemas, revenue recognition formulas, and state concurrency synchronization.

### 1.2 Comprehensive Audit Perimeter
The audit inspected 100% of the active repository code, including:
- **Client Presentation & Component Trees:** `src/components/builder/*`, `src/components/admin/*`, `src/components/captain/*`, `src/components/driver/*`, and `src/components/storefront/*`.
- **Domain Business Services:** `src/services/captainService.ts`, `src/services/storeManager.ts`, `src/services/storeStorage.ts`, `src/services/zatcaPhase2Engine.ts`, `src/services/carrierService.ts`, and `src/services/firebase.ts`.
- **Serverless API Handlers:** `api/createOrder.ts`, `api/updateOrderStatus.ts`, `api/verifyPayment.ts`, `api/moyasarWebhook.ts`, `api/_notifications.ts`, `api/refundOrder.ts`, and `api/geo/nationalAddress.ts`.
- **Infrastructure & Access Controls:** `firestore.rules`, Firebase Admin configuration, and local storage state persistence layers.

### 1.3 High-Level Findings Summary
The audit confirmed critical structural and financial vulnerabilities:
- **Commercial Confidentiality Breach:** The platform owner's driver commission fee structure (1.0% – 2.5%), total platform delivery margin revenues in SAR, and owner approval controls are directly exposed to every merchant in the Store Settings tab.
- **Critical Auth Bypasses & Takeover Vectors:** Delivery captains can be hijacked simply by typing their phone number into the registration form. Master bypass codes (`QUICK-CAPTAIN-2026`, `SAMA-DELIVERY-2026`, `CAPTAIN100`) compiled into client JavaScript allow unvetted drivers to self-activate. Furthermore, `api/updateOrderStatus.ts` contains an explicit bypass for `store_aurora_01` that waives merchant authentication in production.
- **Severe Financial & Accounting Errors:** The driver cash settlement ledger uses zero-floor clamping (`Math.max(0, totalCodCash - totalDriverEarnings)`). When drivers deliver prepaid electronic orders, this formula wipes out the merchant's financial debt to the driver, generating false WhatsApp receipts indicating 0 SAR due. In addition, delivery fees are hardcoded to 25 SAR, ignoring store settings.
- **Privacy & Compliance Violations:** Customer order PII across all stores is scraped and exposed to any logged-in courier in `CaptainPortalModal.tsx`. Merchant bank IBANs and private driver contacts are saved directly into public Firestore documents. Fabricated 5-star customer reviews are injected into Google Product Schema.org JSON-LD, exposing merchants to Google Search manual spam actions.

---

## 2. Prioritized Severity & Risk Matrix

### 2.1 Risk Classification Rubric
Findings are categorized based on the Common Weakness Scoring System (CWSS) and OWASP Risk Assessment Methodology:
- **CRITICAL:** Direct account takeover, financial loss, unrestricted database tampering, or active commercial confidentiality exposure. Requires immediate hotfix.
- **HIGH:** Tenant isolation breakdown, multi-tenant customer PII leaks, severe accounting formula bugs, regulatory non-compliance (ZATCA, Saudi PDPL), or production auth bypasses.
- **MEDIUM:** Algorithmic review fabrication (SEO penalty risks), floating-point Halala truncation, state mutation race conditions, or hardcoded fallback coordinates.
- **LOW:** Code cleanliness, redundant fallbacks, or minor logging hygiene.

### 2.2 Master Vulnerability Matrix

| Finding ID | Severity | Category | Vulnerability Summary | Primary Affected Files | Impact Area |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-R1-01** | **CRITICAL** | Confidentiality Leak | Platform Owner Driver Commission (1%–2.5%) & Total Margin Revenue Exposed to Merchants | `SettingsTab.tsx:1310-1311`<br>`MerchantCaptainsDirectory.tsx:31-35, 112, 126-127, 308-309, 358-372, 396-403, 419-439` | Business / Margin Breach |
| **SEC-R1-02** | **CRITICAL** | Authorization (RBAC) | Insecure Firestore Security Rules on `/captains`, `/orders`, and `/stores` | `firestore.rules:90-96, 126-129, 140-150` | Database Integrity & Tampering |
| **LOG-R3-01** | **CRITICAL** | Authentication / Takeover | Phone-Based Driver Account Takeover & Passwordless Login | `captainService.ts:143-151`<br>`CaptainPortalModal.tsx:110-123` | Driver Account Takeover |
| **SEC-R2-01** | **CRITICAL** | Auth Bypass | Hardcoded Master Captain Activation Codes (`QUICK-CAPTAIN-2026`, etc.) in Production Bundle | `captainService.ts:223-228`<br>`CaptainPortalModal.tsx:387-389` | Unauthorized Courier Onboarding |
| **SEC-R2-03** | **CRITICAL** | Production Auth Bypass | Production Authentication Bypass for `store_aurora_01` in Serverless API | `api/updateOrderStatus.ts:140`<br>`storeManager.ts:834, 942, 1064` | Unauthenticated Order Tampering |
| **SEC-R1-03** | **HIGH** | Multi-Tenant Privacy | Cross-Tenant Customer Order PII Scraping Across Stores in Driver Portal | `CaptainPortalModal.tsx:69-86, 480-508` | Saudi PDPL / Data Leak |
| **SEC-R1-04** | **HIGH** | Information Leak | Merchant Bank IBANs, Driver Contacts & Webhooks Saved to Public Firestore Doc | `storeManager.ts:592-609`<br>`firestore.rules:90-93` | Financial Reconnaissance |
| **LOG-R3-02** | **HIGH** | Financial Logic | Zero-Floor Settlement Clamping Concealing Merchant Debt to Drivers on Prepaid Orders | `driverDispatch.ts:73`<br>`DriverSettlementModal.tsx:71` | Driver Wage Theft / Accounting Distortion |
| **LOG-R3-03** | **HIGH** | Financial Logic | Hardcoded 25 SAR Delivery Fee Overriding Merchant & Customer Shipping Settings | `CaptainPortalModal.tsx:168`<br>`captainService.ts:353` | Financial Ledger Discrepancies |
| **LOG-R3-04** | **HIGH** | Configuration Mismatch | Inconsistent Shipping Rate Field Names (`standardShippingRate` vs `shippingFee`) | `SettingsTab.tsx:656-657`<br>`api/createOrder.ts:279`<br>`storeManager.ts:1447-1450` | Customer Checkout Jumping Fees |
| **LOG-R3-05** | **HIGH** | Financial Telemetry | Gross Revenue & AOV Overstatement: Failure to Exclude Returned & Refunded Orders | `OrdersTab.tsx:68-69`<br>`StoreDashboard.tsx:399-400` | Distorted Financial Reporting |
| **LOG-R3-08** | **HIGH** | Authorization | Unauthenticated Order Cancellation via `/api/updateOrderStatus` | `api/updateOrderStatus.ts:120-137` | Denial of Service / Sabotage |
| **SEC-R2-04** | **HIGH** | Payment Integrity | Sandbox Key Fallback, Fake Payment IDs & Client-Side Payment Verification Bypasses | `MoyasarPaymentModal.tsx:37, 191-199, 226-232` | Free Purchase Exploitation |
| **SEC-R2-05** | **HIGH** | Regional Compliance | Non-Compliant ZATCA Phase 2 Engine: Static Truncated Keys, Fake Hashes & Fixed CRN | `zatcaPhase2Engine.ts:111, 166-172, 188`<br>`zatca.ts:177-186` | ZATCA Invalidation Penalties |
| **LOG-R3-06** | **MEDIUM** | State Concurrency | React State Mutation Race Condition & Stale Closure Clobbering in Store Dashboard | `StoreDashboard.tsx:425-443`<br>`App.tsx:650-671` | Lost State / Inventory Drift |
| **LOG-R3-07** | **MEDIUM** | Database Concurrency | Non-Atomic Stock Restocking in `/api/updateOrderStatus` Lacking Firestore Transactions | `api/updateOrderStatus.ts:240-279` | Inventory Overselling |
| **SEC-R2-02** | **MEDIUM** | Geolocation | Universal Riyadh Olaya Fallback (`24.7136, 46.6753`) for Unknown Cities & Stores | `cityUtils.ts:5-41, 96, 111`<br>`nationalAddress.ts:18-41, 121, 147` | Corrupted Dispatch Distances |
| **SEC-R2-06** | **MEDIUM** | SEO / Search Integrity | Algorithmic 5-Star Reviews Fabricated in Product Schema.org JSON-LD | `seoManager.ts:252-308`<br>`storeStorage.ts:180-207` | Google Manual Spam Penalty |
| **SEC-R1-05** | **MEDIUM** | Cryptographic Weakness | Deterministic Order Delivery PIN Derivation from Order ID Digits | `whatsappInvoice.ts:48-52`<br>`api/updateOrderStatus.ts:128-136` | Fraudulent Delivery Confirmations |
| **LOG-R3-09** | **MEDIUM** | Financial Precision | Halala Precision Rounding Errors (`.toFixed(1)`) & Delivery Replay Inflation | `CaptainPortalModal.tsx:451, 456`<br>`captainService.ts:371-373` | Minor Ledger Drift / Replay Exploit |

---

## 3. Deep-Dive Section R1: Confidentiality & Role Boundary Violations

---

### 3.1 SEC-R1-01: Platform Owner Driver Commission Fee Margin Leak (1% - 2.5%) in Merchant Settings

#### Exact File Paths & Line Ranges
- `src/components/builder/dashboard/SettingsTab.tsx:32, 1310-1311`
- `src/components/admin/MerchantCaptainsDirectory.tsx:31-35, 112, 126-127, 308-309, 358-372, 396-403, 419-439`
- `src/services/captainService.ts:9, 45-93`

#### Verbatim Code Evidence
In `SettingsTab.tsx` (the merchant dashboard settings view):
```tsx
// Line 32
import { MerchantCaptainsDirectory } from '../../admin/MerchantCaptainsDirectory';

// Lines 1310-1311
{/* Verified Captains Network */}
<MerchantCaptainsDirectory settings={editableSettings} storeSlug={storeSlug} />
```

In `MerchantCaptainsDirectory.tsx`:
```tsx
// Lines 31-35
export const MerchantCaptainsDirectory: React.FC<MerchantCaptainsDirectoryProps> = ({
  settings,
  storeSlug,
  isPlatformOwner = true, // By default enabled so store owners can both dispatch & approve their couriers
}) => {
```
```tsx
// Line 112
const totalPlatformCommissionsEarned = captains.reduce((sum, c) => sum + (c.totalPlatformCommission || 0), 0);
```
```tsx
// Lines 126-127
<p className="text-xs text-stone-500 mt-0.5">
  نظام ديناميكي متكامل لتسجيل الكباتن، اعتماد وتفعيل الحسابات بأكواد رسمية، وإسناد الطلبات مع تحصيل نسبة المنصة (1% - 2.5%)
</p>
```
```tsx
// Lines 308-309
الكباتن المسجلون هنا لا يمكنهم رؤية أو استلام أي طلبات حتى تقوم كمالك للمنصة بالاتفاق معهم على نسبة رسوم المنصة (مثلاً 1% إلى 2.5%) والضغط على زر "تفعيل وإرسال كود التفعيل"...
```
```tsx
// Lines 358-372
<span className="font-bold text-stone-700">نسبة عمولة المنصة المتفق عليها:</span>
<div className="flex items-center gap-1">
  {[1.0, 1.5, 2.0, 2.5].map((pct) => (
    <button
      key={pct}
      type="button"
      onClick={() => setCustomFees({ ...customFees, [cap.id]: pct })}
      className={...}
    >
      {pct}%
    </button>
  ))}
</div>
```
```tsx
// Lines 396-403
{/* Platform Commission Summary Card */}
<div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-4">
  <div>
    <span className="text-xs text-emerald-800 font-bold block">إجمالي أرباح وعمولات المنصة المحصلة من التوصيل:</span>
    <span className="text-xl font-black text-emerald-950 font-mono">
      {totalPlatformCommissionsEarned.toFixed(2)} SAR
    </span>
  </div>
```
```tsx
// Lines 419-439
<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
  نسبة المنصة: {cap.platformFeePercent}%
</span>
...
<strong className="text-stone-900">{cap.totalDeliveryFeesEarned.toFixed(2)} SAR</strong>
...
<strong className="text-emerald-700 font-bold">{cap.totalPlatformCommission.toFixed(2)} SAR</strong>
```

#### Root-Cause Analysis
1. **Architectural Role Conflation:** The platform architecture conflated "Store Owner" (tenant merchant running an online boutique) with "Platform Owner" (the SaaS platform operator).
2. **Improper Mounting Point:** An internal platform operator component (`MerchantCaptainsDirectory.tsx` located in `src/components/admin/`) was mounted directly into the merchant's store settings (`SettingsTab.tsx:1311`).
3. **Insecure Default Prop:** The prop `isPlatformOwner = true` defaults to `true`. This grants any tenant merchant full super-admin powers: viewing platform margins, modifying courier commission splits, and auditing national courier earnings.
4. **Unpartitioned Client Cache:** In `captainService.ts:88-89`, `fetchCaptainsFromCloud()` caches all platform couriers into `localStorage['quick_ecommerce_captains_v2']` and broadcasts them via window events, allowing any merchant client script or DevTools inspection to extract confidential platform fee data.

#### Downstream Technical and Business Impact
- **Severe Commercial Breach:** Merchants can observe the exact net margin (1% to 2.5%) the SaaS platform takes on delivery transactions. This undermines platform pricing power, causes contract friction, and allows merchants to collude with drivers off-platform.
- **Unauthorized Commission Tampering:** Any merchant can click "تفعيل الحساب" and alter a courier's agreed platform fee percentage across the national network, directly defrauding the SaaS platform of transaction revenue.
- **Exposure of Driver PII & Financials:** Merchants can view national IDs (`idNumber`), bank IBANs, and total accumulated earnings of all couriers in Saudi Arabia, violating courier confidentiality.

#### Actionable Remediation Code Diff
1. **Remove `MerchantCaptainsDirectory` from `SettingsTab.tsx`:**
```diff
--- a/src/components/builder/dashboard/SettingsTab.tsx
+++ b/src/components/builder/dashboard/SettingsTab.tsx
@@ -29,3 +29,2 @@
 import { CitySelect } from '../../common/CitySelect';
-import { MerchantCaptainsDirectory } from '../../admin/MerchantCaptainsDirectory';
 import { normalizeArabicDigits } from '../../../utils/formatters';
@@ -1309,4 +1308,3 @@
-          {/* Verified Captains Network */}
-          <MerchantCaptainsDirectory settings={editableSettings} storeSlug={storeSlug} />
-
+          {/* Note: Platform Captain Directory relocated to Platform Super-Admin Portal */}
           {/* Store Pickup & ZATCA Tax Compliance */}
```

2. **Harden `MerchantCaptainsDirectory.tsx` with Strict Role Enforcement, Gated Tabs & Clean Subtitles:**
- Set `isPlatformOwner = false` by default so merchants cannot act as platform super-admins.
- Remove the hardcoded platform margin disclosure `(1% - 2.5%)` from lines 126-127.
- Gate BOTH Tab 2 (`pending_approval`, containing the 1%-2.5% fee selection buttons and owner activation controls) and Tab 3 (`all_network`, containing platform commission totals) behind `isPlatformOwner`.
- Hide Tab 2 and Tab 3 selector buttons when `isPlatformOwner === false` so merchants only see their local city couriers (Tab 1: `city_captains`).

```diff
--- a/src/components/admin/MerchantCaptainsDirectory.tsx
+++ b/src/components/admin/MerchantCaptainsDirectory.tsx
@@ -31,5 +31,5 @@
 export const MerchantCaptainsDirectory: React.FC<MerchantCaptainsDirectoryProps> = ({
   settings,
   storeSlug,
-  isPlatformOwner = true, // By default enabled so store owners can both dispatch & approve their couriers
+  isPlatformOwner = false, // Secure default: only true when explicitly authenticated as platform super-admin
 }) => {
@@ -125,3 +125,3 @@
           <p className="text-xs text-stone-500 mt-0.5">
-            نظام ديناميكي متكامل لتسجيل الكباتن، اعتماد وتفعيل الحسابات بأكواد رسمية، وإسناد الطلبات مع تحصيل نسبة المنصة (1% - 2.5%)
+            نظام ديناميكي متكامل لتسجيل الكباتن، وإسناد وتوصيل طلبات المتجر بكفاءة وموثوقية
           </p>
@@ -168,32 +168,36 @@
-        <button
-          type="button"
-          onClick={() => setActiveTab('pending_approval')}
-          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
-            activeTab === 'pending_approval'
-              ? 'bg-amber-600 text-white shadow-xs'
-              : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
-          }`}
-        >
-          <Clock className="w-3.5 h-3.5" />
-          <span>طلبات بانتظار تفعيل المالك</span>
-          {pendingCaptains.length > 0 && (
-            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black">
-              {pendingCaptains.length}
-            </span>
-          )}
-        </button>
-
-        <button
-          type="button"
-          onClick={() => setActiveTab('all_network')}
-          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
-            activeTab === 'all_network'
-              ? 'bg-stone-900 text-white shadow-xs'
-              : 'text-stone-600 hover:bg-stone-100'
-          }`}
-        >
-          <UserCheck className="w-3.5 h-3.5" />
-          <span>إجمالي شبكة الكباتن ({allActive.length})</span>
-        </button>
+        {/* Gate Tab 2 & Tab 3 selector buttons behind isPlatformOwner */}
+        {isPlatformOwner && (
+          <button
+            type="button"
+            onClick={() => setActiveTab('pending_approval')}
+            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
+              activeTab === 'pending_approval'
+                ? 'bg-amber-600 text-white shadow-xs'
+                : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
+            }`}
+          >
+            <Clock className="w-3.5 h-3.5" />
+            <span>طلبات بانتظار تفعيل المالك</span>
+            {pendingCaptains.length > 0 && (
+              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black">
+                {pendingCaptains.length}
+              </span>
+            )}
+          </button>
+        )}
+
+        {isPlatformOwner && (
+          <button
+            type="button"
+            onClick={() => setActiveTab('all_network')}
+            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
+              activeTab === 'all_network'
+                ? 'bg-stone-900 text-white shadow-xs'
+                : 'text-stone-600 hover:bg-stone-100'
+            }`}
+          >
+            <UserCheck className="w-3.5 h-3.5" />
+            <span>إجمالي شبكة الكباتن ({allActive.length})</span>
+          </button>
+        )}
       </div>
@@ -299,3 +303,3 @@
       {/* TAB 2: Pending Approval Gate (Owner Gate) */}
-      {activeTab === 'pending_approval' && (
+      {activeTab === 'pending_approval' && isPlatformOwner && (
         <div className="space-y-4">
@@ -393,3 +397,3 @@
       {/* TAB 3: All Network & Platform Earnings Overview */}
-      {activeTab === 'all_network' && (
+      {activeTab === 'all_network' && isPlatformOwner && (
         <div className="space-y-4">
```

---

### 3.2 SEC-R1-02: Role Security Rule Overexposure in `firestore.rules`

#### Exact File Paths & Line Ranges
- `firestore.rules:90-96, 114-135, 140-150`

#### Verbatim Code Evidence
```firestore-security-rules
// Lines 90-93: Public store get
match /stores/{storeId} {
  allow get: if true;
  allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid;
}

// Lines 126-129: Unauthenticated order status update
allow update: if (isStoreOwner(storeId) && ...) ||
                (request.resource.data.diff(resource.data).affectedKeys().hasOnly([
                   'status', 'driverDeliveredAt', 'driverCashCollected',
                   'returnEligibleUntil', 'trackingNotes', 'updatedAt'
                 ]) && request.resource.data.status in ['Out for Delivery', 'Delivered', 'Cancelled']) ||
                (resource.data.status == 'Delivered' && ...);

// Lines 140-150: Insecure delivery captains collection
match /captains/{captainId} {
  allow read: if isSignedIn();
  allow create: if isValidId(captainId) &&
                request.resource.data.keys().hasAll(['id', 'name', 'phone', 'city', 'status']) &&
                request.resource.data.id == captainId &&
                request.resource.data.name is string && request.resource.data.name.size() > 0 &&
                request.resource.data.phone is string && request.resource.data.phone.size() >= 8 &&
                request.resource.data.status in ['pending_activation', 'active'];
  allow update: if isSignedIn() && isValidId(captainId);
  allow delete: if false;
}
```

#### Root-Cause Analysis
1. **Missing Platform Owner Authorization Concept:** `firestore.rules` has no helper function for `isPlatformOwner()` or `request.auth.token.role == 'platform_owner'`.
2. **Permissive `/captains` Access:**
   - `allow read: if isSignedIn();` allows any registered merchant or user to read all driver documents.
   - `allow update: if isSignedIn() && isValidId(captainId);` lacks an authorization check (`request.auth.uid == captainId`), allowing any user to overwrite any driver's profile, reset their commission percentage to 0, or alter payout IBANs.
   - `allow create:` permits `status in ['pending_activation', 'active']` without requiring `request.auth != null`, allowing unauthenticated creation of active captains.
3. **Unauthenticated Order Cancellation & Delivery Mutation:** In lines 126-129, the update rule allows changing status to `['Out for Delivery', 'Delivered', 'Cancelled']` without checking `isSignedIn()` or verifying delivery PINs.

#### Downstream Technical and Business Impact
- **Database-Wide Captain Document Tampering:** A malicious user or rogue merchant can execute a batch update via client SDK to zero out platform commissions for all drivers or redirect driver payouts to fraudulent bank accounts.
- **Unauthenticated Order Sabotage:** Any anonymous actor using the public Firestore project ID can transition customer orders across any store to `Cancelled` or `Delivered`, wiping out cash-on-delivery collection records (`driverCashCollected`).

#### Actionable Remediation Code Diff
```firestore-security-rules
// Hardened firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isValidId(id) {
      return id is string && id.size() > 0 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function isPlatformOwner() {
      return isSignedIn() && request.auth.token.role == 'platform_owner';
    }

    function isStoreOwner(storeId) {
      return isSignedIn() &&
             exists(/databases/$(database)/documents/stores/$(storeId)) &&
             get(/databases/$(database)/documents/stores/$(storeId)).data.ownerId == request.auth.uid;
    }

    // Captains Collection: Strict Role Isolation
    match /captains/{captainId} {
      allow get: if isPlatformOwner() || (isSignedIn() && request.auth.uid == captainId);
      allow list: if isPlatformOwner();
      allow create: if isSignedIn() && request.auth.uid == captainId &&
                    request.resource.data.status == 'pending_activation' &&
                    request.resource.data.totalPlatformCommission == 0 &&
                    request.resource.data.totalDeliveryFeesEarned == 0;
      allow update: if isPlatformOwner() || 
                    (isSignedIn() && request.auth.uid == captainId && 
                     request.resource.data.diff(resource.data).affectedKeys().hasOnly(['vehicleType', 'city', 'lastActiveAt']));
      allow delete: if false;
    }

    // Orders: Require Store Owner or Serverless Admin SDK
    match /stores/{storeId}/orders/{orderId} {
      allow create: if false; // Creation restricted to Backend API
      allow get, list: if isStoreOwner(storeId);
      allow update: if isStoreOwner(storeId) || isPlatformOwner();
      allow delete: if false;
    }
  }
}
```

#### Architectural Coordination & Migration Pre-Requisite
> **CRITICAL DEPLOYMENT SEQUENCE GUARD:**  
> The rule `allow create: if false;` on `/stores/{storeId}/orders/{orderId}` strictly mandates that all order creation must execute server-side via the Firebase Admin SDK in `/api/createOrder`.  
> However, `src/services/storeManager.ts:942–946` currently maintains a direct client-side Firestore fallback:
> ```typescript
> if (isFirebaseConfigured && storeId && storeId !== 'store_aurora_01') {
>   try {
>     const orderRef = doc(db, 'stores', storeId, 'orders', order.id);
>     const sanitizedOrder = JSON.parse(JSON.stringify(order));
>     await setDoc(orderRef, sanitizedOrder);
> ```
> Additionally, `storeManager.ts:1338–1343` invokes this client-side path during offline checkout, network drops to `/api/createOrder`, or local preview environments.  
> If `allow create: if false;` is pushed to Cloud Firestore **before** this client fallback is deprecated and replaced with an offline-resilient queued sync mechanism (e.g., IndexedDB queue synchronized through the backend API once connectivity is restored), client-side checkout will immediately crash with unhandled `FirebaseError: Missing or insufficient permissions`.  
> **Mandatory Sequencing:** Decommissioning or routing the client-side direct `setDoc` fallback in `storeManager.ts:942–946` through an authenticated backend ingestion gateway must be implemented **in lockstep** with deploying the hardened `firestore.rules`.

---

### 3.3 SEC-R1-03: Cross-Tenant Customer Order PII Leak in Driver Portal

#### Exact File Paths & Line Ranges
- `src/components/captain/CaptainPortalModal.tsx:69-86, 480-508`

#### Verbatim Code Evidence
```tsx
// Lines 69-86 in src/components/captain/CaptainPortalModal.tsx
const loadOrdersForCaptain = (captain: DeliveryCaptain) => {
  const allStores = StoreManager.getAllStores();
  const allOrders: Order[] = [];
  for (const store of allStores) {
    if (Array.isArray(store.orders)) {
      for (const order of store.orders) {
        if (
          order.status === 'Out for Delivery' ||
          order.status === 'In Progress' ||
          order.status === 'Received'
        ) {
          allOrders.push(order);
        }
      }
    }
  }
  setAssignedOrders(allOrders.slice(0, 8));
};
```
```tsx
// Lines 480-508: Renders customer PII across all stores
<div className="text-stone-600 space-y-0.5 text-[11px]">
  <div>👤 العميل: <strong>{ord.customerName}</strong> ({ord.customerPhone})</div>
  <div>🏠 العنوان: {ord.city} - {ord.deliveryAddress}</div>
</div>
```

#### Root-Cause Analysis
- `loadOrdersForCaptain` iterates through `StoreManager.getAllStores()` on the client. It aggregates unassigned active orders across **all** merchants in local storage/memory and displays them to any courier who logs into the portal.

#### Downstream Technical and Business Impact
- **Direct Violation of Saudi Personal Data Protection Law (PDPL):** Customer full names, phone numbers, exact delivery addresses, and cart totals from competing merchants are broadcast to unauthorized couriers.
- **Cross-Merchant Espionage & Package Theft:** Drivers can intercept orders belonging to other stores and attempt unauthorized doorstep collections.

#### Actionable Remediation Code Diff
```diff
--- a/src/components/captain/CaptainPortalModal.tsx
+++ b/src/components/captain/CaptainPortalModal.tsx
@@ -68,17 +68,10 @@
-  const loadOrdersForCaptain = (captain: DeliveryCaptain) => {
-    const allStores = StoreManager.getAllStores();
-    const allOrders: Order[] = [];
-    for (const store of allStores) {
-      if (Array.isArray(store.orders)) {
-        for (const order of store.orders) {
-          if (
-            order.status === 'Out for Delivery' ||
-            order.status === 'In Progress' ||
-            order.status === 'Received'
-          ) {
-            allOrders.push(order);
-          }
-        }
-      }
-    }
+  const loadOrdersForCaptain = (captain: DeliveryCaptain) => {
+    if (!captain || !captain.phone) {
+      setAssignedOrders([]);
+      return;
+    }
+    // Dynamically resolve the active store and scope orders strictly to assigned courier credentials
+    const activeStore = StoreManager.getActiveStore();
+    const assigned = (activeStore?.orders || []).filter(
+      (o) => (o.courierPhone === captain.phone || o.assignedCaptainId === captain.id) &&
+             ['Out for Delivery', 'In Progress'].includes(o.status)
+    );
+    setAssignedOrders(assigned);
   };
```

---

### 3.4 SEC-R1-04: Public Store Document Leakage of Merchant Bank IBANs, Driver Contacts & Webhooks

#### Exact File Paths & Line Ranges
- `src/services/storeManager.ts:592-609`
- `firestore.rules:90-93`
- `src/types/store.ts:57-61`

#### Verbatim Code Evidence
In `src/services/storeManager.ts`:
```ts
// Lines 591-609
// 1. Separate public settings from private merchant config (S4)
const { promoCodes = [], orderNotificationEmail = '', googleWebAppUrl = '', ...publicSettings } = store.settings;
const { orders: _orders, products = [], ...publicStoreData } = store;

const publicPayload = JSON.parse(
  JSON.stringify({
    ...publicStoreData,
    products: cleanProducts,
    settings: publicSettings,
    storeName: store.settings.storeName || 'متجر إلكتروني',
    updatedAt: new Date().toISOString(),
  })
);

const docRef = doc(db, 'stores', store.id);
await setDoc(docRef, publicPayload, { merge: true });
```
In `firestore.rules`:
```firestore-security-rules
// Lines 90-93
match /stores/{storeId} {
  allow get: if true;
```

#### Root-Cause Analysis
1. **Write-Side Overexposure:** The sanitization logic in `storeManager.ts:592` only extracts `promoCodes`, `orderNotificationEmail`, and `googleWebAppUrl` out of `store.settings`. All remaining properties in `publicSettings`—including `bankDetails` (IBAN, bankName, accountHolder), `driverName`, `driverPhone`, `driverFee`, and `notificationWebhookUrl`—are stored directly on `/stores/{storeId}`. Because `allow get: if true;`, any unauthenticated client can retrieve these sensitive settings.
2. **Read-Side Desynchronization & Data Loss:** In `storeManager.ts:723–735`, the read/re-hydration logic only merges `promoCodes`, `orderNotificationEmail`, and `googleWebAppUrl` from `/private/config`. Simply stripping private fields on write without updating the read path causes silent state loss: upon reloading the dashboard, a merchant's bank IBAN, driver contact info, and custom notification webhook URLs would be wiped from in-memory state.

#### Downstream Technical and Business Impact
- **Financial Reconnaissance & Phishing:** Attackers can scrape merchant IBANs, bank names, and account holder identities.
- **Driver Harassment:** Personal mobile numbers of merchant drivers are publicly accessible.
- **Webhook Hijacking:** Merchant notification webhook URLs can be scraped and targeted for denial-of-service or fake webhook payload injection.
- **Merchant State Loss:** Failure to re-hydrate private fields upon store load breaks payment processing and driver dispatch.

#### Actionable Remediation Code Diff
```diff
--- a/src/services/storeManager.ts
+++ b/src/services/storeManager.ts
@@ -591,4 +591,12 @@
-      // 1. Separate public settings from private merchant config (S4)
-      const { promoCodes = [], orderNotificationEmail = '', googleWebAppUrl = '', ...publicSettings } = store.settings;
+      // 1. Strictly isolate all private merchant configuration into /private/config
+      const {
+        promoCodes = [],
+        orderNotificationEmail = '',
+        googleWebAppUrl = '',
+        bankDetails = null,
+        driverName = null,
+        driverPhone = null,
+        driverFee = null,
+        notificationWebhookUrl = null,
+        ...publicSettings
+      } = store.settings;
@@ -614,2 +622,7 @@
           promoCodes,
           orderNotificationEmail,
           googleWebAppUrl,
+          bankDetails,
+          driverName,
+          driverPhone,
+          driverFee,
+          notificationWebhookUrl,
@@ -729,5 +742,10 @@
               mergedSettings = {
                 ...mergedSettings,
                 promoCodes: privData.promoCodes || mergedSettings.promoCodes || [],
                 orderNotificationEmail: privData.orderNotificationEmail || mergedSettings.orderNotificationEmail || '',
                 googleWebAppUrl: privData.googleWebAppUrl || mergedSettings.googleWebAppUrl || '',
+                bankDetails: privData.bankDetails || mergedSettings.bankDetails,
+                driverName: privData.driverName || mergedSettings.driverName,
+                driverPhone: privData.driverPhone || mergedSettings.driverPhone,
+                driverFee: privData.driverFee !== undefined ? privData.driverFee : mergedSettings.driverFee,
+                notificationWebhookUrl: privData.notificationWebhookUrl || mergedSettings.notificationWebhookUrl,
               };
```

---

### 3.5 SEC-R1-05: Deterministic Delivery PIN Derivation

#### Exact File Paths & Line Ranges
- `src/utils/whatsappInvoice.ts:48-52`
- `api/updateOrderStatus.ts:128-136`

#### Verbatim Code Evidence
```ts
// src/utils/whatsappInvoice.ts:48-52
export function getOrderDeliveryPin(order: Partial<Order> & { id?: string }): string {
  if (order.deliveryPin && /^\d{4}$/.test(order.deliveryPin)) {
    return order.deliveryPin;
  }
  // Deterministic 4-digit fallback only for legacy orders missing an explicit deliveryPin
  const digits = (order.id || '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  const seed = (order.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return String(1000 + (seed % 9000));
}
```

#### Root-Cause Analysis
When an order record does not contain an explicit cryptographically generated PIN, the system falls back to calculating the PIN from `order.id.slice(-4)` or a modulo of its characters. Because `order.id` is public (printed on tracking URLs and invoices), anyone can derive the PIN.

#### Downstream Impact & Remediation
Drivers can compute the PIN without visiting the customer, mark orders delivered, and pocket COD cash. Delivery PINs must be cryptographically generated upon order creation using `crypto.randomInt(1000, 10000).toString()` and never inferred from public order identifiers.

---

## 4. Deep-Dive Section R2: Inventory of Hardcoded Entities & Mock Data

---

### 4.1 SEC-R2-01: Master Driver Activation Bypass Codes

#### Exact File Paths & Line Ranges
- `src/services/captainService.ts:223-228`
- `src/components/captain/CaptainPortalModal.tsx:387-389`
- `tests/phase4CaptainsAndCod.test.ts:153`

#### Verbatim Code Evidence
In `src/services/captainService.ts`:
```typescript
// Lines 222-228
// Master activation codes for platform owners, or captain's designated activation code
const isMasterCode =
  cleanCode === 'QUICK-CAPTAIN-2026' ||
  cleanCode === 'SAMA-DELIVERY-2026' ||
  cleanCode === 'CAPTAIN100';
const isSpecificCode = captain.activationCode && cleanCode === captain.activationCode.toUpperCase();
```
In `src/components/captain/CaptainPortalModal.tsx`:
```tsx
// Lines 387-389
<p className="text-[10px] text-stone-500">
  كود تفعيل افتراضي معتمد للتجربة: <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800 font-mono">QUICK-CAPTAIN-2026</code>
</p>
```

#### Root-Cause Analysis
Test bypass strings were introduced during development and accidentally left in production bundles. The UI even presents `QUICK-CAPTAIN-2026` as a default code above the activation button.

#### Downstream Technical and Business Impact
Anyone registering as a driver can self-activate by entering `QUICK-CAPTAIN-2026`. This completely circumvents platform owner identity vetting, vehicle inspection, and fee split agreements.

#### Actionable Remediation Code Diff
```diff
--- a/src/services/captainService.ts
+++ b/src/services/captainService.ts
@@ -222,8 +222,2 @@
-    // Master activation codes for platform owners, or captain's designated activation code
-    const isMasterCode =
-      cleanCode === 'QUICK-CAPTAIN-2026' ||
-      cleanCode === 'SAMA-DELIVERY-2026' ||
-      cleanCode === 'CAPTAIN100';
-    const isSpecificCode = captain.activationCode && cleanCode === captain.activationCode.toUpperCase();
-
-    if (!isMasterCode && !isSpecificCode) {
+    // Strict check: only the exact cryptographically assigned activation code is valid
+    const isSpecificCode = Boolean(captain.activationCode && cleanCode === captain.activationCode.toUpperCase());
+    if (!isSpecificCode) {
```
```diff
--- a/src/components/captain/CaptainPortalModal.tsx
+++ b/src/components/captain/CaptainPortalModal.tsx
@@ -386,4 +386,3 @@
                 </div>
-                <p className="text-[10px] text-stone-500">
-                  كود تفعيل افتراضي معتمد للتجربة: <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800 font-mono">QUICK-CAPTAIN-2026</code>
-                </p>
+                <p className="text-[10px] text-stone-500">يرجى إدخال كود التفعيل المعتمد المستلم من إدارة المنصة.</p>
```

---

### 4.2 SEC-R2-02: Universal Riyadh Olaya Fallback & Mock Geolocation Centroids

#### Exact File Paths & Line Ranges
- `src/utils/cityUtils.ts:5-41, 96, 111`
- `api/geo/nationalAddress.ts:18-41, 121-122, 147-148`
- `src/utils/seoManager.ts:220-223`
- `src/services/storeStorage.ts:64`
- `src/components/storefront/LocationPickerModal.tsx:40-41`
- `scripts/mcp-store-optimizer.cjs:19-20`

#### Verbatim Code Evidence
In `src/utils/cityUtils.ts`:
```typescript
// Line 96 & 111
export function getSaudiCityCoordinates(cityName?: string): { lat: number; lng: number } {
  if (!cityName) return { lat: 24.7136, lng: 46.6753 };
  ...
  return { lat: 24.7136, lng: 46.6753 };
}
```
In `api/geo/nationalAddress.ts`:
```typescript
// Lines 121-122, 147-148
lat: parseFloat(addr.Latitude) || 24.7136,
lng: parseFloat(addr.Longitude) || 46.6753,
```
In `src/utils/seoManager.ts`:
```typescript
// Lines 220-223
setMetaTag('geo.region', 'SA-01');
setMetaTag('geo.placename', 'الرياض, المملكة العربية السعودية');
setMetaTag('geo.position', '24.7136;46.6753');
setMetaTag('ICBM', '24.7136, 46.6753');
```

#### Root-Cause Analysis
A fixed geographic coordinate pair representing central Riyadh (Olaya District, `24.7136, 46.6753`) was hardcoded as a universal fallback across geolocation resolution, national address short-code parsing, SEO meta tags, and default store configurations.

#### Downstream Technical and Business Impact
- Stores based in Jeddah, Dammam, Mecca, or Abha default their platform SEO tags to Riyadh (`SA-01`).
- Customer addresses that do not match the static 22-centroid dictionary resolve to Olaya, Riyadh, resulting in corrupted driver dispatch route calculations and inaccurate distance-based delivery fees.

#### Actionable Remediation
Integrate live Saudi National Address (SPL) API lookups with an on-demand OpenStreetMap Nominatim fallback. For stores without verified coordinates, mark coordinates as `undefined` and prompt the merchant to pinpoint their physical branch on the interactive map rather than defaulting silently to Riyadh.

---

### 4.3 SEC-R2-03: Static IDs & Production Authentication Bypasses (`store_aurora_01`)

#### Exact File Paths & Line Ranges
- `api/updateOrderStatus.ts:140`
- `src/services/storeManager.ts:834, 942, 1064, 1179, 1213, 1302, 1686`
- `src/components/storefront/CheckoutModal.tsx:421`
- `src/components/driver/DriverDispatchView.tsx:34`
- `src/components/storefront/MoyasarPaymentModal.tsx:202`
- `src/components/captain/CaptainPortalModal.tsx:162`

#### Verbatim Code Evidence
In `api/updateOrderStatus.ts`:
```typescript
// Line 140
// Merchant actions require authentication if configured, or allow demo store updates
if (!isMerchantAuthenticated && cleanStoreId !== 'store_aurora_01' && process.env.NODE_ENV === 'production') {
  return res.status(401).json({ error: 'Merchant authentication required.', success: false });
}
```
In `src/services/storeManager.ts`:
```typescript
// Line 942
if (storeId !== 'store_aurora_01') {
  // Dispatches to /api/createOrder or Firestore...
}
```

#### Root-Cause Analysis
A static demo store ID (`store_aurora_01`) was introduced to facilitate testing without a configured database. The API contains an explicit exception exempting `store_aurora_01` from authentication checks in production, while UI modals routinely fall back to `'store_aurora_01'` whenever `storeId` is missing.

#### Downstream Technical and Business Impact
- **Unauthenticated Production Order Manipulation:** Anyone can invoke `/api/updateOrderStatus` without authentication against `store_aurora_01`, altering order states and inventory.
- **Silent Order Dropping:** When customer orders fall back to `store_aurora_01`, `storeManager.ts` aborts remote database sync, leaving orders only in local client storage where they are lost upon browser cache clearance.

#### Actionable Remediation Code Diff
```diff
--- a/api/updateOrderStatus.ts
+++ b/api/updateOrderStatus.ts
@@ -139,3 +139,3 @@
-      // Merchant actions require authentication if configured, or allow demo store updates
-      if (!isMerchantAuthenticated && cleanStoreId !== 'store_aurora_01' && process.env.NODE_ENV === 'production') {
+      // Strict merchant authentication required in production for all stores
+      if (!isMerchantAuthenticated && process.env.NODE_ENV === 'production') {
         return res.status(401).json({ error: 'Merchant authentication required.', success: false });
```

---

### 4.4 SEC-R2-04: Dummy Payment Credentials, Insecure Fallback Secrets & Fake Payment Success Bypasses

#### Exact File Paths & Line Ranges
- `src/components/storefront/MoyasarPaymentModal.tsx:37, 191-199, 226-232`
- `api/_notifications.ts:98`
- `api/moyasarWebhook.ts:131`

#### Verbatim Code Evidence
In `src/components/storefront/MoyasarPaymentModal.tsx`:
```typescript
// Line 37
const DEFAULT_SANDBOX_KEY = 'pk_test_vcFUAGwCU4x8MrjiqqnUS4Vjy3AnFsXZoEi2qTyg';
```
```typescript
// Lines 191-199
const paymentId = paymentData?.id || `pay_${Math.random().toString(36).substring(2, 9)}`;

// Ensure paymentData reported success or we are in test mode
if (paymentData?.status && paymentData.status !== 'paid' && !settings.moyasarTestMode) {
  setIsVerifying(false);
  setStatusMessage('فشلت عملية الدفع أو تم رفضها من قبل البنك. يرجى استخدام بطاقة أخرى.');
  if (onPaymentFailed) onPaymentFailed('فشلت عملية الدفع أو تم رفضها من قبل البنك.');
  return;
}
```
In `api/_notifications.ts`:
```typescript
// Line 98
const secret = webhookSecret || process.env.WEBHOOK_SIGNING_SECRET || 'quick-ecom-secret';
```

#### Root-Cause Analysis
1. A public test key (`pk_test_...`) is embedded in client bundles as a fallback.
2. In `MoyasarPaymentModal.tsx`, if a merchant activates `settings.moyasarTestMode`, failed transactions (`paymentData.status !== 'paid'`) bypass the failure check, fabricate a fake transaction ID (`pay_xxxx`), and mark the order as `Paid`.
3. In `_notifications.ts`, webhook HMAC signatures default to `'quick-ecom-secret'`.

#### Downstream Technical and Business Impact
If a merchant unintentionally leaves test mode enabled in production, customers can submit invalid card details and still receive valid order confirmations marked `Paid`, resulting in uncaptured revenue and product loss.

#### Actionable Remediation Code Diff
```diff
--- a/src/components/storefront/MoyasarPaymentModal.tsx
+++ b/src/components/storefront/MoyasarPaymentModal.tsx
@@ -193,3 +193,3 @@
-    // Ensure paymentData reported success or we are in test mode
-    if (paymentData?.status && paymentData.status !== 'paid' && !settings.moyasarTestMode) {
+    // Strict rejection of any non-paid status regardless of test mode
+    if (!paymentData || paymentData.status !== 'paid') {
       setIsVerifying(false);
```

---

### 4.5 SEC-R2-05: ZATCA Phase 2 Non-Compliance, Truncated Keys & Insecure Hashes

#### Exact File Paths & Line Ranges
- `src/services/zatcaPhase2Engine.ts:111, 166-172, 188`
- `src/utils/zatca.ts:177-186`

#### Verbatim Code Evidence
In `src/services/zatcaPhase2Engine.ts`:
```typescript
// Line 111: Hardcoded CRN in XML
<cbc:ID schemeID="CRN">1010000000</cbc:ID>

// Lines 166-172: Truncated public key and hardcoded HMAC secret
publicKey = 'MIIBSzCCATMC...';
const mockSig = crypto.createHmac('sha256', 'zatca-phase-2-secret').update(hashBuffer).digest();
```
In `src/utils/zatca.ts`:
```typescript
// Lines 177-186: Insecure djb2 string hash instead of SHA-256
export function generateInvoiceHash(invoiceData: string): string {
  let hash = 0;
  for (let i = 0; i < invoiceData.length; i++) {
    const char = invoiceData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `hash_zatca_p2_${hex}_${Date.now().toString(16)}`;
}
```

#### Root-Cause Analysis
The ZATCA Phase 2 engine used simplified stubs (truncated keys, static CRN `1010000000`, and a non-standard djb2 string hash) instead of integrating real cryptographic CSIDs and canonical UBL 2.1 SHA-256 digests.

#### Downstream Technical and Business Impact
Submitting these mock invoices to ZATCA Fatoora clearance endpoints will cause immediate clearance rejection, compliance failure flags, and regulatory fines under the Saudi E-Invoicing Regulation.

---

### 4.6 SEC-R2-06: Fabricated SEO Reviews & Mock Customer Data Pre-Population

#### Exact File Paths & Line Ranges
- `src/utils/seoManager.ts:252-308`
- `src/services/storeStorage.ts:180-207, 426`

#### Verbatim Code Evidence
```typescript
// Lines 252-254, 292-308 in src/utils/seoManager.ts
const seed = (p.id || p.name).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
const ratingValue = p.rating ? p.rating.toFixed(1) : (4.7 + ((seed % 4) * 0.1)).toFixed(1);
const reviewCount = p.reviewsCount || (12 + (seed % 28));
...
review: [
  {
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5', worstRating: '1' },
    author: { '@type': 'Person', name: 'عميل موثق' },
    datePublished: '2026-03-20',
    reviewBody: `منتج عالي الجودة وتجربة شراء ممتازة من متجر ${settings.storeName} وتوصيل سريع وموثوق.`,
  },
]
```

#### Root-Cause Analysis
To ensure stores qualified for Google rich snippets with star ratings, `seoManager.ts` algorithmically generates fake 4.7–5.0 star ratings and injects a fabricated review from "عميل موثق" dated `2026-03-20` into every product's JSON-LD schema.

#### Downstream Technical and Business Impact
Violates Google Search Central's *Review Snippet Structured Data Policies* (which prohibit fabricated or automated reviews). This exposes merchant domains to manual spam penalties and total revocation of rich snippet visibility.

#### Actionable Remediation Code Diff
```diff
--- a/src/utils/seoManager.ts
+++ b/src/utils/seoManager.ts
@@ -252,3 +252,0 @@
-  const seed = (p.id || p.name).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
-  const ratingValue = p.rating ? p.rating.toFixed(1) : (4.7 + ((seed % 4) * 0.1)).toFixed(1);
-  const reviewCount = p.reviewsCount || (12 + (seed % 28));
@@ -285,15 +282,10 @@
-    aggregateRating: {
-      '@type': 'AggregateRating',
-      ratingValue: ratingValue,
-      reviewCount: reviewCount,
-      bestRating: '5',
-      worstRating: '1',
-    },
-    review: [ ... ],
+    ...(p.rating && p.reviewsCount && p.reviewsCount > 0 ? {
+      aggregateRating: {
+        '@type': 'AggregateRating',
+        ratingValue: p.rating.toFixed(1),
+        reviewCount: p.reviewsCount,
+        bestRating: '5',
+        worstRating: '1',
+      }
+    } : {}),
```

---

## 5. Deep-Dive Section R3: Business Logic, Registration & Fee Calculation Audit

---

### 5.1 LOG-R3-01: Driver Account Takeover via Registration & Passwordless Sign-In

#### Exact File Paths & Line Ranges
- `src/services/captainService.ts:143-151`
- `src/components/captain/CaptainPortalModal.tsx:110-123`

#### Verbatim Code Evidence
In `src/services/captainService.ts`:
```typescript
// Lines 143-151
const all = this.getAllCaptains();
const existing = all.find((c) => c.phone.replace(/\D/g, '') === cleanPhone);
if (existing) {
  this.setActiveSessionCaptain(existing.id);
  return {
    success: true,
    captain: existing,
  };
}
```
In `src/components/captain/CaptainPortalModal.tsx`:
```typescript
// Lines 110-123
const handleLogin = (e: React.FormEvent) => {
  e.preventDefault();
  setErrorMsg('');
  setSuccessMsg('');

  const captain = CaptainService.getCaptainByPhone(loginPhone);
  if (!captain) {
    setErrorMsg('لم يتم العثور على كابتن مسجل بهذا الرقم. يرجى التسجيل أولاً.');
    return;
  }

  setActiveCaptain(captain);
  loadOrdersForCaptain(captain);
};
```

#### Root-Cause Analysis
1. In `registerCaptain()`, if the phone number already exists, the function immediately establishes an active session (`setActiveSessionCaptain(existing.id)`) and logs the caller in without password or OTP verification.
2. In `handleLogin()`, authentication only verifies that a captain document exists with matching phone digits.

#### Downstream Technical and Business Impact
**Complete Account Takeover:** Anyone who enters a driver's phone number into the registration or login tab gains immediate access to the driver's profile, assigned customer orders, customer contact details, delivery addresses, and proof-of-delivery confirmation controls.

#### Actionable Remediation Code Diff
```diff
--- a/src/services/captainService.ts
+++ b/src/services/captainService.ts
@@ -143,9 +143,4 @@
     const all = this.getAllCaptains();
     const existing = all.find((c) => c.phone.replace(/\D/g, '') === cleanPhone);
     if (existing) {
-      this.setActiveSessionCaptain(existing.id);
-      return {
-        success: true,
-        captain: existing,
-      };
+      return { success: false, error: 'رقم الجوال مسجل مسبقاً. يرجى تسجيل الدخول باستخدام رمز التحقق (OTP).' };
     }
```

---

### 5.2 LOG-R3-02: Driver Settlement Zero-Floor Clamping Concealing Merchant Debt to Drivers

#### Exact File Paths & Line Ranges
- `src/utils/driverDispatch.ts:56-80 (specifically line 73)`
- `src/components/driver/DriverSettlementModal.tsx:65-72 (specifically line 71, 187-190)`

#### Verbatim Code Evidence
In `src/utils/driverDispatch.ts`:
```typescript
// Lines 56-80
export function calculateDriverSettlement(orders: Order[], driverFeePerOrder: number = 15): {
  totalDelivered: number;
  totalCodCash: number;
  totalDriverEarnings: number;
  netDueToMerchant: number;
} {
  const delivered = orders.filter((o) => o.status === 'Delivered');
  const totalDelivered = delivered.length;

  const totalCodCash = delivered
    .filter((o) => {
      const pm = (o.paymentMethod || '').toLowerCase();
      return pm.includes('cod') || pm.includes('استلام');
    })
    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

  const totalDriverEarnings = totalDelivered * driverFeePerOrder;
  const netDueToMerchant = Math.max(0, totalCodCash - totalDriverEarnings);

  return {
    totalDelivered,
    totalCodCash,
    totalDriverEarnings,
    netDueToMerchant,
  };
}
```
In `src/components/driver/DriverSettlementModal.tsx`:
```tsx
// Lines 71 & 187-190
const netDueToMerchant = Math.max(0, totalCodCash - totalDriverEarnings);
...
<span className="text-xs text-blue-200 block">صافي الكاش المستحق تسليمه لإدارة المحل:</span>
<span className="text-2xl font-black font-mono text-emerald-300">
  {netDueToMerchant.toLocaleString('en-US')} {settings.currency}
</span>
```

#### Detailed Accounting & Mathematical Breakdown
The formula clamps the settlement balance using `Math.max(0, totalCodCash - totalDriverEarnings)`. This assumes the driver always collects more cash than their earned delivery fees.

In modern Saudi e-commerce, the majority of orders are **prepaid** electronically (via Mada, Apple Pay, credit cards).
- **Scenario:** A driver delivers 5 prepaid orders and 0 COD orders.
  - Driver fee per order = 20 SAR
  - Total deliveries = 5
  - `totalDriverEarnings` = 5 × 20 = **100 SAR** (Earned by driver)
  - `totalCodCash` = **0 SAR** (Customer already paid online)
  - Mathematical balance: `totalCodCash - totalDriverEarnings` = `0 - 100` = **-100 SAR**
  - Evaluated code: `Math.max(0, -100)` = **0 SAR**!

#### Downstream Technical and Business Impact
- **Merchant Debt Concealment / Driver Wage Loss:** The store owes the driver 100 SAR, but the system reports `0 SAR`.
- **False WhatsApp Receipts:** The settlement receipt sent to the driver states:
  `💰 الصافي المستحق تسليمه لإدارة المحل: 0 SAR`
  It omits the 100 SAR liability owed to the driver, leading to driver disputes and accounting discrepancies.

#### Actionable Remediation Code Diff
```diff
--- a/src/utils/driverDispatch.ts
+++ b/src/utils/driverDispatch.ts
@@ -56,6 +56,8 @@
-export function calculateDriverSettlement(orders: Order[], driverFeePerOrder: number = 15): {
+export interface DriverSettlementResult {
   totalDelivered: number;
   totalCodCash: number;
   totalDriverEarnings: number;
+  netBalance: number; // Positive: Driver pays merchant; Negative: Merchant pays driver
   netDueToMerchant: number;
+  netDueToDriver: number;
 }
+export function calculateDriverSettlement(orders: Order[], driverFeePerOrder: number = 15): DriverSettlementResult {
@@ -71,3 +73,5 @@
-  const totalDriverEarnings = totalDelivered * driverFeePerOrder;
-  const netDueToMerchant = Math.max(0, totalCodCash - totalDriverEarnings);
+  const totalDriverEarnings = Math.round(totalDelivered * driverFeePerOrder * 100) / 100;
+  const netBalance = Math.round((totalCodCash - totalDriverEarnings) * 100) / 100;
   return {
     totalDelivered,
     totalCodCash,
     totalDriverEarnings,
+    netBalance,
-    netDueToMerchant,
+    netDueToMerchant: netBalance > 0 ? netBalance : 0,
+    netDueToDriver: netBalance < 0 ? Math.abs(netBalance) : 0,
   };
```

---

### 5.3 LOG-R3-03: Hardcoded 25 SAR Delivery Fee Overrides

#### Exact File Paths & Line Ranges
- `src/components/captain/CaptainPortalModal.tsx:168`
- `src/services/captainService.ts:353`

#### Verbatim Code Evidence
```typescript
// src/components/captain/CaptainPortalModal.tsx:168
CaptainService.recordDeliveryCompletion(activeCaptain.id, order.id, 25);

// src/services/captainService.ts:350-353
static recordDeliveryCompletion(
  captainId: string,
  orderId: string,
  deliveryFee: number = 25
)
```

#### Root-Cause Analysis
When completing an order in the Captain Portal, `recordDeliveryCompletion` passes a literal constant `25` rather than dynamically resolving the delivery fee from the active store context (`order.shippingFee ?? activeStore?.settings.standardShippingRate ?? 15`).

#### Downstream Technical and Business Impact
- If a merchant sets local delivery to 15 SAR or offers free shipping, the courier is still credited 25 SAR.
- The platform commission calculation (`25 * platformFeePercent / 100`) is computed on an erroneous base, distorting courier payouts and platform margin accounts.

#### Actionable Remediation Code Diff
```diff
--- a/src/components/captain/CaptainPortalModal.tsx
+++ b/src/components/captain/CaptainPortalModal.tsx
@@ -166,3 +166,5 @@
     // Record commission
     if (activeCaptain) {
-      CaptainService.recordDeliveryCompletion(activeCaptain.id, order.id, 25);
+      const activeStore = StoreManager.getActiveStore();
+      const deliveryFee = order.shippingFee ?? activeStore?.settings.standardShippingRate ?? 15;
+      CaptainService.recordDeliveryCompletion(activeCaptain.id, order.id, deliveryFee);
       const updated = CaptainService.getCaptainById(activeCaptain.id);
```

---

### 5.4 LOG-R3-04: Inconsistent Shipping Rate Field Names (`standardShippingRate` vs `shippingFee`)

#### Exact File Paths & Line Ranges
- `src/components/builder/dashboard/SettingsTab.tsx:656-657`
- `api/createOrder.ts:278-281`
- `src/services/storeManager.ts:1447-1450`

#### Verbatim Code Evidence
In `SettingsTab.tsx`:
```typescript
// Lines 656-657
setEditableSettings({
  ...editableSettings,
  standardShippingRate: norm === '' ? 0 : Number(norm),
});
```
In `api/createOrder.ts`:
```typescript
// Lines 278-281
const standardShippingRate = Number(settings.standardShippingRate) || 0;
const shippingFee = qualifiesForFreeShipping ? 0 : standardShippingRate;
```
In `src/services/storeManager.ts`:
```typescript
// Lines 1447-1450
let shippingFee = isPickup
  ? 0
  : typeof storeSettings.shippingFee === 'number'
  ? storeSettings.shippingFee
  : 25;
```

#### Root-Cause Analysis
`SettingsTab.tsx` updates `standardShippingRate`, while the client fallback calculation engine in `storeManager.ts` reads `storeSettings.shippingFee`. Because `shippingFee` is undefined, `storeManager.ts` defaults to 25 SAR.

#### Downstream Technical and Business Impact
If `/api/createOrder` succeeds, the customer is charged the merchant's configured shipping rate (e.g., 12 SAR). If the client fallback executes, the customer is charged 25 SAR. This causes unpredictable checkout price fluctuations and customer cart abandonment.

#### Actionable Remediation Code Diff
```diff
--- a/src/services/storeManager.ts
+++ b/src/services/storeManager.ts
@@ -1447,3 +1447,5 @@
-        : typeof storeSettings.shippingFee === 'number'
-        ? storeSettings.shippingFee
-        : 25;
+        : typeof storeSettings.standardShippingRate === 'number'
+        ? storeSettings.standardShippingRate
+        : (typeof storeSettings.shippingFee === 'number' ? storeSettings.shippingFee : 0);
```

---

### 5.5 LOG-R3-05: Gross Revenue & AOV Overstatement: Failure to Exclude Returned & Refunded Orders

#### Exact File Paths & Line Ranges
- `src/components/builder/dashboard/OrdersTab.tsx:68-74`
- `src/components/builder/StoreDashboard.tsx:399-403`

#### Verbatim Code Evidence
```typescript
// src/components/builder/dashboard/OrdersTab.tsx:68-74
const validOrders = useMemo(() => dedupedOrders.filter((o) => o.status !== 'Cancelled'), [dedupedOrders]);
const totalRevenue = useMemo(() => validOrders.reduce((sum, o) => sum + o.grandTotal, 0), [validOrders]);
const deliveredOrders = useMemo(() => dedupedOrders.filter((o) => o.status === 'Delivered').length, [dedupedOrders]);

const averageOrderValue = useMemo(() => {
  return validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;
}, [validOrders.length, totalRevenue]);
```

#### Root-Cause Analysis
The revenue filter only excludes orders where `o.status === 'Cancelled'`. Orders with status `'Returned'` or `'Refunded'`, or orders with partial refund amounts (`o.refundedAmount > 0`), remain in `validOrders` and their full `grandTotal` is counted toward revenue.

#### Downstream Technical and Business Impact
- **Distorted Merchant Financial Telemetry:** Store dashboards overstate gross revenue and Average Order Value (AOV), misrepresenting business profitability.
- **Tax Liability Miscalculation:** VAT calculations based on total revenue in the dashboard overreport merchant tax obligations.

#### Actionable Remediation Code Diff
```diff
--- a/src/components/builder/dashboard/OrdersTab.tsx
+++ b/src/components/builder/dashboard/OrdersTab.tsx
@@ -67,5 +67,13 @@
-  // Accurate Metrics (Excludes Cancelled orders from Revenue)
-  const validOrders = useMemo(() => dedupedOrders.filter((o) => o.status !== 'Cancelled'), [dedupedOrders]);
-  const totalRevenue = useMemo(() => validOrders.reduce((sum, o) => sum + o.grandTotal, 0), [validOrders]);
+  // Net Recognized Revenue: Excludes Cancelled, Returned, and Refunded orders; deducts refunds
+  const recognizedRevenueOrders = useMemo(() => {
+    return dedupedOrders.filter(
+      (o) => o.status !== 'Cancelled' && o.status !== 'Returned' && o.status !== 'Refunded'
+    );
+  }, [dedupedOrders]);
+
+  const totalRevenue = useMemo(() => {
+    const sum = recognizedRevenueOrders.reduce((acc, o) => {
+      const net = (Number(o.grandTotal) || 0) - (Number(o.refundedAmount) || 0);
+      return acc + Math.max(0, net);
+    }, 0);
+    return Math.round(sum * 100) / 100;
+  }, [recognizedRevenueOrders]);
```

---

### 5.6 LOG-R3-06: Dashboard State Mutation Race Condition & Stale Closure Clobbering

#### Exact File Paths & Line Ranges
- `src/components/builder/StoreDashboard.tsx:425-443`
- `src/App.tsx:650-671`

#### Verbatim Code Evidence
In `StoreDashboard.tsx`:
```typescript
// Lines 425-443
onUpdateOrders(updated);

if (newStatus === 'Returned' && restockOnReturn) {
  const targetOrder = orders.find((o) => o.id === orderId);
  if (targetOrder && Array.isArray(targetOrder.items)) {
    const updatedProds = products.map(...);
    onUpdateProducts(updatedProds);
  }
}
```
In `App.tsx`:
```typescript
// Lines 650-671
const handleUpdateProducts = (newProducts: Product[]) => {
  const updatedStore: StoreInstance = { ...activeStore, products: newProducts };
  StoreManager.updateStore(updatedStore, { immediateSync: true });
  setActiveStore(updatedStore);
};

const handleUpdateOrders = (newOrders: Order[]) => {
  const updatedStore: StoreInstance = { ...activeStore, orders: newOrders };
  StoreManager.updateStore(updatedStore);
  setActiveStore(updatedStore);
};
```

#### Root-Cause Analysis
`onUpdateOrders(updated)` and `onUpdateProducts(updatedProds)` are invoked sequentially. Both parent handlers in `App.tsx` capture `activeStore` from the same render cycle closure. The second call (`handleUpdateProducts`) overrides `activeStore.orders` with the stale orders from before `handleUpdateOrders` was invoked, clobbering the status update.

#### Actionable Remediation
Consolidate atomic updates into a single function `onUpdateStore(mutator: (prev: StoreInstance) => StoreInstance)` using React functional state updates (`setActiveStore(prev => ...)`).

---

### 5.7 LOG-R3-07: Non-Atomic Stock Restocking in `/api/updateOrderStatus`

#### Exact File Paths & Line Ranges
- `api/updateOrderStatus.ts:240-279`

#### Verbatim Code Evidence
```typescript
// Lines 240-279
const storeData = storeSnap.data() || {};
let storeProducts = Array.isArray(storeData.products) ? [...storeData.products] : [];
let modified = false;

for (const item of existingOrder.items) {
  const qtyToRestock = Number(item.quantity) || 1;
  const prodIdx = storeProducts.findIndex((p: any) => p.id === item.productId);
  if (prodIdx >= 0) {
    const currentStock = Number(storeProducts[prodIdx].stockQuantity) || 0;
    const newStock = currentStock + qtyToRestock;
    storeProducts[prodIdx] = {
      ...storeProducts[prodIdx],
      stockQuantity: newStock,
      inStock: newStock > 0,
    };
    modified = true;
  }
}

if (modified) {
  await storeRef.update({ products: storeProducts, updatedAt: nowIso });
}
```

#### Root-Cause Analysis
Product restocking reads current stock into serverless memory, computes new values, and writes them back via `storeRef.update` without a Firestore transaction (`db.runTransaction`).

#### Downstream Impact & Remediation
Under high concurrency (e.g. concurrent order returns or flash sale cancellations), read-modify-write races overwrite concurrent stock changes, leading to phantom inventory and overselling. Wrap lines 240–279 in `db.runTransaction(async (transaction) => { ... })`.

---

### 5.8 LOG-R3-08: Unauthenticated Order Cancellation via Serverless API

#### Exact File Paths & Line Ranges
- `api/updateOrderStatus.ts:120-137`
- `firestore.rules:126-129`

#### Verbatim Code Evidence
```typescript
// api/updateOrderStatus.ts:120-137
} else if (source === 'driver') {
  const allowedDriverStatuses = ['Out for Delivery', 'Delivered', 'Cancelled'];
  if (status && !allowedDriverStatuses.includes(status)) {
    return res.status(403).json({ error: 'Driver not permitted to set this status.', success: false });
  }

  // Delivery PIN only checked if Delivered!
  if (status === 'Delivered') {
    ...
  }
}
```

#### Root-Cause Analysis
When `source === 'driver'` and `status === 'Cancelled'`, the endpoint verifies neither driver authentication nor delivery PINs.

#### Downstream Impact & Remediation
An unauthenticated attacker can cancel any merchant's orders simply by submitting `{ storeId, orderId, status: 'Cancelled', source: 'driver' }`. Enforce driver authentication via Firebase Auth bearer tokens or verify customer PIN before allowing doorstep cancellation.

---

### 5.9 LOG-R3-09: Idempotency Failures, Currency Rounding & Halala Precision Truncation

#### Exact File Paths & Line Ranges
- `src/services/captainService.ts:371-373`
- `src/components/captain/CaptainPortalModal.tsx:451, 456`
- `src/components/storefront/CheckoutModal.tsx:208`
- `src/utils/driverDispatch.ts:70`

#### Verbatim Code Evidence
```typescript
// captainService.ts:371-373
captain.completedDeliveries = (captain.completedDeliveries || 0) + 1;
captain.totalDeliveryFeesEarned = (captain.totalDeliveryFeesEarned || 0) + deliveryFee;
captain.totalPlatformCommission = (captain.totalPlatformCommission || 0) + platformCommission;

// CaptainPortalModal.tsx:451, 456
{(activeCaptain.totalDeliveryFeesEarned - activeCaptain.totalPlatformCommission).toFixed(1)} ر.س
```

#### Root-Cause Analysis
1. `recordDeliveryCompletion` lacks a deduplication check (`completedOrderIds: string[]`), allowing multiple clicks or network replays to inflate driver earnings.
2. In the driver UI, `.toFixed(1)` rounds currency to a single decimal place, truncating Halalas (e.g. 24.55 SAR renders as 24.5 SAR).
3. Integer rounding (`Math.round`) on promo percentage discounts truncates sub-Riyal discounts.

---

## 6. Strategic Remediation Roadmap

The remediation strategy is divided into three actionable phases:

```
[Phase 1: Immediate Triage] (Days 1–3)
├── SEC-R1-01: Remove MerchantCaptainsDirectory from SettingsTab.tsx
├── SEC-R2-01: Delete master bypass codes (QUICK-CAPTAIN-2026, etc.)
├── LOG-R3-01: Block phone takeover in captain registration
├── LOG-R3-02: Fix zero-floor clamping in driver settlement
└── SEC-R2-03: Eliminate store_aurora_01 bypass in api/updateOrderStatus.ts

[Phase 2: Systematic Hardening] (Weeks 1–2)
├── SEC-R1-02: Deploy hardened firestore.rules with role-based checks
├── SEC-R1-03: Scope driver portal queries strictly to assigned captain
├── SEC-R1-04: Relocate bank details & webhooks to /private/config
├── LOG-R3-04: Unify shipping fee field names (standardShippingRate)
├── LOG-R3-05: Exclude returns & refunds from revenue telemetry
├── LOG-R3-07: Wrap restocking in Firestore atomic transactions
└── SEC-R2-06: Purge algorithmic review generation from seoManager.ts

[Phase 3: Architectural Evolution] (Month 1+)
├── Dedicated Platform Super-Admin Portal (/admin/platform)
├── Cryptographic SMS OTP authentication for drivers
├── Full ZATCA Phase 2 clearance engine with ECDSA CSID signing
└── Dynamic National Address resolution via Saudi Post SPL API
```

### Phase 1: Immediate Triage & Critical Security Hotfixes (Days 1–3)
- **Action 1.1:** Remove `<MerchantCaptainsDirectory />` from `SettingsTab.tsx:1311` to seal the platform margin leak.
- **Action 1.2:** Delete `MASTER_ACTIVATION_CODES` from `captainService.ts:223-228` and purge `QUICK-CAPTAIN-2026` from `CaptainPortalModal.tsx:388`.
  - *Unit Test Synchronization Guardrail:* Concurrently update `tests/phase4CaptainsAndCod.test.ts:153, 170` (which asserts `QUICK-CAPTAIN-2026`) to activate captains via `ownerActivateCaptain(captain.id, fee)` or use the dynamically generated `captain.activationCode`, preserving test green status.
- **Action 1.3:** Patch `captainService.ts:143-151` to reject registration if phone already exists.
- **Action 1.4:** Update `driverDispatch.ts:73` and `DriverSettlementModal.tsx:71` to return `netDueToDriver` when `totalDriverEarnings > totalCodCash`.
- **Action 1.5:** Remove the `cleanStoreId !== 'store_aurora_01'` production bypass from `api/updateOrderStatus.ts:140`.

### Phase 2: Systematic Business Logic & Financial Hardening (Weeks 1–2)
- **Action 2.1:** Deploy updated `firestore.rules` enforcing `isPlatformOwner()` custom claims and locking down `/captains` and `/stores/{storeId}/orders`.
  - *Architectural Coordination Guardrail:* Locking down `allow create: if false;` on `/stores/{storeId}/orders/{orderId}` must be strictly synchronized with deprecating the direct client-side fallback in `storeManager.ts:942-946` and `storeManager.ts:1338-1343`. If the rule is deployed before decommissioning client writes, offline checkouts and fallback writes will crash with permission denied errors.
- **Action 2.2:** Isolate `CaptainPortalModal.tsx` order queries dynamically via `StoreManager.getActiveStore()` to orders assigned to the logged-in courier's credentials.
- **Action 2.3:** Save merchant bank IBANs and webhook secrets exclusively to `/stores/{id}/private/config` and simultaneously update read-side re-hydration in `storeManager.ts:723-735` to restore `bankDetails`, `driverName`, `driverPhone`, `driverFee`, and `notificationWebhookUrl`.
- **Action 2.4:** Standardize on `standardShippingRate` across `SettingsTab.tsx`, `storeManager.ts`, and `createOrder.ts`.
- **Action 2.5:** Update `OrdersTab.tsx` and `StoreDashboard.tsx` to exclude `Returned` and `Refunded` orders from revenue metrics.
- **Action 2.6:** Wrap inventory restocking in `api/updateOrderStatus.ts:240-279` in a Firestore atomic transaction.
- **Action 2.7:** Clean `seoManager.ts` to render `aggregateRating` and `review` schema only when genuine customer reviews exist.
  - *Unit Test Synchronization Guardrail:* Concurrently update `tests/seoDomainMcp.test.ts:228-252` (which asserts the presence of mock `aggregateRating` and `review` schema objects) to inject valid test review fixtures on mock products so removing algorithmic review generation does not break unit tests.

### Phase 3: Architectural Evolution & Enterprise Multi-Tenancy (Month 1+)
- **Action 3.1:** Build a separate, standalone Platform Super-Admin application with dedicated access controls for managing couriers and platform fee agreements.
- **Action 3.2:** Implement SMS OTP authentication via Firebase Phone Auth for delivery captains.
- **Action 3.3:** Replace stubbed ZATCA Phase 2 logic with an enterprise e-invoicing service supporting dynamic X.509 certificates and canonical UBL 2.1 signing.
- **Action 3.4:** Integrate the Saudi Post (SPL) National Address API for accurate dynamic geocoding.

### 6.4 Unit Test Suite Synchronization & Regression Guardrails

During execution of the remediation roadmap, engineering teams must synchronize code changes with corresponding unit test suites to avoid false-negative CI/CD build breaks:

1. **Captain Activation Bypass Tests (`tests/phase4CaptainsAndCod.test.ts`):**
   - **Lines 153 & 170:**
     ```typescript
     // Master code succeeds
     const successRes = CaptainService.activateCaptain(captain.id, 'QUICK-CAPTAIN-2026');
     expect(successRes.success).toBe(true);
     ...
     CaptainService.activateCaptain(captain.id, 'QUICK-CAPTAIN-2026');
     ```
   - **Synchronization Requirement:** When `MASTER_ACTIVATION_CODES` are deleted from `captainService.ts:223–228`, line 153 will fail with `success: false`. The test must be refactored to test the genuine platform owner approval flow:
     ```typescript
     // Activate via owner activation helper or designated code
     const activationRes = CaptainService.ownerActivateCaptain(captain.id, 2.0);
     const successRes = CaptainService.activateCaptain(captain.id, activationRes.activationCode!);
     expect(successRes.success).toBe(true);
     ```

2. **SEO Structured Data Schema Tests (`tests/seoDomainMcp.test.ts`):**
   - **Lines 228–234 & Lines 250–252:**
     ```typescript
     expect(firstProd.aggregateRating).toBeDefined();
     expect(firstProd.aggregateRating['@type']).toBe('AggregateRating');
     expect(firstProd.review).toBeDefined();
     ...
     expect(prodJsonLd.aggregateRating['@type']).toBe('AggregateRating');
     expect(prodJsonLd.review[0]['@type']).toBe('Review');
     ```
   - **Synchronization Requirement:** When algorithmic review generation is purged from `seoManager.ts:252–308`, products without customer reviews will no longer produce `aggregateRating` or `review` blocks. The test suite must be updated to either:
     - Provide mock review fixtures (`product.reviews = [...]`, `product.rating = 4.8`, `product.reviewsCount = 15`) on the test store product.
     - Add conditional assertions verifying that unreviewed products cleanly omit `aggregateRating` in strict compliance with Google Search Central guidelines.

3. **Database Security Rules & Client Order Creation Fallback (`storeManager.ts`):**
   - **Coordination Requirement:** Merging `allow create: if false;` on `/stores/{storeId}/orders/{orderId}` without deprecating `storeManager.ts:942–946` will break `tests/accessControl.test.ts` or client checkout flows in development environments where serverless API functions are bypassed. The client fallback must be phased out simultaneously with security rule enforcement.

---

## 7. Independent Verification Guide & Audit Assertions

To verify the audit findings independently without altering operational code:

### 1. Verification of Platform Margin Leak (R1)
- Inspect `src/components/builder/dashboard/SettingsTab.tsx` at line 1311. Confirm `<MerchantCaptainsDirectory settings={editableSettings} storeSlug={storeSlug} />` is mounted.
- Inspect `src/components/admin/MerchantCaptainsDirectory.tsx` lines 34-35, 112, 126-127, 308-309, 358-372, and 396-403. Confirm presence of 1%–2.5% fee selectors and `totalPlatformCommissionsEarned` display.

### 2. Verification of Master Bypass Codes (R2)
- Inspect `src/services/captainService.ts` lines 223–228. Confirm `QUICK-CAPTAIN-2026`, `SAMA-DELIVERY-2026`, and `CAPTAIN100` are hardcoded.
- Inspect `src/components/captain/CaptainPortalModal.tsx` line 388. Confirm the UI renders `QUICK-CAPTAIN-2026` as a default activation code.

### 3. Verification of Zero-Floor Settlement Clamping (R3)
- Run the settlement unit tests:
  ```powershell
  npx vitest run tests/driverDispatchAndSettlement.test.ts
  ```
- Inspect `src/utils/driverDispatch.ts:73` and confirm `Math.max(0, totalCodCash - totalDriverEarnings)` clamps negative balances to 0.

### 4. Verification of Revenue Overstatement (R3)
- Inspect `src/components/builder/dashboard/OrdersTab.tsx:68-69`. Confirm that only `status !== 'Cancelled'` is filtered, allowing `Returned` and `Refunded` orders to be summed into `totalRevenue`.

---
*End of Report — Quick-eCommerce Master Critical Code Review & Architectural Audit*
