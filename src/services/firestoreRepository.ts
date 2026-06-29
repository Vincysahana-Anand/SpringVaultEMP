import {
  FirebaseFirestoreTypes,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getFirestore,
  query,
} from '@react-native-firebase/firestore';
import type { QueryConstraint } from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';

/**
 * Creates a generic Firestore CRUD repository for a collection.
 *
 * Eliminates the repeated try-catch + handleServiceError boilerplate that
 * appears in every service. Use for standard create/read/update/delete
 * operations; keep business-specific logic (transactions, custom queries,
 * field normalisation) in the service layer.
 *
 * @param collectionName    Firestore collection name.
 * @param defaultConstraints Optional query constraints applied to getAll()
 *                           (e.g. orderBy, where, limit).
 *
 * Usage:
 *   const ordersRepo = createRepository<Order>('orders', [orderBy('timeStamp', 'asc')]);
 *   export const getOrders = () => ordersRepo.getAll();
 *   export const deleteOrder = (id: string) => ordersRepo.delete(id);
 */
export function createRepository<T extends { id?: string }>(
  collectionName: string,
  defaultConstraints: QueryConstraint[] = [],
) {
  const getCol = () => collection(getFirestore(), collectionName);

  return {
    /** Fetch all documents, with optional default ordering/filtering. */
    async getAll(): Promise<T[] | ServiceError> {
      try {
        const q = defaultConstraints.length
          ? query(getCol(), ...defaultConstraints)
          : getCol();
        const snapshot = await getDocs(q as any);
        return snapshot.docs.map(
          (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
            ({ id: d.id, ...d.data() } as T),
        );
      } catch (error) {
        return handleServiceError(error, `${collectionName}/getAll`);
      }
    },

    /** Fetch a single document by ID. Returns null if not found. */
    async getById(id: string): Promise<T | null | ServiceError> {
      try {
        const snap = await getDoc(doc(getFirestore(), collectionName, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as T;
      } catch (error) {
        return handleServiceError(error, `${collectionName}/getById`);
      }
    },

    /**
     * Add a new document (auto-generated ID).
     * Returns the new document ID on success.
     */
    async add(data: Omit<T, 'id'>): Promise<string | ServiceError> {
      try {
        const docRef = await addDoc(getCol(), data as any);
        return docRef.id;
      } catch (error) {
        return handleServiceError(error, `${collectionName}/add`);
      }
    },

    /** Merge-update an existing document. Returns true on success. */
    async update(id: string, data: Partial<T>): Promise<true | ServiceError> {
      try {
        await updateDoc(doc(getFirestore(), collectionName, id), data as any);
        return true;
      } catch (error) {
        return handleServiceError(error, `${collectionName}/update`);
      }
    },

    /** Delete a document by ID. Returns true on success. */
    async delete(id: string): Promise<true | ServiceError> {
      try {
        await deleteDoc(doc(getFirestore(), collectionName, id));
        return true;
      } catch (error) {
        return handleServiceError(error, `${collectionName}/delete`);
      }
    },
  };
}
