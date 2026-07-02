import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
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

type CustomerHydrationCache = Map<string, Record<string, unknown> | null>;

/**
 * Runtime-safe legacy schema scan. This does not mutate data and is useful
 * for warning when an environment still requires admin migration.
 */
export const scanLegacyHistoryShape = async (
  db = getFirestore(),
): Promise<LegacyHistoryShapeSummary> => {
  // Fast path: production migration script writes this marker after successful execute.
  // When present and up-to-date, we can skip expensive full-collection scans on app startup.
  const markerSnap = await getDoc(doc(db, 'meta', 'firestoreMigrations'));
  if (markerSnap.exists()) {
    const markerData = markerSnap.data() as Record<string, unknown>;
    const version = Number(markerData.historySchemaVersion || 0);
    if (!Number.isNaN(version) && version >= 2) {
      return {
        purchaseHistoryDocsWithLegacyPurchasesArray: 0,
        dailyRecordDocsWithLegacyDateArrays: 0,
      };
    }
  }

  const [purchaseLegacySnapshot, dailySnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, 'purchaseHistory'),
        where('purchases', '!=', null),
        limit(1),
      ),
    ),
    getDocs(collection(db, 'dailyRecord')),
  ]);

  const purchaseLegacyCount = purchaseLegacySnapshot.size;

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
  customerCache?: CustomerHydrationCache,
): Promise<DailyRecordEntry[]> => {
  const cache = customerCache ?? new Map<string, Record<string, unknown> | null>();
  const customerIds = Array.from(new Set(entries.map((entry) => entry.customerId).filter(Boolean)));
  if (!customerIds.length) {
    return entries;
  }

  const uncachedIds = customerIds.filter((customerId) => !cache.has(customerId));
  await Promise.all(
    uncachedIds.map(async (customerId) => {
      const customerSnap = await getDoc(doc(db, 'customers', customerId));
      cache.set(customerId, customerSnap.exists() ? (customerSnap.data() as Record<string, unknown>) : null);
    }),
  );

  return entries.map((entry) => {
    const customerData = cache.get(entry.customerId) || undefined;
    return {
      ...entry,
      customerName: entry.customerName || (customerData?.name ? String(customerData.name) : 'Customer'),
      customerMobile: entry.customerMobile || (customerData?.mobile ? String(customerData.mobile) : ''),
      customerAddress: entry.customerAddress || buildCustomerAddress(customerData),
    };
  });
};
