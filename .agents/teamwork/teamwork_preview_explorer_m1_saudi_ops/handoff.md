# Comprehensive Regional E-Commerce & Operations Audit Report (Pillars 4 & 5)

**Evaluator Role**: Regional E-Commerce & Operations Specialist (`teamwork_preview_explorer_m1_saudi_ops`)  
**Target Platform**: StoreLink / Quick E-Commerce (`c:\Users\User\Desktop\Quick-ecomerece`)  
**Live Deployment**: `https://quick-ecommerce-saas-app.web.app`  
**Evaluation Scope**: Pillar 4 (Saudi Compliance & Regionalization, 15%) and Pillar 5 (Merchant Operations & Ergonomics, 15%)  
**Audit Date**: 2026-10-20  

---

## Executive Summary & Scorecard

| Pillar | Sub-Criterion | Weight | Score (1-5) | Weighted Points | Status |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Pillar 4: Saudi Compliance & Regionalization** | 1. ZATCA E-Invoicing Phase 1/2 QR Compliance | 25% | **3.5** | 0.875 / 1.25 | Functional with Gaps (Phase 1 TLV Base64 verified; Phase 2 absent) |
| *(Weight: 15% Overall)* | 2. Saudi E-Commerce Law Storefront Disclosures | 20% | **2.8** | 0.560 / 1.00 | Flawed / High Friction (CR/VAT missing in footer; no SBC badge) |
| | 3. Statutory 7-Day Return/Exchange Transparency | 20% | **4.0** | 0.800 / 1.00 | Strong Production (7-day window enforced in backend & RMA UI) |
| | 4. Arabic RTL Typography, Localization & SAR | 20% | **4.5** | 0.900 / 1.00 | Strong Production (Deep Arabic search & phone normalization) |
| | 5. Saudi National Address & 15% VAT Display | 15% | **2.7** | 0.405 / 0.75 | Flawed (Unstructured address, VAT omitted in checkout summary) |
| **Pillar 4 Subtotal** | **Saudi Compliance & Regionalization** | **100%** | **3.54 / 5.0** | **10.62 / 15.00** | **Grade: B- (70.8%)** |
| | | | | | |
| **Pillar 5: Merchant Operations & Ergonomics** | 1. Order Lifecycle State Machine & Transitions | 20% | **3.2** | 0.640 / 1.00 | Functional with Gaps (Driver states guarded; no merchant FSM or audit log) |
| *(Weight: 15% Overall)* | 2. Return & Exchange Workflow, RMA & Restocking | 20% | **3.8** | 0.760 / 1.00 | Strong Production (Rich RMA modal & restock on return; refund restock gap) |
| | 3. Driver Dispatch, GPS Routing & WhatsApp | 25% | **4.6** | 1.150 / 1.25 | Enterprise Exemplary (Zero-app mobile web view, GPS routing, daily ledger) |
| | 4. Inventory Synchronization & Stock Guards | 20% | **4.0** | 0.800 / 1.00 | Strong Production (Atomic Firestore deductions, OOS guards, low-stock alerts) |
| | 5. Multi-Store Isolation, Ergonomics & Audit | 15% | **3.7** | 0.555 / 0.75 | Strong Production (Firestore rules isolation, store switcher, alerts) |
| **Pillar 5 Subtotal** | **Merchant Operations & Ergonomics** | **100%** | **3.91 / 5.0** | **11.72 / 15.00** | **Grade: B+ (78.1%)** |
| **Combined Subtotal** | **Pillars 4 & 5 Regional E-Commerce Operations** | **30%** | **3.72 / 5.0** | **22.34 / 30.00** | **Composite Grade: B (74.5%)** |

---

## 1. Direct Observations

### Pillar 4: Saudi Compliance & Regionalization

