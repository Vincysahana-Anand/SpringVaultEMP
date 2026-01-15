import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getExpenses, Expense } from '../services/expenseService';
import { handleServiceError } from '../services/serviceErrorWrapper';

interface Props { onBack?: () => void; }

export default function PastExpensesScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);

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
          const tA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : new Date(a.createdAt).getTime();
          const tB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : new Date(b.createdAt).getTime();
          return tB - tA;
        });
        setExpenses(sorted);
        const sum = sorted.reduce((s, e) => s + (e.amount || 0), 0);
        setTotal(sum);
      } else {
        handleServiceError(res, 'getExpenses');
      }
    } catch (e) {
      handleServiceError(e, 'getExpenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const renderItem = ({ item }: { item: Expense }) => {
    const ts = (item.createdAt as any)?.toDate ? (item.createdAt as any).toDate() : new Date(item.createdAt);
    const when = ts ? ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
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
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Last 30 days</Text>
        <Text style={styles.summaryValue}>₹{total.toFixed(2)}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#ef4444" /></View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No expenses found</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 8 },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  summaryLabel: { color: '#475569', fontWeight: '600' },
  summaryValue: { color: '#ef4444', fontWeight: '800', fontSize: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  amount: { fontWeight: '700', color: '#ef4444' },
  sub: { marginTop: 4, color: '#475569', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
