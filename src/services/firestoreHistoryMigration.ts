import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';

import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { CustomerPurchaseHistory, DailyRecordEntry, PurchaseRecord } from '../types';

const purchaseRecordKey = (record: PurchaseRecord): string => {
  return [
    record.product,
    record.orderedAt,
    record.deliveredAt,
    String(record.billAmount),
    String(record.amountPaid),
    record.paymentMethod,
    String(record.emptyQty),
    String(record.deliveredQty),
  ].join('|');
};

const createStableDocId = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
};

const buildCustomerAddress = (customer: Record<string, unknown> | null | undefined): string => {
  if (!customer) return '';
  const parts = [
    customer.doorNumber,
    customer.floor,
    customer.street,
    customer.area,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
};

export const migrateLegacyPurchaseHistoryForCustomer = async (
  customerId: string,
  db = getFirestore(),
): Promise<boolean> => {
  try {
    const legacyRef = doc(db, 'purchaseHistory', customerId);
    const legacySnap = await getDoc(legacyRef);
    if (!legacySnap.exists()) {
      return false;
    }

    const legacyData = legacySnap.data() as CustomerPurchaseHistory | undefined;
    const legacyRecords = Array.isArray(legacyData?.purchases) ? legacyData.purchases : [];
    if (!legacyRecords.length) {
      await deleteDoc(legacyRef);
      return false;
    }

    const purchasesCollection = collection(db, 'purchaseHistory', customerId, 'purchases');
    for (const record of legacyRecords) {
      const docId = `legacy-${createStableDocId(purchaseRecordKey(record))}`;
      await setDoc(doc(purchasesCollection, docId), {
        ...record,
        createdAt: new Date(),
      });
    }

    await deleteDoc(legacyRef);
    return true;
  } catch (error) {
    console.error('Error migrating legacy purchase history:', error);
    return false;
  }
};

export const migrateLegacyPurchaseHistories = async (db = getFirestore()): Promise<void> => {
  const snapshot = await getDocs(collection(db, 'purchaseHistory'));
  await Promise.all(snapshot.docs.map((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => migrateLegacyPurchaseHistoryForCustomer(docSnap.id, db)));
};

export const migrateLegacyDailyRecords = async (db = getFirestore()): Promise<void> => {
  try {
    const snapshot = await getDocs(collection(db, 'dailyRecord'));
    await Promise.all(snapshot.docs.map(async (docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const productId = docSnap.id;
      const data = docSnap.data() as Record<string, unknown>;
      const dateKeys = Object.keys(data).filter((key) => Array.isArray(data[key]));

      if (!dateKeys.length) {
        return;
      }

      const entriesCollection = collection(db, 'dailyRecord', productId, 'entries');
      const updates: Record<string, unknown> = {};

      for (const dateKey of dateKeys) {
        const entries = data[dateKey] as DailyRecordEntry[] | undefined;
        if (!Array.isArray(entries)) {
          continue;
        }
        for (const [index, entry] of entries.entries()) {
          const entryRef = doc(entriesCollection, `legacy-${createStableDocId(`${dateKey}-${index}`)}`);
          const normalizedEntry = entry as unknown as Record<string, unknown>;
          await setDoc(entryRef, {
            ...normalizedEntry,
            date: dateKey,
            createdAt: new Date(),
          });
        }
        updates[dateKey] = deleteField();
      }

      await updateDoc(doc(db, 'dailyRecord', productId), updates);
      await deleteDoc(doc(db, 'dailyRecord', productId));
    }));
  } catch (error) {
    console.error('Error migrating legacy daily records:', error);
  }
};

export const hydrateDailyRecordEntriesWithCustomerData = async (
  db = getFirestore(),
  entries: DailyRecordEntry[],
): Promise<DailyRecordEntry[]> => {
  const customerIds = Array.from(new Set(entries.map((entry) => entry.customerId).filter(Boolean)));
  if (!customerIds.length) {
    return entries;
  }

  const customerMap = new Map<string, Record<string, unknown>>();
  for (const customerId of customerIds) {
    const customerSnap = await getDoc(doc(db, 'customers', customerId));
    if (customerSnap.exists()) {
      customerMap.set(customerId, customerSnap.data() as Record<string, unknown>);
    }
  }

  return entries.map((entry) => {
    const customerData = customerMap.get(entry.customerId);
    return {
      ...entry,
      customerName: entry.customerName || (customerData?.name ? String(customerData.name) : 'Customer'),
      customerMobile: entry.customerMobile || (customerData?.mobile ? String(customerData.mobile) : ''),
      customerAddress: entry.customerAddress || buildCustomerAddress(customerData),
    };
  });
};