#### 1.1 ZATCA E-Invoicing Phase 1/2 QR Code Generation
- **File**: `src/utils/zatca.ts:6-57`
  - Observation: Implements standard ZATCA Phase 1 TLV Base64 encoding using `toTLV(tag, value)` with UTF-8 `TextEncoder()`.
  - Encodes mandatory Tags 1 through 5:
    - Tag 1 (Seller Name): `toTLV(1, data.sellerName)` (`zatca.ts:31`)
    - Tag 2 (VAT Number): `toTLV(2, data.vatNumber)` (`zatca.ts:32`)
    - Tag 3 (Timestamp): `toTLV(3, data.timestamp)` (`zatca.ts:33`)
    - Tag 4 (Invoice Total): `toTLV(4, data.invoiceTotal)` (`zatca.ts:34`)
    - Tag 5 (VAT Total): `toTLV(5, data.vatTotal)` (`zatca.ts:35`)
  - Tested and verified in `tests/moyasar.test.ts:174-195`, confirming bidirectional encode/decode fidelity via `decodeZatcaTLVBase64`.
- **File**: `src/components/storefront/InvoiceModal.tsx:75-93`
  - Observation: Generates QR Data URL on the fly using `qrcode.toDataURL(tlvPayload)` and renders it into printable invoice (`InvoiceModal.tsx:411-426`).
  - Formats: Supports both standard A4 Tax Invoice and 80mm thermal receipt formats (`InvoiceModal.tsx:161-186`).
  - Fallback: Uses merchant's `settings.vatNumber` or default `'300000000000003'` (`InvoiceModal.tsx:57`).
- **Phase 2 Gap**:
  - `src/utils/zatca.ts:1-4` explicitly states: *"Implements Phase 1 Simplified Tax Invoice QR Code (TLV Base64 encoding)."*
  - Complete absence of Phase 2 requirements: no UBL 2.1 XML schema builder, no ECDSA P-256 cryptographic signing, no invoice hash (Tag 6), no cryptographic stamp (Tag 7), no public key (Tag 8), no CSID (Tag 9), no SHA-256 previous invoice hash chaining (PIH), and no ZATCA FATOORA portal clearance/reporting API integration.

#### 1.2 Saudi E-Commerce Law Storefront Disclosures
- **File**: `src/types/store.ts:72-73`
  - Observation: Settings data structure includes `commercialRegister?: string` and `vatNumber?: string`.
- **File**: `src/components/layout/Footer.tsx:35-189`
  - Observation: The storefront footer renders the store name (`line 60`), tagline (`line 68`), phone (`lines 72-76`), email (`lines 78-82`), social links (`lines 85-109`), policy links (`lines 117-132`), and WhatsApp CTA (`lines 166-176`).
  - Defect: Commercial Registration (CR / السجل التجاري) number is NOT rendered in `Footer.tsx`.
  - Defect: VAT Registration number (الرقم الضريبي) is NOT rendered in `Footer.tsx`.
  - Defect: Physical headquarters address is omitted in `Footer.tsx`.
  - Defect: No Saudi Business Center (المركز السعودي للأعمال SBC) or Maroof (معروف) authentication badge or URL exists anywhere on the storefront.

#### 1.3 Statutory 7-Day Return/Exchange Window & Consumer Protection
- **File**: `api/updateOrderStatus.ts:158-161`
  - Observation: Upon delivery (`status === 'Delivered'`), the backend automatically calculates and stores the 7-day statutory deadline:
    ```typescript
    const eligibleUntil = new Date(new Date(deliveredTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    orderUpdates.returnEligibleUntil = eligibleUntil;
    ```
- **File**: `api/updateOrderStatus.ts:98-109`
  - Observation: When a shopper submits a return (`source === 'shopper'`), the endpoint strictly rejects expired returns:
    ```typescript
    if (Date.now() > eligibilityDeadline) {
      return res.status(400).json({
        error: 'انتهت فترة الاسترجاع المسموحة نظاماً لهذا الطلب.',
        success: false,
      });
    }
    ```
- **File**: `src/components/storefront/ReturnRequestModal.tsx:164-173`
  - Observation: Prominently renders a consumer protection banner:
    *"حق المستهلك نظاماً (وزارة التجارة): متاح تقديم طلب الاسترجاع حتى [eligibleDate] بشرط الحفاظ على المنتج وملحقاته بحالته الأصلية."*
- **Discrepancy**:
  - `src/services/storeStorage.ts:222` (`DEFAULT_POLICIES` policy-02) states: *"إمكانية الاستبدال أو الاسترجاع بكل سهولة خلال 14 يوماً من استلام الطلب"* — conflicting with the 7-day system enforcement in `updateOrderStatus.ts`.
  - `src/components/storefront/CheckoutModal.tsx` contains no return window disclosure during the checkout funnel.

