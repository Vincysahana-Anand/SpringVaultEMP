import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { FirebaseFirestoreTypes, getFirestore, collection, getDocs, query, where, addDoc } from '@react-native-firebase/firestore';
import { getISTDate, getISTStartOfDay, getISTDaysAgo, getISTMonthStart, getISTMonthEnd } from '../utils/dateUtils';
import type { Expense } from '../types';

export type { Expense } from '../types';

// Define accepted filter types
export type FilterType =
  | { type: 'today' }
  | { type: '7days' }
  | { type: '15days' }
  | { type: '30days' }
  | { type: 'month'; value: string };

export async function addExpense(expense: Expense): Promise<true | ServiceError> {
  try {
    const db = getFirestore();
    await addDoc(collection(db, 'expenses'), expense);
    return true;
  } catch (error) {
    return handleServiceError(error, 'addExpense');
  }
}

export async function getExpenses(filter: FilterType): Promise<Expense[] | ServiceError> {
  try {
    const db = getFirestore();
    const expensesCol = collection(db, 'expenses');

    const now = getISTDate();
    let startDate = getISTDate();

    switch (filter.type) {
      case 'today':
        startDate = getISTStartOfDay();
        break;
      case '7days':
        startDate = getISTDaysAgo(6);
        break;
      case '15days':
        startDate = getISTDaysAgo(14);
        break;
      case '30days':
        startDate = getISTDaysAgo(29);
        break;
      case 'month':
        const [year, month] = filter.value.split('-'); // expects format 'YYYY-MM'
        const monthStart = getISTMonthStart(parseInt(year) || now.getFullYear(), parseInt(month) - 1);
        const monthEnd = getISTMonthEnd(parseInt(year) || now.getFullYear(), parseInt(month) - 1);

        const monthSnapshot = await getDocs(
          query(expensesCol, where('createdAt', '>=', monthStart), where('createdAt', '<', monthEnd))
        );

        return monthSnapshot.docs.map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
          id: doc.id,
          ...doc.data(),
        })) as Expense[];
    }

    const snapshot = await getDocs(query(expensesCol, where('createdAt', '>=', startDate)));

    return snapshot.docs.map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    })) as Expense[];
  } catch (error) {
    return handleServiceError(error, 'getExpenses');
  }
}

