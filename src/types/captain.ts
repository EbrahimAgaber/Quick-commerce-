/**
 * Types for On-Demand Delivery Captain Network and Platform Commission Gate
 */

export interface DeliveryCaptain {
  id: string; // cap_xxxx
  name: string;
  phone: string;
  city: string;
  vehicleType: 'car' | 'motorcycle' | 'van';
  idNumber?: string;
  iban?: string;
  status: 'pending_activation' | 'active' | 'suspended';
  activationCode?: string; // Code issued by platform owner to activate account
  platformFeePercent: number; // Agreed platform fee percentage (e.g. 2.0%)
  completedDeliveries: number;
  totalDeliveryFeesEarned: number;
  totalPlatformCommission: number;
  registeredAt: string;
  activatedAt?: string;
  lastActiveAt?: string;
}

export interface CaptainDeliveryTask {
  id: string;
  orderId: string;
  storeId: string;
  storeName: string;
  customerName: string;
  customerPhone: string;
  deliveryCity: string;
  deliveryAddress: string;
  googleMapsUrl?: string;
  grandTotal: number;
  paymentMethod: string;
  isCod: boolean;
  deliveryFee: number;
  platformCommission: number; // Platform cut (e.g. fee * 2%)
  captainNetEarnings: number; // Fee - commission
  status: 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
  assignedAt: string;
  deliveredAt?: string;
  deliveryPin: string;
}