#### 1.4 Arabic RTL Localization, Typography & SAR Currency Representation
- **File**: `index.html:2`
  - Observation: Root element correctly specifies `<html lang="ar" dir="rtl">`.
- **File**: `index.html:17` and `src/index.css:4-6`
  - Observation: Google Font `Cairo` (`wght@400;500;600;700;800`) is preconnected and applied as default across all elements (`font-family: 'Cairo', system-ui...`).
- **File**: `src/utils/arabicSearch.ts:7-28`
  - Observation: Thorough Arabic text normalization stripping Tashkeel diacritics (`[\u064B-\u065F\u0670]`), removing Tatweel/Kashida (`\u0640`), normalizing Alef forms (`[أإآٱ] -> ا`), Taa Marbuta (`ة -> ه`), Alef Maqsura (`ى -> ي`), and Persian/Urdu variants (`\u06A9 -> ك`, `[\u06CC\u06D2] -> ي`).
- **File**: `src/utils/digits.ts:16-19` and `29-62`
  - Observation: Normalizes Eastern Arabic digits (`٠-٩`) to Western ASCII digits. Normalizes and validates Saudi mobile numbers (`05XXXXXXXX`, `+9665XXXXXXXX`, `5XXXXXXXX`).
- **File**: `src/components/storefront/ProductCard.tsx:158-166`
  - Observation: Formats prices using `{currentPrice.toLocaleString('en-US')} {settings.currency}`.
  - Defect: Lacks a centralized currency formatting utility (e.g. `Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' })`). In some mock fixtures (`tests/moyasar.test.ts:31`), currency defaults to `'SAR'` rather than localized `'ر.س'`.

#### 1.5 Saudi National Address Capture & 15% VAT Display
- **File**: `src/components/storefront/CheckoutModal.tsx:461-552`
  - Observation: Includes dropdown of 20 predefined Saudi cities (`DEFAULT_CITIES`) plus custom city input (`lines 38-59, 468-495`).
  - Features GPS button `handleGetLocation` (`lines 172-196`) extracting browser geolocation coordinates and formatting Google Maps link (`lines 504-536`).
  - Defect: Address capture is limited to a single unstructured text input: `deliveryAddress` placeholder *"مثال: حي الياسمين، شارع أنس بن مالك، فيلا 12"*.
  - Defect: Completely lacks structured Saudi National Address fields (4-character Short Code e.g. RRRD2929, Building Number, District, Postal Code, Secondary Number).
- **File**: `src/components/storefront/ProductCard.tsx:154-169` and `ProductModal.tsx:220-232`
  - Defect: Neither the catalog product card nor the Product Detail Modal contains the legally mandated "شامل ضريبة القيمة المضافة 15%" (Tax-inclusive) label.
- **File**: `src/components/storefront/CheckoutModal.tsx:741-769`
  - Defect: Order review financial summary displays Subtotal, Coupon Discount, Shipping, and Grand Total, but COMPLETELY OMITS an itemized 15% VAT line item.
- **File**: `api/createOrder.ts:298-324`
  - Defect: The serverless order creation transaction persists `subtotal`, `shippingFee`, and `grandTotal`, but DOES NOT persist `vatAmount`, `vatRate`, or `netAmount` on the Firestore order document.

---

### Pillar 5: Merchant Operations & Ergonomics

#### 2.1 Order Lifecycle State Machine & Transition Rigor
- **File**: `src/types/store.ts:122-133`
  - Observation: Defined states:
    ```typescript
    export type OrderStatus =
      | 'Received'
      | 'In Progress'
      | 'Out for Delivery'
      | 'Delivered'
      | 'Return Requested'
      | 'Returned'
      | 'Cancelled'
      | 'Paid'
      | 'Payment Failed'
      | 'Refunded'
      | 'Partially Refunded';
    ```
- **File**: `api/updateOrderStatus.ts:119-124`
  - Observation: Courier updates are restricted to `['Out for Delivery', 'Delivered', 'Cancelled']`.
