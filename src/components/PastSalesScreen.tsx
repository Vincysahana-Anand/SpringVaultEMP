import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
import { getISTDate } from '../utils/dateUtils';
import { getSalesRecord, SalesRecord } from '../services/salesService';

interface Props { onBack?: () => void; }

export default function PastSalesScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const yesterday = getISTDate();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [sales, setSales] = useState<SalesRecord | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onBack]);

  const load = async (date: Date) => {
    try {
      setLoading(true);
      const dateKey = formatDateKey(date);
      const res = await getSalesRecord(dateKey);
      if (res === null) {
        setSales(null);
      } else if (res && !(res as any).code && !(res as any).message) {
        setSales(res as SalesRecord);
      } else {
        const err = handleServiceError(res as any, 'getSalesRecord');
        showError(err.message);
        setSales(null);
      }
    } catch (e) {
      const err = handleServiceError(e, 'getSalesRecord');
      showError(err.message);
      setSales(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(selectedDate); }, [selectedDate]);

  const salesTotals = useMemo(() => {
    const data = sales || {} as SalesRecord;
    const cashPayment = data.cashPayment || 0;
    const onlinePayment = data.onlinePayment || 0;
    const cashBillsPayment = data.cashBillsPayment || 0;
    const onlineBillsPayment = data.onlineBillsPayment || 0;
    const expense = data.expense || 0;
    const totalSale = data.totalSale || 0;
    const pendingPaymentsReceived = (data.pendingPaymentReceived || 0) + cashBillsPayment + onlineBillsPayment;
    const inHandCash = cashPayment + cashBillsPayment - expense;
    return { cashPayment, onlinePayment, cashBillsPayment, onlineBillsPayment, expense, totalSale, pendingPaymentsReceived, inHandCash };
  }, [sales]);

  const dateLabel = useMemo(() => formatDisplayDate(selectedDate), [selectedDate]);

  const goToDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    next.setHours(0, 0, 0, 0);
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    if (next > today) return;
    setSelectedDate(next);
  };

  const SalesStat = ({ label, value, highlight, bold }: { label: string; value: number; highlight?: boolean; bold?: boolean }) => (
    <View style={[styles.statItem, highlight && styles.statHighlight]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, bold && styles.statValueBold, highlight && styles.statValueHighlight]}>₹{value}</Text>
    </View>
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(selectedDate);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Past Sales</Text>
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} tintColor="#0ea5e9" />}
      >
        <View style={styles.dateBar}>
          <TouchableOpacity onPress={() => goToDay(-1)} style={styles.dateBtn}>
            <MaterialCommunityIcons name="chevron-left" size={22} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.dateTitle}>{dateLabel}</Text>
            <Text style={styles.dateSubtitle}>Sales summary</Text>
          </View>
          <TouchableOpacity onPress={() => goToDay(1)} style={styles.dateBtn}>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.salesHeader}>
            <Text style={styles.salesTitle}>Totals</Text>
            {loading ? <ActivityIndicator size="small" color="#0ea5e9" /> : null}
          </View>
          {sales || loading ? (
            <View style={styles.salesGrid}>
              <SalesStat label="Cash payments" value={salesTotals.cashPayment} />
              <SalesStat label="Online payments" value={salesTotals.onlinePayment} />
              <SalesStat label="Cash bills" value={salesTotals.cashBillsPayment} />
              <SalesStat label="Online bills" value={salesTotals.onlineBillsPayment} />
              <SalesStat label="Expense" value={salesTotals.expense} />
              <SalesStat label="Total sale" value={salesTotals.totalSale} bold />
              <SalesStat label="Pending payments received" value={salesTotals.pendingPaymentsReceived} highlight />
              <SalesStat label="In-hand cash" value={salesTotals.inHandCash} highlight />
            </View>
          ) : (
            <Text style={styles.empty}>No sales found</Text>
          )}
        </View>
      </ScrollView>

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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1, textAlign: 'center' },
  dateIconBtn: { padding: 6, marginLeft: 6 },
  dateBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  dateBtn: { padding: 6 },
  dateTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  dateSubtitle: { color: '#475569', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 12, marginTop: 8 },
  salesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  salesTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  salesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { width: '48%', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { color: '#475569', fontSize: 12, fontWeight: '600' },
  statValue: { color: '#0f172a', fontWeight: '700', fontSize: 16, marginTop: 4 },
  statValueBold: { fontSize: 17 },
  statHighlight: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  statValueHighlight: { color: '#0ea5e9' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 8 },
});

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (date: Date) => {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
