import { increment } from '@react-native-firebase/firestore';

export type SalesIncrementDelta = {
  totalSale?: number;
  cashPayment?: number;
  onlinePayment?: number;
  orders?: number;
  delivered?: number;
  deliveredCans?: number;
  emptyCollected?: number;
  pendingPaymentReceived?: number;
  cashBillsPayment?: number;
  onlineBillsPayment?: number;
  emptyReturned?: number;
};

const SALES_FIELDS: Array<keyof SalesIncrementDelta> = [
  'totalSale',
  'cashPayment',
  'onlinePayment',
  'orders',
  'delivered',
  'deliveredCans',
  'emptyCollected',
  'pendingPaymentReceived',
  'cashBillsPayment',
  'onlineBillsPayment',
  'emptyReturned',
];

export const buildSalesIncrementUpdate = (
  delta: SalesIncrementDelta,
): Record<string, unknown> => {
  const update: Record<string, unknown> = {};

  for (const field of SALES_FIELDS) {
    const value = Number(delta[field] ?? 0);
    if (!Number.isFinite(value) || value === 0) continue;
    update[field] = increment(value);
  }

  return update;
};
