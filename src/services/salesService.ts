import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, getDocs, FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { getISTDate } from '../utils/dateUtils';

export interface SalesRecord {
  totalSale: number;
  cashPayment: number;
  onlinePayment: number;
  expense: number;
  orders: number;
  delivered: number;
  deliveredCans: number;
  emptyCollected: number;
  /** value entered when closing today's sale */
  cashSubmitted?: number;
  /** vault cash total at time of close */
  vaultCash?: number;
  pendingPaymentReceived?: number;
  ordersCount?: number;
  deliveredCount?: number;
  cashBillsPayment?: number;
  onlineBillsPayment?: number;
  emptyReturned?: number;
}

/**
 * Get date string in IST format (YYYY-MM-DD) without time
 */
const getISTDateString = (): string => {
  const istDate = getISTDate();
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Update or create sales record for today
 * Increments existing values with new delivery data
 */
export const updateSalesRecord = async (
  deliveredQty: number,
  emptyQty: number,
  cashPaidValue: number,
  onlinePaidValue: number,
  billAmount: number,
  isDeliveredCan: boolean,
  saleAmount: number,
  pendingPaymentReceived?: number,
  ordersCount?: number,
  deliveredCount?: number,
  cashBillsPayment?: number,
  onlineBillsPayment?: number,
  emptyReturned?: number,
): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    const dateString = getISTDateString();
    const salesDocRef = doc(collection(db, 'sales'), dateString);

    console.log('Updating sales record for date:', dateString);

    // Check if sales document exists
    const salesSnapshot = await getDoc(salesDocRef);

    if (salesSnapshot.exists()) {
      console.log('Sales document exists, updating...');
      const existingData = salesSnapshot.data() as SalesRecord;
      const amountPaid = cashPaidValue + onlinePaidValue;
      const updatedData: SalesRecord = {
        totalSale: existingData.totalSale + saleAmount,
        cashPayment: existingData.cashPayment + cashPaidValue,
        onlinePayment: existingData.onlinePayment + onlinePaidValue,
        expense: existingData.expense || 0, // Keep existing expense
        orders: existingData.orders + + (ordersCount || 0),
        delivered: existingData.delivered + (deliveredCount || 0),
        deliveredCans: existingData.deliveredCans + (isDeliveredCan ? deliveredQty : 0),
        emptyCollected: existingData.emptyCollected + emptyQty,
        pendingPaymentReceived: (existingData.pendingPaymentReceived || 0) + (pendingPaymentReceived || 0),
        cashBillsPayment: (existingData.cashBillsPayment || 0) + (cashBillsPayment || 0),
        onlineBillsPayment: (existingData.onlineBillsPayment || 0) + (onlineBillsPayment || 0),
        emptyReturned: (existingData.emptyReturned || 0) + (emptyReturned || 0),
      };

      await updateDoc(salesDocRef, updatedData);
      console.log('Sales document updated successfully:', updatedData);
    } else {
      console.log('Sales document does not exist, creating new one...');
      const amountPaid = cashPaidValue + onlinePaidValue;
      const newSalesRecord: SalesRecord = {
        totalSale: saleAmount,
        cashPayment: cashPaidValue,
        onlinePayment: onlinePaidValue,
        expense: 0,
        orders: ordersCount || 0,
        delivered: deliveredCount || 0,
        deliveredCans: isDeliveredCan ? deliveredQty : 0,
        emptyCollected: emptyQty,
        pendingPaymentReceived: pendingPaymentReceived || 0,
        cashBillsPayment: cashBillsPayment || 0,
        onlineBillsPayment: onlineBillsPayment || 0,
        emptyReturned: emptyReturned || 0,
      };

      await setDoc(salesDocRef, newSalesRecord);
      console.log('New sales document created:', newSalesRecord);
    }

    return true;
  } catch (error) {
    console.error('Error in updateSalesRecord:', error);
    return handleServiceError(error, 'updateSalesRecord');
  }
};

/**
 * Get sales record for a specific date
 */
export const getSalesRecord = async (dateString?: string): Promise<SalesRecord | null | ServiceError> => {
  try {
    const db = getFirestore();
    const date = dateString || getISTDateString();
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

/**
 * Get sales records for a date range
 */
export const getSalesRecordsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<{ [date: string]: SalesRecord } | ServiceError> => {
  try {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, 'sales'));
    if (snapshot.empty) return {};

    const out: { [date: string]: SalesRecord } = {};
    snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const dateKey = docSnap.id;
      // dateKey is YYYY-MM-DD, so lexical compare matches chronological order.
      if (dateKey >= startDate && dateKey <= endDate) {
        out[dateKey] = docSnap.data() as SalesRecord;
      }
    });
    return out;
  } catch (error) {
    console.error('Error in getSalesRecordsByDateRange:', error);
    return handleServiceError(error, 'getSalesRecordsByDateRange');
  }
};

/**
 * Add expense to today's sales record (creates if missing)
 */
export const addExpenseToSales = async (amount: number): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    const dateString = getISTDateString();
    const salesDocRef = doc(collection(db, 'sales'), dateString);
    const snap = await getDoc(salesDocRef);

    if (snap.exists()) {
      const existing = snap.data() as SalesRecord;
      await updateDoc(salesDocRef, { expense: (existing.expense || 0) + amount });
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
      await setDoc(salesDocRef, newRec);
    }

    return true;
  } catch (error) {
    return handleServiceError(error, 'addExpenseToSales');
  }
};

/**
 * Record cash amount submitted when closing today's sale.
 * This writes or updates the day's sales document with a cashSubmitted field.
 */
export const submitCashForToday = async (
  amount: number,
  vaultCash?: number,
): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    const dateString = getISTDateString();
    const salesDocRef = doc(collection(db, 'sales'), dateString);

    // build payload with optional vaultCash
    const payload: any = { cashSubmitted: amount };
    if (vaultCash !== undefined) payload.vaultCash = vaultCash;

    // merge so existing document is preserved
    await setDoc(salesDocRef, payload, { merge: true });
    return true;
  } catch (error) {
    console.error('Error in submitCashForToday:', error);
    return handleServiceError(error, 'submitCashForToday');
  }
};