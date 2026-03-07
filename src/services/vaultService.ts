import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';

export interface VaultRecord {
  cash: number;
  online: number;
  total: number;
}

const getVaultDocRef = () => {
  const db = getFirestore();
  // single-document "current" summary; could be extended later
  return doc(collection(db, 'vault'), 'current');
};

/**
 * Create or overwrite the vault totals in the collection.
 *
 * @param record values for cash, online and total
 */
export const setVaultRecord = async (
  record: VaultRecord,
): Promise<true | ServiceError> => {
  try {
    const ref = getVaultDocRef();
    await setDoc(ref, record);
    return true;
  } catch (err) {
    console.error('Error in setVaultRecord:', err);
    return handleServiceError(err, 'setVaultRecord');
  }
};

/**
 * Update vault totals, merging with existing document.
 * Only supplied fields will be changed.
 */
export const updateVaultRecord = async (
  partial: Partial<VaultRecord>,
): Promise<true | ServiceError> => {
  try {
    const ref = getVaultDocRef();
    await updateDoc(ref, partial as any);
    return true;
  } catch (err) {
    console.error('Error in updateVaultRecord:', err);
    return handleServiceError(err, 'updateVaultRecord');
  }
};

/**
 * Retrieve current vault totals.
 */
export const getVaultRecord = async (): Promise<VaultRecord | null | ServiceError> => {
  try {
    const ref = getVaultDocRef();
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as VaultRecord;
    }
    return null;
  } catch (err) {
    console.error('Error in getVaultRecord:', err);
    return handleServiceError(err, 'getVaultRecord');
  }
};
