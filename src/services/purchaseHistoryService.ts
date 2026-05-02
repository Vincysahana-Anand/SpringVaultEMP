import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import firestore, { FirebaseFirestoreTypes, getFirestore, collection, getDocs, getDoc, setDoc, updateDoc, doc } from '@react-native-firebase/firestore';

export interface PurchaseRecord {
  product: string;
  deliveredQty: number;
  emptyQty: number;
  orderedAt: string;
  deliveredAt: string;
  billAmount: number;
  amountPaid: number;
  paymentMethod: 'cash' | 'online';
  paymentRef?: number;
}

export interface CustomerPurchaseHistory {
  customerId: string;
  purchases: PurchaseRecord[];
}

// ✅ Add or update purchase history for a customer
export const addPurchaseHistory = async (
  customerId: string,
  purchaseRecord: PurchaseRecord
): Promise<true | ServiceError> => {
  try {
    console.log('Adding purchase history for customer:', customerId, purchaseRecord);
    const db = getFirestore();
    const purchaseHistoryRef = doc(db, 'purchaseHistory', customerId);

    // Check if customer history exists
    const docSnap = await getDoc(purchaseHistoryRef);

    if (docSnap.exists()) {
      console.log('Customer history exists, updating with new purchase');
      const existingData = docSnap.data() as CustomerPurchaseHistory;
      const existingPurchases = existingData?.purchases || [];
      const updatedPurchases = [...existingPurchases, purchaseRecord].slice(-20);
      await updateDoc(purchaseHistoryRef, {
        purchases: updatedPurchases,
      });
      console.log('Purchase history updated successfully');
    } else {
      console.log('Customer history does not exist, creating new record');
      // Create new customer history
      await setDoc(purchaseHistoryRef, {
        purchases: [purchaseRecord],
      });
      console.log('Purchase history created successfully');
    }

    return true;
  } catch (error) {
    console.error('Error in addPurchaseHistory:', error);
    return handleServiceError(error, 'addPurchaseHistory');
  }
};

// ✅ Get all purchases for a specific customer
export const getCustomerPurchaseHistory = async (
  customerId: string
): Promise<PurchaseRecord[] | ServiceError> => {
  try {
    const db = getFirestore();
    const purchaseHistoryRef = doc(db, 'purchaseHistory', customerId);
    const docSnap = await getDoc(purchaseHistoryRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as CustomerPurchaseHistory;
      return data.purchases || [];
    }

    return [];
  } catch (error) {
    return handleServiceError(error, 'getCustomerPurchaseHistory');
  }
};

// ✅ Get all purchase histories
export const getAllPurchaseHistories = async (): Promise<
  CustomerPurchaseHistory[] | ServiceError
> => {
  try {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, 'purchaseHistory'));
    return snapshot.docs.map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => doc.data() as CustomerPurchaseHistory);
  } catch (error) {
    return handleServiceError(error, 'getAllPurchaseHistories');
  }
};
