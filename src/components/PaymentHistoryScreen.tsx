import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { DailyRecordEntry, getDailyRecordsByDate } from '../services/dailyRecordService';
import { getISTDate } from '../utils/dateUtils';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getCustomers, Customer } from '../services/customerService';
import CustomerDetailsScreen from './CustomerDetailsScreen';

interface Props {
  onBack?: () => void;
}

const PAYMENT_PRODUCT_KEY = 'payment';

// Parse deliveredAt string like "14/01/26, 02:30 PM" into timestamp
const parseDeliveredAt = (deliveredAt: string): number => {
  if (!deliveredAt) return 0;
  const [datePart, timePartRaw] = deliveredAt.split(',');
  if (!datePart || !timePartRaw) return 0;
  const [dd, mm, yy] = datePart.trim().split('/');
  const [timePart, meridiemRaw] = timePartRaw.trim().split(' ');
  const [hourStr, minuteStr] = timePart.split(':');
  const yearFull = Number(yy) + 2000;
  let hours = Number(hourStr) % 12;
  if ((meridiemRaw || '').toLowerCase() === 'pm') {
    hours += 12;
  }
  const minutes = Number(minuteStr);
  const date = new Date(Date.UTC(yearFull, Number(mm) - 1, Number(dd), hours, minutes));
  return date.getTime();
};

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (date: Date) => {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function PaymentHistoryScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<DailyRecordEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
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
  }, [onBack, selectedCustomer]);

  const loadEntries = async (date: Date) => {
    try {
      setLoading(true);
      const res = await getDailyRecordsByDate(formatDateKey(date));
      if (Array.isArray(res)) {
        const payments = res.filter(e => (e.product || '').toLowerCase() === PAYMENT_PRODUCT_KEY);
        const sorted = payments.sort((a, b) => parseDeliveredAt(b.deliveredAt) - parseDeliveredAt(a.deliveredAt));
        setEntries(sorted);
      } else {
        handleServiceError(res, 'getDailyRecordsByDate');
      }
    } catch (e) {
      handleServiceError(e, 'getDailyRecordsByDate');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries(selectedDate);
  }, [selectedDate]);

  const openCustomerDetails = async (entry: DailyRecordEntry) => {
    if (!entry.customerId) return;
    try {
      setLoadingCustomer(true);
      const res = await getCustomers();
      if (Array.isArray(res)) {
        const found = res.find(c => c.id === entry.customerId);
        if (found) {
          setSelectedCustomer(found as Customer);
          return;
        }
      }
      // Fallback with minimal data if not found
      setSelectedCustomer({
        id: entry.customerId,
        name: entry.customerName || 'Customer',
        mobile: entry.customerMobile || '',
        alternateContacts: [],
        doorNumber: '',
        floor: '',
        street: '',
        area: '',
        advanceAmount: 0,
        customerType: 'Residence',
        billingType: 'Cash',
        price: 0,
        canHolding: 0,
        balance: entry.amountPaid || 0,
        extraCanHolding: 0,
      });
    } catch (e) {
      handleServiceError(e, 'getCustomers');
    } finally {
      setLoadingCustomer(false);
    }
  };

  const totals = useMemo(() => {
    const cash = entries
      .filter(e => e.paymentMethod === 'cash')
      .reduce((sum, e) => sum + (e.amountPaid || 0), 0);
    const online = entries
      .filter(e => e.paymentMethod === 'online')
      .reduce((sum, e) => sum + (e.amountPaid || 0), 0);
    return { cash, online };
  }, [entries]);

  const renderItem = ({ item }: { item: DailyRecordEntry }) => {
    const ts = parseDeliveredAt(item.deliveredAt);
    const when = ts ? new Date(ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openCustomerDetails(item)}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="cash-multiple" size={20} color="#0ea5e9" />
          <Text style={styles.title}>{item.customerName}</Text>
          <Text style={[styles.amount, { color: item.paymentMethod === 'cash' ? '#16a34a' : '#2563eb' }]}>₹{item.amountPaid || 0}</Text>
        </View>
        <Text style={styles.sub}>{item.customerMobile || ''}</Text>
        <Text style={styles.sub}>Method: {item.paymentMethod === 'cash' ? 'Cash' : 'Online'}</Text>
        <Text style={styles.meta}>{when}</Text>
      </TouchableOpacity>
    );
  };

  const goToDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    next.setHours(0, 0, 0, 0);
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    if (next > today) return;
    setSelectedDate(next);
  };

  const dateLabel = useMemo(() => formatDisplayDate(selectedDate), [selectedDate]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Payment History</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS === 'android') {
                DateTimePickerAndroid.open({
                  value: selectedDate,
                  mode: 'date',
                  onChange: (event, date) => {
                    if (event.type === 'dismissed') return;
                    if (date) {
                      const next = new Date(date);
                      next.setHours(0, 0, 0, 0);
                      const today = getISTDate();
                      today.setHours(0, 0, 0, 0);
                      if (next > today) return;
                      setSelectedDate(next);
                    }
                  },
                  maximumDate: getISTDate(),
                });
              } else {
                setShowPicker(true);
              }
            }}
            style={styles.dateIconBtn}
          >
            <MaterialCommunityIcons name="calendar" size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => goToDay(-1)} style={styles.dateBtn}>
          <MaterialCommunityIcons name="chevron-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.dateTitle}>{dateLabel}</Text>
          <Text style={styles.dateSubtitle}>Payments</Text>
        </View>
        <TouchableOpacity onPress={() => goToDay(1)} style={styles.dateBtn}>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0ea5e9" /></View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, idx) => `${item.customerId || 'c'}-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No payments found</Text>}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadEntries(selectedDate);
                setRefreshing(false);
              }}
              colors={["#0ea5e9"]}
              tintColor="#0ea5e9"
            />
          }
        />
      )}

      {loadingCustomer ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : null}

      <View style={styles.summaryBar}>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryLabel}>cash</Text>
          <Text style={styles.summaryValue}>₹{totals.cash}</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryLabel}>online</Text>
          <Text style={styles.summaryValue}>₹{totals.online}</Text>
        </View>
      </View>

      {Platform.OS === 'ios' && showPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          onChange={(event, date) => {
            if (event.type === 'dismissed') {
              setShowPicker(false);
              return;
            }
            if (date) {
              const next = new Date(date);
              next.setHours(0, 0, 0, 0);
              const today = getISTDate();
              today.setHours(0, 0, 0, 0);
              if (next > today) {
                setShowPicker(false);
                return;
              }
              setSelectedDate(next);
            }
            setShowPicker(false);
          }}
          maximumDate={getISTDate()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 8 },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateIconBtn: { padding: 8 },
  dateBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  dateBtn: { padding: 6 },
  dateTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  dateSubtitle: { color: '#475569', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  amount: { fontWeight: '700' },
  sub: { marginTop: 6, color: '#475569', fontSize: 13 },
  meta: { marginTop: 4, color: '#94a3b8', fontSize: 12 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 140,
    justifyContent: 'space-between',
  },
  summaryLabel: { color: '#475569', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  summaryValue: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
