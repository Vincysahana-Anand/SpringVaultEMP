import {
  getFirestore,
  runTransaction,
  collection,
  doc,
  deleteField,
} from '@react-native-firebase/firestore';

import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { Order } from './orderService';
import { getISTDate } from '../utils/dateUtils';
import { PurchaseRecord } from './purchaseHistoryService';
import { DailyRecordEntry } from './dailyRecordService';
import { SalesRecord } from './salesService';

export type CompleteDeliveryParams = {
  order: Order;
  fullBottlesDelivered: number;
  emptyBottlesCollected: number;
  amountPaid: number;
  paymentMethod: 'cash' | 'online';
  paymentRef?: string;
};

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDeliveredAt = (d: Date) => {
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export async function completeDeliveryTransaction(
  params: CompleteDeliveryParams
): Promise<
  | {
      ok: true;
      deliveredAt: string;
      remainingQuantity: number;
    }
  | ServiceError
> {
  try {
    const { order, fullBottlesDelivered, emptyBottlesCollected, amountPaid, paymentMethod, paymentRef } = params;

    if (!order?.id) {
      return { code: 'invalid-argument', message: '[completeDeliveryTransaction] Missing order.id' };
    }

    const db = getFirestore();

    const deliveredDate = getISTDate();
    const deliveredAt = formatDeliveredAt(deliveredDate);
    const dateKey = formatDateKey(deliveredDate);

    const orderRef = doc(db, 'orders', order.id);
    const customerRef = doc(db, 'customers', order.customerId);
    const stockRef = doc(db, 'stocks', order.productId);
    const salesRef = doc(db, 'sales', dateKey);
    const purchaseHistoryRef = doc(db, 'purchaseHistory', order.customerId);
    const dailyRecordRef = doc(db, 'dailyRecord', order.productId);

    const isDeliveredCan = !!(
      order.productName &&
      order.productName.toLowerCase().includes('20') &&
      order.productName.toLowerCase().includes('liter')
    );

    const getUnitPriceForCustomer = (customerData: any, stockData: any, productId: string) => {
      const stockFallback = Number(stockData?.price ?? 0) || 0;
      const getNum = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      if (productId === '1L_CASE') {
        const custom = customerData?.['1lPrice'];
        const n = getNum(custom);
        return n > 0 ? n : stockFallback;
      }
      if (productId === '500ML_CASE') {
        const custom = customerData?.['500mlPrice'];
        const n = getNum(custom);
        return n > 0 ? n : stockFallback;
      }
      if (productId === '300ML_CASE') {
        const custom = customerData?.['300mlPrice'];
        const n = getNum(custom);
        return n > 0 ? n : stockFallback;
      }

      const n = getNum(customerData?.price);
      return n > 0 ? n : stockFallback;
    };

    const result = await runTransaction(db, async (tx) => {
      const [orderSnap, customerSnap, stockSnap, salesSnap, purchaseHistorySnap, dailyRecordSnap] =
        await Promise.all([
          tx.get(orderRef),
          tx.get(customerRef),
          tx.get(stockRef),
          tx.get(salesRef),
          tx.get(purchaseHistoryRef),
          tx.get(dailyRecordRef),
        ]);

      if (!orderSnap.exists()) {
        throw new Error('Order not found');
      }
      if (!customerSnap.exists()) {
        throw new Error('Customer not found');
      }
      if (!stockSnap.exists()) {
        throw new Error('Stock not found');
      }

      const orderData = orderSnap.data() as any;
      const customerData = customerSnap.data() as any;
      const stockData = stockSnap.data() as any;

      const originalOrderQuantity = Number(orderData?.quantity ?? order.quantity ?? 0) || 0;
      const remainingQuantity = Math.max(originalOrderQuantity - fullBottlesDelivered, 0);

      const customerBalance = Number(customerData?.balance ?? 0) || 0;
      const unitPrice = getUnitPriceForCustomer(customerData, stockData, order.productId);

      const billAmount = customerBalance + unitPrice * fullBottlesDelivered;
      const newCustomerBalance = billAmount - amountPaid;

      const canHolding = Number(customerData?.canHolding ?? 0) || 0;
      const currentExtraCanHolding = Number(customerData?.extraCanHolding ?? 0) || 0;
      const currentTotalCans = canHolding + currentExtraCanHolding;
      const newTotalCans = currentTotalCans + fullBottlesDelivered - emptyBottlesCollected;
      const newExtraCanHolding = newTotalCans - canHolding;

      const currentQuantity = Number(stockData?.quantity ?? 0) || 0;
      const currentEmpty = Number(stockData?.empty ?? 0) || 0;
      const currentExtraCan = Number(stockData?.extraCan ?? 0) || 0;

      if (fullBottlesDelivered > currentQuantity) {
        throw new Error(`Insufficient stock. Available: ${currentQuantity}`);
      }

      const newQuantity = currentQuantity - fullBottlesDelivered;
      const newEmpty = currentEmpty + emptyBottlesCollected;
      const newStockExtraCan = currentExtraCan + fullBottlesDelivered - emptyBottlesCollected;

      // Update customer
      tx.update(customerRef, {
        balance: newCustomerBalance,
        extraCanHolding: newExtraCanHolding,
      });

      // Update stock
      tx.update(stockRef, {
        quantity: newQuantity,
        empty: newEmpty,
        extraCan: newStockExtraCan,
      });

      // Purchase history
      const purchaseRecord: PurchaseRecord = {
        product: order.productName,
        deliveredQty: fullBottlesDelivered,
        emptyQty: emptyBottlesCollected,
        orderedAt: order.orderedAt || (orderData?.orderedAt ?? ''),
        deliveredAt,
        billAmount,
        amountPaid,
        paymentMethod,
        paymentRef: paymentMethod === 'online' ? parseInt(paymentRef || '0', 10) || 0 : 0,
      };

      if (purchaseHistorySnap.exists()) {
        // keep the latest 20 records only for a customer to prevent unbounded growth
        const existingData = purchaseHistorySnap.data() as any;
        const existingPurchases = (existingData?.purchases as PurchaseRecord[]) || [];
        const updatedPurchases = [...existingPurchases, purchaseRecord].slice(-20);
        tx.update(purchaseHistoryRef, {
          purchases: updatedPurchases,
        });
      } else {
        tx.set(purchaseHistoryRef, {
          purchases: [purchaseRecord],
        });
      }

      // Sales record (daily aggregate)
      const saleAmount = unitPrice * fullBottlesDelivered;
      const pendingPaymentReceived = saleAmount < amountPaid ? amountPaid - saleAmount : 0;
      const cashPaidValue = paymentMethod === 'cash' ? Number(amountPaid - pendingPaymentReceived) : 0;
      const onlinePaidValue = paymentMethod === 'online' ? Number(amountPaid - pendingPaymentReceived) : 0;

      if (salesSnap.exists()) {
        const existing = salesSnap.data() as SalesRecord;
        const updated: SalesRecord = {
          totalSale: Number(existing.totalSale || 0) + saleAmount,
          cashPayment: Number(existing.cashPayment || 0) + cashPaidValue,
          onlinePayment: Number(existing.onlinePayment || 0) + onlinePaidValue,
          expense: Number(existing.expense || 0),
          orders: Number(existing.orders || 0) + 0,
          delivered: Number(existing.delivered || 0) + 1,
          deliveredCans: Number(existing.deliveredCans || 0) + (isDeliveredCan ? fullBottlesDelivered : 0),
          emptyCollected: Number(existing.emptyCollected || 0) + emptyBottlesCollected,
          pendingPaymentReceived: Number(existing.pendingPaymentReceived || 0) + pendingPaymentReceived,
          cashBillsPayment: Number(existing.cashBillsPayment || 0) + (paymentMethod === 'cash' ? Number(pendingPaymentReceived) : 0),
          onlineBillsPayment: Number(existing.onlineBillsPayment || 0) + (paymentMethod === 'online' ? Number(pendingPaymentReceived) : 0),
          emptyReturned: Number(existing.emptyReturned || 0) + 0,
        };
        tx.set(salesRef, updated, { merge: true });
      } else {
        const newRec: SalesRecord = {
          totalSale: saleAmount,
          cashPayment: cashPaidValue,
          onlinePayment: onlinePaidValue,
          expense: 0,
          orders: 0,
          delivered: 1,
          deliveredCans: isDeliveredCan ? fullBottlesDelivered : 0,
          emptyCollected: emptyBottlesCollected,
          pendingPaymentReceived,
          cashBillsPayment:  (paymentMethod === 'cash' ? Number(pendingPaymentReceived) : 0),
          onlineBillsPayment:  (paymentMethod === 'online' ? Number(pendingPaymentReceived) : 0),
          emptyReturned: 0,
        };
        tx.set(salesRef, newRec, { merge: true });
      }

      // Daily record
      const dailyRecordEntry: DailyRecordEntry = {
        customerId: order.customerId,
        customerName: order.customerName,
        customerAddress: order.address,
        customerMobile: order.mobile,
        product: order.productName,
        orderedAt: order.orderedAt || (orderData?.orderedAt ?? ''),
        deliveredAt,
        orderedQty: originalOrderQuantity,
        deliveredQty: fullBottlesDelivered,
        emptyQty: emptyBottlesCollected,
        billAmount,
        saleAmount,
        amountPaid,
        paymentMethod,
        paymentRef: paymentMethod === 'online' ? parseInt(paymentRef || '0', 10) || 0 : 0,
        pendingPaymentReceived,
      };

      if (dailyRecordSnap.exists()) {
        const data = dailyRecordSnap.data() as any;
        console.log('existing dailyRecordSnap:', dailyRecordSnap);
        //find the data before 45 days from the dateKey and remove it from the data base only if the order.productId is 20L_CAN 
        const cutoffDate = new Date(deliveredDate);
        cutoffDate.setDate(cutoffDate.getDate() - 45);
        const cutoffDateKey = formatDateKey(cutoffDate);
        console.log('cutoffDateKey:', cutoffDateKey);
        const cleanupPayload: Record<string, any> = {};
        //data befor the cutoff date will be removed only for 20L_CAN product
        if (order.productId === '20L_CAN') {
          for (const key in data) {
            if (key < cutoffDateKey) {
              console.log('removing daily record for date:', key);
              cleanupPayload[key] = deleteField();
            }
          }
        }
        const existingEntries = (data?.[dateKey] as DailyRecordEntry[]) || [];
        tx.set(
          dailyRecordRef,
          {
            ...cleanupPayload,
            [dateKey]: [...existingEntries, dailyRecordEntry],
          },
          { merge: true }
        );
      } else {
        console.log('new dailyRecordSnap:', dailyRecordSnap);
        tx.set(dailyRecordRef, { [dateKey]: [dailyRecordEntry] });
      }

      // Partial delivery: create a new pending order for remaining qty
      if (remainingQuantity > 0 && fullBottlesDelivered < originalOrderQuantity) {
        const newOrderTimestamp = getISTDate();
        const formattedNewOrderedAt = formatDeliveredAt(newOrderTimestamp);
        const newOrderRef = doc(collection(db, 'orders'));

        const newOrderPayload: Order = {
          customerId: order.customerId,
          customerName: order.customerName,
          productId: order.productId,
          productName: order.productName,
          quantity: remainingQuantity,
          paymentMethod: order.paymentMethod || 'Pending',
          amountPaid: 0,
          orderedAt: formattedNewOrderedAt,
          address: order.address,
          mobile: order.mobile,
          timeStamp: newOrderTimestamp,
        };

        tx.set(newOrderRef, newOrderPayload);
      }

      // Delete the original order at the end
      tx.delete(orderRef);

      return {
        ok: true as const,
        deliveredAt,
        remainingQuantity,
      };
    });

    return result;
  } catch (error) {
    console.log('Error in completeDeliveryTransaction:', error);
    return handleServiceError(error, 'completeDeliveryTransaction');
  }
}
