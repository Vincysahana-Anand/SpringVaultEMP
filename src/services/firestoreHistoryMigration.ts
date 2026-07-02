import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
} from '@react-native-firebase/firestore';

import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { DailyRecordEntry } from '../types';

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

export type LegacyHistoryShapeSummary = {
  purchaseHistoryDocsWithLegacyPurchasesArray: number;
  dailyRecordDocsWithLegacyDateArrays: number;
};

/**
 * Runtime-safe legacy schema scan. This does not mutate data and is useful
 * for warning when an environment still requires admin migration.
 */
export const scanLegacyHistoryShape = async (
  db = getFirestore(),
): Promise<LegacyHistoryShapeSummary> => {
  const [purchaseSnapshot, dailySnapshot] = await Promise.all([
    getDocs(collection(db, 'purchaseHistory')),
    getDocs(collection(db, 'dailyRecord')),
  ]);

  let purchaseLegacyCount = 0;
  purchaseSnapshot.docs.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = docSnap.data() as Record<string, unknown>;
    if (Array.isArray(data.purchases)) {
      purchaseLegacyCount += 1;
    }
  });

  let dailyLegacyCount = 0;
  dailySnapshot.docs.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = docSnap.data() as Record<string, unknown>;
    const hasDateArrays = Object.keys(data).some((key) => Array.isArray(data[key]));
    if (hasDateArrays) {
      dailyLegacyCount += 1;
    }
  });

  return {
    purchaseHistoryDocsWithLegacyPurchasesArray: purchaseLegacyCount,
    dailyRecordDocsWithLegacyDateArrays: dailyLegacyCount,
  };
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
