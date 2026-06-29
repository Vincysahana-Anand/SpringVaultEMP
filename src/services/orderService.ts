import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import {
  getFirestore,
  collection,
  doc,
  orderBy,
  runTransaction,
} from '@react-native-firebase/firestore';
import { Order } from '../types';
import { getISTDate, formatDateKey } from '../utils/dateUtils';
import { mergeSalesRecord } from '../shared/business/recordMerge';
import { createRepository } from './firestoreRepository';

export type { Order } from '../types';

const ordersRepo = createRepository<Order>('orders', [orderBy('timeStamp', 'asc')]);

export const getOrders = () => ordersRepo.getAll();

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

export const updateOrder = (id: string, data: Partial<Order>) => ordersRepo.update(id, data);

export const deleteOrder = (id: string) => ordersRepo.delete(id);
