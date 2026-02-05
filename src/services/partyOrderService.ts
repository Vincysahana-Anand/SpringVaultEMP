import {
  FirebaseFirestoreTypes,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  updateDoc,
} from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';

export interface PartyOrder {
  id?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  paymentMethod: string;
  orderedAt?: string;
  requestedDate?: string;
  deliveredAt?: string;
  deliveredQty?: number;
  address?: string;
  mobile?: string;
  timeStamp?: Date;
}

export interface PartyDelivery {
  id?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  deliveredQty?: number;
  deliveredAt?: string;
  requestedDate?: string;
  address?: string;
  mobile?: string;
  timeStamp?: Date;
  paymentMethod?: string;
  amountPaid?: number;
}

export const addPartyOrder = async (order: PartyOrder): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await addDoc(collection(db, 'partyOrders'), order);
    return true;
  } catch (error) {
    return handleServiceError(error, 'addPartyOrder');
  }
};

export const getPartyOrders = async (): Promise<PartyOrder[] | ServiceError> => {
  try {
    const db = getFirestore();
    const ordersQuery = query(collection(db, 'partyOrders'), orderBy('requestedDate', 'asc'));
    const snapshot = await getDocs(ordersQuery);
    return snapshot.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as PartyOrder));
  } catch (error) {
    return handleServiceError(error, 'getPartyOrders');
  }
};

export const deletePartyOrder = async (orderId: string): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await deleteDoc(doc(db, 'partyOrders', orderId));
    return true;
  } catch (error) {
    return handleServiceError(error, 'deletePartyOrder');
  }
};

export const updatePartyOrder = async (
  orderId: string,
  patch: Partial<PartyOrder>
): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await updateDoc(doc(db, 'partyOrders', orderId), patch);
    return true;
  } catch (error) {
    return handleServiceError(error, 'updatePartyOrder');
  }
};

export const addPartyDelivery = async (delivery: PartyDelivery): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await addDoc(collection(db, 'partyDeliveries'), delivery);
    return true;
  } catch (error) {
    return handleServiceError(error, 'addPartyDelivery');
  }
};

export const getPartyDeliveries = async (): Promise<PartyDelivery[] | ServiceError> => {
  try {
    const db = getFirestore();
    const deliveriesQuery = query(collection(db, 'partyDeliveries'), orderBy('timeStamp', 'desc'));
    const snapshot = await getDocs(deliveriesQuery);
    return snapshot.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as PartyDelivery));
  } catch (error) {
    return handleServiceError(error, 'getPartyDeliveries');
  }
};
