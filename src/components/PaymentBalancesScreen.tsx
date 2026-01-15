import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler, RefreshControl, TextInput, Modal, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getCustomers, Customer, updateCustomer } from '../services/customerService';
import { addPurchaseHistory } from '../services/purchaseHistoryService';
import { addDailyRecord, DailyRecordEntry } from '../services/dailyRecordService';
import { updateSalesRecord } from '../services/salesService';
import { getISTDate } from '../utils/dateUtils';
import { handleServiceError } from '../services/serviceErrorWrapper';
import CustomerDetailsScreen from './CustomerDetailsScreen';

interface Props { onBack?: () => void; }

export default function PaymentBalancesScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<'cash' | 'online'>('cash');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showPayModal) {
        setShowPayModal(false);
        return true;
      }
      if (selectedCustomer) {
        setSelectedCustomer(null);
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onBack, selectedCustomer, showPayModal]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getCustomers();
      if (Array.isArray(res)) {
        const normalized = res
          .map(c => ({ ...c, balance: typeof c.balance === 'number' ? c.balance : 0 }))
          .filter(c => (c.balance || 0) !== 0)
          .sort((a, b) => (b.balance || 0) - (a.balance || 0));
        setCustomers(normalized);
      } else {
        handleServiceError(res, 'getCustomers');
      }
    } catch (e) {
      handleServiceError(e, 'getCustomers');
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

  const openPayModal = (customer: Customer) => {
    setPayCustomer(customer);
    setPayMethod('cash');
    setPayAmount((customer.balance || 0).toString());
    setPayRef('');
    setShowPayModal(true);
  };

  const submitPayment = async () => {
    if (!payCustomer?.id) {
      setShowPayModal(false);
      return;
    }
    const amountValue = Number(payAmount || 0);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Validation', 'Enter a valid amount');
      return;
    }
    if (payMethod === 'online' && !payRef.trim()) {
      Alert.alert('Validation', 'Enter UTR / UPI transaction ID');
      return;
    }
    try {
      setSubmittingPay(true);
      const startingBalance = payCustomer.balance || 0;
      const newBalance = startingBalance - amountValue;

      // 1) Update customer balance
      const res = await updateCustomer(payCustomer.id, { balance: newBalance });
      if (res !== true) {
        handleServiceError(res, 'updateCustomer');
        setSubmittingPay(false);
        return;
      }

      // 2) Add purchase history entry for payment
      const now = getISTDate();
      const stamp = now.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      await addPurchaseHistory(payCustomer.id, {
        product: 'payment',
        deliveredQty: 0,
        emptyQty: 0,
        orderedAt: stamp,
        deliveredAt: stamp,
        billAmount: startingBalance,
        amountPaid: amountValue,
        paymentMethod: payMethod,
        paymentRef: payMethod === 'online' ? Number(payRef) || 0 : 0,
      });

      // 3) Update sales record for today (pending payment received + total sale)
      const cashPaidValue = payMethod === 'cash' ? amountValue : 0;
      const onlinePaidValue = payMethod === 'online' ? amountValue : 0;
      await updateSalesRecord(
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
        cashPaidValue,
        onlinePaidValue
      );

      // 4) Add daily record under Payments doc
      const dailyEntry: DailyRecordEntry = {
        customerId: payCustomer.id,
        customerName: payCustomer.name,
        customerMobile: payCustomer.mobile,
        product: 'payment',
        orderedAt: stamp,
        deliveredAt: stamp,
        deliveredQty: 0,
        emptyQty: 0,
        billAmount: startingBalance,
        saleAmount: 0,
        amountPaid: amountValue,
        paymentMethod: payMethod,
        paymentRef: payMethod === 'online' ? Number(payRef) || 0 : 0,
        pendingPaymentReceived: amountValue,
      };
      await addDailyRecord('Payments', dailyEntry);

      await load();
      setShowPayModal(false);
      setPayCustomer(null);
    } catch (e) {
      handleServiceError(e, 'submitPayment');
    } finally {
      setSubmittingPay(false);
    }
  };

  const renderItem = ({ item }: { item: Customer }) => {
    const fullAddress = buildFullAddress(item);

    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedCustomer(item)}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="wallet" size={20} color="#0ea5e9" />
          <Text style={styles.title}>{item.name}</Text>
          <Text style={[styles.balance, { color: (item.balance || 0) >= 0 ? '#16a34a' : '#ef4444' }]}>₹{item.balance || 0}</Text>
          <TouchableOpacity style={styles.payBtn} onPress={() => openPayModal(item)}>
            <MaterialCommunityIcons name="cash-multiple" size={20} color="#0ea5e9" />
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>{item.mobile}</Text>
        <Text style={styles.sub}>{fullAddress || 'No address provided'}</Text>
      </TouchableOpacity>
    );
  };

  if (selectedCustomer) {
    return (
      <CustomerDetailsScreen
        customer={selectedCustomer as any}
        onBack={() => setSelectedCustomer(null)}
        onEdit={() => {}}
        onViewHistory={() => {}}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Payment Balances</Text>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone"
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
        <View style={styles.center}><ActivityIndicator size="large" color="#0ea5e9" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No balances to show</Text>}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              colors={["#0ea5e9"]}
              tintColor="#0ea5e9"
            />
          }
        />
      )}

      <Modal visible={showPayModal} transparent animationType="fade" onRequestClose={() => setShowPayModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPayModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={styles.modalSubtitle}>{payCustomer?.name}</Text>
              <Text style={styles.modalSubtitleSmall}>{payCustomer?.mobile}</Text>

              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[styles.methodBtn, payMethod === 'cash' && styles.methodBtnActive]}
                  onPress={() => setPayMethod('cash')}
                  disabled={submittingPay}
                >
                  <Text style={[styles.methodText, payMethod === 'cash' && styles.methodTextActive]}>Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.methodBtn, payMethod === 'online' && styles.methodBtnActive]}
                  onPress={() => setPayMethod('online')}
                  disabled={submittingPay}
                >
                  <Text style={[styles.methodText, payMethod === 'online' && styles.methodTextActive]}>Online</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Amount</Text>
                <TextInput
                  style={styles.fieldInput}
                  keyboardType="number-pad"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="0"
                />
              </View>

              {payMethod === 'online' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>UTR / UPI Transaction ID</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={payRef}
                    onChangeText={(text) => setPayRef(text.replace(/[^0-9]/g, ''))}
                    placeholder="Enter reference"
                    keyboardType="number-pad"
                  />
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, submittingPay && { opacity: 0.6 }]}
                onPress={submitPayment}
                disabled={submittingPay}
              >
                {submittingPay ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 8 },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', gap: 8 },
  searchInput: { flex: 1, color: '#0f172a', paddingVertical: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  balance: { fontWeight: '700' },
  payBtn: { padding: 6, marginLeft: 6 },
  sub: { marginTop: 4, color: '#475569', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: { width: '90%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalSubtitle: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  modalSubtitleSmall: { color: '#475569', marginBottom: 12 },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  methodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc' },
  methodBtnActive: { borderColor: '#0ea5e9', backgroundColor: '#e0f2fe' },
  methodText: { color: '#0f172a', fontWeight: '600' },
  methodTextActive: { color: '#0ea5e9' },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { color: '#334155', marginBottom: 6, fontWeight: '600' },
  fieldInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#0f172a', backgroundColor: '#fff' },
  saveBtn: { marginTop: 6, backgroundColor: '#0ea5e9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
