import {
  getFirestore,
  runTransaction,
  doc,
} from '@react-native-firebase/firestore';

import { getISTDate, formatDateKey, formatDeliveredAt } from '../utils/dateUtils';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { DailyRecordEntry, PurchaseRecord } from '../types';
import { createPurchaseHistoryEntryTransaction } from './purchaseHistoryService';
import { createDailyRecordEntryTransaction } from './dailyRecordService';
import { mergeSalesRecord } from '../shared/business/recordMerge';
import { config } from '../shared/config';

export const COUNTER_SALES_CUSTOMER_ID = config.firestore.counterSalesCustomerId;
export const COUNTER_SALES_CUSTOMER_NAME = config.firestore.counterSalesCustomerName;

export type CompleteCounterSaleParams = {
  productId: '20L_CAN' | '1L_CASE' | '500ML_CASE' | '300ML_CASE';
  quantity: number;
  emptyQty?: number;
  unitPrice: number;
  paymentMethod: 'cash' | 'online';
  amountPaid: number;
  paymentRef?: string;
};

export async function completeCounterSaleTransaction(
  params: CompleteCounterSaleParams
): Promise<{ ok: true; deliveredAt: string } | ServiceError> {
  try {
    const { productId, quantity, emptyQty, unitPrice, paymentMethod, amountPaid, paymentRef } = params;

    if (!productId) return { code: 'invalid-argument', message: '[completeCounterSaleTransaction] Missing productId' };
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { code: 'invalid-argument', message: '[completeCounterSaleTransaction] Invalid quantity' };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { code: 'invalid-argument', message: '[completeCounterSaleTransaction] Invalid unitPrice' };
    }
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      return { code: 'invalid-argument', message: '[completeCounterSaleTransaction] Invalid amountPaid' };
    }

    const db = getFirestore();

    const deliveredDate = getISTDate();
    const deliveredAt = formatDeliveredAt(deliveredDate);
    const dateKey = formatDateKey(deliveredDate);

    const customerRef = doc(db, 'customers', COUNTER_SALES_CUSTOMER_ID);
    const stockRef = doc(db, 'stocks', productId);
    const salesRef = doc(db, 'sales', dateKey);

    const result = await runTransaction(db, async (tx) => {
      const [customerSnap, stockSnap, salesSnap] = await Promise.all([
        tx.get(customerRef),
        tx.get(stockRef),
        tx.get(salesRef),
      ]);

      if (!customerSnap.exists()) throw new Error('CounterSales customer not found');
      if (!stockSnap.exists()) throw new Error('Stock not found');

      const customerData = customerSnap.data() as Record<string, unknown>;
      const stockData = stockSnap.data() as Record<string, unknown>;

      const customerBalance = Number(customerData?.balance ?? 0) || 0;

      const currentQuantity = Number(stockData?.quantity ?? 0) || 0;
      const currentEmpty = Number(stockData?.empty ?? 0) || 0;
      const currentExtraCan = Number(stockData?.extraCan ?? 0) || 0;

      if (currentQuantity < quantity) {
        throw new Error(`Insufficient stock. Available: ${currentQuantity}`);
      }

      const is20L = productId === '20L_CAN';
      const emptyCollectedRaw = is20L ? (Number(emptyQty ?? 0) || 0) : 0;
      const emptyCollected = Math.max(0, Math.min(quantity, Math.floor(emptyCollectedRaw)));
      const extraCanDelta = is20L ? quantity - emptyCollected : 0;

      const newQuantity = currentQuantity - quantity;
      const newEmpty = currentEmpty + emptyCollected;
      const newExtraCan = currentExtraCan + extraCanDelta;

      const saleAmount = Number(unitPrice) * Number(quantity);
      const billAmount = customerBalance + saleAmount;
      const newCustomerBalance = billAmount - amountPaid;

      tx.update(customerRef, { balance: newCustomerBalance });

      const stockUpdate: Record<string, number> = { quantity: newQuantity };
      if (is20L) {
        stockUpdate.empty = newEmpty;
        stockUpdate.extraCan = newExtraCan;
      }
      tx.update(stockRef, stockUpdate);

      const productName = String(stockData?.productName || productId);

      const purchaseRecord: PurchaseRecord = {
        product: productName,
        deliveredQty: quantity,
        emptyQty: emptyCollected,
        orderedAt: deliveredAt,
        deliveredAt,
        billAmount,
        amountPaid,
        paymentMethod,
        paymentRef: paymentMethod === 'online' ? parseInt(paymentRef || '0', 10) || 0 : 0,
      };

      createPurchaseHistoryEntryTransaction(tx, db, COUNTER_SALES_CUSTOMER_ID, purchaseRecord);

      const pendingPaymentReceived = saleAmount < amountPaid ? amountPaid - saleAmount : 0;
      const cashPaidValue = paymentMethod === 'cash' ? Number(amountPaid - pendingPaymentReceived) : 0;
      const onlinePaidValue = paymentMethod === 'online' ? Number(amountPaid - pendingPaymentReceived) : 0;
      const deliveredCans = is20L ? quantity : 0;

      const salesPayload = mergeSalesRecord(
        salesSnap.exists() ? (salesSnap.data() as Parameters<typeof mergeSalesRecord>[0]) : undefined,
        {
          saleAmount,
          cashPaidValue,
          onlinePaidValue,
          ordersCount: 1,
          deliveredCount: 1,
          deliveredQty: quantity,
          emptyQty: emptyCollected,
          pendingPaymentReceived,
          isDeliveredCan: is20L,
        },
      );
      tx.set(salesRef, salesPayload, { merge: true });

      const dailyRecordEntry: DailyRecordEntry = {
        customerId: COUNTER_SALES_CUSTOMER_ID,
        customerName: COUNTER_SALES_CUSTOMER_NAME,
        customerAddress: '',
        customerMobile: '',
        product: productName,
        orderedAt: deliveredAt,
        deliveredAt,
        orderedQty: quantity,
        deliveredQty: quantity,
        emptyQty: emptyCollected,
        billAmount,
        saleAmount,
        amountPaid,
        paymentMethod,
        paymentRef: paymentMethod === 'online' ? parseInt(paymentRef || '0', 10) || 0 : 0,
        pendingPaymentReceived,
      };

      createDailyRecordEntryTransaction(tx, db, productId, dailyRecordEntry, dateKey);

      return { ok: true as const, deliveredAt };
    });

    return result;
  } catch (error) {
    return handleServiceError(error, 'completeCounterSaleTransaction');
  }
}