- **Defect (State Machine Guard)**:
  - In `api/updateOrderStatus.ts:139-141`, when the caller is the merchant (`source !== 'driver' && source !== 'shopper'`), any string matching `status` is written directly (`orderUpdates.status = status;`).
  - There is no Finite State Machine (FSM) validation table enforcing legal state progressions (e.g., preventing jumping from `Cancelled` to `Delivered`, or `Refunded` back to `In Progress`).
- **Defect (Audit Trail Absence)**:
  - In `types/store.ts:151-195` and `api/createOrder.ts:298-324`, the `Order` entity contains single timestamps (`createdAt`, `driverDeliveredAt`, `returnedAt`, `refundedAt`), but lacks a `statusHistory` or `auditLog` collection/array recording state transition histories, modifier user IDs, or notes.

#### 2.2 Return & Exchange Workflow, RMA Dashboard & Restocking Logic
- **File**: `src/components/storefront/ReturnRequestModal.tsx:1-376`
  - Observation: Exemplary customer RMA modal supporting item checkbox selection (`lines 216-278`), individual item quantity pickers (`lines 250-273`), categorized return reasons (`defective`, `wrong_item`, `size_fit`, `changed_mind`, `other`), detailed problem notes, last-4-digits phone verification, and direct 1-tap WhatsApp dispute link generation (`lines 122-127`).
- **File**: `api/updateOrderStatus.ts:225-270`
  - Observation: Automatically restocks inventory when order status transitions to `Returned` or `Cancelled` with `restockItems: true`:
    ```typescript
    const currentStock = Number(storeProducts[prodIdx].stockQuantity) || 0;
    const newStock = currentStock + qtyToRestock;
    storeProducts[prodIdx] = { ...storeProducts[prodIdx], stockQuantity: newStock, inStock: newStock > 0 };
    ```
    Updates both `storeRef` products array and subcollection documents (`lines 247-261`).
- **File**: `src/components/builder/StoreDashboard.tsx:464-481`
  - Observation: Local state also increments product stock when merchant marks an order as `Returned` with restock checked.
- **File**: `api/refundOrder.ts:112-147`
  - Defect: When a merchant processes a gateway refund via `/api/refundOrder`, the status is updated to `Refunded` or `Partially Refunded`, but STOCK RESTOCKING IS COMPLETELY OMITTED. Returned items refunded via Moyasar are never restored to inventory unless manually adjusted.

#### 2.3 Driver Dispatch System, GPS Routing & WhatsApp Communications
- **File**: `src/components/driver/DriverDispatchView.tsx:1-372`
  - Observation: Zero-app mobile web interface accessed via `/?store=<storeId>&driver=<orderId>`. No native mobile app install required for local freelance couriers.
  - Pickup Route: Displays merchant store pickup address with Google Maps link (`DriverDispatchView.tsx:96, 194-205`).
  - Drop-off Route: Displays customer address, notes, and direct Google Maps navigation coordinates (`DriverDispatchView.tsx:97, 207-235`).
  - Customer Comms: 1-tap Phone Call (`tel:...`) and direct 1-tap WhatsApp chat (`wa.me/...`).
  - COD Handling: High-visibility banner distinguishing Cash on Delivery collection (`order.grandTotal`) from prepaid orders (`DriverDispatchView.tsx:238-265`).
  - Driver Actions: 1-tap buttons for "استلام وبدء التوصيل (Out for Delivery)", "تأكيد التسليم واستلام الكاش (Delivered)", and "تعذر التوصيل / رفض العميل (Cancelled)" (`lines 290-335`). Doorstep cancellations automatically set `restockItems: true`.
- **File**: `src/utils/driverDispatch.ts:12-46` and `StoreDashboard.tsx:525-568`
  - Observation: 1-Tap Driver WhatsApp Dispatch formats pre-filled WhatsApp message containing pickup location, customer address, Google Maps pin, COD amount, and driver dispatch link.
- **File**: `src/components/driver/DriverSettlementModal.tsx:1-241` and `src/utils/driverDispatch.ts:56-81`
  - Observation: Driver Daily Reconciliation & Settlement Ledger groups delivered orders, aggregates COD cash collected, computes driver earnings (`deliveredOrders.length * driverFeePerOrder`), calculates net cash due to merchant (`netDueToMerchant = totalCodCash - totalDriverEarnings`), marks orders as settled (`driverSettled: true`), and generates formatted WhatsApp reconciliation report (`DriverSettlementModal.tsx:80-95`).
