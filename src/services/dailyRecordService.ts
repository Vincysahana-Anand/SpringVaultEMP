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
  where,
} from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { DailyRecordEntry } from '../types';
import { hydrateDailyRecordEntriesWithCustomerData } from './firestoreHistoryMigration';
import { config } from '../shared/config';

export type { DailyRecordEntry } from '../types';

const DEFAULT_DAILY_RECORD_PAGE_SIZE = 100;

export type DailyRecordCursor = FirebaseFirestoreTypes.QueryDocumentSnapshot | null;

export type DailyRecordPage = {
  entries: DailyRecordEntry[];
  nextCursor: DailyRecordCursor;
  hasMore: boolean;
};

const toMillis = (value: unknown): number => {
  if (!value) return 0;

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().getTime();
    }
  }

  const asDate = new Date(String(value));
  return Number.isNaN(asDate.getTime()) ? 0 : asDate.getTime();
};

const sortByCreatedAtDesc = (entries: DailyRecordEntry[]): DailyRecordEntry[] => {
  return [...entries].sort((left, right) => {
    const leftTime = toMillis((left as Record<string, unknown>).createdAt);
    const rightTime = toMillis((right as Record<string, unknown>).createdAt);
    return rightTime - leftTime;
  });
};

const isMissingIndexError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === 'firestore/failed-precondition'
    || String(maybeError.message || '').toLowerCase().includes('query requires an index')
  );
};

