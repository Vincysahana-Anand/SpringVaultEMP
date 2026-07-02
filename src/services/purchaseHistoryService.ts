import {
  FirebaseFirestoreTypes,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  startAfter,
} from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { PurchaseRecord } from '../types';

export type { PurchaseRecord, CustomerPurchaseHistory } from '../types';

const DEFAULT_PURCHASE_HISTORY_PAGE_SIZE = 50;

export type PurchaseHistoryCursor = FirebaseFirestoreTypes.QueryDocumentSnapshot | null;

export type CustomerPurchaseHistoryPage = {
  records: PurchaseRecord[];
  nextCursor: PurchaseHistoryCursor;
  hasMore: boolean;
};

export const createPurchaseHistoryEntryTransaction = (
  tx: FirebaseFirestoreTypes.Transaction,
  db: ReturnType<typeof getFirestore>,
  customerId: string,
  purchaseRecord: PurchaseRecord,
): void => {
  const purchasesCollection = collection(db, 'purchaseHistory', customerId, 'purchases');
  const purchaseDocRef = doc(purchasesCollection);
  tx.set(purchaseDocRef, {
    ...purchaseRecord,
    createdAt: new Date(),
  });
};

export const getCustomerPurchaseHistory = async (
  customerId: string,
): Promise<PurchaseRecord[] | ServiceError> => {
  try {
    let cursor: PurchaseHistoryCursor = null;
    const records: PurchaseRecord[] = [];

    while (true) {
      const page = await getCustomerPurchaseHistoryPage(
        customerId,
        DEFAULT_PURCHASE_HISTORY_PAGE_SIZE,
        cursor,
      );

      if (!('records' in page)) {
        return page;
      }

      records.push(...page.records);
      if (!page.hasMore || !page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
    }

    return records;
  } catch (error) {
    return handleServiceError(error, 'getCustomerPurchaseHistory');
  }
};

export const getCustomerPurchaseHistoryPage = async (
  customerId: string,
  pageSize = DEFAULT_PURCHASE_HISTORY_PAGE_SIZE,
  cursor: PurchaseHistoryCursor = null,
): Promise<CustomerPurchaseHistoryPage | ServiceError> => {
  try {
    const db = getFirestore();
    const cappedPageSize = Math.max(1, pageSize);
    const constraints = [
      orderBy('createdAt', 'desc'),
      limit(cappedPageSize),
    ];

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    const purchasesQuery = query(
      collection(db, 'purchaseHistory', customerId, 'purchases'),
      ...(constraints as any[]),
    );

    const snapshot = await getDocs(purchasesQuery);
    const records: PurchaseRecord[] = snapshot.docs.map(
      (docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => docSnap.data() as PurchaseRecord,
    );
    const lastDoc = snapshot.docs.length > 0
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;
    const hasMore = snapshot.docs.length === cappedPageSize;

    return {
      records,
      nextCursor: hasMore ? lastDoc : null,
      hasMore,
    };
  } catch (error) {
    return handleServiceError(error, 'getCustomerPurchaseHistoryPage');
  }
};
