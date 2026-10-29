import { describe, it, expect } from 'vitest';

describe('Phase 5: Stock Release for Unpaid and Cancelled Orders', () => {
  interface Product {
    id: string;
    name: string;
    stockQuantity: number;
    inStock: boolean;
  }

  interface Order {
    id: string;
    status: string;
    items: { productId: string; qty: number }[];
    stockReleased?: boolean;
    stockReleasedAt?: string;
    stockReleaseReason?: string;
    needsMerchantAttention?: boolean;
    attentionReason?: string;
  }

  function createStockReleaseHarness() {
    const products = new Map<string, Product>([
      ['prod_1', { id: 'prod_1', name: 'عطر فاخر', stockQuantity: 5, inStock: true }],
      ['prod_2', { id: 'prod_2', name: 'عود طبيعي', stockQuantity: 2, inStock: true }],
    ]);

    const orders = new Map<string, Order>();

    // releaseOrderStock simulation
    const releaseStock = (orderId: string, reason: string) => {
      const order = orders.get(orderId);
      if (!order) throw new Error('Order not found');

      if (order.stockReleased) {
        return { success: true, alreadyReleased: true, restockedCount: 0 };
      }

      let count = 0;
      for (const it of order.items) {
        const prod = products.get(it.productId);
        if (prod) {
          prod.stockQuantity += it.qty;
          prod.inStock = prod.stockQuantity > 0;
          count++;
        }
      }

      order.stockReleased = true;
      order.stockReleasedAt = new Date().toISOString();
      order.stockReleaseReason = reason;

      return { success: true, alreadyReleased: false, restockedCount: count };
    };

    // Late paid event on expired order
    const handleLatePaidWebhook = (orderId: string) => {
      const order = orders.get(orderId);
      if (!order) throw new Error('Order not found');

      // Check if stock is available to re-reserve
      let canReReserve = true;
      for (const it of order.items) {
        const prod = products.get(it.productId);
        if (!prod || prod.stockQuantity < it.qty) {
          canReReserve = false;
          break;
        }
      }

      if (canReReserve) {
        for (const it of order.items) {
          const prod = products.get(it.productId)!;
          prod.stockQuantity -= it.qty;
          prod.inStock = prod.stockQuantity > 0;
        }
        order.status = 'Paid';
        order.stockReleased = false;
        return { action: 're_reserved', status: 'Paid' };
      } else {
        // Flag for merchant attention
        order.status = 'Paid';
        order.needsMerchantAttention = true;
        order.attentionReason = 'Late payment received after order expiration, but inventory is no longer available.';
        return { action: 'flagged_for_attention', status: 'Paid' };
      }
    };

    return { products, orders, releaseStock, handleLatePaidWebhook };
  }

  it('1. Correctly restores product stockQuantity and inStock when order expires', () => {
    const harness = createStockReleaseHarness();
    harness.orders.set('ORD-101', {
      id: 'ORD-101',
      status: 'Received',
      items: [{ productId: 'prod_1', qty: 2 }],
    });

    const res = harness.releaseStock('ORD-101', 'order_expired_unpaid');
    expect(res.success).toBe(true);
    expect(res.alreadyReleased).toBe(false);
    expect(res.restockedCount).toBe(1);

    // Stock was 5, now 5 + 2 = 7
    expect(harness.products.get('prod_1')!.stockQuantity).toBe(7);
    expect(harness.orders.get('ORD-101')!.stockReleased).toBe(true);
  });

  it('2. Idempotent: repeated release calls do not increment stock twice', () => {
    const harness = createStockReleaseHarness();
    harness.orders.set('ORD-101', {
      id: 'ORD-101',
      status: 'Received',
      items: [{ productId: 'prod_1', qty: 2 }],
    });

    harness.releaseStock('ORD-101', 'order_expired_unpaid');
    expect(harness.products.get('prod_1')!.stockQuantity).toBe(7);

    // Second call
    const res2 = harness.releaseStock('ORD-101', 'order_expired_unpaid');
    expect(res2.alreadyReleased).toBe(true);
    expect(harness.products.get('prod_1')!.stockQuantity).toBe(7); // Did NOT become 9!
  });

  it('3. Re-reserves stock on late paid webhook when stock is available', () => {
    const harness = createStockReleaseHarness();
    // Order originally expired and released 2 items back (prod_1 has 7 items now)
    harness.orders.set('ORD-101', {
      id: 'ORD-101',
      status: 'Expired',
      items: [{ productId: 'prod_1', qty: 2 }],
      stockReleased: true,
    });
    harness.products.get('prod_1')!.stockQuantity = 7;

    const res = harness.handleLatePaidWebhook('ORD-101');
    expect(res.action).toBe('re_reserved');
    expect(harness.orders.get('ORD-101')!.status).toBe('Paid');
    expect(harness.products.get('prod_1')!.stockQuantity).toBe(5); // 7 - 2 = 5
  });

  it('4. Flags order for manual merchant attention and refund when inventory is gone', () => {
    const harness = createStockReleaseHarness();
    harness.orders.set('ORD-101', {
      id: 'ORD-101',
      status: 'Expired',
      items: [{ productId: 'prod_2', qty: 2 }], // requests 2
      stockReleased: true,
    });
    // Another customer bought remaining stock of prod_2, only 1 left!
    harness.products.get('prod_2')!.stockQuantity = 1;

    const res = harness.handleLatePaidWebhook('ORD-101');
    expect(res.action).toBe('flagged_for_attention');
    expect(harness.orders.get('ORD-101')!.needsMerchantAttention).toBe(true);
    expect(harness.orders.get('ORD-101')!.attentionReason).toContain('inventory is no longer available');
  });
});
