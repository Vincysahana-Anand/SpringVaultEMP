import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import {
  FirebaseFirestoreTypes,
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  runTransaction,
} from '@react-native-firebase/firestore';
import { Order } from '../types';
import { getISTDate, formatDateKey } from '../utils/dateUtils';
import { mergeSalesRecord } from '../shared/business/recordMerge';

export type { Order } from '../types';

export const getOrders = async (): Promise<Order[] | ServiceError> => {
  try {
    const db = getFirestore();
    const ordersQuery = query(collection(db, 'orders'), orderBy('timeStamp', 'asc'));
    const snapshot = await getDocs(ordersQuery);
    return snapshot.docs.map((orderDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
      id: orderDoc.id,
      ...orderDoc.data(),
    } as Order));
  } catch (error) {
    return handleServiceError(error, 'getOrders');
  }
};

export const addOrder = async (order: Order): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await addDoc(collection(db, 'orders'), order);
    return true;
  } catch (error) {
    return handleServiceError(error, 'addOrder');
  }
};

/**
 * Atomically create a pending order and increment today's order count in sales.
 */
export const placeOrderTransaction = async (
  order: Order,
): Promise<{ ok: true } | ServiceError> => {
  try {
    const db = getFirestore();
    const dateKey = formatDateKey(getISTDate());
    const salesRef = doc(db, 'sales', dateKey);
    const newOrderRef = doc(collection(db, 'orders'));

    await runTransaction(db, async (tx) => {
      const salesSnap = await tx.get(salesRef);
      const salesPayload = mergeSalesRecord(
        salesSnap.exists() ? (salesSnap.data() as Parameters<typeof mergeSalesRecord>[0]) : undefined,
        { ordersCount: 1 },
      );
      tx.set(newOrderRef, order);
      tx.set(salesRef, salesPayload, { merge: true });
    });

    return { ok: true };
  } catch (error) {
    return handleServiceError(error, 'placeOrderTransaction');
  }
};

export const updateOrder = async (id: string, data: Partial<Order>): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await updateDoc(doc(db, 'orders', id), data);
    return true;
  } catch (error) {
    return handleServiceError(error, 'updateOrder');
  }
};

export const deleteOrder = async (id: string): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await deleteDoc(doc(db, 'orders', id));
    return true;
  } catch (error) {
    return handleServiceError(error, 'deleteOrder');
  }
};
