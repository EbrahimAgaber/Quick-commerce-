import { getAdminFirestore, getAdminAuth } from './_firebaseAdmin';
import { handleCors } from './_security';
import { 
  TorodCarrierProvider, 
  SmsaCarrierProvider, 
  SplCarrierProvider, 
  AramexCarrierProvider, 
  MockCarrierProvider,
  ShipmentRequest 
} from '../src/services/carrierService';

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  // 1. Authenticate Merchant
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required to create shipments.', success: false });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let merchantUid = '';
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    merchantUid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid merchant authentication token.', success: false });
  }

  const { storeId, orderId, provider = 'torod', weightKg = 1, description } = req.body || {};
  if (!storeId || !orderId) {
    return res.status(400).json({ error: 'storeId and orderId are required.', success: false });
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

    // Verify ownership
    if (storeSnap.data()?.ownerId !== merchantUid) {
      return res.status(403).json({ error: 'You are not authorized to dispatch shipments for this store.', success: false });
    }

    const storeData = storeSnap.data() || {};
    const orderRef = storeRef.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found.', success: false });
    }

    const orderData = orderSnap.data() || {};
    if (orderData.status === 'Cancelled' || orderData.status === 'Refunded') {
      return res.status(400).json({ 
        error: 'لا يمكن إصدار بوليصة شحن لطلب ملغي أو مسترد.', 
        success: false 
      });
    }

    // Check private carrier configuration if present
    const privateCarrierRef = storeRef.collection('private').doc('carriers');
    const privateCarrierSnap = await privateCarrierRef.get();
    const carrierSecrets = privateCarrierSnap.exists ? privateCarrierSnap.data() || {} : {};

    // Select and configure carrier provider
    let carrierInstance;
    const chosenProvider = (provider || 'torod').toLowerCase();

    if (chosenProvider === 'smsa') {
      const passKey = carrierSecrets.smsaPassKey || process.env.SMSA_PASSKEY || '';
      carrierInstance = new SmsaCarrierProvider(passKey, !passKey);
    } else if (chosenProvider === 'spl') {
      const apiKey = carrierSecrets.splApiKey || process.env.SPL_API_KEY || '';
      const accountNo = carrierSecrets.splAccountNo || process.env.SPL_ACCOUNT_NO || '';
      carrierInstance = new SplCarrierProvider(apiKey, accountNo, !apiKey);
    } else if (chosenProvider === 'aramex') {
      const accNo = carrierSecrets.aramexAccountNumber || process.env.ARAMEX_ACCOUNT_NUMBER || '';
      const pwd = carrierSecrets.aramexPassword || process.env.ARAMEX_PASSWORD || '';
      carrierInstance = new AramexCarrierProvider(accNo, pwd, true);
    } else if (chosenProvider === 'mock') {
      carrierInstance = new MockCarrierProvider();
    } else {
      // Default: Torod Aggregator
      const apiKey = carrierSecrets.torodApiKey || process.env.TOROD_API_KEY || '';
      const apiSecret = carrierSecrets.torodApiSecret || process.env.TOROD_API_SECRET || '';
      carrierInstance = new TorodCarrierProvider(apiKey, apiSecret, !apiKey);
    }

    // Prepare shipment payload
    const isCod = ['cash', 'cod', 'الدفع عند الاستلام'].includes((orderData.paymentMethod || '').toLowerCase());
    const shipmentReq: ShipmentRequest = {
      orderId,
      storeId: storeSnap.id,
      sender: {
        name: storeData.storeName || 'متجر سريـع',
        phone: storeData.whatsappNumber || storeData.supportPhone || '0500000000',
        city: storeData.city || 'الرياض',
        address: storeData.storePickupAddress || 'المملكة العربية السعودية',
      },
      recipient: {
        name: orderData.customerName || 'عميل المتجر',
        phone: orderData.customerPhone || '0500000000',
        city: orderData.city || 'الرياض',
        address: orderData.deliveryAddress || 'العنوان الوطني',
      },
      packages: {
        weightKg: Number(weightKg) || 1,
        description: description || orderData.itemsSummary || 'طلب متجر إلكتروني',
        itemCount: Array.isArray(orderData.items) ? orderData.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0) : 1,
      },
      codAmount: isCod ? Number(orderData.grandTotal) : 0,
    };

    const shipmentRes = await carrierInstance.createShipment(shipmentReq);

    if (!shipmentRes.success) {
      return res.status(400).json({
        error: shipmentRes.error || 'فشل إصدار بوليصة الشحن من شركة النقل.',
        success: false,
      });
    }

    const nowIso = new Date().toISOString();
    const updatedStatus = orderData.status === 'Received' ? 'In Progress' : orderData.status;

    // Atomically persist on merchant order
    await orderRef.update({
      courierName: shipmentRes.courierName,
      trackingNumber: shipmentRes.trackingNumber,
      trackingUrl: shipmentRes.trackingUrl || '',
      labelUrl: shipmentRes.labelUrl || '',
      estimatedDeliveryDate: shipmentRes.estimatedDeliveryDate || '',
      status: updatedStatus,
      updatedAt: nowIso,
    });

    // Update public customer tracking projection
    try {
      const trackingRef = db.collection('tracking').doc(orderId);
      await trackingRef.set({
        orderId,
        storeId: storeSnap.id,
        courierName: shipmentRes.courierName,
        trackingNumber: shipmentRes.trackingNumber,
        trackingUrl: shipmentRes.trackingUrl || '',
        labelUrl: shipmentRes.labelUrl || '',
        status: updatedStatus,
        trackingNotes: `تم إصدار بوليصة الشحن مع (${shipmentRes.courierName}) برقم تتبع: ${shipmentRes.trackingNumber}`,
        updatedAt: nowIso,
      }, { merge: true });
    } catch (trackErr) {
      console.warn('Tracking projection shipment update notice:', trackErr);
    }

    return res.status(200).json({
      success: true,
      shipment: {
        trackingNumber: shipmentRes.trackingNumber,
        courierName: shipmentRes.courierName,
        labelUrl: shipmentRes.labelUrl,
        trackingUrl: shipmentRes.trackingUrl,
        estimatedDeliveryDate: shipmentRes.estimatedDeliveryDate,
        status: updatedStatus,
      },
      orderId,
    });
  } catch (err: any) {
    console.error('Shipment creation error:', err);
    return res.status(500).json({ error: 'Internal error generating shipment AWB.', success: false });
  }
}
