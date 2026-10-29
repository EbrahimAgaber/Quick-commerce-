import { describe, it, expect, vi } from 'vitest';

describe('Phase 3: Payment Verification & Reconciliation Engine', () => {
  // Test harness simulating the reconciler logic
  interface OrderDoc {
    id: string;
    storeId: string;
    grandTotal: number;
    status: string;
    paymentId?: string;
  }

  interface PaymentDoc {
    id: string;
    status: string;
    amount: number; // in halalas
    currency: string;
    metadata?: { orderId?: string; storeId?: string };
    created_at?: string;
    fee?: number;
  }

  function createReconcilerHarness() {
    const orders = new Map<string, OrderDoc>();
    const paymentClaims = new Map<string, { orderId: string; storeId: string }>();

    const reconcile = async (
      storeId: string,
      orderId: string,
      payment: PaymentDoc
    ): Promise<{ success: boolean; status: string; error?: string; statusCode?: number }> => {
      const order = orders.get(orderId);
      if (!order) {
        return { success: false, status: 'error', statusCode: 404, error: 'Order not found' };
      }

      // Check currency
      if (payment.currency !== 'SAR') {
        return { success: false, status: 'error', statusCode: 400, error: 'Invalid currency. Only SAR is accepted.' };
      }

      // Check metadata
      if (payment.metadata?.orderId && payment.metadata.orderId !== orderId) {
        return { success: false, status: 'error', statusCode: 400, error: 'Metadata orderId mismatch' };
      }
      if (payment.metadata?.storeId && payment.metadata.storeId !== storeId) {
        return { success: false, status: 'error', statusCode: 400, error: 'Metadata storeId mismatch' };
      }

      // Check amount
      const expectedAmountHalalas = Math.round(order.grandTotal * 100);
      if (payment.amount !== expectedAmountHalalas) {
        return { success: false, status: 'error', statusCode: 400, error: 'Amount mismatch' };
      }

      const pStatus = payment.status.toLowerCase();

      // Initiated / authorized -> pending
      if (pStatus === 'initiated' || pStatus === 'authorized') {
        return { success: true, status: 'pending' };
      }

      // Paid state
      if (pStatus === 'paid') {
        // Atomic claim check
        if (paymentClaims.has(payment.id)) {
          const claim = paymentClaims.get(payment.id)!;
          if (claim.orderId !== orderId || claim.storeId !== storeId) {
            return {
              success: false,
              status: 'error',
              statusCode: 409,
              error: 'Payment ID already claimed for another order',
            };
          }
        } else {
          paymentClaims.set(payment.id, { orderId, storeId });
        }

        order.status = 'Paid';
        order.paymentId = payment.id;
        return { success: true, status: 'Paid' };
      }

      // Failed / voided
      if (pStatus === 'failed' || pStatus === 'voided') {
        order.status = 'Payment Failed';
        return { success: true, status: 'Payment Failed' };
      }

      return { success: false, status: 'error', statusCode: 400, error: 'Unknown status' };
    };

    return { orders, paymentClaims, reconcile };
  }

  it('1. Successfully verifies legitimate paid SAR payment and sets status to Paid', async () => {
    const harness = createReconcilerHarness();
    harness.orders.set('ORD-101', {
      id: 'ORD-101',
      storeId: 'store_1',
      grandTotal: 150.0,
      status: 'Received',
    });

    const payment: PaymentDoc = {
      id: 'pay_valid_123',
      status: 'paid',
      amount: 15000,
      currency: 'SAR',
      metadata: { orderId: 'ORD-101', storeId: 'store_1' },
    };

    const res = await harness.reconcile('store_1', 'ORD-101', payment);
    expect(res.success).toBe(true);
    expect(res.status).toBe('Paid');
    expect(harness.orders.get('ORD-101')!.status).toBe('Paid');
    expect(harness.paymentClaims.get('pay_valid_123')!.orderId).toBe('ORD-101');
  });

  it('2. Blocks payment reuse across multiple orders (atomic payment claims)', async () => {
    const harness = createReconcilerHarness();
    // Order 1
    harness.orders.set('ORD-101', { id: 'ORD-101', storeId: 'store_1', grandTotal: 150, status: 'Received' });
    // Order 2 (same total)
    harness.orders.set('ORD-102', { id: 'ORD-102', storeId: 'store_1', grandTotal: 150, status: 'Received' });

    const payment: PaymentDoc = {
      id: 'pay_single_use',
      status: 'paid',
      amount: 15000,
      currency: 'SAR',
      metadata: { orderId: 'ORD-101', storeId: 'store_1' },
    };

    // Settle Order 1
    const res1 = await harness.reconcile('store_1', 'ORD-101', payment);
    expect(res1.success).toBe(true);

    // Attacker tries to use the same payment ID for Order 2
    const fakePaymentForOrder2: PaymentDoc = {
      ...payment,
      metadata: { orderId: 'ORD-102', storeId: 'store_1' },
    };
    const res2 = await harness.reconcile('store_1', 'ORD-102', fakePaymentForOrder2);
    expect(res2.success).toBe(false);
    expect(res2.statusCode).toBe(409);
    expect(res2.error).toContain('already claimed');
    expect(harness.orders.get('ORD-102')!.status).toBe('Received');
  });

  it('3. Rejects payment when metadata does not match target order', async () => {
    const harness = createReconcilerHarness();
    harness.orders.set('ORD-101', { id: 'ORD-101', storeId: 'store_1', grandTotal: 100, status: 'Received' });

    const payment: PaymentDoc = {
      id: 'pay_wrong_meta',
      status: 'paid',
      amount: 10000,
      currency: 'SAR',
      metadata: { orderId: 'ORD-999', storeId: 'store_1' }, // Mismatch!
    };

    const res = await harness.reconcile('store_1', 'ORD-101', payment);
    expect(res.success).toBe(false);
    expect(res.error).toContain('mismatch');
  });

  it('4. Rejects non-SAR currency payments', async () => {
    const harness = createReconcilerHarness();
    harness.orders.set('ORD-101', { id: 'ORD-101', storeId: 'store_1', grandTotal: 100, status: 'Received' });

    const payment: PaymentDoc = {
      id: 'pay_usd',
      status: 'paid',
      amount: 10000,
      currency: 'USD',
      metadata: { orderId: 'ORD-101', storeId: 'store_1' },
    };

    const res = await harness.reconcile('store_1', 'ORD-101', payment);
    expect(res.success).toBe(false);
    expect(res.error).toContain('currency');
  });

  it('5. Handles initiated or authorized status as pending without marking order as failed', async () => {
    const harness = createReconcilerHarness();
    harness.orders.set('ORD-101', { id: 'ORD-101', storeId: 'store_1', grandTotal: 100, status: 'Received' });

    const payment: PaymentDoc = {
      id: 'pay_init',
      status: 'initiated',
      amount: 10000,
      currency: 'SAR',
      metadata: { orderId: 'ORD-101', storeId: 'store_1' },
    };

    const res = await harness.reconcile('store_1', 'ORD-101', payment);
    expect(res.success).toBe(true);
    expect(res.status).toBe('pending');
    expect(harness.orders.get('ORD-101')!.status).toBe('Received'); // Unchanged!
  });

  it('6. Marks order as Payment Failed when payment status is failed or voided', async () => {
    const harness = createReconcilerHarness();
    harness.orders.set('ORD-101', { id: 'ORD-101', storeId: 'store_1', grandTotal: 100, status: 'Received' });

    const payment: PaymentDoc = {
      id: 'pay_failed_1',
      status: 'failed',
      amount: 10000,
      currency: 'SAR',
      metadata: { orderId: 'ORD-101', storeId: 'store_1' },
    };

    const res = await harness.reconcile('store_1', 'ORD-101', payment);
    expect(res.success).toBe(true);
    expect(res.status).toBe('Payment Failed');
    expect(harness.orders.get('ORD-101')!.status).toBe('Payment Failed');
  });
});
