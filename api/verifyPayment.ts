import { handleCors, checkRateLimit, getClientIp } from './_security';
import { reconcileMoyasarPayment } from './_paymentReconcile';

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(`pay_verify_${clientIp}`, 20, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait.', success: false });
  }

  const { storeId, orderId, paymentId } = req.body || {};

  if (!storeId || !orderId || !paymentId) {
    return res.status(400).json({ error: 'Missing storeId, orderId, or paymentId.', success: false });
  }

  try {
    const result = await reconcileMoyasarPayment({
      storeId,
      orderId,
      paymentId,
      source: 'verify_payment',
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        error: result.error || 'Payment verification failed.',
        success: false,
      });
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Verify payment handler error:', err);
    return res.status(500).json({
      error: 'An internal error occurred while verifying payment.',
      success: false,
    });
  }
}