const getDailyRecordFallbackEntriesByDate = async (
  db: ReturnType<typeof getFirestore>,
  date: string,
): Promise<DailyRecordEntry[]> => {
  const productIds = config.firestore.dailyRecordProductIds;
  const snapshots = await Promise.all(
    productIds.map((productId) => getDocs(
      query(
        collection(db, 'dailyRecord', productId, 'entries'),
        where('date', '==', date),
      ),
    )),
  );

  return snapshots.flatMap((snapshot) => snapshot.docs.map(
    (docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => docSnap.data() as DailyRecordEntry,
  ));
};

const extractDateFromDeliveredAt = (deliveredAt: string): string => {
  const datePart = deliveredAt.split(',')[0];
  const [dd, mm, yy] = datePart.trim().split('/');
  const year = parseInt(yy, 10) < 50 ? 2000 + parseInt(yy, 10) : 1900 + parseInt(yy, 10);
  const month = String(parseInt(mm, 10)).padStart(2, '0');
  const day = String(parseInt(dd, 10)).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const createDailyRecordEntryTransaction = (
  tx: FirebaseFirestoreTypes.Transaction,
  db: ReturnType<typeof getFirestore>,
  productId: string,
  entry: DailyRecordEntry,
  dateKey: string,
): void => {
  const { customerName, customerAddress, customerMobile, ...persistedEntry } = entry;
  const entriesCollection = collection(db, 'dailyRecord', productId, 'entries');
  const entryRef = doc(entriesCollection);
  tx.set(entryRef, {
    ...persistedEntry,
    date: dateKey,
    createdAt: new Date(),
  });
};

export const addDailyRecord = async (
  productId: string,
  entry: DailyRecordEntry,
): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    const dateKey = extractDateFromDeliveredAt(entry.deliveredAt);
    const { customerName, customerAddress, customerMobile, ...persistedEntry } = entry;
    const entriesCollection = collection(db, 'dailyRecord', productId, 'entries');
    const entryRef = doc(entriesCollection);

    await setDoc(entryRef, {
      ...persistedEntry,
      date: dateKey,
      createdAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('Error in addDailyRecord:', error);
    return handleServiceError(error, 'addDailyRecord');
  }
};

export const getDailyRecordsByDate = async (
  date: string,
): Promise<DailyRecordEntry[] | ServiceError> => {
  try {
    let cursor: DailyRecordCursor = null;
    const entries: DailyRecordEntry[] = [];

    while (true) {
      const page = await getDailyRecordsByDatePage(date, DEFAULT_DAILY_RECORD_PAGE_SIZE, cursor);
      if (!('entries' in page)) {
        return page;
      }

      entries.push(...page.entries);
      if (!page.hasMore || !page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
    }

    return entries;
  } catch (error) {
    console.error('Error in getDailyRecordsByDate:', error);
    return handleServiceError(error, 'getDailyRecordsByDate');
  }
};

export const getDailyRecordsByDatePage = async (
  date: string,
  pageSize = DEFAULT_DAILY_RECORD_PAGE_SIZE,
  cursor: DailyRecordCursor = null,
): Promise<DailyRecordPage | ServiceError> => {
  try {
    const db = getFirestore();
    const cappedPageSize = Math.max(1, pageSize);
    const constraints: FirebaseFirestoreTypes.QueryConstraint[] = [
      where('date', '==', date),
      orderBy('createdAt', 'desc'),
      limit(cappedPageSize),
    ];

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    try {
      const entriesQuery = query(collectionGroup(db, 'entries'), ...constraints);
      const snapshot = await getDocs(entriesQuery);
      const entries = snapshot.docs.map(
        (docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => docSnap.data() as DailyRecordEntry,
      );
      const hydrated = await hydrateDailyRecordEntriesWithCustomerData(db, entries);
      const lastDoc = snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : null;
      const hasMore = snapshot.docs.length === cappedPageSize;

      return {
        entries: hydrated,
        nextCursor: hasMore ? lastDoc : null,
        hasMore,
      };
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      console.warn('Missing Firestore index for getDailyRecordsByDatePage; falling back to client-side sorting/paging.');

      const fallbackEntries = await getDailyRecordFallbackEntriesByDate(db, date);
      const sorted = sortByCreatedAtDesc(fallbackEntries).slice(0, cappedPageSize);
      const hydrated = await hydrateDailyRecordEntriesWithCustomerData(db, sorted);

      return {
        entries: hydrated,
        nextCursor: null,
        hasMore: false,
      };
    }
  } catch (error) {
    console.error('Error in getDailyRecordsByDatePage:', error);
    return handleServiceError(error, 'getDailyRecordsByDatePage');
  }
};

export const getDailyRecord = async (
  productId: string,
  date: string,
): Promise<DailyRecordEntry[] | ServiceError> => {
  try {
    let cursor: DailyRecordCursor = null;
    const entries: DailyRecordEntry[] = [];

    while (true) {
      const page = await getDailyRecordPage(
        productId,
        date,
        DEFAULT_DAILY_RECORD_PAGE_SIZE,
        cursor,
      );
      if (!('entries' in page)) {
        return page;
      }

      entries.push(...page.entries);
      if (!page.hasMore || !page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
    }

    return entries;
  } catch (error) {
    console.error('Error in getDailyRecord:', error);
    return handleServiceError(error, 'getDailyRecord');
  }
};

export const getDailyRecordPage = async (
  productId: string,
  date: string,
  pageSize = DEFAULT_DAILY_RECORD_PAGE_SIZE,
  cursor: DailyRecordCursor = null,
): Promise<DailyRecordPage | ServiceError> => {
  try {
    const db = getFirestore();
    const cappedPageSize = Math.max(1, pageSize);
    const constraints: FirebaseFirestoreTypes.QueryConstraint[] = [
      where('date', '==', date),
      orderBy('createdAt', 'desc'),
      limit(cappedPageSize),
    ];

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    try {
      const entriesQuery = query(
        collection(db, 'dailyRecord', productId, 'entries'),
        ...constraints,
      );

      const snapshot = await getDocs(entriesQuery);
      const entries = snapshot.docs.map(
        (docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => docSnap.data() as DailyRecordEntry,
      );
      const hydrated = await hydrateDailyRecordEntriesWithCustomerData(db, entries);
      const lastDoc = snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : null;
      const hasMore = snapshot.docs.length === cappedPageSize;

      return {
        entries: hydrated,
        nextCursor: hasMore ? lastDoc : null,
        hasMore,
      };
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      console.warn('Missing Firestore index for getDailyRecordPage; falling back to client-side sorting/paging.');

      const fallbackQuery = query(
        collection(db, 'dailyRecord', productId, 'entries'),
        where('date', '==', date),
      );
      const fallbackSnapshot = await getDocs(fallbackQuery);
      const fallbackEntries = fallbackSnapshot.docs.map(
        (docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => docSnap.data() as DailyRecordEntry,
      );
      const sorted = sortByCreatedAtDesc(fallbackEntries).slice(0, cappedPageSize);
      const hydrated = await hydrateDailyRecordEntriesWithCustomerData(db, sorted);

      return {
        entries: hydrated,
        nextCursor: null,
        hasMore: false,
      };
    }
  } catch (error) {
    console.error('Error in getDailyRecordPage:', error);
    return handleServiceError(error, 'getDailyRecordPage');
  }
};

export const getAllDailyRecords = async (): Promise<
  DailyRecordEntry[] | ServiceError
> => {
  try {
    const db = getFirestore();
    const snapshot = await getDocs(collectionGroup(db, 'entries'));
    const entries = snapshot.docs.map((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => docSnap.data() as DailyRecordEntry);
    const hydrated = await hydrateDailyRecordEntriesWithCustomerData(db, entries);
    return hydrated;
  } catch (error) {
    console.error('Error in getAllDailyRecords:', error);
    return handleServiceError(error, 'getAllDailyRecords');
  }
};
