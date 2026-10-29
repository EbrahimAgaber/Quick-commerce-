import { getAdminFirestore } from './_firebaseAdmin';

export interface ReleaseOrderStockResult {
  success: boolean;
  alreadyReleased: boolean;
  restockedItemsCount: number;
  error?: string;
}

/**
 * Transactional and idempotent stock release function (Phase 5).
 * Restores `stockQuantity` and `inStock` on `/stores/{storeId}/products/{productId}`
 * and the legacy `products` array on the store doc.
 * Sets `stockReleased: true`, `stockReleasedAt`, and `stockReleaseReason` on the order doc.
 */
export async function releaseOrderStock(
  storeId: string,
  orderId: string,
  reason: string,
  options?: { externalTx?: any }
): Promise<ReleaseOrderStockResult> {
  const db = getAdminFirestore();

  const executeRelease = async (transaction: any) => {
    let storeRef = db.collection('stores').doc(storeId);
    let storeSnap = await transaction.get(storeRef);

    if (!storeSnap.exists) {
      // Check slug fallback
      const slugQuery = await db.collection('stores').where('slug', '==', storeId).limit(1).get();
      if (!slugQuery.empty) {
        storeRef = slugQuery.docs[0].ref;
        storeSnap = slugQuery.docs[0];
      } else {
        throw new Error(`Store ${storeId} not found`);
      }
    }

    const orderRef = storeRef.collection('orders').doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new Error(`Order ${orderId} not found in store ${storeId}`);
    }

    const orderData = orderSnap.data() || {};

    // 1. Idempotency Check: if stock was already released, no-op
    if (orderData.stockReleased === true) {
      return {
        success: true,
        alreadyReleased: true,
        restockedItemsCount: 0,
      };
    }

    const items = Array.isArray(orderData.items) ? orderData.items : [];
    const productSubcollection = storeRef.collection('products');
    const storeData = storeSnap.data() || {};
    const legacyProducts = Array.isArray(storeData.products) ? [...storeData.products] : [];
    let legacyModified = false;
    let restockedCount = 0;

    // Fetch product documents in subcollection
    for (const item of items) {
      const pid = item.productId;
      const qty = Number(item.quantity || item.qty) || 0;
      if (!pid || qty <= 0) continue;

      const pRef = productSubcollection.doc(pid);
      const pSnap = await transaction.get(pRef);

      if (pSnap.exists) {
        const pData = pSnap.data() || {};
        const currentStock = typeof pData.stockQuantity === 'number' ? pData.stockQuantity : null;
        if (currentStock !== null) {
          const newStock = Math.round((currentStock + qty) * 1000) / 1000;
          transaction.update(pRef, {
            stockQuantity: newStock,
            inStock: newStock > 0,
          });
          restockedCount++;
        }
      }

      // Also update legacy store.products array if present
      const legIdx = legacyProducts.findIndex((p: any) => p.id === pid);
      if (legIdx >= 0 && typeof legacyProducts[legIdx].stockQuantity === 'number') {
        const cur = legacyProducts[legIdx].stockQuantity;
        const newStock = Math.round((cur + qty) * 1000) / 1000;
        legacyProducts[legIdx] = {
          ...legacyProducts[legIdx],
          stockQuantity: newStock,
          inStock: newStock > 0,
        };
        legacyModified = true;
      }
    }

    if (legacyModified) {
      transaction.update(storeRef, {
        products: legacyProducts,
        updatedAt: new Date().toISOString(),
      });
    }

    // Mark order as stock released
    const nowIso = new Date().toISOString();
    transaction.update(orderRef, {
      stockReleased: true,
      stockReleasedAt: nowIso,
      stockReleaseReason: reason,
      updatedAt: nowIso,
    });

    return {
      success: true,
      alreadyReleased: false,
      restockedItemsCount: restockedCount,
    };
  };

  try {
    if (options?.externalTx) {
      return await executeRelease(options.externalTx);
    } else {
      return await db.runTransaction(executeRelease);
    }
  } catch (err: any) {
    console.error(`releaseOrderStock failed for ${orderId}:`, err);
    return {
      success: false,
      alreadyReleased: false,
      restockedItemsCount: 0,
      error: err?.message || String(err),
    };
  }
}
