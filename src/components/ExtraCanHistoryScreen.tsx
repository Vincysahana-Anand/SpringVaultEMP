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
import { DailyRecordEntry, getDailyRecord } from '../services/dailyRecordService';
import { getISTDate } from '../utils/dateUtils';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
import { getCustomers, Customer } from '../services/customerService';
import CustomerDetailsScreen from './CustomerDetailsScreen';

interface Props { onBack?: () => void; }

const EMPTY_RETURNED_DOC_ID = 'emptyReturned';

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

export default function ExtraCanHistoryScreen({ onBack }: Props) {
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
      const res = await getDailyRecord(EMPTY_RETURNED_DOC_ID, formatDateKey(date));
      if (Array.isArray(res)) {
        const onlyReturns = res
          .filter((e) => (e.emptyQty || 0) > 0)
          .sort((a, b) => parseDeliveredAt(b.deliveredAt) - parseDeliveredAt(a.deliveredAt));
        const sorted = onlyReturns;
        setEntries(sorted);
      } else {
        const err = handleServiceError(res, 'getDailyRecord');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'getDailyRecord');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries(selectedDate);
  }, [selectedDate]);

  const totals = useMemo(() => {
    const returned = entries.reduce((sum, e) => sum + (e.emptyQty || 0), 0);
    const customers = new Set(entries.map((e) => e.customerId).filter(Boolean)).size;
    return { returned, customers };
  }, [entries]);

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
      } else {
        const err = handleServiceError(res, 'getCustomers');
        showError(err.message);
      }
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
        extraCanHolding: entry.deliveredQty || 0,
      });
    } catch (e) {
      const err = handleServiceError(e, 'getCustomers');
      showError(err.message);
    } finally {
      setLoadingCustomer(false);
    }
  };

  const renderItem = ({ item }: { item: DailyRecordEntry }) => {
    const ts = parseDeliveredAt(item.deliveredAt);
    const when = ts ? new Date(ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openCustomerDetails(item)}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="bottle-soda-outline" size={20} color="#8b5cf6" />
          <Text style={styles.title}>{item.customerName}</Text>
          <Text style={styles.amount}>{item.emptyQty || 0}</Text>
        </View>
        <Text style={styles.sub}>{item.customerMobile || ''}</Text>
        <Text style={styles.sub}>Empty Returned: {item.emptyQty || 0}</Text>
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
        <Text style={styles.headerTitle}>Extra Can History</Text>
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
          <Text style={styles.dateSubtitle}>Empty Returned</Text>
        </View>
        <TouchableOpacity onPress={() => goToDay(1)} style={styles.dateBtn}>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /></View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, idx) => `${item.customerId || 'c'}-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No extra can history</Text>}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadEntries(selectedDate);
                setRefreshing(false);
              }}
              colors={["#8b5cf6"]}
              tintColor="#8b5cf6"
            />
          }
        />
      )}

      <View style={styles.summaryBar}>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryLabel}>returned</Text>
          <Text style={styles.summaryValue}>{totals.returned}</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryLabel}>customers</Text>
          <Text style={styles.summaryValue}>{totals.customers}</Text>
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

      {loadingCustomer ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
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
  amount: { fontWeight: '700', color: '#8b5cf6' },
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
