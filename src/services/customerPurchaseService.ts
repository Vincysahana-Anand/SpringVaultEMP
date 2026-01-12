import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import firestore from '@react-native-firebase/firestore';

export interface PurchaseData {
  id: string;
  customerName: string;
  mobile: string;
  balance: number;
  extraCanHolding: number;
  address?: string;
  [key: string]: any;
}

// Fetch customer purchase data where balance > 0 or extraCanHolding ≠ 0
export async function fetchCustomerPurchases(): Promise<PurchaseData[] | ServiceError> {
  try {
    const snapshot = await firestore().collection('customersPurchaseManage').get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as PurchaseData))
      .filter((item) => item.balance > 0 || (item.extraCanHolding ?? 0) !== 0);
  } catch (error) {
    return handleServiceError(error, 'fetchCustomerPurchases');
  }
}

// Update customer balance (subtract value)
export async function updateCustomerPurchase(customer: PurchaseData, value: number): Promise<true | ServiceError> {
  try {
    const ref = firestore().collection('customersPurchaseManage').doc(customer.id);
    await ref.update({
      balance: firestore.FieldValue.increment(-value),
    });
    return true;
  } catch (error) {
    return handleServiceError(error, 'updateCustomerPurchase');
  }
}

// Update customer's extra can holding count
export async function updateCustomerCan(customer: PurchaseData, value: number): Promise<true | ServiceError> {
  try {
    const ref = firestore().collection('customersPurchaseManage').doc(customer.id);
    await ref.update({
      extraCanHolding: firestore.FieldValue.increment(-value),
    });
    return true;
  } catch (error) {
    return handleServiceError(error, 'updateCustomerCan');
  }
}
