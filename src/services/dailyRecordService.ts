import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, arrayUnion, query, where, FirebaseFirestoreTypes, getDoc } from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';

export interface DailyRecordEntry {
  customerId: string;
  customerName: string;
  customerAddress?: string;
  customerMobile?: string;
  product: string;
  orderedAt: string;
  deliveredAt: string;
  orderedQty?: number;
  deliveredQty: number;
  emptyQty: number;
  billAmount: number;
  saleAmount: number;
  amountPaid: number;
  paymentMethod: 'cash' | 'online';
  paymentRef?: number;
  pendingPaymentReceived: number;
}

export interface DailyRecord {
  [date: string]: DailyRecordEntry[] | string; // date keys (yyyy-MM-dd) map to arrays of entries, productId is string
}

// Format date to yyyy-MM-dd format
const formatDateForDaily = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Extract date from deliveredAt timestamp and convert to yyyy-MM-dd
const extractDateFromDeliveredAt = (deliveredAt: string): string => {
  // deliveredAt format: "14/01/26, 02:30 PM"
  const datePart = deliveredAt.split(',')[0]; // "14/01/26"
  const [dd, mm, yy] = datePart.trim().split('/');
  const year = parseInt(yy, 10) < 50 ? 2000 + parseInt(yy, 10) : 1900 + parseInt(yy, 10);
  const month = String(parseInt(mm, 10)).padStart(2, '0');
  const day = String(parseInt(dd, 10)).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ✅ Add or update daily record entry
export const addDailyRecord = async (
  productId: string,
  entry: DailyRecordEntry
): Promise<true | ServiceError> => {
  try {
    console.log('Adding daily record for product:', productId, entry);
    const db = getFirestore();
    
    // Extract date from deliveredAt in yyyy-MM-dd format
    const dateKey = extractDateFromDeliveredAt(entry.deliveredAt);
    
    // Document ID is just the productId
    const docRef = doc(db, 'dailyRecord', productId);
    
    // Check if document exists
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log('Daily record exists, adding entry to date array');
      const data = docSnap.data() || {};
      const existingEntries = (data[dateKey] as DailyRecordEntry[]) || [];
      
      // Update existing document by adding to the date's array
      await updateDoc(docRef, {
        [dateKey]: [...existingEntries, entry],
      });
      console.log('Daily record updated successfully');
    } else {
      console.log('Daily record does not exist, creating new record');
      // Create new document with productId and first date entry
      await setDoc(docRef, {
        [dateKey]: [entry],
      });
      console.log('Daily record created successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Error in addDailyRecord:', error);
    return handleServiceError(error, 'addDailyRecord');
  }
};

// ✅ Get all daily records for a specific date
export const getDailyRecordsByDate = async (
  date: string
): Promise<DailyRecordEntry[] | ServiceError> => {
  try {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, 'dailyRecord'));
    
    if (snapshot.empty) {
      return [];
    }
    
    // Collect all entries for the specified date from all products
    const allEntries: DailyRecordEntry[] = [];
    snapshot.docs.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const data = docSnap.data();
      const dateEntries = data[date] as DailyRecordEntry[] | undefined;
      if (dateEntries && Array.isArray(dateEntries)) {
        allEntries.push(...dateEntries);
      }
    });
    
    return allEntries;
  } catch (error) {
    console.error('Error in getDailyRecordsByDate:', error);
    return handleServiceError(error, 'getDailyRecordsByDate');
  }
};

// ✅ Get daily record for specific product and date
export const getDailyRecord = async (
  productId: string,
  date: string
): Promise<DailyRecordEntry[] | ServiceError> => {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'dailyRecord', productId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() || {};
      const dateEntries = data[date] as DailyRecordEntry[] | undefined;
      return dateEntries || [];
    }
    
    return [];
  } catch (error) {
    console.error('Error in getDailyRecord:', error);
    return handleServiceError(error, 'getDailyRecord');
  }
};

// ✅ Get all daily records
export const getAllDailyRecords = async (): Promise<
  DailyRecord[] | ServiceError
> => {
  try {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, 'dailyRecord'));
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => docSnap.data() as DailyRecord);
  } catch (error) {
    console.error('Error in getAllDailyRecords:', error);
    return handleServiceError(error, 'getAllDailyRecords');
  }
};
