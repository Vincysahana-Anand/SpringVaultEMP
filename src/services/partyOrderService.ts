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
import { getISTDate } from '../utils/dateUtils';
import { PurchaseRecord } from './purchaseHistoryService';

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

export type CompletePartyDeliveryParams = {
  order: PartyOrder;
  deliveredQty: number;
};

const formatDeliveredAt = (d: Date) => {
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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

    const partyOrderRef = doc(db, 'partyOrders', order.id);
    const stockRef = doc(db, 'stocks', order.productId);
    const customerRef = doc(db, 'customers', order.customerId);
    const purchaseHistoryRef = doc(db, 'purchaseHistory', order.customerId);
    const partyDeliveryRef = doc(collection(db, 'partyDeliveries'));

    const result = await runTransaction(db, async (tx) => {
      const [stockSnap, purchaseHistorySnap] = await Promise.all([
        tx.get(stockRef),
        tx.get(purchaseHistoryRef),
      ]);

      const customerSnap = await tx.get(customerRef);

      if (!stockSnap.exists()) {
        throw new Error('Stock not found');
      }

      const stockData = stockSnap.data() as any;
      const currentQuantity = Number(stockData?.quantity ?? 0) || 0;
      const stockUnitPrice = Number(stockData?.price ?? 0) || 0;

      const customerData = customerSnap.exists() ? (customerSnap.data() as any) : null;
      const customerPrice = Number(customerData?.price ?? 0) || 0;
      const customer1LPrice = Number(customerData?.['1lPrice'] ?? 0) || 0;
      const customer500mlPrice = Number(customerData?.['500mlPrice'] ?? 0) || 0;
      const customer300mlPrice = Number(customerData?.['300mlPrice'] ?? 0) || 0;

      let unitPrice = stockUnitPrice;
      switch (String(order.productId || '')) {
        case '20L_PARTY_CAN':
          unitPrice = customerPrice > 0 ? customerPrice : stockUnitPrice;
          break;
        case '1L_CASE':
          unitPrice = customer1LPrice > 0 ? customer1LPrice : stockUnitPrice;
          break;
        case '500ML_CASE':
          unitPrice = customer500mlPrice > 0 ? customer500mlPrice : stockUnitPrice;
          break;
        case '300ML_CASE':
          unitPrice = customer300mlPrice > 0 ? customer300mlPrice : stockUnitPrice;
          break;
        default: {
          const normalizedName = String(order.productName || '')
            .toLowerCase()
            .replace(/\s+/g, '');
          const is20LPartyCanByName = normalizedName.includes('20l') && (normalizedName.includes('-p') || normalizedName.includes('party') || normalizedName.endsWith('p'));
          if (is20LPartyCanByName && customerPrice > 0) {
            unitPrice = customerPrice;
          }
        }
      }

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

      if (purchaseHistorySnap.exists()) {
        const existingData = purchaseHistorySnap.data() as any;
        const existingPurchases = (existingData?.purchases as PurchaseRecord[]) || [];
        const updatedPurchases = [...existingPurchases, purchaseRecord].slice(-20);
        tx.update(purchaseHistoryRef, {
          purchases: updatedPurchases,
        });
      } else {
        tx.set(purchaseHistoryRef, {
          purchases: [purchaseRecord],
        });
      }

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
