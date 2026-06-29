import {
  FirebaseFirestoreTypes,
  collection,
  collectionGroup,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
} from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { CustomerPurchaseHistory, PurchaseRecord } from '../types';

export type { PurchaseRecord, CustomerPurchaseHistory } from '../types';

const DEFAULT_PURCHASE_HISTORY_PAGE_SIZE = 50;

export type PurchaseHistoryCursor = FirebaseFirestoreTypes.QueryDocumentSnapshot | null;

export type CustomerPurchaseHistoryPage = {
  records: PurchaseRecord[];
  nextCursor: PurchaseHistoryCursor;
  hasMore: boolean;
};

export const addPurchaseHistory = async (
  customerId: string,
  purchaseRecord: PurchaseRecord,
): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    const purchasesCollection = collection(db, 'purchaseHistory', customerId, 'purchases');
    const purchaseDocRef = doc(purchasesCollection);

    await setDoc(purchaseDocRef, {
      ...purchaseRecord,
      createdAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('Error in addPurchaseHistory:', error);
    return handleServiceError(error, 'addPurchaseHistory');
  }
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
    const constraints: FirebaseFirestoreTypes.QueryConstraint[] = [
      orderBy('createdAt', 'desc'),
      limit(cappedPageSize),
    ];

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    const purchasesQuery = query(
      collection(db, 'purchaseHistory', customerId, 'purchases'),
      ...constraints,
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

export const getAllPurchaseHistories = async (): Promise<
  CustomerPurchaseHistory[] | ServiceError
> => {
  try {
    const db = getFirestore();
    const snapshot = await getDocs(collectionGroup(db, 'purchases'));
    const map = new Map<string, PurchaseRecord[]>();

    snapshot.docs.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const pathParts = docSnap.ref.path.split('/');
      if (pathParts.length >= 4) {
        const customerId = pathParts[1];
        const record = docSnap.data() as PurchaseRecord;
        const existing = map.get(customerId) ?? [];
        existing.push(record);
        map.set(customerId, existing);
      }
    });

    return Array.from(map.entries()).map(([customerId, purchases]) => ({
      customerId,
      purchases,
    }));
  } catch (error) {
    return handleServiceError(error, 'getAllPurchaseHistories');
  }
};
