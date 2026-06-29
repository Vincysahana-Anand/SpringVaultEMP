import { SalesRecord, DailyRecordEntry, PurchaseRecord } from '../../types';

export type SalesRecordDelta = {
  saleAmount?: number;
  cashPaidValue?: number;
  onlinePaidValue?: number;
  ordersCount?: number;
  deliveredCount?: number;
  deliveredQty?: number;
  emptyQty?: number;
  pendingPaymentReceived?: number;
  cashBillsPayment?: number;
  onlineBillsPayment?: number;
  emptyReturned?: number;
  isDeliveredCan?: boolean;
};

export function mergeSalesRecord(
  existing: SalesRecord | undefined,
  delta: SalesRecordDelta,
): SalesRecord {
  const saleAmount = delta.saleAmount ?? 0;
  const cashPaidValue = delta.cashPaidValue ?? 0;
  const onlinePaidValue = delta.onlinePaidValue ?? 0;
  const ordersCount = delta.ordersCount ?? 0;
  const deliveredCount = delta.deliveredCount ?? 0;
  const deliveredQty = delta.deliveredQty ?? 0;
  const emptyQty = delta.emptyQty ?? 0;
  const pendingPaymentReceived = delta.pendingPaymentReceived ?? 0;
  const cashBillsPayment = delta.cashBillsPayment ?? 0;
  const onlineBillsPayment = delta.onlineBillsPayment ?? 0;
  const emptyReturned = delta.emptyReturned ?? 0;
  const isDeliveredCan = delta.isDeliveredCan ?? false;

  if (existing) {
    return {
      totalSale: Number(existing.totalSale || 0) + saleAmount,
      cashPayment: Number(existing.cashPayment || 0) + cashPaidValue,
      onlinePayment: Number(existing.onlinePayment || 0) + onlinePaidValue,
      expense: Number(existing.expense || 0),
      orders: Number(existing.orders || 0) + ordersCount,
      delivered: Number(existing.delivered || 0) + deliveredCount,
      deliveredCans: Number(existing.deliveredCans || 0) + (isDeliveredCan ? deliveredQty : 0),
      emptyCollected: Number(existing.emptyCollected || 0) + emptyQty,
      pendingPaymentReceived:
        Number(existing.pendingPaymentReceived || 0) + pendingPaymentReceived,
      cashBillsPayment: Number(existing.cashBillsPayment || 0) + cashBillsPayment,
      onlineBillsPayment: Number(existing.onlineBillsPayment || 0) + onlineBillsPayment,
      emptyReturned: Number(existing.emptyReturned || 0) + emptyReturned,
    };
  }

  return {
    totalSale: saleAmount,
    cashPayment: cashPaidValue,
    onlinePayment: onlinePaidValue,
    expense: 0,
    orders: ordersCount,
    delivered: deliveredCount,
    deliveredCans: isDeliveredCan ? deliveredQty : 0,
    emptyCollected: emptyQty,
    pendingPaymentReceived,
    cashBillsPayment,
    onlineBillsPayment,
    emptyReturned,
  };
}
