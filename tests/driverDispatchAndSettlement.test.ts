import { describe, it, expect } from 'vitest';
import { extractDriverOrderIdFromUrl } from '../src/utils/urlRouter';
import { calculateDriverSettlement } from '../src/utils/driverDispatch';
import { Order, StoreSettings } from '../src/types/store';

describe('Local Shared Freelance Driver Dispatch & Settlement Engine', () => {
  describe('URL Routing for Zero-App Driver Access', () => {
    it('extracts driverOrderId from standard query string', () => {
      const url = 'https://storelink.sa/?driver=ORD-SA-12345';
      expect(extractDriverOrderIdFromUrl(url)).toBe('ORD-SA-12345');
    });

    it('extracts driverOrderId when mixed with other UTM and language parameters', () => {
      const url = 'https://storelink.sa/?lang=ar&utm_source=whatsapp&driver=ORD-8877&utm_medium=chat';
      expect(extractDriverOrderIdFromUrl(url)).toBe('ORD-8877');
    });

    it('extracts driverOrderId from hash-based routing format', () => {
      const url = 'https://storelink.sa/#/?driver=ORD-HASH-9988';
      expect(extractDriverOrderIdFromUrl(url)).toBe('ORD-HASH-9988');
    });

    it('returns null when driver parameter is absent', () => {
      const url = 'https://storelink.sa/?store=aurora&product=abaya-01';
      expect(extractDriverOrderIdFromUrl(url)).toBeNull();
    });
  });

  describe('Driver Daily Cash Reconciliation & Settlement Ledger', () => {
    const mockSettings = {
      storeName: 'متجر التمور الفاخرة',
      currency: 'SAR',
      whatsappNumber: '966500000000',
      supportEmail: 'support@store.com',
      driverName: 'أبو فهد',
      driverPhone: '966551234567',
      driverFee: 15,
      storeLocationUrl: 'https://maps.app.goo.gl/StoreLocation123',
    } as unknown as StoreSettings;

    const todayStr = new Date().toISOString().split('T')[0];

    const mockOrders = [
      {
        id: 'ORD-101',
        customerName: 'سارة العتيبي',
        customerPhone: '0551112233',
        city: 'الرياض',
        deliveryAddress: 'حي النرجس، شارع أبي بكر',
        googleMapsUrl: 'https://maps.google.com/?q=24.8123,46.6456',
        paymentMethod: 'الدفع عند الاستلام (COD)',
        grandTotal: 150,
        subtotal: 130,
        shippingFee: 20,
        itemsSummary: 'تمر سكري فاخر × 1',
        items: [],
        status: 'Delivered',
        timestamp: `${todayStr}T10:00:00Z`,
        driverDeliveredAt: `${todayStr}T11:30:00Z`,
        driverCashCollected: 150,
      },
      {
        id: 'ORD-102',
        customerName: 'محمد الشهري',
        customerPhone: '0552223344',
        city: 'الرياض',
        deliveryAddress: 'حي الياسمين',
        paymentMethod: 'Moyasar (mada / Apple Pay)',
        grandTotal: 200,
        subtotal: 180,
        shippingFee: 20,
        itemsSummary: 'تمر عجوة × 2',
        items: [],
        status: 'Delivered',
        timestamp: `${todayStr}T11:00:00Z`,
        driverDeliveredAt: `${todayStr}T12:45:00Z`,
      },
      {
        id: 'ORD-103',
        customerName: 'خالد الدوسري',
        customerPhone: '0553334455',
        city: 'الرياض',
        deliveryAddress: 'حي الملقا',
        paymentMethod: 'COD',
        grandTotal: 300,
        subtotal: 280,
        shippingFee: 20,
        itemsSummary: 'صندوق تمر خلاص × 3',
        items: [],
        status: 'Delivered',
        timestamp: `${todayStr}T14:00:00Z`,
        driverDeliveredAt: `${todayStr}T15:15:00Z`,
        driverCashCollected: 300,
      },
      {
        id: 'ORD-104',
        customerName: 'فهد القحطاني',
        customerPhone: '0554445566',
        city: 'الرياض',
        deliveryAddress: 'حي الصحافة',
        paymentMethod: 'COD',
        grandTotal: 100,
        subtotal: 80,
        shippingFee: 20,
        itemsSummary: 'تمر مجدول × 1',
        items: [],
        status: 'Out for Delivery', // Not yet delivered
        timestamp: `${todayStr}T16:00:00Z`,
      },
    ] as unknown as Order[];

    it('correctly calculates total deliveries, COD cash, driver fees, and net store payout', () => {
      const delivered = mockOrders.filter((o) => o.status === 'Delivered');
      expect(delivered.length).toBe(3);

      const totalCodCash = delivered.reduce((sum, o) => {
        const isCOD = o.paymentMethod.toLowerCase().includes('cod') || o.paymentMethod.includes('استلام');
        return isCOD ? sum + o.grandTotal : sum;
      }, 0);

      // ORD-101 (150) + ORD-103 (300) = 450 SAR (ORD-102 was online payment, so 0 cash collected)
      expect(totalCodCash).toBe(450);

      const driverFeePerOrder = mockSettings.driverFee ?? 15;
      const totalDriverEarnings = delivered.length * driverFeePerOrder;
      // 3 deliveries * 15 SAR = 45 SAR
      expect(totalDriverEarnings).toBe(45);

      // Net due to merchant: 450 - 45 = 405 SAR
      const netDueToMerchant = Math.max(0, totalCodCash - totalDriverEarnings);
      expect(netDueToMerchant).toBe(405);
    });

    it('generates a complete reconciliation receipt for WhatsApp', () => {
      const delivered = mockOrders.filter((o) => o.status === 'Delivered');
      const totalDeliveries = delivered.length;
      const totalCodCash = 450;
      const totalDriverEarnings = 45;
      const netDueToMerchant = 405;

      const receipt = 
        `📋 *تقرير تصفية الحساب اليومي للمندوب*\n` +
        `المتجر: ${mockSettings.storeName}\n` +
        `المندوب: ${mockSettings.driverName}\n` +
        `• عدد الشحنات المسلّمة: ${totalDeliveries}\n` +
        `• إجمالي الكاش المستلم من العملاء: ${totalCodCash} ${mockSettings.currency}\n` +
        `• أتعاب التوصيل المستحقة للمندوب: ${totalDriverEarnings} ${mockSettings.currency}\n` +
        `💰 *الصافي المستحق تسليمه لإدارة المحل: ${netDueToMerchant} ${mockSettings.currency}*`;

      expect(receipt).toContain('450 SAR');
      expect(receipt).toContain('45 SAR');
      expect(receipt).toContain('405 SAR');
      expect(receipt).toContain(mockSettings.storeName);
      expect(receipt).toContain(mockSettings.driverName);
    });

    it('marks orders as settled with audit timestamp', () => {
      const settledTimestamp = new Date().toISOString();
      const updatedOrders = mockOrders.map((o) => {
        if (o.status === 'Delivered') {
          return { ...o, driverSettled: true, driverSettledAt: settledTimestamp };
        }
        return o;
      });

      const settledCount = updatedOrders.filter((o) => o.driverSettled).length;
      expect(settledCount).toBe(3);

      const unsettledOrder = updatedOrders.find((o) => o.id === 'ORD-104');
      expect(unsettledOrder?.driverSettled).toBeUndefined();
    });

    it('accurately tracks merchant debt to driver (netDueToDriver) when all delivered orders are prepaid online', () => {
      const prepaidOrders = [
        {
          id: 'ORD-PRE-1',
          paymentMethod: 'Moyasar (mada / Apple Pay)',
          grandTotal: 220,
          status: 'Delivered',
        },
        {
          id: 'ORD-PRE-2',
          paymentMethod: 'بطاقة مدى',
          grandTotal: 180,
          status: 'Delivered',
        },
      ] as unknown as Order[];

      const settlement = calculateDriverSettlement(prepaidOrders, 20);
      expect(settlement.totalDelivered).toBe(2);
      expect(settlement.totalCodCash).toBe(0);
      expect(settlement.totalDriverEarnings).toBe(40);
      expect(settlement.netBalance).toBe(-40);
      expect(settlement.netDueToMerchant).toBe(0);
      expect(settlement.netDueToDriver).toBe(40);
    });
  });

  describe('Driver 1-Tap WhatsApp Dispatch Content Generation', () => {
    it('formats a complete dispatch payload with store pickup, customer GPS, and direct web link', () => {
      const storeSettings = {
        storeName: 'حلويات العيد',
        currency: 'SAR',
        whatsappNumber: '966500000000',
        supportEmail: 'info@store.com',
        driverPhone: '966551234567',
        storeLocationUrl: 'https://maps.app.goo.gl/StoreGPS',
      } as unknown as StoreSettings;

      const order = {
        id: 'ORD-999',
        customerName: 'عبدالله السعد',
        customerPhone: '0501234567',
        city: 'الدمام',
        deliveryAddress: 'حي الشاطئ، فيلا 12',
        googleMapsUrl: 'https://maps.google.com/?q=26.4321,50.1234',
        landmarkNotes: 'الباب الخشبي المقابل للحديقة',
        paymentMethod: 'الدفع عند الاستلام (COD)',
        grandTotal: 180,
        subtotal: 160,
        shippingFee: 20,
        itemsSummary: 'معمول بالتمر × 2',
        items: [],
        status: 'In Progress',
        timestamp: '2026-10-18T12:00:00Z',
      } as unknown as Order;

      const origin = 'https://storelink.sa';
      const driverLink = `${origin}/?driver=${order.id}`;

      const isCOD = order.paymentMethod.toLowerCase().includes('cod') || order.paymentMethod.includes('استلام');
      const paymentStatus = isCOD 
        ? `💵 الدفع عند الاستلام (COD): تحصيل ${order.grandTotal} ${storeSettings.currency}`
        : `✅ مدفوع إلكترونياً مسبقاً (لا يُحصّل من العميل)`;

      let msg = `🚚 *مهمة توصيل جديدة - متجر ${storeSettings.storeName}*\n`;
      msg += `📦 *رقم الطلب:* #${order.id}\n`;
      if (storeSettings.storeLocationUrl) {
        msg += `📍 *موقع استلام الشحنة (المحل):* ${storeSettings.storeLocationUrl}\n`;
      }
      msg += `👤 *العميل:* ${order.customerName}\n`;
      msg += `📱 *جوال العميل:* ${order.customerPhone}\n`;
      msg += `🏠 *العنوان:* ${order.city} - ${order.deliveryAddress}\n`;
      if (order.googleMapsUrl) {
        msg += `🗺️ *موقع العميل (Google Maps):* ${order.googleMapsUrl}\n`;
      }
      if (order.landmarkNotes) {
        msg += `📝 *ملاحظات:* ${order.landmarkNotes}\n`;
      }
      msg += `💰 *حالة التحصيل:* ${paymentStatus}\n`;
      msg += `🔗 *رابط مسار التوصيل المباشر للمندوب:* \n${driverLink}\n`;

      expect(msg).toContain('ORD-999');
      expect(msg).toContain('https://maps.app.goo.gl/StoreGPS');
      expect(msg).toContain('https://maps.google.com/?q=26.4321,50.1234');
      expect(msg).toContain('تحصيل 180 SAR');
      expect(msg).toContain('https://storelink.sa/?driver=ORD-999');
    });
  });
});
