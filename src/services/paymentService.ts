import {
  doc,
  getFirestore,
  runTransaction,
} from '@react-native-firebase/firestore';

import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { getTransactionTimestamp } from '../utils/dateUtils';
import { DailyRecordEntry, PurchaseRecord } from '../types';
import { createPurchaseHistoryEntryTransaction } from './purchaseHistoryService';
import { createDailyRecordEntryTransaction } from './dailyRecordService';
import { buildSalesIncrementUpdate } from './salesIncrementHelper';

export type CompletePaymentParams = {
  customerId: string;
  customerName: string;
  customerMobile: string;
  startingBalance: number;
  amount: number;
  paymentMethod: 'cash' | 'online';
  paymentRef?: string;
};

export async function completePaymentTransaction(
  params: CompletePaymentParams,
): Promise<{ ok: true } | ServiceError> {
  try {
    const {
      customerId,
      customerName,
      customerMobile,
      startingBalance,
      amount,
      paymentMethod,
      paymentRef,
    } = params;

    if (!customerId) {
      return { code: 'invalid-argument', message: '[completePaymentTransaction] Missing customerId' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { code: 'invalid-argument', message: '[completePaymentTransaction] Invalid amount' };
    }

    const db = getFirestore();
    const { deliveredAt, dateKey } = getTransactionTimestamp();
    const newBalance = startingBalance - amount;

    const customerRef = doc(db, 'customers', customerId);
    const salesRef = doc(db, 'sales', dateKey);

    await runTransaction(db, async (tx) => {
      const customerSnap = await tx.get(customerRef);

      if (!customerSnap.exists()) {
        throw new Error('Customer not found');
      }

      tx.update(customerRef, { balance: newBalance });

      const purchaseRecord: PurchaseRecord = {
        product: 'payment',
        deliveredQty: 0,
        emptyQty: 0,
        orderedAt: deliveredAt,
        deliveredAt,
        billAmount: startingBalance,
        amountPaid: amount,
        paymentMethod,
        paymentRef: paymentMethod === 'online' ? parseInt(paymentRef || '0', 10) || 0 : 0,
      };

      createPurchaseHistoryEntryTransaction(tx, db, customerId, purchaseRecord);

      const cashBillsPayment = paymentMethod === 'cash' ? amount : 0;
      const onlineBillsPayment = paymentMethod === 'online' ? amount : 0;
      tx.set(
        salesRef,
        buildSalesIncrementUpdate({
          pendingPaymentReceived: amount,
          cashBillsPayment,
          onlineBillsPayment,
        }),
        { merge: true },
      );

      const dailyRecordEntry: DailyRecordEntry = {
        customerId,
        customerName,
        customerMobile,
        product: 'payment',
        orderedAt: deliveredAt,
        deliveredAt,
        deliveredQty: 0,
        emptyQty: 0,
        billAmount: startingBalance,
        saleAmount: 0,
        amountPaid: amount,
        paymentMethod,
        paymentRef: paymentMethod === 'online' ? parseInt(paymentRef || '0', 10) || 0 : 0,
        pendingPaymentReceived: amount,
      };

      createDailyRecordEntryTransaction(tx, db, 'Payments', dailyRecordEntry, dateKey);
    });

    return { ok: true };
  } catch (error) {
    return handleServiceError(error, 'completePaymentTransaction');
  }
}
