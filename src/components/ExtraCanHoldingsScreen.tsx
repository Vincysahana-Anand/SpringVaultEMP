import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
  TextInput,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getCustomers, Customer } from '../services/customerService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
import CustomerDetailsScreen from './CustomerDetailsScreen';
import ExtraCanHistoryScreen from './ExtraCanHistoryScreen';
import { updateCustomer } from '../services/customerService';
import { addPurchaseHistory } from '../services/purchaseHistoryService';
import { updateSalesRecord } from '../services/salesService';
import { addDailyRecord } from '../services/dailyRecordService';
import { getISTDate } from '../utils/dateUtils';
import { getStocks, resolveProductName, updateStock } from '../services/stockService';

interface Props { onBack?: () => void; }

export default function ExtraCanHoldingsScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [returnCustomer, setReturnCustomer] = useState<Customer | null>(null);
  const [returnQty, setReturnQty] = useState('');
  const [returnProduct, setReturnProduct] = useState<'20L_CAN' | '20L_PARTY_CAN'>('20L_CAN');
  const [savingReturn, setSavingReturn] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedCustomer) {
        setSelectedCustomer(null);
        return true;
      }
      if (showHistory) {
        setShowHistory(false);
        return true;
      }
      if (returnModal) {
        setReturnModal(false);
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onBack, selectedCustomer, showHistory, returnModal]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getCustomers();
      if (Array.isArray(res)) {
        const filtered = res
          .map(c => ({ ...c, extraCanHolding: typeof c.extraCanHolding === 'number' ? c.extraCanHolding : 0 }))
          .filter(c => (c.extraCanHolding || 0) !== 0)
          .sort((a, b) => (b.extraCanHolding || 0) - (a.extraCanHolding || 0));
        setCustomers(filtered as Customer[]);
      } else {
        const err = handleServiceError(res, 'getCustomers');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'getCustomers');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const buildFullAddress = (customer: Customer) =>
    [customer.doorNumber, customer.floor, customer.street, customer.area]
      .filter(Boolean)
      .join(' ')
      .trim();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c => {
      const fullAddress = buildFullAddress(c).toLowerCase();
      if (c.name?.toLowerCase().includes(q)) return true;
      if (c.mobile?.includes(q)) return true;
      if (fullAddress.includes(q)) return true;
      if (c.alternateContacts?.some(contact => contact?.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [customers, searchQuery]);

  const renderItem = ({ item }: { item: Customer }) => {
    const fullAddress = buildFullAddress(item);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => setSelectedCustomer(item)}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="bottle-soda" size={20} color="#8b5cf6" />
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.count}>{item.extraCanHolding || 0}</Text>
          <TouchableOpacity style={styles.returnBtn} onPress={() => openReturnModal(item)}>
            <MaterialCommunityIcons name="tray-arrow-down" size={20} color="#8b5cf6" />
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>{item.mobile}</Text>
        <Text style={styles.sub}>{fullAddress || 'No address provided'}</Text>
      </TouchableOpacity>
    );
  };

  const openReturnModal = (customer: Customer) => {
    setReturnCustomer(customer);
    setReturnQty('');
    setReturnProduct('20L_CAN');
    setReturnModal(true);
  };

  const submitReturn = async () => {
    if (!returnCustomer?.id) {
      setReturnModal(false);
      return;
    }
    const qty = Number(returnQty || 0);
    if (isNaN(qty) || qty <= 0) {
      return;
    }
    if (savingReturn) return;
    const current = returnCustomer.extraCanHolding || 0;
    const nextValue = Math.max(0, current - qty);
    const timestampLabel = getISTDate().toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const productName = resolveProductName(returnProduct);
    try {
      setSavingReturn(true);
      const updateCustomerResult = await updateCustomer(returnCustomer.id, { extraCanHolding: nextValue });
      if (updateCustomerResult !== true) {
        const err = handleServiceError(updateCustomerResult, 'updateCustomer');
        showError(err.message);
        setSavingReturn(false);
        return;
      }

      const purchaseRecordResult = await addPurchaseHistory(returnCustomer.id, {
        product: "extraCans",
        deliveredQty: 0,
        emptyQty: qty,
        orderedAt: timestampLabel,
        deliveredAt: timestampLabel,
        billAmount: 0,
        amountPaid: 0,
        paymentMethod: 'cash',
        paymentRef: 0,
      });
      if (purchaseRecordResult !== true) {
        const err = handleServiceError(purchaseRecordResult, 'addPurchaseHistory');
        showError(err.message);
        setSavingReturn(false);
        return;
      }

      const salesUpdateResult = await updateSalesRecord(
        0,
        0,
        0,
        0,
        0,
        false,
        0,
        0,
        0,
        0,
        0,
        0,
        qty,
      );
      if (salesUpdateResult !== true) {
        const err = handleServiceError(salesUpdateResult, 'updateSalesRecord');
        showError(err.message);
        setSavingReturn(false);
        return;
      }

      const dailyRecordResult = await addDailyRecord("emptyReturned", {
        customerId: returnCustomer.id,
        customerName: returnCustomer.name,
        customerAddress: buildFullAddress(returnCustomer),
        customerMobile: returnCustomer.mobile,
        product: "emptyReturned",
        orderedAt: timestampLabel,
        deliveredAt: timestampLabel,
        orderedQty: 0,
        deliveredQty: 0,
        emptyQty: qty,
        billAmount: returnCustomer.balance || 0,
        saleAmount: 0,
        amountPaid: 0,
        paymentMethod: 'cash',
        paymentRef: 0,
        pendingPaymentReceived: 0,
      });
      if (dailyRecordResult !== true) {
        const err = handleServiceError(dailyRecordResult, 'addDailyRecord');
        showError(err.message);
        setSavingReturn(false);
        return;
      }

      const stocks = await getStocks();
      if (!Array.isArray(stocks)) {
        const err = handleServiceError(stocks, 'getStocks');
        showError(err.message);
        setSavingReturn(false);
        return;
      }
      const selectedStock = stocks.find(s => s.id === returnProduct);
      if (!selectedStock) {
        setSavingReturn(false);
        return;
      }
      const nextExtraCan = Math.max((selectedStock.extraCan || 0) - qty, 0);
      const nextEmpty = (selectedStock.empty || 0) + qty;
      const stockUpdateResult = await updateStock(returnProduct, { extraCan: nextExtraCan, empty: nextEmpty });
      if (stockUpdateResult !== true) {
        const err = handleServiceError(stockUpdateResult, 'updateStock');
        showError(err.message);
        setSavingReturn(false);
        return;
      }
      await load();
      setReturnModal(false);
      setReturnCustomer(null);
      setReturnQty('');
    } catch (e) {
      const err = handleServiceError(e, 'updateCustomer');
      showError(err.message);
    } finally {
      setSavingReturn(false);
    }
  };

  const totalExtra = useMemo(() => filtered.reduce((sum, c) => sum + (c.extraCanHolding || 0), 0), [filtered]);

  if (selectedCustomer) {
    return (
      <CustomerDetailsScreen
        customer={selectedCustomer as any}
        onBack={() => setSelectedCustomer(null)}
        onEdit={() => setSelectedCustomer(null)}
        onViewHistory={() => setSelectedCustomer(null)}
      />
    );
  }

  if (showHistory) {
    return <ExtraCanHistoryScreen onBack={() => setShowHistory(false)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Extra Can Holdings</Text>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.historyBtn}>
          <MaterialCommunityIcons name="history" size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, address"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /></View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={filtered}
            keyExtractor={(item, idx) => item.id || String(idx)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<Text style={styles.empty}>No extra cans recorded</Text>}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
                colors={["#8b5cf6"]}
                tintColor="#8b5cf6"
              />
            }
          />

          <View style={styles.summaryBar}>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryLabel}>total extra cans</Text>
              <Text style={styles.summaryValue}>{totalExtra}</Text>
            </View>
          </View>

          <Modal visible={returnModal} transparent animationType="fade" onRequestClose={() => setReturnModal(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setReturnModal(false)}>
              <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Return empty cans</Text>
                  <TouchableOpacity onPress={() => setReturnModal(false)}>
                    <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>{returnCustomer?.name}</Text>
                <Text style={styles.modalSubtitleSmall}>Holding: {returnCustomer?.extraCanHolding || 0}</Text>
                <View style={styles.productSwitch}>
                  {[
                    { id: '20L_CAN' as const, label: '20L' },
                    { id: '20L_PARTY_CAN' as const, label: '20L-P' },
                  ].map(option => (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.productBtn, returnProduct === option.id && styles.productBtnActive]}
                      onPress={() => setReturnProduct(option.id)}
                    >
                      <Text style={[styles.productBtnText, returnProduct === option.id && styles.productBtnTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter count"
                  placeholderTextColor="#94a3b8"
                  keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                  value={returnQty}
                  onChangeText={(text) => setReturnQty(text.replace(/[^0-9]/g, ''))}
                />
                <TouchableOpacity style={[styles.saveBtn, savingReturn && { opacity: 0.7 }]} onPress={submitReturn} disabled={savingReturn}>
                  <Text style={styles.saveBtnText}>{savingReturn ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 8 },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1 },
  historyBtn: { padding: 6, marginLeft: 6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', gap: 8 },
  searchInput: { flex: 1, color: '#0f172a', paddingVertical: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  count: { fontWeight: '700', color: '#8b5cf6' },
  returnBtn: { padding: 6, marginLeft: 4 },
  sub: { marginTop: 4, color: '#475569', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  summaryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 180,
    width: '100%',
    maxWidth: 420,
  },
  summaryLabel: { color: '#475569', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  summaryValue: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalSubtitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  modalSubtitleSmall: { color: '#475569', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    marginBottom: 12,
  },
  productSwitch: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  productBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  productBtnActive: {
    borderColor: '#8b5cf6',
    backgroundColor: '#ede9fe',
  },
  productBtnText: { color: '#475569', fontWeight: '700' },
  productBtnTextActive: { color: '#7c3aed' },
  saveBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
