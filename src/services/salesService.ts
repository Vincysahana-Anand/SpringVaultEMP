import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc } from '@react-native-firebase/firestore';
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
  saleAmount: number
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
        orders: existingData.orders + 1,
        delivered: existingData.delivered + 1,
        deliveredCans: existingData.deliveredCans + (isDeliveredCan ? deliveredQty : 0),
        emptyCollected: existingData.emptyCollected + emptyQty,
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
        orders: 1,
        delivered: 1,
        deliveredCans: isDeliveredCan ? deliveredQty : 0,
        emptyCollected: emptyQty,
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
    const salesCollection = collection(db, 'sales');

    // Note: This is a simple implementation. For production, use proper Firestore query
    // For now, return empty object - should be implemented with proper querying
    return {};
  } catch (error) {
    console.error('Error in getSalesRecordsByDateRange:', error);
    return handleServiceError(error, 'getSalesRecordsByDateRange');
  }
};
