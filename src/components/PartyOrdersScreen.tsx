import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
  Linking,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getCustomers } from '../services/customerService';
import { getStocks, Stock } from '../services/stockService';
import {
  addPartyDelivery,
  addPartyOrder,
  completePartyDeliveryTransaction,
  deletePartyOrder,
  getPartyDeliveries,
  getPartyOrders,
  updatePartyOrder,
  PartyDelivery,
  PartyOrder,
} from '../services/partyOrderService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { currencyINR } from '../utils/format';
import { getISTDate } from '../utils/dateUtils';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { showError, showSuccess } from '../shared/feedback/messageBus';
import DropletLoader from './DropletLoader';
import CustomerDetailsScreen from './CustomerDetailsScreen';
import EditCustomerScreen from './EditCustomerScreen';
import CustomerPurchaseHistoryScreen from './CustomerPurchaseHistoryScreen';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  doorNumber?: string;
  floor?: string;
  street?: string;
  area?: string;
  alternateContacts?: string[];
  advanceAmount?: number;
  canHolding?: number;
  extraCanHolding?: number;
  balance?: number;
  price?: number;
  '1lPrice'?: number;
  '500mlPrice'?: number;
  '300mlPrice'?: number;
  customerType?: string;
}

interface PartyOrdersScreenProps {
  allowCustomerDelete?: boolean;
  userRole?: 'owner' | 'employee';
  isAdmin?: boolean;
}

type PartyBadgeTab = 'customers' | 'orders' | 'history';

