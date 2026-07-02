import {
  getFirestore,
  runTransaction,
  collection,
  doc,
} from '@react-native-firebase/firestore';

import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { Order } from './orderService';
import { formatDeliveredAt, getISTDate, getTransactionTimestamp } from '../utils/dateUtils';
import { DailyRecordEntry, PurchaseRecord } from '../types';
import { getUnitPriceForCustomer } from '../shared/business/pricing';
import { createPurchaseHistoryEntryTransaction } from './purchaseHistoryService';
import { createDailyRecordEntryTransaction } from './dailyRecordService';
import { buildSalesIncrementUpdate } from './salesIncrementHelper';

export type CompleteDeliveryParams = {
  order: Order;
  fullBottlesDelivered: number;
  emptyBottlesCollected: number;
  amountPaid: number;
  paymentMethod: 'cash' | 'online';
  paymentRef?: string;
};

export async function completeDeliveryTransaction(
  params: CompleteDeliveryParams
): Promise<
  | {
      ok: true;
      deliveredAt: string;
      remainingQuantity: number;
    }
  | ServiceError
> {
  try {
    const { order, fullBottlesDelivered, emptyBottlesCollected, amountPaid, paymentMethod, paymentRef } = params;
    const deliveredQty = Math.max(0, Math.floor(Number(fullBottlesDelivered) || 0));

    if (deliveredQty <= 0) {
      return { code: 'invalid-argument', message: '[completeDeliveryTransaction] Invalid fullBottlesDelivered' };
    }

    if (!order?.id) {
      return { code: 'invalid-argument', message: '[completeDeliveryTransaction] Missing order.id' };
    }

    const db = getFirestore();

    const { deliveredAt, dateKey } = getTransactionTimestamp();

    const orderRef = doc(db, 'orders', order.id);
    const customerRef = doc(db, 'customers', order.customerId);
    const stockRef = doc(db, 'stocks', order.productId);
    const salesRef = doc(db, 'sales', dateKey);

    const isDeliveredCan = order.productId === '20L_CAN' || order.productId === '20L_PARTY_CAN';

    const result = await runTransaction(db, async (tx) => {
      const [orderSnap, customerSnap, stockSnap] = await Promise.all([
        tx.get(orderRef),
        tx.get(customerRef),
        tx.get(stockRef),
      ]);

      if (!orderSnap.exists()) {
        throw new Error('Order not found');
      }
      if (!customerSnap.exists()) {
        throw new Error('Customer not found');
      }
      if (!stockSnap.exists()) {
        throw new Error('Stock not found');
      }

      const orderData = orderSnap.data() as Record<string, unknown>;
      const customerData = customerSnap.data() as Record<string, unknown>;
      const stockData = stockSnap.data() as Record<string, unknown>;

      const originalOrderQuantity = Number(orderData?.quantity ?? order.quantity ?? 0) || 0;
      const remainingQuantity = Math.max(originalOrderQuantity - deliveredQty, 0);

      const customerBalance = Number(customerData?.balance ?? 0) || 0;
      const unitPrice = getUnitPriceForCustomer(customerData, stockData, order.productId);

      const billAmount = customerBalance + unitPrice * deliveredQty;
      const newCustomerBalance = billAmount - amountPaid;

      const canHolding = Number(customerData?.canHolding ?? 0) || 0;
      const currentExtraCanHolding = Number(customerData?.extraCanHolding ?? 0) || 0;
      const currentTotalCans = canHolding + currentExtraCanHolding;
      const emptyCollectedRaw = Math.max(0, Math.floor(Number(emptyBottlesCollected) || 0));
      const effectiveEmptyCollected = isDeliveredCan ? Math.min(emptyCollectedRaw, deliveredQty) : 0;
      const newTotalCans = currentTotalCans + (isDeliveredCan ? deliveredQty - effectiveEmptyCollected : 0);
      const newExtraCanHolding = newTotalCans - canHolding;

      const currentQuantity = Number(stockData?.quantity ?? 0) || 0;
      const currentEmpty = Number(stockData?.empty ?? 0) || 0;
      const currentExtraCan = Number(stockData?.extraCan ?? 0) || 0;

      if (deliveredQty > currentQuantity) {
        throw new Error(`Insufficient stock. Available: ${currentQuantity}`);
      }

      const newQuantity = currentQuantity - deliveredQty;
      const newEmpty = currentEmpty + effectiveEmptyCollected;
      const newStockExtraCan = currentExtraCan + (isDeliveredCan ? deliveredQty - effectiveEmptyCollected : 0);

      const customerUpdate: Record<string, number> = {
        balance: newCustomerBalance,
      };
      if (isDeliveredCan) {
        customerUpdate.extraCanHolding = newExtraCanHolding;
      }
      tx.update(customerRef, customerUpdate);

      const stockUpdate: Record<string, number> = {
        quantity: newQuantity,
      };
      if (isDeliveredCan) {
        stockUpdate.empty = newEmpty;
        stockUpdate.extraCan = newStockExtraCan;
      }
      tx.update(stockRef, stockUpdate);

      const purchaseRecord: PurchaseRecord = {
        product: order.productName,
        deliveredQty: deliveredQty,
        emptyQty: effectiveEmptyCollected,
        orderedAt: order.orderedAt || String(orderData?.orderedAt ?? ''),
        deliveredAt,
        billAmount,
        amountPaid,
        paymentMethod,
        paymentRef: paymentMethod === 'online' ? parseInt(paymentRef || '0', 10) || 0 : 0,
      };

      createPurchaseHistoryEntryTransaction(tx, db, order.customerId, purchaseRecord);

      const saleAmount = unitPrice * deliveredQty;
      const pendingPaymentReceived = saleAmount < amountPaid ? amountPaid - saleAmount : 0;
      const cashPaidValue = paymentMethod === 'cash' ? Number(amountPaid - pendingPaymentReceived) : 0;
      const onlinePaidValue = paymentMethod === 'online' ? Number(amountPaid - pendingPaymentReceived) : 0;
      const cashBillsPayment = paymentMethod === 'cash' ? Number(pendingPaymentReceived) : 0;
      const onlineBillsPayment = paymentMethod === 'online' ? Number(pendingPaymentReceived) : 0;

      const salesUpdate = buildSalesIncrementUpdate({
        totalSale: saleAmount,
        cashPayment: cashPaidValue,
        onlinePayment: onlinePaidValue,
        orders: 1,
        delivered: 1,
        emptyCollected: effectiveEmptyCollected,
        pendingPaymentReceived,
        cashBillsPayment,
        onlineBillsPayment,
        deliveredCans: isDeliveredCan ? deliveredQty : 0,
      });
      tx.set(salesRef, salesUpdate, { merge: true });

      const dailyRecordEntry: DailyRecordEntry = {
        customerId: order.customerId,
        customerName: order.customerName,
        customerAddress: order.address,
        customerMobile: order.mobile,
        product: order.productName,
        orderedAt: order.orderedAt || String(orderData?.orderedAt ?? ''),
        deliveredAt,
        orderedQty: originalOrderQuantity,
        deliveredQty: deliveredQty,
        emptyQty: effectiveEmptyCollected,
        billAmount,
        saleAmount,
        amountPaid,
        paymentMethod,
        paymentRef: paymentMethod === 'online' ? parseInt(paymentRef || '0', 10) || 0 : 0,
        pendingPaymentReceived,
      };

      createDailyRecordEntryTransaction(tx, db, order.productId, dailyRecordEntry, dateKey);

      if (remainingQuantity > 0 && deliveredQty < originalOrderQuantity) {
        const newOrderTimestamp = getISTDate();
        const formattedNewOrderedAt = formatDeliveredAt(newOrderTimestamp);
        const newOrderRef = doc(collection(db, 'orders'));

        const newOrderPayload: Order = {
          customerId: order.customerId,
          customerName: order.customerName,
          productId: order.productId,
          productName: order.productName,
          quantity: remainingQuantity,
          paymentMethod: order.paymentMethod || 'Pending',
          amountPaid: 0,
          orderedAt: formattedNewOrderedAt,
          address: order.address,
          mobile: order.mobile,
          timeStamp: newOrderTimestamp,
        };

        tx.set(newOrderRef, newOrderPayload);
      }

      tx.delete(orderRef);

      return {
        ok: true as const,
        deliveredAt,
        remainingQuantity,
      };
    });

    return result;
  } catch (error) {
    console.log('Error in completeDeliveryTransaction:', error);
    return handleServiceError(error, 'completeDeliveryTransaction');
  }
}
