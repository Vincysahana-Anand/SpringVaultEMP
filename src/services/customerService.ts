import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import firestore, { FirebaseFirestoreTypes, getFirestore, collection, getDocs, query, where, orderBy, startAt, endAt, addDoc, updateDoc, deleteDoc, doc } from '@react-native-firebase/firestore';


export interface Customer {
  id?: string;
  name: string;
  mobile: string;
  alternateContacts: string[];
  doorNumber: string;
  floor: string;
  street: string;
  area: string;
  advanceAmount: number;
  customerType: 'Residence' | 'Shop' | 'Party';
  billingType: 'Cash' | 'Rotational Payment' | 'Monthly Payment' | 'Online';
  price: number;
  // Optional per-product pricing (used for non-20L deliveries).
  '1lPrice'?: number;
  '500mlPrice'?: number;
  '300mlPrice'?: number;
  canHolding: number;
  extraCanHolding?: number;
  balance?: number;
}

export const getCustomers = async (): Promise<Customer[] | ServiceError> => {
  try {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, 'customers'));
    return snapshot.docs.map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as Customer));
  } catch (error) {
    return handleServiceError(error, 'getCustomers');
  }
};

export const addCustomer = async (customer: Customer): Promise<string | ServiceError> => {
  try {
    const newCustomer = {
      ...customer,
      name: customer.name.trim(),
      mobile: customer.mobile.trim(),
      alternateContacts: customer.alternateContacts.map(c => c.trim()),
      doorNumber: customer.doorNumber.trim(),
      floor: customer.floor.trim(),
      street: customer.street.trim(),
      area: customer.area.trim(),
      extraCanHolding: 0
    };
    const db = getFirestore();
    const docRef = await addDoc(collection(db, 'customers'), newCustomer);
    return docRef.id;
  } catch (error) {
    return handleServiceError(error, 'addCustomer');
  }
};

export const updateCustomer = async (id: string, data: Partial<Customer>): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await updateDoc(doc(db, 'customers', id), data);
    return true;
  } catch (error) {
    return handleServiceError(error, 'updateCustomer');
  }
};

export const deleteCustomer = async (id: string): Promise<true | ServiceError> => {
  try {
    const db = getFirestore();
    await deleteDoc(doc(db, 'customers', id));
    return true;
  } catch (error) {
    return handleServiceError(error, 'deleteCustomer');
  }
};

export const searchCustomers = async (term: string): Promise<Customer[] | ServiceError> => {
  try {
    if (term.length < 2) return [];

    const db = getFirestore();
    const promises: Promise<FirebaseFirestoreTypes.QuerySnapshot>[] = [];
    const customersCol = collection(db, 'customers');

    // Name (using startAt for partial match)
    promises.push(
      getDocs(query(customersCol, orderBy('name'), startAt(term), endAt(term + '\uf8ff')))
    );

    // Mobile (exact or startsWith)
    promises.push(
      getDocs(query(customersCol, where('mobile', '>=', term), where('mobile', '<=', term + '\uf8ff')))
    );

    // Alternate contacts: exact match only with array-contains
    promises.push(
      getDocs(query(customersCol, where('alternateContacts', 'array-contains', term)))
    );

    // Door Number
    promises.push(
      getDocs(query(customersCol, orderBy('doorNumber'), startAt(term), endAt(term + '\uf8ff')))
    );

    // Street
    promises.push(
      getDocs(query(customersCol, orderBy('street'), startAt(term), endAt(term + '\uf8ff')))
    );

    // Area
    promises.push(
      getDocs(query(customersCol, orderBy('area'), startAt(term), endAt(term + '\uf8ff')))
    );

    const snapshots = await Promise.all(promises);

    const map: Record<string, Customer> = {};
    snapshots.forEach((snap) => {
      snap.forEach((doc) => {
        map[doc.id] = { id: doc.id, ...doc.data() } as Customer;
      });
    });

    return Object.values(map);
  } catch (error) {
    return handleServiceError(error, 'searchCustomers');
  }
};
