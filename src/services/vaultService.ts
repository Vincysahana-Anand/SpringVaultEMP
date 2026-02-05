import {
  getFirestore,
  runTransaction,
  doc,
  collection,
  getDoc,
  query,
  where,
  getDocs,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import { handleServiceError, ServiceError } from './serviceErrorWrapper';

type VaultEntry = {
  dateKey: string;
  createdAt: Date;
  income: number;
  expense: number;
  cashPayment: number;
  onlinePayment: number;
  cashBillsPayment: number;
  onlineBillsPayment: number;
  pendingPaymentReceived: number;
  totalSale: number;
  orders: number;
  delivered: number;
};

const getISTDayStartForKey = (dateKey: string) => {
  const [yRaw, mRaw, dRaw] = dateKey.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  const base = new Date();
  base.setFullYear(Number.isFinite(y) ? y : base.getFullYear());
  base.setMonth(Number.isFinite(m) ? m - 1 : base.getMonth());
  base.setDate(Number.isFinite(d) ? d : base.getDate());
  base.setHours(0, 0, 0, 0);
  return base;
};

export async function closeSalesForDate(dateKey: string): Promise<true | ServiceError> {
  try {
    const db = getFirestore();

    const salesRef = doc(db, 'sales', dateKey);
    const vaultRef = doc(db, 'vault', dateKey);

    const salesSnap = await getDoc(salesRef);
    const sales = salesSnap.exists() ? (salesSnap.data() as any) : {};

    const cashPayment = Number(sales?.cashPayment ?? 0) || 0;
    const onlinePayment = Number(sales?.onlinePayment ?? 0) || 0;
    const cashBillsPayment = Number(sales?.cashBillsPayment ?? 0) || 0;
    const onlineBillsPayment = Number(sales?.onlineBillsPayment ?? 0) || 0;
    const pendingPaymentReceived = Number(sales?.pendingPaymentReceived ?? 0) || 0;
    const totalSale = Number(sales?.totalSale ?? 0) || 0;
    const orders = Number(sales?.orders ?? 0) || 0;
    const delivered = Number(sales?.delivered ?? 0) || 0;

    // Expenses are stored in a separate collection and time-stamped.
    // We sum the day's expenses to compute income.
    const start = getISTDayStartForKey(dateKey);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const expensesSnap = await getDocs(
      query(collection(db, 'expenses'), where('createdAt', '>=', start), where('createdAt', '<', end))
    );

    const expense = expensesSnap.docs.reduce((sum: number, docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const data = docSnap.data() as any;
      return sum + (Number(data?.amount ?? 0) || 0);
    }, 0);

    const income = cashPayment + onlinePayment + cashBillsPayment + onlineBillsPayment + pendingPaymentReceived - expense;

    const payload: VaultEntry = {
      dateKey,
      createdAt: new Date(),
      income,
      expense,
      cashPayment,
      onlinePayment,
      cashBillsPayment,
      onlineBillsPayment,
      pendingPaymentReceived,
      totalSale,
      orders,
      delivered,
    };

    const res = await runTransaction(db, async (tx) => {
      const existing = await tx.get(vaultRef);
      if (existing.exists()) {
        throw new Error('Sales already closed for this date');
      }
      tx.set(vaultRef, payload);
      return true;
    });

    return res === true ? true : true;
  } catch (error) {
    return handleServiceError(error, 'closeSalesForDate');
  }
}
