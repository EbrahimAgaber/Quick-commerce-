# Production Deployment Guide (StoreLink)

This guide provides instructions for deploying StoreLink to **Firebase** (Firebase Hosting, Firestore, Auth, Storage, and Security Rules).

---

## 1. Prerequisites & Required Tools

- **Node.js**: v20+ / v22 LTS
- **Firebase CLI**: `npm i -g firebase-tools` (or use `npx firebase-tools`)
- **Git**: Installed and configured

---

## 2. Environment Variables Checklist

Configure client variables in `.env` or during the build process:

### Client Variables (`VITE_*`)
```env
# Firebase Web Client Configuration
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-app"
VITE_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"

# Production Flags
VITE_DEMO_MODE="false"
```

### Server Variables (Serverless Functions)
```env
# Firebase Admin SDK Credentials
FIREBASE_PROJECT_ID="your-app"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-app.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Gemini AI Key
GEMINI_API_KEY="AIzaSy..."

# Moyasar Webhook Secret Token / Signature Key
MOYASAR_WEBHOOK_SECRET="sec_live_..."

# Allowed CORS Origin (Frontend domain)
ALLOWED_ORIGIN="https://yourdomain.sa"
```

---

## 3. Database & Security Rules Deployment

Deploy Firestore security rules and composite indexes to your Firebase project:

```bash
# 1. Login to Firebase
firebase login

# 2. Select your production project
firebase use --add

# 3. Deploy Firestore Rules and Indexes
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 4. Existing Data Migration (Legacy Schema to Split Schema)

If you have stores operating on the legacy schema (where private settings or promo codes were inside the public store document):

```bash
# 1. Run dry-run to inspect docs that need migration
npm run migrate:dry-run

# 2. Execute live atomic migration to split schema
npm run migrate
```

This script:
- Moves promo codes and sensitive configs into `/stores/{id}/private/config`
- Moves products into `/stores/{id}/products/{productId}` subcollections
- Registers global unique slug records in `/slugs/{slug}`

---

## 5. Moyasar Payment Gateway Webhook Registration

1. Log into your [Moyasar Dashboard](https://dashboard.moyasar.com).
2. Go to **Settings** > **Webhooks**.
3. Add a new Webhook URL:
   ```
   https://yourdomain.sa/api/moyasarWebhook
   ```
4. Choose event: `payment.paid`.
5. Copy the generated Webhook Secret into your Vercel Environment Variables as `MOYASAR_WEBHOOK_SECRET`.

---

## 6. Vercel Deployment

Deploy the combined Vite client and Serverless API functions to Vercel:

```bash
# Production deployment
npm run deploy
# (Runs: npx vercel --prod)
```

---

## 7. Post-Deployment Verification Checklist

- [ ] Visit `https://yourdomain.sa/` and confirm landing page loads without console errors.
- [ ] Visit `https://yourdomain.sa/?store=aurora` or a test slug to verify storefront loading.
- [ ] Test order creation through checkout stepper: ensure `/api/createOrder` succeeds and stock is decremented.
- [ ] Verify ZATCA Phase 1 QR code generation on the invoice modal and print preview.
- [ ] Confirm Moyasar test payment redirect and webhook processing in dashboard.