- **File**: `src/services/carrierService.ts:1-154`
  - Observation: Clean `CarrierProvider` abstraction. Implements `MockCarrierProvider` generating sandbox SMSA tracking numbers (`lines 56-83`) and `AramexCarrierProvider` stub (`lines 89-127`). SMSA, Torod, and Naqel live API integrations remain unconfigured.

#### 2.4 Inventory Synchronization & Stock Control
- **File**: `api/createOrder.ts:115-200, 329-337`
  - Observation: Server-side order creation runs inside atomic Firestore transaction (`db.runTransaction`).
  - Validates `prod.inStock !== false` and `prod.stockQuantity >= item.qty` (`lines 175-185`).
  - Atomically decrements stock and sets `inStock = remainingStock > 0` (`lines 186-189, 329-337`), preventing race conditions and overselling.
- **File**: `src/components/storefront/ProductCard.tsx:42-48, 104-110, 171-189`
  - Observation: Out-of-stock overlay ("نفدت الكمية") and disabled CTA button when `stockQuantity <= 0`.
  - Urgency indicator ("متبقي X فقط") rendered when `stockQuantity <= 5` (`ProductCard.tsx:95-100` and `ProductModal.tsx:207-212`).
- **Defect**:
  - In `api/createOrder.ts:191-199`, if products exist only in the legacy `storeData.products` array and not in the `products` subcollection, stock decrements are not applied to the store document.

#### 2.5 Merchant Multi-Store Isolation, Ergonomics, Performance & Audit Trails
- **File**: `firestore.rules:17-21, 88-136`
  - Observation: Robust database-level multi-tenant isolation.
  - `isStoreOwner(storeId)` helper ensures `request.auth.uid == get(...).data.ownerId`.
  - Orders subcollection `orders`: `allow get, list: if isStoreOwner(storeId);` — strictly prevents any merchant from accessing or querying another merchant's orders.
  - Orders cannot be deleted (`allow delete: if false`).
- **File**: `src/components/layout/Navbar.tsx:116-168`
  - Observation: Store Switcher dropdown dynamically lists only stores owned by the authenticated merchant (`merchantStores = StoreManager.getMerchantStores(currentUser.id)`).
- **File**: `src/components/builder/StoreDashboard.tsx`
  - Observation: Rich operational ergonomics:
    - Order status filter tabs (`Received`, `In Progress`, `Out for Delivery`, `Delivered`, `Return Requested`, `Returned`, `Cancelled`) (`lines 425-438`).
    - Search query filtering across order ID, customer name, phone number, and city (`lines 428-436`).
    - CSV order export (`lines 620-640`).
    - Audio notifications, OS desktop notifications, Telegram bot dispatches, and webhook notifications (`services/notificationService.ts`).
- **Defects**:
  - LocalStorage Shared Cache: `StoreManager.saveAllStores` serializes all loaded stores to a shared key `localStorage['storelink_all_stores']` (`storeManager.ts:225`), posing data leakage risks across different users on a shared terminal.
  - Single Owner Role Only: No multi-user role delegation (e.g. store owner vs order fulfillment staff vs delivery driver vs accountant).

---

## 2. Logic Chain

1. **ZATCA Assessment**:
   - *Observation*: `zatca.ts:30-57` encodes tags 1-5 into Base64 TLV and decodes them accurately. `InvoiceModal.tsx:75-93` displays the QR code on A4 and 80mm receipts.
   - *Inference*: Phase 1 simplified tax invoice requirements are fully met.
   - *Observation*: Tags 6-9, ECDSA signatures, XML UBL 2.1 formatting, and FATOORA API endpoints are absent.
   - *Conclusion*: Platform is compliant with ZATCA Phase 1 (B2C simplified invoices), but non-compliant with Phase 2 (Integration phase). Score: **3.5 / 5.0**.

