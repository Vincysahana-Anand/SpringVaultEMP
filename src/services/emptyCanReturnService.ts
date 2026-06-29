import {
  getFirestore,
  runTransaction,
  doc,
} from '@react-native-firebase/firestore';

import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { getTransactionTimestamp } from '../utils/dateUtils';
import { DailyRecordEntry, PurchaseRecord } from '../types';
import { createPurchaseHistoryEntryTransaction } from './purchaseHistoryService';
import { createDailyRecordEntryTransaction } from './dailyRecordService';
import { mergeSalesRecord } from '../shared/business/recordMerge';

export type CompleteEmptyCanReturnParams = {
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerMobile: string;
  customerBalance: number;
  productId: string;
  qty: number;
};

export async function completeEmptyCanReturnTransaction(
  params: CompleteEmptyCanReturnParams,
): Promise<{ ok: true } | ServiceError> {
  try {
    const {
      customerId,
      customerName,
      customerAddress,
      customerMobile,
      customerBalance,
      productId,
      qty,
    } = params;

    if (!customerId) {
      return { code: 'invalid-argument', message: '[completeEmptyCanReturnTransaction] Missing customerId' };
    }
    if (!productId) {
      return { code: 'invalid-argument', message: '[completeEmptyCanReturnTransaction] Missing productId' };
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return { code: 'invalid-argument', message: '[completeEmptyCanReturnTransaction] Invalid qty' };
    }

    const db = getFirestore();
    const { deliveredDate, deliveredAt, dateKey } = getTransactionTimestamp();

    const customerRef = doc(db, 'customers', customerId);
    const stockRef = doc(db, 'stocks', productId);
    const salesRef = doc(db, 'sales', dateKey);

    await runTransaction(db, async (tx) => {
      const [customerSnap, stockSnap, salesSnap] = await Promise.all([
        tx.get(customerRef),
        tx.get(stockRef),
        tx.get(salesRef),
      ]);

      if (!customerSnap.exists()) {
        throw new Error('Customer not found');
      }
      if (!stockSnap.exists()) {
        throw new Error('Stock not found');
      }

      const customerData = customerSnap.data() as { extraCanHolding?: number };
      const stockData = stockSnap.data() as { extraCan?: number; empty?: number };

      const currentExtraCanHolding = Number(customerData.extraCanHolding ?? 0) || 0;
      const nextExtraCanHolding = Math.max(0, currentExtraCanHolding - qty);

      const currentExtraCan = Number(stockData.extraCan ?? 0) || 0;
      const currentEmpty = Number(stockData.empty ?? 0) || 0;
      const nextExtraCan = Math.max(currentExtraCan - qty, 0);
      const nextEmpty = currentEmpty + qty;

      tx.update(customerRef, { extraCanHolding: nextExtraCanHolding });
      tx.update(stockRef, { extraCan: nextExtraCan, empty: nextEmpty });

      const purchaseRecord: PurchaseRecord = {
        product: 'extraCans',
        deliveredQty: 0,
        emptyQty: qty,
        orderedAt: deliveredAt,
        deliveredAt,
        billAmount: 0,
        amountPaid: 0,
        paymentMethod: 'cash',
        paymentRef: 0,
      };

      createPurchaseHistoryEntryTransaction(tx, db, customerId, purchaseRecord);

      const salesPayload = mergeSalesRecord(
        salesSnap.exists() ? (salesSnap.data() as Parameters<typeof mergeSalesRecord>[0]) : undefined,
        { emptyReturned: qty },
      );
      tx.set(salesRef, salesPayload, { merge: true });

      const dailyRecordEntry: DailyRecordEntry = {
        customerId,
        customerName,
        customerAddress,
        customerMobile,
        product: 'emptyReturned',
        orderedAt: deliveredAt,
        deliveredAt,
        orderedQty: 0,
        deliveredQty: 0,
        emptyQty: qty,
        billAmount: customerBalance,
        saleAmount: 0,
        amountPaid: 0,
        paymentMethod: 'cash',
        paymentRef: 0,
        pendingPaymentReceived: 0,
      };

      createDailyRecordEntryTransaction(tx, db, 'emptyReturned', dailyRecordEntry, dateKey);
    });

    return { ok: true };
  } catch (error) {
    return handleServiceError(error, 'completeEmptyCanReturnTransaction');
  }
}
