import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler, Platform } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { getExpenses, Expense } from '../services/expenseService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
import { getISTDate } from '../utils/dateUtils';

interface Props { onBack?: () => void; }

export default function PastExpensesScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [showPicker, setShowPicker] = useState(false);

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

  const load = async () => {
    try {
      setLoading(true);
      const res = await getExpenses({ type: '30days' });
      if (Array.isArray(res)) {
        const sorted = [...res].sort((a, b) => {
          const tA = toDateSafe(a.createdAt).getTime();
          const tB = toDateSafe(b.createdAt).getTime();
          return tB - tA;
        });
        setExpenses(sorted);
      } else {
        const err = handleServiceError(res, 'getExpenses');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'getExpenses');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const key = formatDateKey(selectedDate);
    return expenses.filter(e => formatDateKey(toDateSafe(e.createdAt)) === key);
  }, [expenses, selectedDate]);

  const dayTotal = useMemo(() => filtered.reduce((sum, e) => sum + (e.amount || 0), 0), [filtered]);

  const shiftDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    next.setHours(0, 0, 0, 0);
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    if (next > today) return;
    setSelectedDate(next);
  };

  const renderItem = ({ item }: { item: Expense }) => {
    const ts = toDateSafe(item.createdAt);
    const when = ts ? ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="cash-multiple" size={20} color="#ef4444" />
          <Text style={styles.title}>{item.type}</Text>
          <Text style={styles.amount}>₹{item.amount.toFixed(2)}</Text>
        </View>
        <Text style={styles.sub}>{when}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Past Expenses</Text>
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

      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => shiftDay(-1)} style={styles.dateBtn}>
          <MaterialCommunityIcons name="chevron-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.dateTitle}>{formatDisplayDate(selectedDate)}</Text>
          <Text style={styles.dateSubtitle}>Expenses</Text>
        </View>
        <TouchableOpacity onPress={() => shiftDay(1)} style={styles.dateBtn}>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#ef4444" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No expenses found</Text>}
        />
      )}

      <View style={styles.summaryBar}>
        <Text style={styles.summaryLabel}>Total</Text>
        <Text style={styles.summaryValue}>₹{dayTotal.toFixed(2)}</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1, textAlign: 'center' },
  dateIconBtn: { padding: 6, marginLeft: 6 },
  dateBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  dateBtn: { padding: 6 },
  dateTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  dateSubtitle: { color: '#475569', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 12, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  amount: { fontWeight: '700', color: '#ef4444' },
  sub: { marginTop: 4, color: '#475569', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  summaryBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  summaryLabel: { color: '#475569', fontWeight: '700' },
  summaryValue: { color: '#ef4444', fontWeight: '800', fontSize: 18 },
});

const toDateSafe = (value: any): Date => {
  if ((value as any)?.toDate) return (value as any).toDate();
  return new Date(value);
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