2. **Saudi E-Commerce Law Disclosure Assessment**:
   - *Observation*: `Footer.tsx:35-189` renders store name, phone, email, and policies, but omits `settings.commercialRegister`, `settings.vatNumber`, headquarters address, and Saudi Business Center / Maroof badges.
   - *Inference*: Saudi Ministry of Commerce E-Commerce Law (Articles 4 & 5) mandates clear display of CR number, VAT registration, physical location, and authentication credentials on storefronts.
   - *Conclusion*: The storefront leaves merchants vulnerable to regulatory penalties and fines. Score: **2.8 / 5.0**.

3. **Statutory Return Window Assessment**:
   - *Observation*: `api/updateOrderStatus.ts:159` computes `returnEligibleUntil = deliveryDate + 7 days`. Line 104 rejects customer return attempts after 7 days. `ReturnRequestModal.tsx:168` cites Ministry of Commerce consumer protection rights with exact date.
   - *Inference*: The 7-day statutory right of withdrawal is technically enforced in both backend and frontend.
   - *Observation*: `DEFAULT_POLICIES` (`storeStorage.ts:222`) mentions 14 days, creating legal confusion. Checkout does not display the return policy.
   - *Conclusion*: Strong production implementation with minor policy text discrepancy. Score: **4.0 / 5.0**.

4. **Address & VAT Transparency Assessment**:
   - *Observation*: `CheckoutModal.tsx:498` captures address as a single text input. `ProductCard.tsx` lacks a "شامل الضريبة" tag. `CheckoutModal.tsx:741` omits the 15% VAT line item from the order summary. `api/createOrder.ts:298` does not save `vatAmount`.
   - *Inference*: Unstructured address entry causes last-mile delivery friction. Absence of tax-inclusive labeling and missing VAT breakdown violates ZATCA and Ministry of Commerce consumer pricing transparency rules. Lack of tax snapshot in database prevents immutable tax accounting.
   - *Conclusion*: High regulatory friction and operational deficiency. Score: **2.7 / 5.0**.

5. **Driver Dispatch & Ergonomics Assessment**:
   - *Observation*: `DriverDispatchView.tsx` provides zero-app mobile web navigation with dual GPS points, COD cash instructions, WhatsApp hooks, and automatic delivery/cancellation state changes. `DriverSettlementModal.tsx` reconciles daily cash and driver fees.
   - *Inference*: The platform solves the local freelance courier problem with high ergonomics, zero barrier to entry, and accurate cash reconciliation.
   - *Conclusion*: Outstanding operational design. Score: **4.6 / 5.0**.

6. **Restocking on Refund Assessment**:
   - *Observation*: `api/updateOrderStatus.ts:225` restocks inventory when order is marked `Returned`. However, `api/refundOrder.ts:112` modifies status to `Refunded` without invoking any restocking logic.
   - *Inference*: Merchants executing electronic refunds via Moyasar face inventory discrepancies (stock remains un-restocked).
   - *Conclusion*: Critical operational bug in financial return loop. Score: **3.8 / 5.0**.

---

## 3. Caveats & Invalidation Conditions

1. **ZATCA Wave Thresholds**: Phase 2 compliance is legally mandatory in phases based on merchant annual taxable revenue (waves 1 through 15+). For small micro-merchants under 500,000 SAR annual revenue, Phase 1 TLV QR is currently tolerated, but platform SaaS multi-tenancy will eventually require Phase 2 FATOORA connectivity.
2. **Third-Party Carrier APIs**: We evaluated the active codebase and test suite; live Aramex / SMSA corporate accounts were not connected during this read-only audit.
3. **Moyasar Production Secrets**: Evaluation of refund workflows utilized codebase inspection and mock test verification (`tests/moyasar.test.ts`), as live bank payment gateway credentials were not configured.
4. **Invalidation Condition**: If StoreLink introduces a microservice or Cloud Function outside this repository handling ZATCA FATOORA reporting, the Phase 2 compliance score would be higher.

---

## 4. Conclusion & Prioritized Remediation Roadmap

StoreLink exhibits strong regional alignment in Arabic typography, Eastern Arabic digit normalization, zero-app driver logistics, daily COD cash reconciliation, and 7-day statutory return enforcement. However, critical gaps exist in storefront legal disclosures (CR/VAT in footer), unstructured National Address capture, 15% VAT display at checkout, and inventory restocking upon electronic refund.

