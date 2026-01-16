import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { Expense, getExpenses } from '../services/expenseService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
import { getISTDate } from '../utils/dateUtils';
import DropletLoader from './DropletLoader';

const colors = {
  primary: { 500: '#0ea5e9', 600: '#0284c7' },
  bg: { white: '#ffffff', light: '#f8fafc' },
  gray: { 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 600: '#475569', 800: '#1e293b' },
  success: { 500: '#10b981' },
  danger: { 500: '#ef4444' },
};

export default function ExpenseScreen({ onAddPress }: { onAddPress?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const todayIST = getISTDate();

  const fetchTodayExpenses = async () => {
    try {
      setLoading(true);
      const result = await getExpenses({ type: 'today' });
      if (Array.isArray(result)) {
        setExpenses(result);
        const total = result.reduce((sum, e) => sum + (e.amount || 0), 0);
        setTotalExpense(total);
      } else {
        const err = handleServiceError(result, 'getExpenses');
        showError(err.message);
      }
    } catch (error) {
      const err = handleServiceError(error, 'getExpenses');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayExpenses();
  }, []);



  const renderItem = ({ item }: { item: Expense }) => {
    const created = (item as any)?.createdAt;
    let whenStr = '';
    try {
      const d: Date = created?.toDate ? created.toDate() : created instanceof Date ? created : new Date(created);
      whenStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      whenStr = '';
    }
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <MaterialCommunityIcons name="cash" size={24} color={colors.primary[600]} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.expenseType}>{item.type}</Text>
            {whenStr ? <Text style={styles.expenseTime}>{whenStr}</Text> : null}
          </View>
        </View>
        <Text style={styles.amount}>₹ {item.amount.toFixed(2)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <DropletLoader visible={true} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={() => (
            <Text style={styles.empty}>No expenses recorded today</Text>
          )}
        />
      )}
      
      <View style={styles.bottomContainer}>
        <View style={styles.summaryChip}>
          <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.primary[600]} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.summaryLabel}>Today's Expense</Text>
            <Text style={styles.summaryAmount}>₹ {totalExpense.toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => onAddPress && onAddPress()}>
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.white },
  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderTopWidth: 1, borderTopColor: colors.gray[200] },
  summaryChip: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary[500], paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  summaryLabel: { fontSize: 10, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' },
  summaryAmount: { fontSize: 14, color: '#fff', fontWeight: '700', marginTop: 2 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success[500], paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, elevation: 1 },
  addButtonText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.gray[200] },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  expenseType: { fontSize: 16, color: colors.gray[800], fontWeight: '600' },
  expenseTime: { fontSize: 12, color: colors.gray[600], marginTop: 2 },
  amount: { fontSize: 16, color: colors.gray[800], fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.gray[600], marginTop: 24 },
});
