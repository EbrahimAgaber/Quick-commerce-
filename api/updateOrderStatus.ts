import { getAdminFirestore, getAdminAuth } from './_firebaseAdmin';
import { handleCors, evaluateRateLimit, setRateLimitHeaders, getClientIp } from './_security';

export default async function handler(req: any, res: any) {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Origin not allowed.', success: false });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.', success: false });
  }

  const clientIp = getClientIp(req);
  const rateLimit = await evaluateRateLimit(`order_update_${clientIp}`, 60, 60 * 1000);
  setRateLimitHeaders(res, rateLimit);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many status update requests.', success: false });
  }

  const {
    storeId,
    orderId,
    status,
    trackingNotes,
    courierName,
    courierPhone,
    trackingNumber,
    trackingUrl,
    driverCashCollected,
    driverDeliveredAt,
    driverSettled,
    // Return parameters
    returnReason,
    returnNotes,
    returnItems,
    returnStatus,
    restockItems,
    // Customer return request verification
    phoneLast4,
    source, // 'merchant' | 'driver' | 'shopper'
  } = req.body || {};

  const cleanStoreId = (storeId || '').toString().trim();
  const cleanOrderId = (orderId || '').toString().trim().toUpperCase().replace('#', '');

  if (!cleanStoreId || !cleanOrderId) {
    return res.status(400).json({ error: 'storeId and orderId are required.', success: false });
  }

  const db = getAdminFirestore();

  try {
    const storeRef = db.collection('stores').doc(cleanStoreId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      return res.status(404).json({ error: 'Store not found.', success: false });
    }

    const orderRef = storeRef.collection('orders').doc(cleanOrderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found.', success: false });
    }

    const existingOrder = orderSnap.data() || {};
    const trackingRef = db.collection('tracking').doc(cleanOrderId);
    const trackingSnap = await trackingRef.get();
    const existingTracking = trackingSnap.exists ? trackingSnap.data() || {} : {};

    // 1. Authorization check
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    let isMerchantAuthenticated = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      try {
        const decoded = await getAdminAuth().verifyIdToken(token);
        if (decoded.uid === storeSnap.data()?.ownerId) {
          isMerchantAuthenticated = true;
        }
      } catch (authErr) {
        // Token invalid, fall through
      }
    }

    // Role-based validation
    if (source === 'shopper') {
      // Shoppers can ONLY submit return requests for delivered orders within eligibility window
      if (status !== 'Return Requested') {
        return res.status(403).json({ error: 'Shoppers can only submit return requests.', success: false });
      }

      if (existingOrder.status !== 'Delivered' && existingOrder.status !== 'Return Requested') {
        return res.status(400).json({
          error: 'يمكن تقديم طلب الاسترجاع فقط للطلبات التي تم توصيلها بنجاح.',
          success: false,
        });
      }

      // Check return eligibility deadline (if set, default 7 days)
      const deliveryDate = existingOrder.driverDeliveredAt || existingOrder.updatedAt || existingOrder.timestamp;
      const eligibilityDeadline = existingOrder.returnEligibleUntil
        ? new Date(existingOrder.returnEligibleUntil).getTime()
        : new Date(deliveryDate).getTime() + 7 * 24 * 60 * 60 * 1000;

      if (Date.now() > eligibilityDeadline) {
        return res.status(400).json({
          error: 'انتهت فترة الاسترجاع المسموحة نظاماً لهذا الطلب.',
          success: false,
        });
      }

      // Phone verification check for shopper (Mandatory)
      const expectedLast4 = (existingOrder.customerPhone || '').replace(/\D/g, '').slice(-4);
      const cleanPhoneLast4 = (phoneLast4 || '').toString().trim();
      if (!cleanPhoneLast4 || cleanPhoneLast4 !== expectedLast4) {
        return res.status(403).json({
          error: 'آخر 4 أرقام من رقم الجوال غير متطابقة.',
          success: false,
        });
      }
    } else if (source === 'driver') {
      // Drivers can transition orders to 'Out for Delivery', 'Delivered', or 'Cancelled' (doorstep rejection)
      const allowedDriverStatuses = ['Out for Delivery', 'Delivered', 'Cancelled'];
      if (status && !allowedDriverStatuses.includes(status)) {
        return res.status(403).json({ error: 'Driver not permitted to set this status.', success: false });
      }

      // If driver is marking order as 'Delivered' or 'Cancelled', verify delivery PIN or assigned courier phone!
      if (status === 'Delivered' || status === 'Cancelled') {
        const expectedPin = existingOrder.deliveryPin || (existingOrder.id ? (existingOrder.id.replace(/\D/g, '').slice(-4) || '0000') : '');
        const providedPin = (req.body?.deliveryPin || req.body?.pin || '').toString().trim();
        const providedCourierPhone = (req.body?.courierPhone || '').toString().replace(/\D/g, '');
        const assignedCourierPhone = (existingOrder.courierPhone || '').toString().replace(/\D/g, '');
        const isAssignedCourier =
          status === 'Cancelled' &&
          Boolean(providedCourierPhone && assignedCourierPhone && assignedCourierPhone.endsWith(providedCourierPhone.slice(-8)));

        if (!isMerchantAuthenticated && !isAssignedCourier && (!providedPin || providedPin !== expectedPin)) {
          return res.status(403).json({
            error: 'رمز تأكيد التسليم (PIN) غير صحيح أو لم يتم التحقق من صلاحية المندوب.',
            success: false,
          });
        }
      }
    } else {
      // Strict merchant authentication required in production for all stores
      if (!isMerchantAuthenticated && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Merchant authentication required.', success: false });
      }
    }

    const nowIso = new Date().toISOString();

    // 2. Prepare order update payload
    const orderUpdates: Record<string, any> = {
      updatedAt: nowIso,
    };

    if (status) {
      orderUpdates.status = status;
    }
    if (trackingNotes !== undefined) orderUpdates.trackingNotes = trackingNotes;
    if (courierName !== undefined) orderUpdates.courierName = courierName;
    if (courierPhone !== undefined) orderUpdates.courierPhone = courierPhone;
    if (trackingNumber !== undefined) orderUpdates.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) orderUpdates.trackingUrl = trackingUrl;

    // Delivery specifics
    if (status === 'Delivered') {
      const deliveredTime = driverDeliveredAt || nowIso;
      orderUpdates.driverDeliveredAt = deliveredTime;
      if (driverCashCollected !== undefined) {
        orderUpdates.driverCashCollected = Number(driverCashCollected);
      } else if (existingOrder.paymentMethod === 'cod' || existingOrder.paymentMethod === 'الدفع عند الاستلام') {
        orderUpdates.driverCashCollected = existingOrder.grandTotal;
      }

      // Compute Saudi E-Commerce Law 7-day return eligibility window
      const eligibleUntil = new Date(new Date(deliveredTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      orderUpdates.returnEligibleUntil = eligibleUntil;
    }

    if (driverSettled !== undefined) {
      orderUpdates.driverSettled = Boolean(driverSettled);
      if (driverSettled) {
        orderUpdates.driverSettledAt = nowIso;
      }
    }

    // Return & Refund specifics
    if (status === 'Return Requested') {
      orderUpdates.returnStatus = 'pending';
      orderUpdates.returnRequestedAt = nowIso;
      if (returnReason) orderUpdates.returnReason = returnReason;
      if (returnNotes) orderUpdates.returnNotes = returnNotes;
      if (returnItems && Array.isArray(returnItems)) orderUpdates.returnItems = returnItems;
    }

    if (status === 'Returned' || status === 'Refunded') {
      orderUpdates.returnedAt = nowIso;
      orderUpdates.returnStatus = 'completed';
      if (returnReason) orderUpdates.returnReason = returnReason;
    }

    if (returnStatus) {
      orderUpdates.returnStatus = returnStatus;
    }

    // 3. Atomically update Firestore order document
    await orderRef.update(orderUpdates);

    // 4. Atomically update Minimal Public Tracking Projection
    const trackingUpdates: Record<string, any> = {
      updatedAt: nowIso,
    };

    if (status) trackingUpdates.status = status;
    if (trackingNotes !== undefined) trackingUpdates.trackingNotes = trackingNotes;
    if (courierName !== undefined) trackingUpdates.courierName = courierName;
    if (courierPhone !== undefined) trackingUpdates.courierPhone = courierPhone;
    if (trackingNumber !== undefined) trackingUpdates.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) trackingUpdates.trackingUrl = trackingUrl;
    if (orderUpdates.driverDeliveredAt) trackingUpdates.driverDeliveredAt = orderUpdates.driverDeliveredAt;
    if (orderUpdates.returnEligibleUntil) trackingUpdates.returnEligibleUntil = orderUpdates.returnEligibleUntil;
    if (orderUpdates.returnStatus) trackingUpdates.returnStatus = orderUpdates.returnStatus;
    if (orderUpdates.returnReason) trackingUpdates.returnReason = orderUpdates.returnReason;

    if (trackingSnap.exists) {
      await trackingRef.update(trackingUpdates);
    } else {
      await trackingRef.set({
        orderId: cleanOrderId,
        storeId: cleanStoreId,
        status: status || existingOrder.status || 'Received',
        timestamp: existingOrder.timestamp || nowIso,
        itemsSummary: existingOrder.itemsSummary || '',
        grandTotal: existingOrder.grandTotal || 0,
        shippingFee: existingOrder.shippingFee || 0,
        paymentMethod: existingOrder.paymentMethod || '',
        phoneLast4: (existingOrder.customerPhone || '').slice(-4),
        ...trackingUpdates,
      });
    }

    // 5. Atomically restock inventory if requested upon order return or doorstep cancellation
    if (restockItems && (status === 'Returned' || status === 'Cancelled') && Array.isArray(existingOrder.items)) {
      try {
        const applyRestock = async (tx?: any) => {
          const freshStoreSnap = tx ? await tx.get(storeRef) : await storeRef.get();
          const storeData = freshStoreSnap.data() || {};
          const storeProducts = Array.isArray(storeData.products) ? [...storeData.products] : [];
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

            try {
              const pRef = storeRef.collection('products').doc(item.productId);
              const pSnap = tx ? await tx.get(pRef) : await pRef.get();
              if (pSnap.exists) {
                const pData = pSnap.data() || {};
                const currentStock = Number(pData.stockQuantity) || 0;
                const newStock = currentStock + qtyToRestock;
                if (tx) {
                  tx.update(pRef, { stockQuantity: newStock, inStock: newStock > 0 });
                } else {
                  await pRef.update({ stockQuantity: newStock, inStock: newStock > 0 });
                }
              }
            } catch (subErr) {
              console.warn('Subcollection product restock notice:', subErr);
            }
          }

          if (modified) {
            if (tx) {
              tx.update(storeRef, { products: storeProducts, updatedAt: nowIso });
            } else {
              await storeRef.update({ products: storeProducts, updatedAt: nowIso });
            }
          }
        };

        if (typeof db.runTransaction === 'function') {
          await db.runTransaction(async (tx: any) => applyRestock(tx));
        } else {
          await applyRestock();
        }
      } catch (restockErr) {
        console.warn('Restocking error:', restockErr);
      }
    }

    const mergedOrder: any = {
      ...existingOrder,
      ...orderUpdates,
      id: cleanOrderId,
    };

    return res.status(200).json({
      success: true,
      order: mergedOrder,
      orderId: cleanOrderId,
      status: mergedOrder.status,
    });
  } catch (err: any) {
    console.error('Order status update error:', err);
    return res.status(500).json({
      error: err.message || 'فشل تحديث حالة الطلب.',
      success: false,
    });
  }
}