export default function PartyOrdersScreen({
  allowCustomerDelete = false,
  userRole = 'employee',
  isAdmin = false,
}: PartyOrdersScreenProps) {
  const [activeBadge, setActiveBadge] = useState<PartyBadgeTab>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [partyOrders, setPartyOrders] = useState<PartyOrder[]>([]);
  const [filteredPartyOrders, setFilteredPartyOrders] = useState<PartyOrder[]>([]);
  const [partyDeliveries, setPartyDeliveries] = useState<PartyDelivery[]>([]);
  const [filteredPartyDeliveries, setFilteredPartyDeliveries] = useState<PartyDelivery[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderCustomer, setOrderCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Stock[]>([]);
  const [productQuantities, setProductQuantities] = useState<Record<string, string>>({});
  const [requestedDate, setRequestedDate] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [showRequestedDatePicker, setShowRequestedDatePicker] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submittingDeliveryOrderId, setSubmittingDeliveryOrderId] = useState<string | null>(null);
  const [showPartyDeliveryModal, setShowPartyDeliveryModal] = useState(false);
  const [deliveringPartyOrder, setDeliveringPartyOrder] = useState<PartyOrder | null>(null);
  const [deliveryQtyInput, setDeliveryQtyInput] = useState('');
  const [submittingPartyDelivery, setSubmittingPartyDelivery] = useState(false);
  const quantityUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingPartyOrderId, setDeletingPartyOrderId] = useState<string | null>(null);
  const [showEditPartyOrderModal, setShowEditPartyOrderModal] = useState(false);
  const [editingPartyOrder, setEditingPartyOrder] = useState<PartyOrder | null>(null);
  const [editPartyOrderQty, setEditPartyOrderQty] = useState('1');
  const [editRequestedDate, setEditRequestedDate] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [showEditRequestedDatePicker, setShowEditRequestedDatePicker] = useState(false);
  const [submittingEditPartyOrder, setSubmittingEditPartyOrder] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const openPurchaseHistory = (customer: Customer | null) => {
    const id = customer?.id;
    if (!id) {
      showError('Customer not found. Please refresh and try again.');
      return;
    }
    setHistoryCustomer({ ...customer, id } as Customer);
  };

  const handleCallCustomer = (mobile?: string) => {
    const phone = String(mobile || '').trim();
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const getCustomerUnitPriceForOrder = (order: PartyOrder, customer: Customer | null): number => {
    const stock = products.find((p) => p.id === order.productId);
    const stockUnitPrice = Number(stock?.price ?? 0) || 0;
    if (!customer) return stockUnitPrice;

    const customerPrice = Number((customer as any)?.price ?? 0) || 0;
    const customer1LPrice = Number((customer as any)?.['1lPrice'] ?? 0) || 0;
    const customer500mlPrice = Number((customer as any)?.['500mlPrice'] ?? 0) || 0;
    const customer300mlPrice = Number((customer as any)?.['300mlPrice'] ?? 0) || 0;

    switch (String(order.productId || '')) {
      case '20L_PARTY_CAN':
        return customerPrice > 0 ? customerPrice : stockUnitPrice;
      case '1L_CASE':
        return customer1LPrice > 0 ? customer1LPrice : stockUnitPrice;
      case '500ML_CASE':
        return customer500mlPrice > 0 ? customer500mlPrice : stockUnitPrice;
      case '300ML_CASE':
        return customer300mlPrice > 0 ? customer300mlPrice : stockUnitPrice;
      default: {
        // Backward compatibility for any legacy IDs/names.
        const normalizedName = String(order.productName || '')
          .toLowerCase()
          .replace(/\s+/g, '');
        const is20LPartyCanByName = normalizedName.includes('20l') && (normalizedName.includes('-p') || normalizedName.includes('party') || normalizedName.endsWith('p'));
        if (is20LPartyCanByName && customerPrice > 0) return customerPrice;
        return stockUnitPrice;
      }
    }
  };

  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, []);

  useEffect(() => {
    const handleBackPress = () => {
      if (selectedCustomer) {
        setSelectedCustomer(null);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (activeBadge === 'customers') {
      filterCustomers();
    } else if (activeBadge === 'orders') {
      filterPartyOrders();
    } else {
      filterPartyDeliveries();
    }
  }, [searchQuery, customers, partyOrders, partyDeliveries, activeBadge]);

  useEffect(() => {
    if (activeBadge === 'orders' && partyOrders.length === 0) {
      loadPartyOrders();
    }
    if (activeBadge === 'history' && partyDeliveries.length === 0) {
      loadPartyDeliveries();
    }
  }, [activeBadge]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const result = await getCustomers();
      const customersData = (Array.isArray(result) ? result : []) as Customer[];

      const partyCustomers = customersData.filter(
        (c) => (c.customerType || '').toLowerCase() === 'party'
      );

      setCustomers(partyCustomers);
      setFilteredCustomers(partyCustomers);
    } catch (e) {
      const err = handleServiceError(e, 'loadCustomers');
      showError(err.message);
    } finally {
      setLoading(false);
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
      const err = handleServiceError(error, 'getStocks');
      showError(err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadPartyOrders = async () => {
    try {
      setLoadingOrders(true);
      const result = await getPartyOrders();
      if (Array.isArray(result)) {
        setPartyOrders(result);
        setFilteredPartyOrders(result);
      } else {
        const err = handleServiceError(result, 'getPartyOrders');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'getPartyOrders');
      showError(err.message);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadPartyDeliveries = async () => {
    try {
      setLoadingDeliveries(true);
      const result = await getPartyDeliveries();
      if (Array.isArray(result)) {
        setPartyDeliveries(result);
        setFilteredPartyDeliveries(result);
      } else {
        const err = handleServiceError(result, 'getPartyDeliveries');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'getPartyDeliveries');
      showError(err.message);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const filterCustomers = () => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = customers.filter((customer) => {
      if (customer.name?.toLowerCase().includes(query)) return true;
      if (customer.mobile?.includes(query)) return true;

      const fullAddress = [customer.doorNumber, customer.floor, customer.street, customer.area]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (fullAddress.includes(query)) return true;

      if (customer.alternateContacts?.some((contact) => contact.includes(query))) return true;

      return false;
    });

    setFilteredCustomers(filtered);
  };

  const filterPartyOrders = () => {
    if (!searchQuery.trim()) {
      setFilteredPartyOrders(partyOrders);
      return;
    }

    const q = searchQuery.toLowerCase();
    const filtered = partyOrders.filter((o) => {
      if (String(o.customerName || '').toLowerCase().includes(q)) return true;
      if (String(o.mobile || '').includes(q)) return true;
      if (String(o.productName || '').toLowerCase().includes(q)) return true;
      if (String(o.requestedDate || '').toLowerCase().includes(q)) return true;
      if (String(o.orderedAt || '').toLowerCase().includes(q)) return true;
      return false;
    });

    setFilteredPartyOrders(filtered);
  };

  const filterPartyDeliveries = () => {
    if (!searchQuery.trim()) {
      setFilteredPartyDeliveries(partyDeliveries);
      return;
    }

    const q = searchQuery.toLowerCase();
    const filtered = partyDeliveries.filter((d) => {
      if (String(d.customerName || '').toLowerCase().includes(q)) return true;
      if (String(d.mobile || '').includes(q)) return true;
      if (String(d.productName || '').toLowerCase().includes(q)) return true;
      if (String(d.requestedDate || '').toLowerCase().includes(q)) return true;
      if (String(d.deliveredAt || '').toLowerCase().includes(q)) return true;
      return false;
    });

    setFilteredPartyDeliveries(filtered);
  };

  const getFullAddress = (customer: Customer) => {
    const parts = [customer.doorNumber, customer.floor, customer.street, customer.area].filter(Boolean);
    return parts.join(', ');
  };

  const formatProductName = (productName: string) => {
    const name = productName.toLowerCase();

    if (name.includes('20') && name.includes('party')) {
      return '20L-P';
    } else if (name.includes('20') && name.includes('liter')) {
      return '20L';
    } else if (name.includes('1') && name.includes('liter')) {
      return '1L';
    } else if (name.includes('500') && name.includes('ml')) {
      return '500ml';
    } else if (name.includes('300') && name.includes('ml')) {
      return '300ml';
    }

    return productName;
  };

  const getProductOrder = (productName: string) => {
    const name = productName.toLowerCase();

    if (name.includes('20') && name.includes('liter') && !name.includes('party')) {
      return 1;
    } else if (name.includes('20') && name.includes('party')) {
      return 2;
    } else if (name.includes('1') && name.includes('liter')) {
      return 3;
    } else if (name.includes('500') && name.includes('ml')) {
      return 4;
    } else if (name.includes('300') && name.includes('ml')) {
      return 5;
    }

    return 999;
  };

  const getFilteredProducts = () => {
    const filtered = products.filter((product) => {
      const name = product.productName.toLowerCase();

      // Party customers should NOT see regular 20L (non-party)
      if (name.includes('20') && name.includes('liter') && !name.includes('party')) {
        return false;
      }

      return true;
    });

    return filtered.sort((a, b) => getProductOrder(a.productName) - getProductOrder(b.productName));
  };

  const handleOpenOrderModal = (customer: Customer, event: any) => {
    event.stopPropagation();
    setOrderCustomer(customer);
    setSubmittingOrder(false);
    setProductQuantities({});
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    setRequestedDate(today);
    setShowRequestedDatePicker(false);
    setShowOrderModal(true);
  };

  const handleCloseOrderModal = () => {
    setShowOrderModal(false);
    setOrderCustomer(null);
    setProductQuantities({});
    setShowRequestedDatePicker(false);
    setSubmittingOrder(false);
  };

  const handleOpenPartyDeliveryModal = (order: PartyOrder) => {
    if (!order.id) {
      showError('Order not found. Please refresh and try again.');
      return;
    }
    setDeliveringPartyOrder(order);
    setDeliveryQtyInput(String(order.quantity ?? ''));
    setShowPartyDeliveryModal(true);
  };

  const handleClosePartyDeliveryModal = () => {
    setShowPartyDeliveryModal(false);
    setDeliveringPartyOrder(null);
    setDeliveryQtyInput('');
    setSubmittingPartyDelivery(false);
    if (quantityUpdateTimerRef.current) {
      clearTimeout(quantityUpdateTimerRef.current);
      quantityUpdateTimerRef.current = null;
    }
  };

  const schedulePartyOrderQuantityUpdate = (order: PartyOrder, nextQty: number) => {
    if (!order?.id) return;
    if (!Number.isFinite(nextQty) || nextQty <= 0) return;

    if (quantityUpdateTimerRef.current) {
      clearTimeout(quantityUpdateTimerRef.current);
      quantityUpdateTimerRef.current = null;
    }

    quantityUpdateTimerRef.current = setTimeout(async () => {
      try {
        if (nextQty === (Number(order.quantity) || 0)) return;

        const result = await updatePartyOrder(order.id as string, { quantity: nextQty });
        if (result !== true) {
          const err = handleServiceError(result, 'updatePartyOrder');
          showError(err.message);
          return;
        }

        setPartyOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, quantity: nextQty } : o)));
        setFilteredPartyOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, quantity: nextQty } : o)));
        setDeliveringPartyOrder((prev) => {
          if (!prev) return prev;
          if (prev.id !== order.id) return prev;
          return { ...prev, quantity: nextQty };
        });
      } catch (e) {
        const err = handleServiceError(e, 'updatePartyOrder');
        showError(err.message);
      }
    }, 450);
  };

  const handleSubmitPartyDelivery = async () => {
    if (!deliveringPartyOrder?.id) return;

    const qty = parseInt(deliveryQtyInput || '0', 10) || 0;
    if (qty <= 0) {
      showError('Please enter valid quantity');
      return;
    }

    try {
      setSubmittingPartyDelivery(true);

      const result = await completePartyDeliveryTransaction({ order: deliveringPartyOrder, deliveredQty: qty });
      if (!('ok' in result) || result.ok !== true) {
        const err = handleServiceError(result, 'completePartyDeliveryTransaction');
        showError(err.message);
        return;
      }

      // Refresh local UI: remove from Orders, add to History.
      setPartyOrders((prev) => prev.filter((o) => o.id !== deliveringPartyOrder.id));
      setFilteredPartyOrders((prev) => prev.filter((o) => o.id !== deliveringPartyOrder.id));

      const newDelivery: PartyDelivery = {
        customerId: deliveringPartyOrder.customerId,
        customerName: deliveringPartyOrder.customerName,
        mobile: deliveringPartyOrder.mobile,
        address: deliveringPartyOrder.address,
        productId: deliveringPartyOrder.productId,
        productName: deliveringPartyOrder.productName,
        quantity: deliveringPartyOrder.quantity,
        deliveredQty: qty,
        deliveredAt: result.deliveredAt,
        requestedDate: deliveringPartyOrder.requestedDate,
        paymentMethod: deliveringPartyOrder.paymentMethod,
        amountPaid: 0,
        timeStamp: getISTDate(),
      };

      setPartyDeliveries((prev) => [newDelivery, ...prev]);
      setFilteredPartyDeliveries((prev) => [newDelivery, ...prev]);

      showSuccess('Delivered successfully');
      handleClosePartyDeliveryModal();
    } catch (e) {
      const err = handleServiceError(e, 'completePartyDeliveryTransaction');
      showError(err.message);
    } finally {
      setSubmittingPartyDelivery(false);
    }
  };

  const canEditOrDeleteOrders = userRole === 'owner' || (userRole === 'employee' && isAdmin);

  const handleDeletePartyOrder = (order: PartyOrder) => {
    if (!order.id) {
      showError('Order not found. Please refresh and try again.');
      return;
    }

    Alert.alert('Delete Order', `Delete order for ${order.customerName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingPartyOrderId(order.id as string);
            const result = await deletePartyOrder(order.id as string);
            if (result !== true) {
              const err = handleServiceError(result, 'deletePartyOrder');
              showError(err.message);
              return;
            }
            setPartyOrders((prev) => prev.filter((o) => o.id !== order.id));
            setFilteredPartyOrders((prev) => prev.filter((o) => o.id !== order.id));
            showSuccess('Order deleted');
          } catch (e) {
            const err = handleServiceError(e, 'deletePartyOrder');
            showError(err.message);
          } finally {
            setDeletingPartyOrderId(null);
          }
        },
      },
    ]);
  };

  const handleOpenEditPartyOrder = (order: PartyOrder) => {
    if (!order.id) {
      showError('Order not found. Please refresh and try again.');
      return;
    }

    const parsedDate = (() => {
      const key = String(order.requestedDate || '').trim();
      const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
      const dt = new Date(y, mo - 1, d);
      dt.setHours(0, 0, 0, 0);
      return dt;
    })();

    setEditingPartyOrder(order);
    setEditPartyOrderQty(String(order.quantity ?? 1));
    setEditRequestedDate(parsedDate || (() => {
      const today = getISTDate();
      today.setHours(0, 0, 0, 0);
      return today;
    })());
    setShowEditRequestedDatePicker(false);
    setShowEditPartyOrderModal(true);
  };

  const handleCloseEditPartyOrder = () => {
    setShowEditPartyOrderModal(false);
    setEditingPartyOrder(null);
    setEditPartyOrderQty('1');
    setShowEditRequestedDatePicker(false);
    setSubmittingEditPartyOrder(false);
  };

  const handleSubmitEditPartyOrder = async () => {
    if (!editingPartyOrder?.id) return;
    const qty = parseInt(editPartyOrderQty || '0', 10) || 0;
    if (qty <= 0) {
      showError('Please enter valid quantity');
      return;
    }

    const requestedDateKey = formatDateKey(editRequestedDate);

    try {
      setSubmittingEditPartyOrder(true);
      const result = await updatePartyOrder(editingPartyOrder.id, { quantity: qty, requestedDate: requestedDateKey });
      if (result !== true) {
        const err = handleServiceError(result, 'updatePartyOrder');
        showError(err.message);
        return;
      }

      const applyUpdate = (arr: PartyOrder[]) =>
        arr
          .map((o) => (o.id === editingPartyOrder.id ? { ...o, quantity: qty, requestedDate: requestedDateKey } : o))
          .sort((a, b) => String(a.requestedDate || '').localeCompare(String(b.requestedDate || '')));

      setPartyOrders((prev) => applyUpdate(prev));
      setFilteredPartyOrders((prev) => applyUpdate(prev));
      showSuccess('Order updated');
      handleCloseEditPartyOrder();
    } catch (e) {
      const err = handleServiceError(e, 'updatePartyOrder');
      showError(err.message);
    } finally {
      setSubmittingEditPartyOrder(false);
    }
  };

  const hasAnyQuantity = () => {
    const available = getFilteredProducts();
    return available.some((p) => (parseInt(productQuantities[p.id] || '0', 10) || 0) > 0);
  };

  const handleSubmitOrder = async () => {
    if (!orderCustomer) return;

    const availableProducts = getFilteredProducts();
    const selections = availableProducts
      .map((p) => ({ product: p, qty: parseInt(productQuantities[p.id] || '0', 10) || 0 }))
      .filter((s) => s.qty > 0);

    if (selections.length === 0) return;

    try {
      setSubmittingOrder(true);

      const now = getISTDate();
      const formattedDate = now.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const requestedDateKey = formatDateKey(requestedDate);

      for (const sel of selections) {
        const orderData = {
          customerId: orderCustomer.id,
          customerName: orderCustomer.name,
          mobile: orderCustomer.mobile,
          address: getFullAddress(orderCustomer),
          productId: sel.product.id,
          productName: sel.product.productName,
          quantity: sel.qty,
          paymentMethod: 'Pending',
          orderedAt: formattedDate,
          requestedDate: requestedDateKey,
          timeStamp: now,
        };

        const result = await addPartyOrder(orderData);
        if (result !== true) {
          const err = handleServiceError(result, 'addPartyOrder');
          showError(err.message);
          setSubmittingOrder(false);
          return;
        }
      }

      handleCloseOrderModal();
      showSuccess(`Order placed successfully for ${orderCustomer.name}`);
    } catch (e) {
      showError('An unexpected error occurred. Please try again.');
      setSubmittingOrder(false);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const renderCustomerCard = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      activeOpacity={0.7}
      onPress={() => setSelectedCustomer(item)}
    >
      <View style={styles.cardContent}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          <Text style={styles.customerMobile}>{item.mobile}</Text>
          <Text style={styles.customerAddress}>{getFullAddress(item)}</Text>
        </View>

        <TouchableOpacity
          style={styles.orderIconButton}
          onPress={(e) => handleOpenOrderModal(item, e)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="water-plus" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <View style={styles.customerStats}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="wallet" size={16} color={colors.success[500]} />
          <Text style={styles.statLabel}>Balance: {currencyINR(item.balance || 0)}</Text>
        </View>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="water" size={16} color={colors.info[500]} />
          <Text style={styles.statLabel}>Extra Can: {item.extraCanHolding || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderPartyOrderCard = ({ item }: { item: PartyOrder }) => (
    <View style={styles.partyOrderCard}>
      <View style={styles.partyOrderHeader}>
        <View style={styles.partyOrderCustomerInfo}>
          <Text style={styles.partyOrderCustomerName}>{item.customerName}</Text>

          <TouchableOpacity
            style={styles.partyOrderPhoneRow}
            onPress={() => handleCallCustomer(item.mobile)}
            disabled={!String(item.mobile || '').trim()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="phone" size={16} color={colors.primary[500]} />
            <Text style={styles.partyOrderPhoneNumber}>{item.mobile || '-'}</Text>
          </TouchableOpacity>

          <Text style={styles.partyOrderAddress} numberOfLines={2}>
            {item.address || '-'}
          </Text>

          {item.requestedDate ? (
            <Text style={styles.partyOrderMeta}>Requested: {item.requestedDate}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.partyOrderProductActionRow}>
        <View style={styles.partyOrderProductContainer}>
          <MaterialCommunityIcons name="water" size={18} color={colors.primary[500]} />
          <Text style={styles.partyOrderProductName}>{formatProductName(String(item.productName || ''))}</Text>
          <View style={styles.partyOrderQuantityBadge}>
            <Text style={styles.partyOrderQuantityText}>{item.quantity ?? 0}</Text>
          </View>
        </View>

        <View style={styles.partyOrderActionIconsRow}>
          <TouchableOpacity
            style={styles.partyOrderActionIcon}
            activeOpacity={0.7}
            disabled={!item.id || submittingPartyDelivery || deletingPartyOrderId === item.id || submittingEditPartyOrder}
            onPress={() => handleOpenPartyDeliveryModal(item)}
          >
            <MaterialCommunityIcons name="truck-delivery" size={18} color={colors.success[500]} />
          </TouchableOpacity>

          {canEditOrDeleteOrders ? (
            <TouchableOpacity
              style={styles.partyOrderActionIcon}
              onPress={() => handleOpenEditPartyOrder(item)}
              disabled={!item.id || submittingDeliveryOrderId === item.id || deletingPartyOrderId === item.id || submittingEditPartyOrder}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="pencil" size={18} color={colors.primary[500]} />
            </TouchableOpacity>
          ) : null}

          {canEditOrDeleteOrders ? (
            <TouchableOpacity
              style={styles.partyOrderActionIcon}
              onPress={() => handleDeletePartyOrder(item)}
              disabled={!item.id || submittingDeliveryOrderId === item.id || deletingPartyOrderId === item.id || submittingEditPartyOrder}
              activeOpacity={0.7}
            >
              {deletingPartyOrderId === item.id ? (
                <ActivityIndicator size="small" color={colors.danger[500]} />
              ) : (
                <MaterialCommunityIcons name="trash-can" size={18} color={colors.danger[500]} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

    </View>
  );

  const renderPartyDeliveryCard = ({ item }: { item: PartyDelivery }) => (
    <View style={styles.customerCard}>
      <View style={styles.cardContent}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.customerMobile}>{item.mobile || '-'}</Text>
          <Text style={styles.customerAddress} numberOfLines={2}>
            {item.address || '-'}
          </Text>
        </View>

        <View style={styles.rightMeta}>
          <View style={styles.productBadge}>
            <Text style={styles.productBadgeText}>{formatProductName(String(item.productName || ''))}</Text>
          </View>
          <Text style={styles.metaValue}>Delivered: {item.deliveredQty ?? item.quantity ?? 0}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Requested:</Text>
        <Text style={styles.metaValue}>{item.requestedDate || '-'}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Delivered:</Text>
        <Text style={styles.metaValue}>{item.deliveredAt || '-'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {historyCustomer ? (
        <View style={styles.detailsContainer}>
          <CustomerPurchaseHistoryScreen customer={historyCustomer} onBack={() => setHistoryCustomer(null)} />
        </View>
      ) : selectedCustomer ? (
        <View style={styles.detailsContainer}>
          {selectedCustomer.id?.includes('edit-') ? (
            <EditCustomerScreen
              customer={{ ...selectedCustomer, id: selectedCustomer.id?.replace('edit-', '') || '' }}
              onBack={() => setSelectedCustomer(null)}
              onSave={(updatedCustomer) => {
                setCustomers((prev) => prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c)));
                setSelectedCustomer(updatedCustomer);
              }}
            />
          ) : (
            <CustomerDetailsScreen
              customer={selectedCustomer}
              onBack={() => setSelectedCustomer(null)}
              onEdit={() => setSelectedCustomer({ ...selectedCustomer, id: `edit-${selectedCustomer.id}` })}
              onViewHistory={() => openPurchaseHistory(selectedCustomer)}
              allowDelete={allowCustomerDelete}
              onDeleted={(customerId) => {
                setCustomers((prev) => prev.filter((c) => c.id !== customerId));
                setFilteredCustomers((prev) => prev.filter((c) => c.id !== customerId));
              }}
            />
          )}
        </View>
      ) : (
        <>
          <DropletLoader visible={activeBadge === 'customers' ? loading : activeBadge === 'orders' ? loadingOrders : loadingDeliveries} />

          <View style={styles.badgeRow}>
            <TouchableOpacity
              style={[styles.badge, activeBadge === 'customers' && styles.badgeActive]}
              onPress={() => {
                setActiveBadge('customers');
                setSelectedCustomer(null);
                setHistoryCustomer(null);
                setShowOrderModal(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.badgeText, activeBadge === 'customers' && styles.badgeTextActive]}>Customers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.badge, activeBadge === 'orders' && styles.badgeActive]}
              onPress={() => {
                setActiveBadge('orders');
                setSelectedCustomer(null);
                setHistoryCustomer(null);
                setShowOrderModal(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.badgeText, activeBadge === 'orders' && styles.badgeTextActive]}>Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.badge, activeBadge === 'history' && styles.badgeActive]}
              onPress={() => {
                setActiveBadge('history');
                setSelectedCustomer(null);
                setHistoryCustomer(null);
                setShowOrderModal(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.badgeText, activeBadge === 'history' && styles.badgeTextActive]}>History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.gray[400]} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={activeBadge === 'customers' ? 'Search customer...' : activeBadge === 'orders' ? 'Search orders...' : 'Search history...'}
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

          {activeBadge === 'customers' && !loading && filteredCustomers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-group-outline" size={64} color={colors.gray[300]} />
              <Text style={styles.emptyText}>{searchQuery ? 'No customers found' : 'No customers yet'}</Text>
              {searchQuery && <Text style={styles.emptySubtext}>Try searching with a different keyword</Text>}
            </View>
          ) : activeBadge === 'customers' && !loading ? (
            <FlatList
              data={filteredCustomers}
              renderItem={renderCustomerCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={loadCustomers} />}
            />
          ) : activeBadge === 'orders' && !loadingOrders && filteredPartyOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={64} color={colors.gray[300]} />
              <Text style={styles.emptyText}>{searchQuery ? 'No orders found' : 'No orders yet'}</Text>
              {searchQuery && <Text style={styles.emptySubtext}>Try searching with a different keyword</Text>}
            </View>
          ) : activeBadge === 'orders' && !loadingOrders ? (
            <FlatList
              data={filteredPartyOrders}
              renderItem={renderPartyOrderCard}
              keyExtractor={(item) => item.id || `${item.customerId}_${item.productId}_${item.orderedAt || ''}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={loadingOrders} onRefresh={loadPartyOrders} />}
            />
          ) : activeBadge === 'history' && !loadingDeliveries && filteredPartyDeliveries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="history" size={64} color={colors.gray[300]} />
              <Text style={styles.emptyText}>{searchQuery ? 'No deliveries found' : 'No deliveries yet'}</Text>
              {searchQuery && <Text style={styles.emptySubtext}>Try searching with a different keyword</Text>}
            </View>
          ) : activeBadge === 'history' && !loadingDeliveries ? (
            <FlatList
              data={filteredPartyDeliveries}
              renderItem={renderPartyDeliveryCard}
              keyExtractor={(item) => item.id || `${item.customerId}_${item.productId}_${item.deliveredAt || ''}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={loadingDeliveries} onRefresh={loadPartyDeliveries} />}
            />
          ) : null}
        </>
      )}

      <Modal visible={showOrderModal} transparent animationType="fade" onRequestClose={handleCloseOrderModal}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={handleCloseOrderModal}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Order</Text>
                <TouchableOpacity onPress={handleCloseOrderModal} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {orderCustomer && (
                  <>
                    <View style={styles.customerInfoSection}>
                      <Text style={styles.customerNameModal}>{orderCustomer.name}</Text>
                      <Text style={styles.customerAddressModal}>{getFullAddress(orderCustomer)}</Text>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Requested Date *</Text>
                      <TouchableOpacity
                        style={styles.dateFieldButton}
                        onPress={() => setShowRequestedDatePicker(true)}
                        disabled={submittingOrder}
                        activeOpacity={0.85}
                      >
                        <MaterialCommunityIcons name="calendar" size={18} color={colors.gray[500]} />
                        <Text style={styles.dateFieldText}>
                          {requestedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      </TouchableOpacity>

                      {showRequestedDatePicker ? (
                        <DateTimePicker
                          value={requestedDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(_, selected) => {
                            if (Platform.OS !== 'ios') {
                              setShowRequestedDatePicker(false);
                            }
                            if (selected) {
                              const picked = new Date(selected);
                              picked.setHours(0, 0, 0, 0);
                              setRequestedDate(picked);
                            }
                          }}
                        />
                      ) : null}
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Products *</Text>
                      {loadingProducts ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                          <Text style={styles.loadingText}>Loading products...</Text>
                        </View>
                      ) : products.length === 0 ? (
                        <Text style={styles.noProductsText}>No products available</Text>
                      ) : (
                        <View style={styles.multiProductList}>
                          {getFilteredProducts().map((product) => (
                            <View key={product.id} style={styles.multiProductRow}>
                              <View style={styles.productBadge}>
                                <Text style={styles.productBadgeText}>{formatProductName(product.productName)}</Text>
                              </View>
                              <TextInput
                                style={styles.qtyInput}
                                placeholder="0"
                                placeholderTextColor={colors.gray[400]}
                                value={productQuantities[product.id] ?? ''}
                                onChangeText={(t) => {
                                  const cleaned = (t || '').replace(/[^0-9]/g, '');
                                  setProductQuantities((prev) => ({ ...prev, [product.id]: cleaned }));
                                }}
                                keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                                editable={!submittingOrder}
                              />
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.submitButton, (submittingOrder || !hasAnyQuantity()) && styles.submitButtonDisabled]}
                      onPress={handleSubmitOrder}
                      disabled={submittingOrder || !hasAnyQuantity()}
                    >
                      {submittingOrder ? (
                        <ActivityIndicator color={colors.bg.white} size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>Submit Order</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showEditPartyOrderModal} transparent animationType="fade" onRequestClose={handleCloseEditPartyOrder}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={handleCloseEditPartyOrder}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Order</Text>
                <TouchableOpacity onPress={handleCloseEditPartyOrder} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {editingPartyOrder ? (
                  <>
                    <View style={styles.customerInfoSection}>
                      <Text style={styles.customerNameModal}>{editingPartyOrder.customerName}</Text>
                      <Text style={styles.customerAddressModal}>{formatProductName(String(editingPartyOrder.productName || ''))}</Text>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Requested Date *</Text>
                      <TouchableOpacity
                        style={styles.dateFieldButton}
                        onPress={() => setShowEditRequestedDatePicker(true)}
                        disabled={submittingEditPartyOrder}
                        activeOpacity={0.85}
                      >
                        <MaterialCommunityIcons name="calendar" size={18} color={colors.gray[500]} />
                        <Text style={styles.dateFieldText}>
                          {editRequestedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      </TouchableOpacity>

                      {showEditRequestedDatePicker ? (
                        <DateTimePicker
                          value={editRequestedDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(_, selected) => {
                            if (Platform.OS !== 'ios') {
                              setShowEditRequestedDatePicker(false);
                            }
                            if (selected) {
                              const picked = new Date(selected);
                              picked.setHours(0, 0, 0, 0);
                              setEditRequestedDate(picked);
                            }
                          }}
                        />
                      ) : null}
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Quantity *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter quantity"
                        placeholderTextColor={colors.gray[400]}
                        value={editPartyOrderQty}
                        onChangeText={(t) => {
                          const cleaned = (t || '').replace(/[^0-9]/g, '');
                          setEditPartyOrderQty(cleaned);
                        }}
                        keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                        editable={!submittingEditPartyOrder}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.submitButton, submittingEditPartyOrder && styles.submitButtonDisabled]}
                      onPress={handleSubmitEditPartyOrder}
                      disabled={submittingEditPartyOrder}
                    >
                      {submittingEditPartyOrder ? (
                        <ActivityIndicator color={colors.bg.white} size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPartyDeliveryModal} transparent animationType="fade" onRequestClose={handleClosePartyDeliveryModal}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={handleClosePartyDeliveryModal}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Deliver Order</Text>
                <TouchableOpacity onPress={handleClosePartyDeliveryModal} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {deliveringPartyOrder ? (
                  <>
                    <View style={styles.customerInfoSection}>
                      <Text style={styles.customerNameModal}>{deliveringPartyOrder.customerName}</Text>
                      <Text style={styles.customerAddressModal}>{formatProductName(String(deliveringPartyOrder.productName || ''))}</Text>

                      {(() => {
                        const customer = customers.find((c) => c.id === deliveringPartyOrder.customerId);
                        if (!customer) return null;
                        return (
                          <View style={[styles.customerStats, { marginTop: spacing[8] }]}>
                            <View style={styles.statItem}>
                              <MaterialCommunityIcons name="wallet" size={16} color={colors.success[500]} />
                              <Text style={styles.statLabel}>Balance: {currencyINR(customer.balance || 0)}</Text>
                            </View>
                          </View>
                        );
                      })()}
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Quantity *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter quantity"
                        placeholderTextColor={colors.gray[400]}
                        value={deliveryQtyInput}
                        onChangeText={(t) => {
                          const cleaned = (t || '').replace(/[^0-9]/g, '');
                          setDeliveryQtyInput(cleaned);
                          const nextQty = parseInt(cleaned || '0', 10) || 0;
                          if (nextQty > 0) {
                            // Requirement: if qty changed, update party order quantity.
                            schedulePartyOrderQuantityUpdate(deliveringPartyOrder, nextQty);
                          }
                        }}
                        keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                        editable={!submittingPartyDelivery}
                      />
                    </View>

                    {(() => {
                      const customer = customers.find((c) => c.id === deliveringPartyOrder.customerId);
                      if (!customer) return null;

                      const customerBalance = Number(customer.balance ?? 0) || 0;
                      const qtyForBill = parseInt(deliveryQtyInput || '0', 10) || 0;

                      const unitPrice = getCustomerUnitPriceForOrder(deliveringPartyOrder, customer);

                      const billAmount = customerBalance + unitPrice * qtyForBill;

                      return (
                        <View style={styles.billAmountRow}>
                          <Text style={styles.billAmountLabel}>Bill Amount</Text>
                          <Text style={styles.billAmountValue}>
                            Rs {qtyForBill > 0 ? billAmount : customerBalance}
                          </Text>
                        </View>
                      );
                    })()}

                    <TouchableOpacity
                      style={[styles.submitButton, submittingPartyDelivery && styles.submitButtonDisabled]}
                      onPress={handleSubmitPartyDelivery}
                      disabled={submittingPartyDelivery}
                    >
                      {submittingPartyDelivery ? (
                        <ActivityIndicator color={colors.bg.white} size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>Submit</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.light,
  },
  detailsContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing[10],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  badge: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[10],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  badgeActive: {
    borderColor: colors.primary[500],
  },
  badgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[600],
  },
  badgeTextActive: {
    color: colors.primary[600],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.white,
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    marginBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  searchIcon: {
    marginRight: spacing[8],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
    padding: 0,
  },
  clearButton: {
    padding: spacing[4],
  },
  listContent: {
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[20],
  },
  customerCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  partyOrderCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  partyOrderHeader: {
    marginBottom: spacing[12],
  },
  partyOrderCustomerInfo: {
    gap: spacing[6],
  },
  partyOrderCustomerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  partyOrderPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  partyOrderPhoneNumber: {
    fontSize: typography.fontSize.base,
    color: colors.primary[500],
  },
  partyOrderAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    lineHeight: 18,
  },
  partyOrderMeta: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  partyOrderProductActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[12],
  },
  partyOrderProductContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flex: 1,
  },
  partyOrderProductName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  partyOrderQuantityBadge: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partyOrderQuantityText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.bg.white,
  },
  partyOrderActionIconsRow: {
    flexDirection: 'row',
    gap: spacing[8],
    alignItems: 'center',
  },
  partyOrderActionIcon: {
    padding: spacing[6],
  },
  partyOrderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    marginTop: spacing[8],
    paddingTop: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  partyOrderTimeText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[12],
  },
  customerInfo: {
    flex: 1,
  },
  orderIconButton: {
    padding: spacing[8],
    marginTop: -spacing[8],
    marginRight: -spacing[8],
  },
  deliveryIconButton: {
    padding: spacing[8],
    marginTop: -spacing[8],
    marginRight: -spacing[8],
  },
  customerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[4],
  },
  customerMobile: {
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
    marginBottom: spacing[4],
  },
  customerAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    lineHeight: 18,
  },
  customerStats: {
    flexDirection: 'row',
    gap: spacing[16],
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    fontWeight: typography.fontWeight.medium,
  },
  rightMeta: {
    alignItems: 'flex-end',
    gap: spacing[8],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginTop: spacing[6],
  },
  metaLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    fontWeight: typography.fontWeight.medium,
  },
  metaValue: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.semibold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[32],
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
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[20],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSize['xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  modalCloseButton: {
    padding: spacing[4],
  },
  customerInfoSection: {
    backgroundColor: colors.bg.light,
    padding: spacing[12],
    borderRadius: borderRadius.md,
    marginBottom: spacing[20],
  },
  customerNameModal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[4],
  },
  customerAddressModal: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: spacing[16],
  },
  modalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[8],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    gap: spacing[8],
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  noProductsText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    textAlign: 'center',
    paddingVertical: spacing[16],
  },
  multiProductList: {
    gap: spacing[10],
  },
  multiProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  productBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    backgroundColor: colors.bg.white,
    minWidth: 80,
    alignItems: 'center',
  },
  productBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[700],
  },
  qtyInput: {
    flex: 1,
    maxWidth: 140,
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
    textAlign: 'right',
  },
  modalInput: {
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
  },
  billAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[12],
    marginTop: -spacing[4],
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
  dateFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  dateFieldText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[800],
  },
  submitButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[12],
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[8],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.bg.white,
  },
});