### Prioritized Remediation Plan

#### P0: Critical / Immediate Fixes (Compliance & Data Integrity)
1. **Storefront Legal Disclosures**: Update `src/components/layout/Footer.tsx:35-189` to display:
   - Commercial Registration (CR) number (`settings.commercialRegister`)
   - VAT Registration number (`settings.vatNumber`)
   - Headquarters city and national address
   - Saudi Business Center (المركز السعودي للأعمال SBC) or Maroof (معروف) verification badge.
2. **15% VAT Display & Database Persistence**:
   - Add "شامل ضريبة القيمة المضافة 15%" badge to `ProductCard.tsx:158` and `ProductModal.tsx:221`.
   - Add itemized 15% VAT line item to `CheckoutModal.tsx:741-769` financial summary.
   - Update `api/createOrder.ts:298-324` to compute and persist `vatRate`, `vatAmount`, and `netAmount` directly on the order record.
3. **Electronic Refund Restocking Bug**:
   - Patch `api/refundOrder.ts:112-147` to execute inventory replenishment when full refunds are processed.

#### P1: High Priority / Near-Term Upgrades (Logistics & FSM Rigor)
1. **Saudi National Address (SPL) Structured Capture**:
   - Refactor `CheckoutModal.tsx:498-537` to capture structured fields: 4-letter Short Address Code (e.g. RRRD2929), Building Number, District, and Postal Code.
2. **Finite State Machine & Status Audit Trail**:
   - Introduce status transition matrix in `api/updateOrderStatus.ts` prohibiting invalid state jumps.
   - Add `statusHistory` array (`[{ status, timestamp, changedBy, note }]`) to order records.
3. **Policy Text Alignment**:
   - Harmonize `DEFAULT_POLICIES` (`storeStorage.ts:222`) to state 7 days (or clarify 7 days unconditional + 14 days manufacturer defect).

#### P2: Strategic / Future Roadmaps (Enterprise Scale)
1. **ZATCA Phase 2 FATOORA Integration**:
   - Implement UBL 2.1 XML generation, ECDSA P-256 cryptographic signing, and automated clearance/reporting with ZATCA's FATOORA API.
2. **Live Carrier Shipping Integrations**:
   - Connect live APIs for SMSA Express, Torod, and Naqel with automated waybill printing.
3. **Granular Multi-User Store RBAC**:
   - Support staff sub-accounts (`owner`, `manager`, `courier`, `cashier`) with scoped Firestore permissions.

---

## 5. Verification Method

To independently verify these findings:

1. **Run Vitest Automated Suite**:
   ```powershell
   cd c:\Users\User\Desktop\Quick-ecomerece
   npm test
   ```
   *Expected Result*: All 14 test files and 101 tests pass, validating Phase 1 TLV QR encoding (`tests/moyasar.test.ts`), driver settlement calculation (`tests/driverDispatchAndSettlement.test.ts`), and 7-day return flow (`tests/returnsAndDeliveryE2E.test.ts`).

2. **Inspect ZATCA Phase 1 vs Phase 2 Implementation**:
   - Open `src/utils/zatca.ts:1-57`: Verify only Tags 1-5 are encoded. Confirm absence of Tags 6-9, XML generation, and ECDSA signing.

3. **Inspect Storefront Footer Legal Disclosures**:
   - Open `src/components/layout/Footer.tsx:35-189`: Confirm `commercialRegister`, `vatNumber`, and SBC/Maroof badges are omitted from rendering.

4. **Inspect Checkout Address Capture & VAT Breakdown**:
   - Open `src/components/storefront/CheckoutModal.tsx:498-537`: Verify single unstructured `deliveryAddress` input.
   - Open `src/components/storefront/CheckoutModal.tsx:741-769`: Confirm the absence of a 15% VAT line item in the checkout order summary.
   - Open `api/createOrder.ts:298-324`: Confirm `vatAmount` is not persisted in the Firestore order record.

5. **Inspect Electronic Refund Restocking**:
   - Open `api/refundOrder.ts:112-147`: Confirm no stock decrement reversal / restocking logic is present.
