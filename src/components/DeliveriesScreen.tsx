import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  BackHandler,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getOrders, Order, addOrder, updateOrder, deleteOrder } from '../services/orderService';
import { getStocks, getStockById, Stock, updateStock } from '../services/stockService';
import { getCustomerById, getCustomers, Customer, updateCustomer } from '../services/customerService';
import { getDailyRecordsByDate, DailyRecordEntry } from '../services/dailyRecordService';
import { completeDeliveryTransaction } from '../services/deliveryService';
import { COUNTER_SALES_CUSTOMER_ID, COUNTER_SALES_CUSTOMER_NAME } from '../services/counterSaleService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getISTDate } from '../utils/dateUtils';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { showError, showSuccess } from '../shared/feedback/messageBus';
import DropletLoader from './DropletLoader';

type DeliveryTab = 'pending' | 'delivered';

type PendingProductFilter = 'all' | '20L' | '1L' | '500ml' | '300ml';

interface DeliveriesScreenProps {
  userRole?: 'owner' | 'employee';
  isAdmin?: boolean;
}

export default function DeliveriesScreen({ userRole = 'employee', isAdmin = false }: DeliveriesScreenProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [filteredCompletedDeliveries, setFilteredCompletedDeliveries] = useState<DailyRecordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingPending, setRefreshingPending] = useState(false);
  const [refreshingCompleted, setRefreshingCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<DeliveryTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingProductFilter, setPendingProductFilter] = useState<PendingProductFilter>('all');
  const [showPendingFilterModal, setShowPendingFilterModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showDeliveryPage, setShowDeliveryPage] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [fullBottlesDelivered, setFullBottlesDelivered] = useState('0');
  const [emptyBottlesCollected, setEmptyBottlesCollected] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditPage, setShowEditPage] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editProductId, setEditProductId] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [, setLoadingCustomers] = useState(false);
  const [selectedCustomerData, setSelectedCustomerData] = useState<Customer | null>(null);
  const [selectedStockData, setSelectedStockData] = useState<Stock | null>(null);
  const [completedDeliveries, setCompletedDeliveries] = useState<DailyRecordEntry[]>([]);
  const [selectedCompletedDelivery, setSelectedCompletedDelivery] = useState<DailyRecordEntry | null>(null);
  const [showPendingFilterPage, setShowPendingFilterPage] = useState(false);

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (activeTab === 'delivered') {
      loadCompletedDeliveries();
    }
  }, [activeTab]);

  useEffect(() => {
    filterOrders();
  }, [searchQuery, orders, completedDeliveries, customers, activeTab, pendingProductFilter]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showPendingFilterPage) {
        setShowPendingFilterPage(false);
        return true;
      }
      if (showEditPage || showEditModal) {
        handleCloseEditModal();
        return true;
      }
      if (showDeliveryPage || showDeliveryModal) {
        handleCloseDeliveryModal();
        return true;
      }
      if (showPendingFilterModal) {
        setShowPendingFilterModal(false);
        return true;
      }
      if (selectedCompletedDelivery) {
        setSelectedCompletedDelivery(null);
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [
    selectedCompletedDelivery,
    showDeliveryModal,
    showDeliveryPage,
    showEditModal,
    showEditPage,
    showPendingFilterModal,
    showPendingFilterPage,
  ]);

  useEffect(() => {
    if (selectedOrder) {
      const customer = customers.find((c) => c.id === selectedOrder.customerId) || null;
      setSelectedCustomerData(customer);
    } else {
      setSelectedCustomerData(null);
    }
  }, [selectedOrder, customers]);

  const getUnitPriceForCustomer = (
    customer: Customer | null,
    productId: string | undefined,
    fallbackStockPrice: number
  ) => {
    const stockFallback = Number(fallbackStockPrice ?? 0) || 0;
    if (!customer || !productId) return stockFallback;

    const c: any = customer;
    const getNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    if (productId === '1L_CASE') {
      const custom = c['1lPrice'];
      const n = getNum(custom);
      return n > 0 ? n : stockFallback;
    }
    if (productId === '500ML_CASE') {
      const custom = c['500mlPrice'];
      const n = getNum(custom);
      return n > 0 ? n : stockFallback;
    }
    if (productId === '300ML_CASE') {
      const custom = c['300mlPrice'];
      const n = getNum(custom);
      return n > 0 ? n : stockFallback;
    }

    // Default (20L and any other products): use the regular customer price.
    const n = getNum((c as any).price);
    return n > 0 ? n : stockFallback;
  };

  const parsedFullBottlesForBill = parseInt(fullBottlesDelivered || '0', 10) || 0;
  const billCustomerBalance = Number(selectedCustomerData?.balance ?? 0) || 0;
  const billStockPrice = Number(
    selectedStockData?.price ?? products.find((p: Stock) => p.id === selectedOrder?.productId)?.price ?? 0
  ) || 0;
  const billCustomerUnitPrice = getUnitPriceForCustomer(
    selectedCustomerData,
    selectedOrder?.productId,
    billStockPrice
  );
  const billAmount = billCustomerBalance + billCustomerUnitPrice * parsedFullBottlesForBill;
  
  // Debug bill calculation
  if (showDeliveryModal && parsedFullBottlesForBill > 0) {
    console.log('Bill calculation debug:', {
      parsedFullBottlesForBill,
      billCustomerBalance,
      billCustomerUnitPrice,
      billAmount,
      calculated: billCustomerBalance + billCustomerUnitPrice * parsedFullBottlesForBill,
    });
  }

  const loadOrders = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const result = await getOrders();
      if (Array.isArray(result)) {
        // Sort by orderedAt time in descending order (latest first)
        const sorted = result.sort((a, b) => {
          const dateA = new Date(a.timeStamp || 0).getTime();
          const dateB = new Date(b.timeStamp || 0).getTime();
          return dateB - dateA;
        });
        setOrders(sorted);
      } else {
        const err = handleServiceError(result, 'getOrders');
        showError(err.message);
      }
    } catch (error) {
      const err = handleServiceError(error, 'loadOrders');
      showError(err.message);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const getCustomerFullAddress = (customer?: Customer | null) => {
    const parts = [customer?.doorNumber, customer?.floor, customer?.street, customer?.area].filter(Boolean);
    return parts.join(', ');
  };

  const filterOrders = () => {
    const q = searchQuery.trim().toLowerCase();

    // Pending list
    let pendingFiltered = orders;

    if (q) {
      pendingFiltered = pendingFiltered.filter((order) => {
        const customer = customers.find((c) => c.id === order.customerId) || null;
        const address = String(order.address || getCustomerFullAddress(customer) || '').toLowerCase();
        const mobile = String(order.mobile || customer?.mobile || '');
        const altContacts = customer?.alternateContacts || [];

        if (String(order.customerName || '').toLowerCase().includes(q)) return true;
        if (mobile.includes(q)) return true;
        if (address.includes(q)) return true;
        if (String(order.productName || '').toLowerCase().includes(q)) return true;
        if (altContacts.some((c) => String(c || '').includes(q))) return true;
        return false;
      });
    }

    if (pendingProductFilter !== 'all') {
      const normalizeOrderProduct = (name?: string): PendingProductFilter | '' => {
        const lowerName = (name || '').toLowerCase();
        if (lowerName.includes('20') && lowerName.includes('liter')) return '20L';
        if (lowerName.includes('1') && lowerName.includes('liter')) return '1L';
        if (lowerName.includes('500') && lowerName.includes('ml')) return '500ml';
        if (lowerName.includes('300') && lowerName.includes('ml')) return '300ml';
        return '';
      };

      pendingFiltered = pendingFiltered.filter((order) => normalizeOrderProduct(order.productName) === pendingProductFilter);
    }

    setFilteredOrders(pendingFiltered);

    // Completed list
    let completedFiltered = completedDeliveries;
    if (q) {
      completedFiltered = completedFiltered.filter((entry) => {
        const customer = customers.find((c) => c.id === entry.customerId) || null;
        const address = String(entry.customerAddress || getCustomerFullAddress(customer) || '').toLowerCase();
        const mobile = String(entry.customerMobile || customer?.mobile || '');
        const altContacts = customer?.alternateContacts || [];

        if (String(entry.customerName || '').toLowerCase().includes(q)) return true;
        if (mobile.includes(q)) return true;
        if (address.includes(q)) return true;
        if (String(entry.product || '').toLowerCase().includes(q)) return true;
        if (altContacts.some((c) => String(c || '').includes(q))) return true;
        return false;
      });
    }

    setFilteredCompletedDeliveries(completedFiltered);
  };

  const onRefreshPending = async () => {
    try {
      setRefreshingPending(true);
      await Promise.all([loadOrders({ silent: true }), loadProducts(), loadCustomers()]);
    } finally {
      setRefreshingPending(false);
    }
  };

  const onRefreshCompleted = async () => {
    try {
      setRefreshingCompleted(true);
      await Promise.all([loadCompletedDeliveries({ silent: true }), loadCustomers()]);
    } finally {
      setRefreshingCompleted(false);
    }
  };

  const handleCompleteDelivery = async (order: Order) => {
    if (!order.id) return;
    setSelectedOrder(order);
    setFullBottlesDelivered(order.quantity?.toString() || '0');
    setEmptyBottlesCollected('0');
    setAmountPaid('0');
    setPaymentMethod('cash');
    setPaymentRef('');

    if (userRole === 'employee' && !isAdmin) {
      setShowDeliveryPage(true);
      setShowDeliveryModal(false);
    } else {
      setShowDeliveryModal(true);
      setShowDeliveryPage(false);
    }

    // Fetch only the customer and stock needed for this delivery.
    try {
      const [customerResult, stockResult] = await Promise.all([
        getCustomerById(order.customerId),
        getStockById(order.productId),
      ]);

      if (customerResult && typeof customerResult === 'object' && 'code' in customerResult && 'message' in customerResult) {
        const err = handleServiceError(customerResult, 'getCustomerById');
        showError(err.message);
      } else {
        setSelectedCustomerData(customerResult);
      }

      if (stockResult && typeof stockResult === 'object' && 'code' in stockResult && 'message' in stockResult) {
        const err = handleServiceError(stockResult, 'getStockById');
        showError(err.message);
      } else {
        setSelectedStockData(stockResult);
      }
    } catch (error) {
      const err = handleServiceError(error, 'loadCustomerForModal');
      showError(err.message);
    }
  };

  const handleCloseDeliveryModal = () => {
    setShowDeliveryModal(false);
    setShowDeliveryPage(false);
    setSelectedOrder(null);
    setFullBottlesDelivered('0');
    setEmptyBottlesCollected('0');
    setAmountPaid('0');
    setPaymentMethod('cash');
    setPaymentRef('');
    setSelectedCustomerData(null);
    setSelectedStockData(null);
  };

  const handleSubmitDelivery = async () => {
    if (!selectedOrder?.id) return;

    // Set submitting immediately to prevent multiple clicks
    setSubmitting(true);

    // Validate full bottles delivered (mandatory)
    const fullBottles = parseInt(fullBottlesDelivered || '0', 10);
    if (isNaN(fullBottles) || fullBottles <= 0) {
      showError('Please enter at least 1 full water bottle delivered', { title: 'Validation' });
      setSubmitting(false);
      return;
    }

    // If online payment, ensure reference is provided
    if (paymentMethod === 'online' && !paymentRef.trim()) {
      showError('Please enter UTR / UPI Transaction ID for online payments', { title: 'Validation' });
      setSubmitting(false);
      return;
    }

    // Calculate can holding delta (20L cans in customer possession)
    const emptyBottles = Math.max(0, parseInt(emptyBottlesCollected?.trim() || '0', 10) || 0);
    const amountPaidValue = Math.max(0, parseInt(amountPaid?.trim() || '0', 10) || 0);
    
    // Fetch customer data to get canHolding, extraCanHolding, price, and balance
    let customer = selectedCustomerData || customers.find((c) => c.id === selectedOrder.customerId) || null;
    if (!customer) {
      const customerResult = await getCustomerById(selectedOrder.customerId);
      if (customerResult && typeof customerResult === 'object' && 'code' in customerResult && 'message' in customerResult) {
        const err = handleServiceError(customerResult, 'getCustomerById');
        showError(err.message);
        setSubmitting(false);
        return;
      }
      customer = customerResult;
      setSelectedCustomerData(customerResult);
    }
    
    if (!customer) {
      setSubmitting(false);
      showError('Customer not found');
      return;
    }
    
    // Fetch stock details for the product (used for both validation and pricing fallback)
    let currentStock = selectedStockData || products.find((p: Stock) => p.id === selectedOrder.productId) || null;
    if (!currentStock) {
      const stockResult = await getStockById(selectedOrder.productId);
      if (stockResult && typeof stockResult === 'object' && 'code' in stockResult && 'message' in stockResult) {
        const err = handleServiceError(stockResult, 'getStockById');
        showError(err.message);
        setSubmitting(false);
        return;
      }
      currentStock = stockResult;
      setSelectedStockData(stockResult);
    }

    if (!currentStock) {
      setSubmitting(false);
      showError('Stock not found for this product');
      return;
    }

    const stockQtyAvailable = Number(currentStock.quantity ?? 0) || 0;
    if (stockQtyAvailable <= 0) {
      showError('Insufficient stock. Available: 0', { title: 'Stock' });
      setSubmitting(false);
      return;
    }
    if (stockQtyAvailable < fullBottles) {
      showError(`Insufficient stock. Available: ${stockQtyAvailable}`, { title: 'Stock' });
      setSubmitting(false);
      return;
    }

    const customerBalance = Number(customer.balance ?? 0) || 0;
    const unitPrice = getUnitPriceForCustomer(customer, selectedOrder.productId, Number(currentStock.price ?? 0) || 0);
    const billAmountValue = customerBalance + unitPrice * fullBottles;
    const newCustomerBalance = billAmountValue - amountPaidValue;
    
    // canHolding: number of cans customer SHOULD have
    // extraCanHolding: number of EXTRA cans customer is currently holding
    const canHolding = customer.canHolding ?? 0;
    const currentExtraCanHolding = customer.extraCanHolding ?? 0;
    
    // Total cans currently with customer
    const currentTotalCans = canHolding + currentExtraCanHolding;
    
    // Calculate new total cans after delivery
    const newTotalCans = currentTotalCans + fullBottles - emptyBottles;
    
    // Calculate new extra can holding (can be negative if customer owes cans)
    const newExtraCanHolding = newTotalCans - canHolding;
    console.log('selectedOrder', selectedOrder);
    console.log('Can holding calculation', {
      customerName: selectedOrder.customerName,
      canHolding: canHolding, // Should have
      currentExtraCanHolding: currentExtraCanHolding, // Currently holding extra
      currentTotalCans: currentTotalCans, // Total cans with customer now
      fullBottlesDelivered: fullBottles,
      emptyBottlesCollected: emptyBottles,
      newTotalCans: newTotalCans, // Total cans after delivery
      newExtraCanHolding: newExtraCanHolding, // New extra cans (positive = extra, negative = owed)
      amountPaid: amountPaidValue,
    });

    console.log('Billing calculation', {
      customerName: selectedOrder.customerName,
      customerBalance,
      unitPrice,
      fullBottlesDelivered: fullBottles,
      billAmount: billAmountValue,
      amountPaid: amountPaidValue,
      newCustomerBalance,
    });

    // Calculate new stock values
    const currentQuantity = currentStock.quantity || 0;
    const currentEmpty = currentStock.empty || 0;
    const currentExtraCan = currentStock.extraCan || 0;
    
    // Stock calculation logic:
    // 1. Quantity: reduce by full bottles delivered
    const newQuantity = currentQuantity - fullBottles;
    
    // 2. Empty: increase by empty bottles collected
    const newEmpty = currentEmpty + emptyBottles;
    
    // 3. ExtraCan: increase by full bottles delivered, decrease by empty bottles collected
    const newStockExtraCan = currentExtraCan + fullBottles - emptyBottles;

    console.log('Stock update calculation', {
      productName: currentStock.productName,
      currentQuantity: currentQuantity,
      currentEmpty: currentEmpty,
      currentExtraCan: currentExtraCan,
      fullBottlesDelivered: fullBottles,
      emptyBottlesCollected: emptyBottles,
      newQuantity: newQuantity,
      newEmpty: newEmpty,
      newStockExtraCan: newStockExtraCan,
    });

    // LEGACY (non-atomic) implementation kept for reference.
    // It performed a sequence of independent writes across multiple documents.
    // This is intentionally replaced by an all-or-nothing Firestore transaction.
    //
    // try {
    //   ... updateCustomer -> updateStock -> addPurchaseHistory -> addOrder (partial) -> updateSalesRecord -> addDailyRecord -> deleteOrder
    // } catch (error) { ... }

    try {
      const txResult = await completeDeliveryTransaction({
        order: selectedOrder,
        fullBottlesDelivered: fullBottles,
        emptyBottlesCollected: emptyBottles,
        amountPaid: amountPaidValue,
        paymentMethod,
        paymentRef,
      });

      if (txResult && typeof txResult === 'object' && 'code' in txResult && 'message' in txResult) {
        const err = handleServiceError(txResult, 'completeDeliveryTransaction');
        showError(err.message);
        setSubmitting(false);
        return;
      }

      await loadOrders();
      setSubmitting(false);
      handleCloseDeliveryModal();
      showSuccess('Delivery completed successfully');
    } catch (error) {
      console.error('Error in handleSubmitDelivery:', error);
      const err = handleServiceError(error, 'completeDeliveryTransaction');
      showError(err.message);
      setSubmitting(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const result = await getStocks();
      if (Array.isArray(result)) {
        setProducts(result);
      } else {
        const err = handleServiceError(result, 'getStocks');
        showError(err.message);
      }
    } catch (error) {
      const err = handleServiceError(error, 'loadProducts');
      showError(err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const result = await getCustomers();
      if (Array.isArray(result)) {
        setCustomers(result);
      } else {
        const err = handleServiceError(result, 'getCustomers');
        showError(err.message);
      }
    } catch (error) {
      const err = handleServiceError(error, 'loadCustomers');
      showError(err.message);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadCompletedDeliveries = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const today = getISTDate();
      // Format date as yyyy-MM-dd
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const result = await getDailyRecordsByDate(dateStr);
      if (Array.isArray(result)) {
        const normalizeName = (name: string | undefined) =>
          (name || '').replace(/\s+/g, '').toLowerCase();

        const counterNameNorm = normalizeName(COUNTER_SALES_CUSTOMER_NAME);

        const filtered = result.filter((entry) => {
          const deliveredQty = Number((entry as any).deliveredQty ?? 0) || 0;
          if (deliveredQty <= 0) return false;

          if (entry.customerId === COUNTER_SALES_CUSTOMER_ID) return false;

          const nameNorm = normalizeName(entry.customerName);
          if (nameNorm === 'countersale') return false;
          if (nameNorm === 'countersales') return false;
          if (nameNorm === counterNameNorm) return false;

          return true;
        });

        // Reverse to show latest first
        setCompletedDeliveries([...filtered].reverse());
      } else {
        const err = handleServiceError(result, 'getDailyRecordsByDate');
        showError(err.message);
        setCompletedDeliveries([]);
      }
    } catch (error) {
      const err = handleServiceError(error, 'loadCompletedDeliveries');
      showError(err.message);
      setCompletedDeliveries([]);
      setFilteredCompletedDeliveries([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const formatProductName = (name: string): string => {
    if (!name) return '';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('20') && lowerName.includes('liter')) {
      if (lowerName.includes('party')) return '20L-P';
      return '20L';
    }
    if (lowerName.includes('1') && lowerName.includes('liter')) return '1L';
    if (lowerName.includes('500') && lowerName.includes('ml')) return '500ml';
    if (lowerName.includes('300') && lowerName.includes('ml')) return '300ml';
    return name;
  };

  const getFilteredProducts = (order: Order) => {
    if (!products || products.length === 0) return [];
    // Default to 'Residence' if customerType is not available in order
    const customerType = 'Residence'; // Since Order doesn't have customerType, use default
    let filtered = products.filter((product: Stock) => {
      const name = product.productName.toLowerCase();
      if (customerType === 'Residence') {
        return !name.includes('party');
      } else {
        return !name.includes('20') || name.includes('party');
      }
    });

    const getProductOrder = (name: string): number => {
      const lowerName = name.toLowerCase();
      if (lowerName.includes('20') && lowerName.includes('party')) return 2;
      if (lowerName.includes('20') && lowerName.includes('liter')) return 1;
      if (lowerName.includes('1') && lowerName.includes('liter')) return 3;
      if (lowerName.includes('500') && lowerName.includes('ml')) return 4;
      if (lowerName.includes('300') && lowerName.includes('ml')) return 5;
      return 6;
    };

    filtered.sort((a: Stock, b: Stock) => {
      return getProductOrder(a.productName) - getProductOrder(b.productName);
    });

    return filtered;
  };

  const handleEditOrder = (order: Order) => {
    if (!order.id) return;
    setEditingOrder(order);
    setEditProductId(order.productId || '');
    setEditProductName(order.productName || '');
    setEditQuantity(order.quantity?.toString() || '1');
    if (userRole === 'employee' && !isAdmin) {
      setShowEditPage(true);
      setShowEditModal(false);
    } else {
      setShowEditModal(true);
      setShowEditPage(false);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setShowEditPage(false);
    setEditingOrder(null);
    setEditProductId('');
    setEditProductName('');
    setEditQuantity('1');
  };

  const handleSubmitEdit = async () => {
    if (!editingOrder?.id) return;

    const quantity = parseInt(editQuantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      showError('Please enter a valid quantity', { title: 'Validation' });
      return;
    }

    if (!editProductId) {
      showError('Please select a product', { title: 'Validation' });
      return;
    }

    try {
      setSubmittingEdit(true);
      const updatedOrder = {
        ...editingOrder,
        productId: editProductId,
        productName: editProductName,
        quantity,
      };

      await updateOrder(editingOrder.id, updatedOrder);
      
      // Update local state
      setOrders(orders.map(o => o.id === editingOrder.id ? updatedOrder : o));
      
      handleCloseEditModal();
      showSuccess('Order updated successfully');
    } catch (error) {
      const err = handleServiceError(error, 'updateOrder');
      showError(err.message);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!order.id) return;

    Alert.alert(
      'Delete Order',
      `Delete order for ${order.customerName}?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              setDeleting(order.id!);
              await deleteOrder(order.id!);
              setOrders(orders.filter((o) => o.id !== order.id));
              showSuccess('Order deleted');
            } catch (error) {
              const err = handleServiceError(error, 'deleteOrder');
              showError(err.message);
            } finally {
              setDeleting(null);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleTabChange = (tab: DeliveryTab) => {
    setActiveTab(tab);
    setSearchQuery(''); // Clear search when switching tabs
  };

  const handleCallCustomer = (mobile: string) => {
    Linking.openURL(`tel:${mobile}`);
  };

  const renderDeliveryCard = ({ item }: { item: Order }) => (
    <View style={styles.deliveryCard}>
      {/* Customer Info */}
      <View style={styles.cardHeader}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <TouchableOpacity
            style={styles.phoneRow}
            onPress={() => handleCallCustomer(item.mobile || '')}
          >
            <MaterialCommunityIcons name="phone" size={16} color={colors.primary[500]} />
            <Text style={styles.phoneNumber}>{item.mobile}</Text>
          </TouchableOpacity>
          <Text style={styles.address}>{item.address}</Text>
        </View>
      </View>

      {/* Product Row with Actions */}
      <View style={styles.productActionRow}>
        {/* Product and Quantity */}
        <View style={styles.productContainer}>
          <MaterialCommunityIcons name="water" size={18} color={colors.primary[500]} />
          <Text style={styles.productName}>{item.productName}</Text>
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>{item.quantity}</Text>
          </View>
        </View>

        {/* Action Icons */}
        <View style={styles.actionIconsRow}>
          {/* Complete Delivery */}
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => handleCompleteDelivery(item)}
            disabled={deleting === item.id}
          >
            {deleting === item.id ? (
              <MaterialCommunityIcons name="loading" size={18} color={colors.success[500]} />
            ) : (
              <MaterialCommunityIcons name="truck-delivery" size={18} color={colors.success[500]} />
            )}
          </TouchableOpacity>

          {/* Edit - Only for Owner and Admin Employee */}
          {(userRole === 'owner' || (userRole === 'employee' && isAdmin)) && (
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={() => handleEditOrder(item)}
              disabled={deleting === item.id}
            >
              <MaterialCommunityIcons name="pencil" size={18} color={colors.primary[500]} />
            </TouchableOpacity>
          )}

          {/* Delete - Only for Owner and Admin Employee */}
          {(userRole === 'owner' || (userRole === 'employee' && isAdmin)) && (
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={() => handleDeleteOrder(item)}
              disabled={deleting === item.id}
            >
              <MaterialCommunityIcons name="trash-can" size={18} color={colors.danger[500]} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderCompletedCard = ({ item }: { item: DailyRecordEntry }) => {
    const customer = customers.find((c) => c.id === item.customerId) || null;
    const mobile = item.customerMobile || customer?.mobile || '';
    const address = item.customerAddress || getCustomerFullAddress(customer) || '';

    return (
    <TouchableOpacity
      style={styles.deliveryCard}
      onPress={() => setSelectedCompletedDelivery(item)}
      activeOpacity={0.7}
    >
      {/* Customer Info */}
      <View style={styles.cardHeader}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          {mobile ? <Text style={styles.customerMeta}>{mobile}</Text> : null}
          {address ? <Text style={styles.address}>{address}</Text> : null}
          <Text style={styles.address}>{item.product}</Text>
        </View>
      </View>

      {/* Product Row */}
      <View style={styles.productActionRow}>
        {/* Product and Quantity */}
        <View style={styles.productContainer}>
          <MaterialCommunityIcons name="water" size={18} color={colors.primary[500]} />
          <Text style={styles.productName}>Delivered: {item.deliveredQty}</Text>
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>Empty: {item.emptyQty}</Text>
          </View>
        </View>

        {/* Amount and Method */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountValue}>₹{item.amountPaid}</Text>
          <Text style={styles.methodBadge}>{item.paymentMethod}</Text>
        </View>
      </View>

      {/* Delivery Time */}
      <View style={styles.timeRow}>
        <MaterialCommunityIcons name="clock" size={14} color={colors.gray[500]} />
        <Text style={styles.timeText}>{item.deliveredAt}</Text>
      </View>
    </TouchableOpacity>
    );
  };

  if (showPendingFilterPage) {
    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setShowPendingFilterPage(false)} style={styles.detailBackButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.gray[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filter by Product</Text>
          <View style={styles.detailHeaderSpacer} />
        </View>

        <ScrollView style={styles.detailsContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
          <View style={styles.filterModalContent}>
            {(['all', '20L', '1L', '500ml', '300ml'] as PendingProductFilter[]).map((opt) => {
              const selected = opt === pendingProductFilter;
              const label = opt === 'all' ? 'All' : opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={styles.filterOptionRow}
                  onPress={() => {
                    setPendingProductFilter(opt);
                    setShowPendingFilterPage(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>
                    {label}
                  </Text>
                  {selected ? (
                    <MaterialCommunityIcons name="check" size={20} color={colors.primary[600]} />
                  ) : (
                    <View style={{ width: 20, height: 20 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: spacing[24] }} />
        </ScrollView>
      </View>
    );
  }

  if (showEditPage && editingOrder) {
    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={handleCloseEditModal} style={styles.detailBackButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.gray[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Order</Text>
          <View style={styles.detailHeaderSpacer} />
        </View>

        <ScrollView
          style={styles.detailsContent}
          contentContainerStyle={{ paddingBottom: spacing[24] }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalContent}>
            {/* Customer Info */}
            <View style={styles.customerInfoSection}>
              <Text style={styles.customerNameModal}>{editingOrder.customerName}</Text>
              <Text style={styles.productInfoModal}>{editingOrder.address}</Text>
            </View>

            {/* Product Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.modalLabel}>Product *</Text>
              {loadingProducts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                  <Text style={styles.loadingText}>Loading products...</Text>
                </View>
              ) : products.length === 0 ? (
                <Text style={styles.noProductsText}>No products available</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.productSelector}
                  contentContainerStyle={styles.productSelectorContent}
                >
                  {getFilteredProducts(editingOrder).map((product: Stock) => (
                    <TouchableOpacity
                      key={product.id}
                      style={[styles.productButton, editProductId === product.id && styles.productButtonActive]}
                      onPress={() => {
                        setEditProductId(product.id || '');
                        setEditProductName(formatProductName(product.productName));
                      }}
                      disabled={submittingEdit}
                    >
                      <Text style={[styles.productButtonText, editProductId === product.id && styles.productButtonTextActive]}>
                        {formatProductName(product.productName)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Quantity Input */}
            <View style={styles.formGroup}>
              <Text style={styles.modalLabel}>Quantity *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter quantity"
                placeholderTextColor={colors.gray[400]}
                value={editQuantity}
                onChangeText={setEditQuantity}
                keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                editable={!submittingEdit}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, submittingEdit && styles.submitButtonDisabled]}
              onPress={handleSubmitEdit}
              disabled={submittingEdit}
            >
              {submittingEdit ? (
                <ActivityIndicator color={colors.bg.white} size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Update Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (showDeliveryPage && selectedOrder) {
    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={handleCloseDeliveryModal} style={styles.detailBackButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.gray[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Complete Delivery</Text>
          <View style={styles.detailHeaderSpacer} />
        </View>

        <ScrollView
          style={styles.detailsContent}
          contentContainerStyle={{ paddingBottom: spacing[24] }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalContent}>
            {/* Customer Info */}
            <View style={styles.customerInfoSection}>
              <Text style={styles.customerNameModal}>{selectedOrder.customerName}</Text>
              <Text style={styles.productInfoModal}>{selectedOrder.address}</Text>
              <View style={styles.productBadgeContainer}>
                <View style={styles.productBadge}>
                  <Text style={styles.productBadgeText}>
                    {selectedOrder.productName} x {selectedOrder.quantity}
                  </Text>
                </View>
              </View>
            </View>

            {/* Full Bottles Delivered */}
            <View style={styles.formGroup}>
              <Text style={styles.modalLabel}>Full Water Bottles Delivered</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={colors.gray[400]}
                value={fullBottlesDelivered}
                onChangeText={setFullBottlesDelivered}
                keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                editable={!submitting}
              />
            </View>

            {/* Empty Bottles Collected - Only for 20L cans */}
            {selectedOrder.productName &&
              selectedOrder.productName.toLowerCase().includes('20') &&
              selectedOrder.productName.toLowerCase().includes('liter') && (
                <View style={styles.formGroup}>
                  <Text style={styles.modalLabel}>Empty Water Bottles Collected</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0"
                    placeholderTextColor={colors.gray[400]}
                    value={emptyBottlesCollected}
                    onChangeText={setEmptyBottlesCollected}
                    onFocus={() => {
                      if (emptyBottlesCollected === '0') {
                        setEmptyBottlesCollected('');
                      }
                    }}
                    onBlur={() => {
                      if (emptyBottlesCollected.trim() === '') {
                        setEmptyBottlesCollected('0');
                      }
                    }}
                    keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                    editable={!submitting}
                  />
                </View>
              )}

            {selectedCustomerData && (
              <View style={styles.billAmountRow}>
                <Text style={styles.billAmountLabel}>Bill Amount</Text>
                <Text style={styles.billAmountValue}>
                  Rs {parsedFullBottlesForBill > 0 ? billAmount : billCustomerBalance}
                </Text>
              </View>
            )}

            {/* Payment Method */}
            <View style={styles.formGroup}>
              <Text style={styles.modalLabel}>Payment Method</Text>
              <View style={styles.paymentMethodContainer}>
                <TouchableOpacity
                  style={[styles.paymentMethodButton, paymentMethod === 'cash' && styles.paymentMethodButtonActive]}
                  onPress={() => setPaymentMethod('cash')}
                  disabled={submitting}
                >
                  <Text style={[styles.paymentMethodText, paymentMethod === 'cash' && styles.paymentMethodTextActive]}>Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentMethodButton, paymentMethod === 'online' && styles.paymentMethodButtonActive]}
                  onPress={() => setPaymentMethod('online')}
                  disabled={submitting}
                >
                  <Text style={[styles.paymentMethodText, paymentMethod === 'online' && styles.paymentMethodTextActive]}>Online</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount Paid */}
            <View style={styles.formGroup}>
              <Text style={styles.modalLabel}>Amount</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={colors.gray[400]}
                value={amountPaid}
                onChangeText={setAmountPaid}
                onFocus={() => {
                  if (amountPaid === '0') {
                    setAmountPaid('');
                  }
                }}
                onBlur={() => {
                  if (amountPaid.trim() === '') {
                    setAmountPaid('0');
                  }
                }}
                keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                editable={!submitting}
              />
            </View>

            {/* UTR / UPI Transaction ID for online payments */}
            {paymentMethod === 'online' && (
              <View style={styles.formGroup}>
                <Text style={styles.modalLabel}>UTR / UPI Transaction ID *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter UTR / UPI Transaction ID"
                  placeholderTextColor={colors.gray[400]}
                  value={paymentRef}
                  onChangeText={(text) => setPaymentRef(text.replace(/[^0-9]/g, ''))}
                  editable={!submitting}
                  keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                />
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmitDelivery}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.bg.white} size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Complete Delivery</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Render content based on state
  let content;

  if (loading) {
    content = <DropletLoader visible={true} />;
  } else if (selectedCompletedDelivery) {
    // Show completed delivery details
    content = (
      <>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedCompletedDelivery(null)} style={styles.detailBackButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.gray[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Details</Text>
          <View style={styles.detailHeaderSpacer} />
        </View>

        {/* Details Content */}
        <ScrollView style={styles.detailsContent} showsVerticalScrollIndicator={false}>
          {/* Customer Card */}
          <View style={styles.detailCard}>
            <Text style={styles.detailSectionTitle}>Customer Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.customerName}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mobile</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.customerMobile || 'N/A'}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.customerAddress || 'N/A'}</Text>
            </View>
          </View>

          {/* Product Card */}
          <View style={styles.detailCard}>
            <Text style={styles.detailSectionTitle}>Product Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Product</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.product}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ordered Quantity</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.orderedQty || 0}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivered Quantity</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.deliveredQty}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Empty Collected</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.emptyQty}</Text>
            </View>
          </View>

          {/* Payment Card */}
          <View style={styles.detailCard}>
            <Text style={styles.detailSectionTitle}>Payment Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bill Amount</Text>
              <Text style={styles.detailValueAmount}>₹{selectedCompletedDelivery.billAmount}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount Paid</Text>
              <Text style={styles.detailValueAmount}>₹{selectedCompletedDelivery.amountPaid}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pending Payment Received</Text>
              <Text style={styles.detailValueAmount}>₹{selectedCompletedDelivery.pendingPaymentReceived}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <View style={styles.paymentMethodBadge}>
                <MaterialCommunityIcons
                  name={selectedCompletedDelivery.paymentMethod === 'online' ? 'credit-card' : 'cash'}
                  size={14}
                  color={colors.primary[600]}
                />
                <Text style={[styles.paymentMethodBadgeText, { marginLeft: spacing[6] }]}>
                  {selectedCompletedDelivery.paymentMethod === 'online' ? 'Online' : 'Cash'}
                </Text>
              </View>
            </View>
            {selectedCompletedDelivery.paymentRef !== undefined && selectedCompletedDelivery.paymentRef > 0 ? (
              <View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Reference</Text>
                  <Text style={styles.detailValue}>{selectedCompletedDelivery.paymentRef}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Timeline Card */}
          <View style={styles.detailCard}>
            <Text style={styles.detailSectionTitle}>Timeline</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ordered At</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.orderedAt}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivered At</Text>
              <Text style={styles.detailValue}>{selectedCompletedDelivery.deliveredAt}</Text>
            </View>
          </View>

          <View style={{ height: spacing[24] }} />
        </ScrollView>
      </>
    );
  } else {
    // Show main delivery list
    content = (
      <>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => handleTabChange('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'delivered' && styles.activeTab]}
          onPress={() => handleTabChange('delivered')}
        >
          <Text style={[styles.tabText, activeTab === 'delivered' && styles.activeTabText]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search + Filter Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.gray[400]} style={styles.searchIcon2} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTab === 'pending' ? 'pending' : 'delivered'} deliveries...`}
            placeholderTextColor={colors.gray[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>

        {activeTab === 'pending' && (
          <TouchableOpacity
            onPress={() => {
              if (userRole === 'employee' && !isAdmin) {
                setShowPendingFilterPage(true);
                setShowPendingFilterModal(false);
              } else {
                setShowPendingFilterModal(true);
                setShowPendingFilterPage(false);
              }
            }}
            style={styles.pendingFilterButton}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="filter-variant" size={18} color={colors.primary[600]} />
            <Text style={styles.pendingFilterButtonText}>
              {pendingProductFilter === 'all' ? 'All' : pendingProductFilter}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Deliveries List */}
      {activeTab === 'pending' ? (
        // Pending deliveries
        filteredOrders.length === 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.emptyContainer, { flexGrow: 1 }]}
            refreshControl={<RefreshControl refreshing={refreshingPending} onRefresh={onRefreshPending} />}
            showsVerticalScrollIndicator={false}
          >
            <MaterialCommunityIcons name="inbox-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No deliveries found' : 'No pending deliveries'}
            </Text>
            {searchQuery && (
              <Text style={styles.emptySubtext}>Try searching with a different keyword</Text>
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={filteredOrders}
            renderItem={renderDeliveryCard}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshingPending} onRefresh={onRefreshPending} />}
          />
        )
      ) : (
        // Delivered/Completed deliveries
        filteredCompletedDeliveries.length === 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.emptyContainer, { flexGrow: 1 }]}
            refreshControl={<RefreshControl refreshing={refreshingCompleted} onRefresh={onRefreshCompleted} />}
            showsVerticalScrollIndicator={false}
          >
            <MaterialCommunityIcons name="check-circle-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No deliveries found' : 'No deliveries completed today yet'}
            </Text>
            {searchQuery ? <Text style={styles.emptySubtext}>Try searching with a different keyword</Text> : null}
          </ScrollView>
        ) : (
          <FlatList
            data={filteredCompletedDeliveries}
            renderItem={renderCompletedCard}
            keyExtractor={(_, index) => `completed-${index}`}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshingCompleted} onRefresh={onRefreshCompleted} />}
          />
        )
      )}

      {/* Complete Delivery Modal */}
      <Modal
        visible={showDeliveryModal && !(userRole === 'employee' && !isAdmin)}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDeliveryModal}
      >
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={handleCloseDeliveryModal}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Complete Delivery</Text>
                <TouchableOpacity onPress={handleCloseDeliveryModal} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {selectedOrder && (
                  <>
                    {/* Customer Info */}
                    <View style={styles.customerInfoSection}>
                      <Text style={styles.customerNameModal}>{selectedOrder.customerName}</Text>
                      <Text style={styles.productInfoModal}>{selectedOrder.address}</Text>
                      <View style={styles.productBadgeContainer}>
                        <View style={styles.productBadge}>
                          <Text style={styles.productBadgeText}>
                            {selectedOrder.productName} x {selectedOrder.quantity}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Full Bottles Delivered */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Full Water Bottles Delivered</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        value={fullBottlesDelivered}
                        onChangeText={setFullBottlesDelivered}
                        keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                        editable={!submitting}
                      />
                    </View>

                    {/* Empty Bottles Collected - Only for 20L cans */}
                    {selectedOrder.productName && 
                      selectedOrder.productName.toLowerCase().includes('20') && 
                      selectedOrder.productName.toLowerCase().includes('liter') && (
                      <View style={styles.formGroup}>
                        <Text style={styles.modalLabel}>Empty Water Bottles Collected</Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="0"
                          placeholderTextColor={colors.gray[400]}
                          value={emptyBottlesCollected}
                          onChangeText={setEmptyBottlesCollected}
                          onFocus={() => {
                            if (emptyBottlesCollected === '0') {
                              setEmptyBottlesCollected('');
                            }
                          }}
                          onBlur={() => {
                            if (emptyBottlesCollected.trim() === '') {
                              setEmptyBottlesCollected('0');
                            }
                          }}
                          keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                          editable={!submitting}
                        />
                      </View>
                    )}

                    {selectedCustomerData && (
                      <View style={styles.billAmountRow}>
                        <Text style={styles.billAmountLabel}>Bill Amount</Text>
                        <Text style={styles.billAmountValue}>
                          Rs {parsedFullBottlesForBill > 0 ? billAmount : billCustomerBalance}
                        </Text>
                      </View>
                    )}

                    {/* Payment Method */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Payment Method</Text>
                      <View style={styles.paymentMethodContainer}>
                        <TouchableOpacity
                          style={[styles.paymentMethodButton, paymentMethod === 'cash' && styles.paymentMethodButtonActive]}
                          onPress={() => setPaymentMethod('cash')}
                          disabled={submitting}
                        >
                          <Text style={[styles.paymentMethodText, paymentMethod === 'cash' && styles.paymentMethodTextActive]}>Cash</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.paymentMethodButton, paymentMethod === 'online' && styles.paymentMethodButtonActive]}
                          onPress={() => setPaymentMethod('online')}
                          disabled={submitting}
                        >
                          <Text style={[styles.paymentMethodText, paymentMethod === 'online' && styles.paymentMethodTextActive]}>Online</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Amount Paid */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Amount</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        value={amountPaid}
                        onChangeText={setAmountPaid}
                        onFocus={() => {
                          if (amountPaid === '0') {
                            setAmountPaid('');
                          }
                        }}
                        onBlur={() => {
                          if (amountPaid.trim() === '') {
                            setAmountPaid('0');
                          }
                        }}
                        keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                        editable={!submitting}
                      />
                    </View>

                    {/* UTR / UPI Transaction ID for online payments */}
                    {paymentMethod === 'online' && (
                      <View style={styles.formGroup}>
                        <Text style={styles.modalLabel}>UTR / UPI Transaction ID *</Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="Enter UTR / UPI Transaction ID"
                          placeholderTextColor={colors.gray[400]}
                          value={paymentRef}
                          onChangeText={(text) => setPaymentRef(text.replace(/[^0-9]/g, ''))}
                          editable={!submitting}
                          keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                        />
                      </View>
                    )}

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        submitting && styles.submitButtonDisabled,
                      ]}
                      onPress={handleSubmitDelivery}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color={colors.bg.white} size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>Complete Delivery</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Order Modal */}
      <Modal
        visible={showEditModal && !(userRole === 'employee' && !isAdmin)}
        transparent
        animationType="fade"
        onRequestClose={handleCloseEditModal}
      >
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={handleCloseEditModal}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Order</Text>
                <TouchableOpacity onPress={handleCloseEditModal} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {editingOrder && (
                  <>
                    {/* Customer Info */}
                    <View style={styles.customerInfoSection}>
                      <Text style={styles.customerNameModal}>{editingOrder.customerName}</Text>
                      <Text style={styles.productInfoModal}>{editingOrder.address}</Text>
                    </View>

                    {/* Product Selection */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Product *</Text>
                      {loadingProducts ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                          <Text style={styles.loadingText}>Loading products...</Text>
                        </View>
                      ) : products.length === 0 ? (
                        <Text style={styles.noProductsText}>No products available</Text>
                      ) : (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.productSelector}
                          contentContainerStyle={styles.productSelectorContent}
                        >
                          {getFilteredProducts(editingOrder).map((product: Stock) => (
                            <TouchableOpacity
                              key={product.id}
                              style={[
                                styles.productButton,
                                editProductId === product.id && styles.productButtonActive,
                              ]}
                              onPress={() => {
                                setEditProductId(product.id || '');
                                setEditProductName(formatProductName(product.productName));
                              }}
                              disabled={submittingEdit}
                            >
                              <Text
                                style={[
                                  styles.productButtonText,
                                  editProductId === product.id && styles.productButtonTextActive,
                                ]}
                              >
                                {formatProductName(product.productName)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>

                    {/* Quantity Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Quantity *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter quantity"
                        placeholderTextColor={colors.gray[400]}
                        value={editQuantity}
                        onChangeText={setEditQuantity}
                        keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                        editable={!submittingEdit}
                      />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        submittingEdit && styles.submitButtonDisabled,
                      ]}
                      onPress={handleSubmitEdit}
                      disabled={submittingEdit}
                    >
                      {submittingEdit ? (
                        <ActivityIndicator color={colors.bg.white} size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>Update Order</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Pending Product Filter Modal */}
      <Modal
        visible={showPendingFilterModal && !(userRole === 'employee' && !isAdmin)}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPendingFilterModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPendingFilterModal(false)}>
          <Pressable style={styles.filterModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Product</Text>
              <TouchableOpacity
                onPress={() => setShowPendingFilterModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
              </TouchableOpacity>
            </View>

            {(['all', '20L', '1L', '500ml', '300ml'] as PendingProductFilter[]).map((opt) => {
              const selected = opt === pendingProductFilter;
              const label = opt === 'all' ? 'All' : opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={styles.filterOptionRow}
                  onPress={() => {
                    setPendingProductFilter(opt);
                    setShowPendingFilterModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>
                    {label}
                  </Text>
                  {selected ? (
                    <MaterialCommunityIcons name="check" size={20} color={colors.primary[600]} />
                  ) : (
                    <View style={{ width: 20, height: 20 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
      </>
    );
  }

  return (
    <View style={styles.container}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.light,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  searchIcon: {
    padding: spacing[8],
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[12],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary[500],
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[400],
  },
  activeTabText: {
    color: colors.primary[500],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    marginHorizontal: spacing[16],
    marginVertical: spacing[12],
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.white,
    paddingHorizontal: spacing[12],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon2: {
    marginRight: spacing[8],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[10],
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
  },
  clearButton: {
    padding: spacing[4],
  },
  pendingFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[12],
    ...elevation.sm,
  },
  pendingFilterButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  filterModalContent: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 360,
    ...elevation.lg,
  },
  filterOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterOptionText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
    fontWeight: typography.fontWeight.medium,
  },
  filterOptionTextSelected: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.bold,
  },
  listContent: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  deliveryCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  cardHeader: {
    marginBottom: spacing[12],
  },
  customerInfo: {
    gap: spacing[6],
  },
  customerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  phoneNumber: {
    fontSize: typography.fontSize.base,
    color: colors.primary[500],
  },
  address: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    lineHeight: 18,
  },
  customerMeta: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  productActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[12],
  },
  productContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flex: 1,
  },
  productName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  quantityBadge: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.bg.white,
  },
  amountContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
    marginBottom: spacing[4],
  },
  methodBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[500],
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    marginTop: spacing[8],
    paddingTop: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  actionIconsRow: {
    flexDirection: 'row',
    gap: spacing[8],
    alignItems: 'center',
  },
  actionIcon: {
    padding: spacing[6],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[24],
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[600],
    marginTop: spacing[16],
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
    marginTop: spacing[8],
    textAlign: 'center',
  },
  flex1: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[16],
  },
  modalContent: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...elevation.lg,
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  modalCloseButton: {
    padding: spacing[4],
  },
  customerInfoSection: {
    backgroundColor: colors.bg.light,
    padding: spacing[6],
    borderRadius: borderRadius.md,
    marginBottom: spacing[8],
  },
  customerNameModal: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[2],
  },
  productInfoModal: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
  },
  productBadgeContainer: {
    marginTop: spacing[4],
  },
  productBadge: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[10],
    alignSelf: 'flex-start',
  },
  productBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.bg.white,
  },
  formGroup: {
    marginBottom: spacing[8],
  },
  modalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[2],
  },
  modalInput: {
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    fontSize: typography.fontSize.sm,
    color: colors.gray[800],
  },
  billAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[8],
  },
  billAmountLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[700],
  },
  billAmountValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  submitButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[10],
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[8],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.bg.white,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
  },
  loadingText: {
    marginLeft: spacing[8],
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  noProductsText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    textAlign: 'center',
    paddingVertical: spacing[12],
  },
  productSelector: {
    maxHeight: 60,
  },
  productSelectorContent: {
    gap: spacing[8],
    paddingVertical: spacing[4],
  },
  productButton: {
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  productButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  productButtonTextActive: {
    color: colors.bg.white,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  paymentMethodButton: {
    flex: 1,
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[8],
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  paymentMethodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  paymentMethodTextActive: {
    color: colors.bg.white,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailBackButton: {
    padding: spacing[8],
    marginLeft: -spacing[8],
  },
  detailHeaderSpacer: {
    width: 40,
  },
  detailsContent: {
    flex: 1,
    backgroundColor: colors.bg.light,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  detailCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    ...elevation.sm,
  },
  detailSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    marginBottom: spacing[12],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    flex: 1,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    textAlign: 'right',
    flex: 1,
  },
  detailValueAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
    textAlign: 'right',
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing[4],
  },
  paymentMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: borderRadius.md,
  },
  paymentMethodBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
});
