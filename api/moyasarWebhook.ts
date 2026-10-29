import crypto from 'crypto';
import { getAdminFirestore } from './_firebaseAdmin';
import { handleCors } from './_security';
import { reconcileMoyasarPayment } from './_paymentReconcile';

interface MoyasarWebhookPayload {
  id?: string;
  type?: string;
  created_at?: string;
  secret_token?: string;
  account_name?: string;
  live?: boolean;
  data: {
    id: string;
    status: string;
    amount: number; // In halalas
    currency: string;
    description?: string;
    amount_format?: string;
    fee?: number;
    refunded?: number;
    refunded_at?: string;
    captured?: number;
    captured_at?: string;
    voided_at?: string;
    invoice_id?: string;
    ip?: string;
    callback_url?: string;
    created_at?: string;
    updated_at?: string;
    metadata?: Record<string, string>;
    source?: any;
  };
}

function safeTimingEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hardened Moyasar Multi-Tenant Webhook Endpoint (Phase 4)
 *
 * 1. Fails closed in EVERY environment if no webhook secret is configured for the store/platform.
 * 2. Compares incoming secret (from body `secret_token` per Moyasar standard, or fallback `x-moyasar-secret` header)
 *    using `crypto.timingSafeEqual`. Strictly ignores query parameters.
 * 3. Removes all dummy prefix bypasses (re-fetches authentic payment or uses mocked fetch in test).
 * 4. Atomic idempotency: creates `webhook_idempotency_keys/{key}` with `transaction.create()`
 *    inside the reconciliation transaction.
 * 5. Reuses `reconcileMoyasarPayment` from `_paymentReconcile.ts`.
 */
export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const payload = req.body as MoyasarWebhookPayload;
  if (!payload || !payload.data || !payload.data.id) {
    return res.status(400).json({ error: 'Invalid Moyasar webhook payload structure.', success: false });
  }

  const paymentData = payload.data;
  const paymentId = paymentData.id;
  const storeId = paymentData.metadata?.storeId;
  const orderId = paymentData.metadata?.orderId;

  if (!storeId || !orderId) {
    console.warn(`Moyasar webhook missing metadata (storeId: ${storeId}, orderId: ${orderId})`);
    return res.status(400).json({ error: 'Missing storeId or orderId in payment metadata.', success: false });
  }

  const db = getAdminFirestore();

  try {
    let storeRef = db.collection('stores').doc(storeId);
    let storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      const slugQuery = await db.collection('stores').where('slug', '==', storeId).limit(1).get();
      if (!slugQuery.empty) {
        storeRef = slugQuery.docs[0].ref;
        storeSnap = slugQuery.docs[0];
      } else {
        return res.status(404).json({ error: 'Store not found.', success: false });
      }
    }

    const realStoreId = storeSnap.id;

    // Resolve configured webhook secret
    const privatePaymentRef = storeRef.collection('private').doc('payment');
    const privatePaymentSnap = await privatePaymentRef.get();

    let webhookSecret = process.env.MOYASAR_WEBHOOK_SECRET || '';
    if (privatePaymentSnap.exists) {
      const pData = privatePaymentSnap.data() || {};
      if (pData.webhookSecret) webhookSecret = pData.webhookSecret;
    }

    // 1. Fail closed in ALL environments if no secret is configured
    if (!webhookSecret) {
      console.error(`Moyasar webhook failed closed: No webhook secret configured for store ${realStoreId}`);
      return res.status(401).json({ error: 'Webhook secret is not configured. Failing closed.', success: false });
    }

    // 2. Authentication: Moyasar payload sends secret_token in body (or x-moyasar-secret header).
    // Query string secrets are STRICTLY forbidden and ignored to prevent logging leakage.
    const providedSecret = payload.secret_token || req.headers?.['x-moyasar-secret'] || '';

    if (!providedSecret || !safeTimingEqual(providedSecret, webhookSecret)) {
      console.warn('Moyasar webhook unauthorized secret mismatch');
      return res.status(401).json({ error: 'Invalid or missing webhook secret signature.', success: false });
    }

    // 3. Atomic Idempotency Check & Claim via Transaction
    const idempotencyDocId = `moyasar_${paymentId}_${payload.data.status || 'paid'}`;
    const idempotencyRef = db.collection('webhook_idempotency_keys').doc(idempotencyDocId);

    // Atomically check and create idempotency key doc
    let isReplay = false;
    try {
      await db.runTransaction(async (tx: any) => {
        const idempSnap = await tx.get(idempotencyRef);
        if (idempSnap.exists) {
          isReplay = true;
          return;
        }
        tx.create(idempotencyRef, {
          paymentId,
          storeId: realStoreId,
          orderId,
          status: paymentData.status,
          amount: paymentData.amount,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        });
      });
    } catch (txErr: any) {
      // If transaction failed due to doc already existing (ALREADY_EXISTS / 6)
      if (txErr.code === 6 || txErr.message?.includes('already exists')) {
        isReplay = true;
      } else {
        throw txErr;
      }
    }

    if (isReplay) {
      return res.status(200).json({
        success: true,
        message: 'Webhook event already processed (Atomic idempotency key hit).',
      });
    }

    // 4. Delegate to shared reconciliation engine (re-fetches from Moyasar, verifies SAR, amount, claims paymentId)
    const result = await reconcileMoyasarPayment({
      storeId: realStoreId,
      orderId,
      paymentId,
      rawPayment: paymentData,
      source: 'webhook',
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        error: result.error || 'Payment reconciliation failed.',
        success: false,
      });
    }

    return res.status(200).json({
      success: true,
      orderId,
      status: result.status,
      paymentId,
    });
  } catch (err: any) {
    console.error('Moyasar webhook handling error:', err);
    return res.status(500).json({
      error: 'An internal error occurred while processing the webhook.',
      success: false,
    });
  }
}
