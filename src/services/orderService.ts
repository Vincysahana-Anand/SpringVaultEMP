import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import firestore, { FirebaseFirestoreTypes, getFirestore, collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from '@react-native-firebase/firestore';

export interface Order {
  id?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  deliveredQty?: number;
  paymentMethod: string;
  amountPaid?: number;
  orderedAt?: string;
  deliveredAt?: string;
  address?: string;
  mobile?: string;
  timeStamp?: Date;
}

export const getOrders = async (): Promise<Order[] | ServiceError> => {
  try {
    const db = getFirestore();
    const ordersQuery = query(collection(db, 'orders'), orderBy('timeStamp', 'asc'));
    const snapshot = await getDocs(ordersQuery);
    return snapshot.docs.map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as Order));
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
