import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import firestore, { FirebaseFirestoreTypes, getFirestore, collection, getDocs, setDoc, updateDoc, doc, increment } from '@react-native-firebase/firestore';

export interface Stock {
  id: string;
  productName: string;
  quantity: number;
  price?: number; // Price per unit
  empty?: number; // Only for 20L can & party can
  total?: number; // Optional, can be used for total stock
  extraCan?: number;
}

// ✅ Fetch all stocks
export const getStocks = async (): Promise<Stock[] | ServiceError> => {
  try {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, 'stocks'));
    return snapshot.docs.map(
      (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Stock)
    );
  } catch (error) {
    return handleServiceError(error, 'getStocks');
  }
};

// ✅ Add a new stock product
export const addStock = async (id: string, data: Stock): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await setDoc(doc(db, 'stocks', id), data);
    return true;
  } catch (error) {
    return handleServiceError(error, 'addStock');
  }
};

// ✅ Atomically restock an existing product
export const restockStock = async (id: string, qty: number, emt:number): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await updateDoc(doc(db, 'stocks', id), {
      quantity: increment(qty),
      empty: emt
    });
    return true;
  } catch (error) {
    return handleServiceError(error, 'restockStock');
  }
};

// ✅ Direct update (if needed)
export const updateStock = async (id: string, data: Partial<Stock>): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await updateDoc(doc(db, 'stocks', id), data);
    return true;
  } catch (error) {
    return handleServiceError(error, 'updateStock');
  }
};

// ✅ Optional: Helper to get product name by static ID
export const resolveProductName = (id: string): string => {
  switch (id) {
    case '20L_CAN': return '20 liter can';
    case '1L_CASE': return '1 liter case';
    case '500ML_CASE': return '500ml case';
    case '300ML_CASE': return '300ml case';
    case '20L_PARTY_CAN': return '20 liter party can';
    default: return 'Unknown';
  }
};
