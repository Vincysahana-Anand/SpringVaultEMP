import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler, Platform, RefreshControl } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { DailyRecordEntry, getDailyRecordsByDate } from '../services/dailyRecordService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getISTDate } from '../utils/dateUtils';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

interface Props {
  onBack?: () => void;
}

export default function PastDeliveriesScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<DailyRecordEntry[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('20L_CAN');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const yesterday = getISTDate();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const productOptions = [
    { id: '20L_CAN', label: '20L' },
    { id: '20L_PARTY_CAN', label: '20L-P' },
    { id: '1L_CASE', label: '1L' },
    { id: '500ML_CASE', label: '500ML' },
    { id: '300ML_CASE', label: '300ML' },
  ];

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

  const loadEntries = async (date: Date) => {
    try {
      setLoading(true);
      const dateKey = formatDateKey(date);
      const res = await getDailyRecordsByDate(dateKey);
      if (Array.isArray(res)) {
        const sorted = [...res].sort((a, b) => parseDeliveredAt(b.deliveredAt) - parseDeliveredAt(a.deliveredAt));
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

  const filteredEntries = useMemo(
    () => entries.filter(e => matchesProduct(e.product, selectedProduct, productOptions)),
    [entries, selectedProduct]
  );

  const totals = useMemo(() => {
    const delivered = filteredEntries.reduce((sum, e) => sum + (e.deliveredQty || 0), 0);
    const empty = filteredEntries.reduce((sum, e) => sum + (e.emptyQty || 0), 0);
    return { delivered, empty };
  }, [filteredEntries]);

  const renderItem = ({ item }: { item: DailyRecordEntry }) => {
    const ts = parseDeliveredAt(item.deliveredAt);
    const when = new Date(ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="truck" size={20} color="#0ea5e9" />
          <Text style={styles.title}>{item.customerName}</Text>
          <Text style={styles.amount}>₹{item.amountPaid || 0}</Text>
        </View>
        <Text style={styles.sub}>{item.product} • Delivered {item.deliveredQty} • Empty {item.emptyQty}</Text>
        <Text style={styles.meta}>{when}</Text>
      </View>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Past Deliveries</Text>
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

      <View style={styles.chipRow}>
        {productOptions.map(option => {
          const active = selectedProduct === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => setSelectedProduct(option.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => goToDay(-1)} style={styles.dateBtn}>
          <MaterialCommunityIcons name="chevron-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.dateTitle}>{dateLabel}</Text>
          <Text style={styles.dateSubtitle}>Daily report</Text>
        </View>
        <TouchableOpacity onPress={() => goToDay(1)} style={styles.dateBtn}>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0ea5e9" /></View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item, idx) => `${item.customerId || 'c'}-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No deliveries found</Text>}
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

      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Cans delivered</Text>
          <Text style={styles.summaryValue}>{totals.delivered}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Empty collected</Text>
          <Text style={styles.summaryValue}>{totals.empty}</Text>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  chipText: { color: '#0f172a', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  amount: { fontWeight: '700', color: '#0ea5e9' },
  sub: { marginTop: 6, color: '#475569', fontSize: 13 },
  meta: { marginTop: 4, color: '#94a3b8', fontSize: 12 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  summaryBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', padding: 12, backgroundColor: '#0f172a', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  summaryItem: { flex: 1 },
  summaryLabel: { color: '#cbd5e1', fontSize: 12 },
  summaryValue: { color: '#fff', fontWeight: '800', fontSize: 18, marginTop: 2 },
});

const sanitizeKey = (value?: string) => (value || '').toString().replace(/[^a-z0-9]/gi, '').toLowerCase();

const matchesProduct = (
  product?: string,
  selectedProductId?: string,
  options?: { id: string; label: string }[]
) => {
  if (!selectedProductId) return false;
  const target = options?.find(o => o.id === selectedProductId);
  const targetId = sanitizeKey(selectedProductId); // e.g., 20lcan
  const targetLabel = sanitizeKey(target?.label); // e.g., 20l
  const productKey = sanitizeKey(product); // e.g., 20lcan or 20l

  // Exact matches first
  if (productKey === targetId || productKey === targetLabel) return true;

  // Allow contains either way (handles values like "20L CAN", "20L-P", etc.)
  if (productKey.includes(targetId) || targetId.includes(productKey)) return true;
  if (productKey.includes(targetLabel) || targetLabel.includes(productKey)) return true;

  return false;
};

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDeliveredAt = (value: string) => {
  // deliveredAt stored as "dd/mm/yy, hh:mm AM/PM"
  if (!value) return 0;
  const [datePartRaw, timePartRaw] = value.split(',').map(v => v.trim());
  if (!datePartRaw) return 0;
  const [dd, mm, yy] = datePartRaw.split('/').map(v => parseInt(v, 10));
  const [time, meridiem] = (timePartRaw || '').split(' ');
  const [hh, min] = (time || '').split(':').map(v => parseInt(v, 10));
  const hours24 = (meridiem?.toLowerCase() === 'pm' && hh !== 12 ? hh + 12 : hh === 12 && meridiem?.toLowerCase() === 'am' ? 0 : hh) || 0;
  const fullYear = yy < 50 ? 2000 + yy : 1900 + yy;
  const dateObj = new Date(fullYear, (mm || 1) - 1, dd || 1, hours24, min || 0, 0);
  return dateObj.getTime();
};

const formatDisplayDate = (date: Date) => {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
