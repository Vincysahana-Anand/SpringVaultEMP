import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  startAt,
  endAt,
  runTransaction,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { getISTDate, formatDateKey } from '../utils/dateUtils';
import { SalesRecord } from '../types';

export type { SalesRecord } from '../types';

export const getSalesRecord = async (dateString?: string): Promise<SalesRecord | null | ServiceError> => {
  try {
    const db = getFirestore();
    const date = dateString || formatDateKey(getISTDate());
    const salesDocRef = doc(collection(db, 'sales'), date);

    const salesSnapshot = await getDoc(salesDocRef);

    if (salesSnapshot.exists()) {
      return salesSnapshot.data() as SalesRecord;
    }

    return null;
  } catch (error) {
    console.error('Error in getSalesRecord:', error);
    return handleServiceError(error, 'getSalesRecord');
  }
};

export const getSalesRecordsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<{ [date: string]: SalesRecord } | ServiceError> => {
  try {
    const db = getFirestore();
    const salesCol = collection(db, 'sales');
    const rangeQuery = query(
      salesCol,
      orderBy('__name__'),
      startAt(startDate),
      endAt(endDate)
    );
    const snapshot = await getDocs(rangeQuery);
    if (snapshot.empty) return {};

    const out: { [date: string]: SalesRecord } = {};
    snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      out[docSnap.id] = docSnap.data() as SalesRecord;
    });
    return out;
  } catch (error) {
    console.error('Error in getSalesRecordsByDateRange:', error);
    return handleServiceError(error, 'getSalesRecordsByDateRange');
  }
};

export const addExpenseToSales = async (amount: number): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    const dateString = formatDateKey(getISTDate());
    const salesDocRef = doc(collection(db, 'sales'), dateString);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(salesDocRef);
      if (snap.exists()) {
        const existing = snap.data() as SalesRecord;
        tx.set(
          salesDocRef,
          { expense: (existing.expense || 0) + amount },
          { merge: true },
        );
      } else {
        const newRec: SalesRecord = {
          totalSale: 0,
          cashPayment: 0,
          onlinePayment: 0,
          expense: amount,
          orders: 0,
          delivered: 0,
          deliveredCans: 0,
          emptyCollected: 0,
        };
        tx.set(salesDocRef, newRec);
      }
    });

    return true;
  } catch (error) {
    return handleServiceError(error, 'addExpenseToSales');
  }
};

export const submitCashForToday = async (
  amount: number,
  vaultCash?: number,
): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    const dateString = formatDateKey(getISTDate());
    const salesDocRef = doc(collection(db, 'sales'), dateString);

    const payload: Record<string, number> = { cashSubmitted: amount };
    if (vaultCash !== undefined) payload.vaultCash = vaultCash;

    await setDoc(salesDocRef, payload, { merge: true });
    return true;
  } catch (error) {
    console.error('Error in submitCashForToday:', error);
    return handleServiceError(error, 'submitCashForToday');
  }
};
