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
  runTransaction,
  updateDoc,
} from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { getISTDate, formatDateKey, formatDeliveredAt } from '../utils/dateUtils';
import { DailyRecordEntry, PartyDelivery, PartyOrder, PurchaseRecord } from '../types';
import { getUnitPriceForPartyOrder } from '../shared/business/pricing';
import { createPurchaseHistoryEntryTransaction } from './purchaseHistoryService';
import { createDailyRecordEntryTransaction } from './dailyRecordService';
import { mergeSalesRecord } from '../shared/business/recordMerge';

export type { PartyOrder, PartyDelivery } from '../types';

export type CompletePartyDeliveryParams = {
  order: PartyOrder;
  deliveredQty: number;
};

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

export const completePartyDeliveryTransaction = async (
  params: CompletePartyDeliveryParams
): Promise<{ ok: true; deliveredAt: string } | ServiceError> => {
  try {
    const { order, deliveredQty } = params;

    if (!order?.id) {
      return { code: 'invalid-argument', message: '[completePartyDeliveryTransaction] Missing order.id' };
    }

    if (!order.customerId) {
      return { code: 'invalid-argument', message: '[completePartyDeliveryTransaction] Missing order.customerId' };
    }

    if (!order.productId) {
      return { code: 'invalid-argument', message: '[completePartyDeliveryTransaction] Missing order.productId' };
    }

    const qty = Number(deliveredQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { code: 'invalid-argument', message: '[completePartyDeliveryTransaction] Invalid deliveredQty' };
    }

    const db = getFirestore();

    const deliveredDate = getISTDate();
    const deliveredAt = formatDeliveredAt(deliveredDate);

    const dateKey = formatDateKey(deliveredDate);

    const partyOrderRef = doc(db, 'partyOrders', order.id);
    const stockRef = doc(db, 'stocks', order.productId);
    const customerRef = doc(db, 'customers', order.customerId);
    const partyDeliveryRef = doc(collection(db, 'partyDeliveries'));
    const salesRef = doc(db, 'sales', dateKey);

    const result = await runTransaction(db, async (tx) => {
      const [partyOrderSnap, stockSnap, customerSnap, salesSnap] = await Promise.all([
        tx.get(partyOrderRef),
        tx.get(stockRef),
        tx.get(customerRef),
        tx.get(salesRef),
      ]);

      if (!partyOrderSnap.exists()) {
        throw new Error('Party order not found');
      }
      if (!stockSnap.exists()) {
        throw new Error('Stock not found');
      }

      const stockData = stockSnap.data() as Record<string, unknown>;
      const currentQuantity = Number(stockData?.quantity ?? 0) || 0;

      const customerData = customerSnap.exists()
        ? (customerSnap.data() as Record<string, unknown>)
        : null;

      const unitPrice = getUnitPriceForPartyOrder(
        customerData,
        stockData,
        order.productId,
        order.productName,
      );

      if (qty > currentQuantity) {
        throw new Error(`Insufficient stock. Available: ${currentQuantity}`);
      }

      tx.update(stockRef, {
        quantity: currentQuantity - qty,
      });

      const purchaseRecord: PurchaseRecord = {
        product: String(order.productName || ''),
        deliveredQty: qty,
        emptyQty: 0,
        orderedAt: String(order.orderedAt || ''),
        deliveredAt,
        billAmount: unitPrice * qty,
        amountPaid: 0,
        paymentMethod: 'cash',
        paymentRef: 0,
      };

      createPurchaseHistoryEntryTransaction(tx, db, order.customerId, purchaseRecord);

      const saleAmount = unitPrice * qty;
      const isDeliveredCan = order.productId === '20L_CAN' || order.productId === '20L_PARTY_CAN';

      const salesPayload = mergeSalesRecord(
        salesSnap.exists() ? (salesSnap.data() as Parameters<typeof mergeSalesRecord>[0]) : undefined,
        {
          saleAmount,
          ordersCount: 1,
          deliveredCount: 1,
          deliveredQty: qty,
          isDeliveredCan,
        },
      );
      tx.set(salesRef, salesPayload, { merge: true });

      const dailyRecordEntry: DailyRecordEntry = {
        customerId: order.customerId,
        customerName: order.customerName,
        customerAddress: order.address,
        customerMobile: order.mobile,
        product: String(order.productName || ''),
        orderedAt: String(order.orderedAt || ''),
        deliveredAt,
        orderedQty: Number(order.quantity ?? qty) || qty,
        deliveredQty: qty,
        emptyQty: 0,
        billAmount: saleAmount,
        saleAmount,
        amountPaid: 0,
        paymentMethod: 'cash',
        paymentRef: 0,
        pendingPaymentReceived: 0,
      };

      createDailyRecordEntryTransaction(tx, db, order.productId, dailyRecordEntry, dateKey);

      const deliveryData: PartyDelivery = {
        customerId: order.customerId,
        customerName: order.customerName,
        mobile: order.mobile,
        address: order.address,
        productId: order.productId,
        productName: order.productName,
        quantity: order.quantity,
        deliveredQty: qty,
        deliveredAt,
        requestedDate: order.requestedDate,
        paymentMethod: order.paymentMethod,
        amountPaid: 0,
        timeStamp: deliveredDate,
      };

      tx.set(partyDeliveryRef, deliveryData);
      tx.delete(partyOrderRef);

      return deliveryData;
    });

    return { ok: true, deliveredAt };
  } catch (error) {
    return handleServiceError(error, 'completePartyDeliveryTransaction');
  }
};
