/**
 * Shared TypeScript definitions for SpringVaultEMP.
 */

export interface User {
  id?: string;
  name: string;
  email: string;
  phone: string;
  isAdmin: boolean;
  isActive: boolean;
  role?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Customer {
  id?: string;
  name: string;
  mobile: string;
  alternateContacts: string[];
  doorNumber: string;
  floor: string;
  street: string;
  area: string;
  advanceAmount: number;
  customerType: 'Residence' | 'Shop' | 'Party';
  billingType: 'Cash' | 'Rotational Payment' | 'Monthly Payment' | 'Online';
  price: number;
  '1lPrice'?: number;
  '500mlPrice'?: number;
  '300mlPrice'?: number;
  canHolding: number;
  extraCanHolding?: number;
  balance?: number;
}

export interface Order {
  id?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  deliveredQty?: number;
  paymentMethod: string;
  amountPaid?: number;
  orderedAt?: string;
  requestedDate?: string;
  deliveredAt?: string;
  address?: string;
  mobile?: string;
  timeStamp?: Date;
}

export interface Stock {
  id: string;
  productName: string;
  quantity: number;
  price?: number;
  empty?: number;
  total?: number;
  extraCan?: number;
}

export interface SalesRecord {
  totalSale: number;
  cashPayment: number;
  onlinePayment: number;
  expense: number;
  orders: number;
  delivered: number;
  deliveredCans: number;
  emptyCollected: number;
  cashSubmitted?: number;
  vaultCash?: number;
  pendingPaymentReceived?: number;
  ordersCount?: number;
  deliveredCount?: number;
  cashBillsPayment?: number;
  onlineBillsPayment?: number;
  emptyReturned?: number;
}

export interface Expense {
  id?: string;
  type: string;
  amount: number;
  createdAt: Date;
}

export interface PurchaseRecord {
  product: string;
  deliveredQty: number;
  emptyQty: number;
  orderedAt: string;
  deliveredAt: string;
  billAmount: number;
  amountPaid: number;
  paymentMethod: 'cash' | 'online';
  paymentRef?: number;
}

export interface CustomerPurchaseHistory {
  customerId: string;
  purchases: PurchaseRecord[];
}

export interface DailyRecordEntry {
  customerId: string;
  customerName?: string;
  customerAddress?: string;
  customerMobile?: string;
  product: string;
  orderedAt: string;
  deliveredAt: string;
  orderedQty?: number;
  deliveredQty: number;
  emptyQty: number;
  billAmount: number;
  saleAmount: number;
  amountPaid: number;
  paymentMethod: 'cash' | 'online';
  paymentRef?: number;
  pendingPaymentReceived: number;
}

export interface DailyRecord {
  [date: string]: DailyRecordEntry[] | string;
}

export interface PartyOrder {
  id?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  paymentMethod: string;
  orderedAt?: string;
  requestedDate?: string;
  deliveredAt?: string;
  deliveredQty?: number;
  address?: string;
  mobile?: string;
  timeStamp?: Date;
}

export interface PartyDelivery {
  id?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  deliveredQty?: number;
  deliveredAt?: string;
  requestedDate?: string;
  address?: string;
  mobile?: string;
  timeStamp?: Date;
  paymentMethod?: string;
  amountPaid?: number;
}
