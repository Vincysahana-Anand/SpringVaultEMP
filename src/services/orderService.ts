import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
} from '@react-native-firebase/firestore';
import { Order } from '../types';
import { getISTDate, formatDateKey } from '../utils/dateUtils';
import { createRepository } from './firestoreRepository';
import { buildSalesIncrementUpdate } from './salesIncrementHelper';

export type { Order } from '../types';

const ordersRepo = createRepository<Order>('orders', [orderBy('timeStamp', 'asc')] as any);

export const getOrders = () => ordersRepo.getAll();

/**
 * Fetch only the pending order for a specific customer + product pair.
 * This avoids scanning the full orders collection on every order submit.
 */
export const getPendingOrderByCustomerAndProduct = async (
  customerId: string,
  productId: string,
): Promise<Order | null | ServiceError> => {
  try {
    const db = getFirestore();
    const pendingOrderQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', customerId),
      where('productId', '==', productId),
      limit(1),
    );

    const snapshot = await getDocs(pendingOrderQuery);
    if (snapshot.empty) {
      return null;
    }

    const first = snapshot.docs[0];
    return { id: first.id, ...(first.data() as Order) };
  } catch (error) {
    return handleServiceError(error, 'getPendingOrderByCustomerAndProduct');
  }
};

export const addOrder = async (order: Order): Promise<true | ServiceError> => {
  const result = await ordersRepo.add(order);
  return typeof result === 'string' ? true : result;
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
      tx.set(newOrderRef, order);
      tx.set(salesRef, buildSalesIncrementUpdate({ orders: 1 }), { merge: true });
    });

    return { ok: true };
  } catch (error) {
    return handleServiceError(error, 'placeOrderTransaction');
  }
};

export const updateOrder = (id: string, data: Partial<Order>) => ordersRepo.update(id, data);

export const deleteOrder = (id: string) => ordersRepo.delete(id);
