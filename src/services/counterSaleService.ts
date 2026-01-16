import {
  getFirestore,
  runTransaction,
  doc,
  collection,
  arrayUnion,
} from '@react-native-firebase/firestore';

import { getISTDate } from '../utils/dateUtils';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { DailyRecordEntry } from './dailyRecordService';
import { PurchaseRecord } from './purchaseHistoryService';
import { SalesRecord } from './salesService';

export const COUNTER_SALES_CUSTOMER_ID = 'MyTjc2Kqa6DOMRLhnFSH';
export const COUNTER_SALES_CUSTOMER_NAME = 'CounterSales';

export type CompleteCounterSaleParams = {
  productId: '20L_CAN' | '1L_CASE' | '500ML_CASE' | '300ML_CASE';
  quantity: number;
  emptyQty?: number; // only for 20L_CAN
  unitPrice: number;
  paymentMethod: 'cash' | 'online';
  amountPaid: number;
  paymentRef?: string;
};

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDeliveredAt = (d: Date) => {
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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
    const purchaseHistoryRef = doc(db, 'purchaseHistory', COUNTER_SALES_CUSTOMER_ID);
    const dailyRecordRef = doc(db, 'dailyRecord', productId);

    const result = await runTransaction(db, async (tx) => {
      const [customerSnap, stockSnap, salesSnap, purchaseHistorySnap, dailyRecordSnap] = await Promise.all([
        tx.get(customerRef),
        tx.get(stockRef),
        tx.get(salesRef),
        tx.get(purchaseHistoryRef),
        tx.get(dailyRecordRef),
      ]);

      if (!customerSnap.exists()) throw new Error('CounterSales customer not found');
      if (!stockSnap.exists()) throw new Error('Stock not found');

      const customerData = customerSnap.data() as any;
      const stockData = stockSnap.data() as any;

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

      // Keep stock extraCan tracking consistent with normal delivery
      // extraCan increases when customer takes cans without returning empties.
      const extraCanDelta = is20L ? quantity - emptyCollected : 0;

      const newQuantity = currentQuantity - quantity;
      const newEmpty = currentEmpty + emptyCollected;
      const newExtraCan = currentExtraCan + extraCanDelta;

      const saleAmount = Number(unitPrice) * Number(quantity);
      const billAmount = customerBalance + saleAmount;
      const newCustomerBalance = billAmount - amountPaid;

      // Update customer balance only (CounterSales is a synthetic customer)
      tx.update(customerRef, {
        balance: newCustomerBalance,
      });

      // Update stock
      const stockUpdate: any = {
        quantity: newQuantity,
      };
      if (is20L) {
        stockUpdate.empty = newEmpty;
        stockUpdate.extraCan = newExtraCan;
      }
      tx.update(stockRef, stockUpdate);

      const productName = String(stockData?.productName || productId);

      // Purchase history
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

      if (purchaseHistorySnap.exists()) {
        tx.update(purchaseHistoryRef, {
          purchases: arrayUnion(purchaseRecord),
        });
      } else {
        tx.set(purchaseHistoryRef, {
          purchases: [purchaseRecord],
        });
      }

      // Sales record
      const pendingPaymentReceived = saleAmount < amountPaid ? amountPaid - saleAmount : 0;
      const cashPaidValue = paymentMethod === 'cash' ? Number(amountPaid - pendingPaymentReceived) : 0;
      const onlinePaidValue = paymentMethod === 'online' ? Number(amountPaid - pendingPaymentReceived) : 0;

      const deliveredCans = is20L ? quantity : 0;

      if (salesSnap.exists()) {
        const existing = salesSnap.data() as SalesRecord;
        const updated: SalesRecord = {
          totalSale: Number(existing.totalSale || 0) + saleAmount,
          cashPayment: Number(existing.cashPayment || 0) + cashPaidValue,
          onlinePayment: Number(existing.onlinePayment || 0) + onlinePaidValue,
          expense: Number(existing.expense || 0),
          orders: Number(existing.orders || 0) + 0,
          delivered: Number(existing.delivered || 0) + 1,
          deliveredCans: Number(existing.deliveredCans || 0) + deliveredCans,
          emptyCollected: Number(existing.emptyCollected || 0) + emptyCollected,
          pendingPaymentReceived: Number(existing.pendingPaymentReceived || 0) + pendingPaymentReceived,
          cashBillsPayment: Number(existing.cashBillsPayment || 0) + 0,
          onlineBillsPayment: Number(existing.onlineBillsPayment || 0) + 0,
          emptyReturned: Number(existing.emptyReturned || 0) + 0,
        };
        tx.set(salesRef, updated, { merge: true });
      } else {
        const newRec: SalesRecord = {
          totalSale: saleAmount,
          cashPayment: cashPaidValue,
          onlinePayment: onlinePaidValue,
          expense: 0,
          orders: 0,
          delivered: 1,
          deliveredCans,
          emptyCollected,
          pendingPaymentReceived,
          cashBillsPayment: 0,
          onlineBillsPayment: 0,
          emptyReturned: 0,
        };
        tx.set(salesRef, newRec, { merge: true });
      }

      // Daily record
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

      if (dailyRecordSnap.exists()) {
        const data = dailyRecordSnap.data() as any;
        const existingEntries = (data?.[dateKey] as DailyRecordEntry[]) || [];
        tx.set(dailyRecordRef, { [dateKey]: [...existingEntries, dailyRecordEntry] }, { merge: true });
      } else {
        tx.set(dailyRecordRef, { [dateKey]: [dailyRecordEntry] });
      }

      return { ok: true as const, deliveredAt };
    });

    return result;
  } catch (error) {
    return handleServiceError(error, 'completeCounterSaleTransaction');
  }
}
