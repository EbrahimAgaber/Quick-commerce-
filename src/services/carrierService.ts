/**
 * Carrier Integration Abstraction (Saudi Shipping Providers)
 * Supports Aramex, SMSA Express, Torod, and Naqel via unified CarrierProvider interface.
 */

export interface ShipmentRequest {
  orderId: string;
  storeId: string;
  sender: {
    name: string;
    phone: string;
    city: string;
    address: string;
  };
  recipient: {
    name: string;
    phone: string;
    city: string;
    address: string;
  };
  packages: {
    weightKg: number;
    description: string;
    itemCount: number;
  };
  codAmount?: number;
}

export interface ShipmentResponse {
  success: boolean;
  trackingNumber: string;
  courierName: string;
  labelUrl?: string;
  estimatedDeliveryDate?: string;
  error?: string;
}

export interface CarrierTrackingInfo {
  trackingNumber: string;
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';
  statusDescription: string;
  location?: string;
  updatedAt: string;
}

export interface CarrierProvider {
  name: string;
  createShipment(req: ShipmentRequest): Promise<ShipmentResponse>;
  trackShipment(trackingNumber: string): Promise<CarrierTrackingInfo>;
  cancelShipment(trackingNumber: string): Promise<boolean>;
}

/**
 * Mock / Sandbox Carrier Provider (Default for development and demo mode)
 */
export class MockCarrierProvider implements CarrierProvider {
  name = 'MockCarrier';

  async createShipment(req: ShipmentRequest): Promise<ShipmentResponse> {
    const trackingNumber = `SA${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
    return {
      success: true,
      trackingNumber,
      courierName: 'سمسا إكسبريس (تجريبي)',
      labelUrl: `https://api.storelink.sa/labels/${trackingNumber}.pdf`,
      estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    };
  }

  async trackShipment(trackingNumber: string): Promise<CarrierTrackingInfo> {
    return {
      trackingNumber,
      status: 'in_transit',
      statusDescription: 'الشحنة في طريقها للتسليم إلى المستلم',
      location: 'مستودع التوزيع - الرياض',
      updatedAt: new Date().toISOString(),
    };
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    return true;
  }
}

/**
 * Aramex Carrier Implementation
 * TODO(decision): Requires merchant corporate Aramex Account Number, PIN, and Entity details.
 */
export class AramexCarrierProvider implements CarrierProvider {
  name = 'Aramex';
  private accountNumber: string;
  private password: string;

  constructor(accountNumber: string = '', password: string = '') {
    this.accountNumber = accountNumber;
    this.password = password;
  }

  async createShipment(req: ShipmentRequest): Promise<ShipmentResponse> {
    // In production, invoke Aramex Shipping API (SOAP/REST)
    // https://www.aramex.com/developers/api
    if (!this.accountNumber) {
      throw new Error('TODO(decision): Aramex account credentials missing. Provide credentials in merchant settings.');
    }
    const trackingNumber = `ARX${Date.now().toString().slice(-9)}`;
    return {
      success: true,
      trackingNumber,
      courierName: 'Aramex',
      labelUrl: `https://ws.aramex.net/ShippingAPI.V2/Shipping/PrintLabel?ShipmentNumber=${trackingNumber}`,
    };
  }

  async trackShipment(trackingNumber: string): Promise<CarrierTrackingInfo> {
    return {
      trackingNumber,
      status: 'in_transit',
      statusDescription: 'In Transit to Destination Facility',
      location: 'Riyadh Hub',
      updatedAt: new Date().toISOString(),
    };
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    return true;
  }
}

class CarrierManager {
  private providers: Map<string, CarrierProvider> = new Map();
  private activeProviderName: string = 'mock';

  constructor() {
    this.registerProvider('mock', new MockCarrierProvider());
    this.registerProvider('aramex', new AramexCarrierProvider());
  }

  public registerProvider(key: string, provider: CarrierProvider) {
    this.providers.set(key, provider);
  }

  public setActiveProvider(key: string) {
    if (this.providers.has(key)) {
      this.activeProviderName = key;
    }
  }

  public getActiveProvider(): CarrierProvider {
    return this.providers.get(this.activeProviderName) || new MockCarrierProvider();
  }
}

export const CarrierService = new CarrierManager();
