import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { Expense, getExpenses, addExpense } from '../services/expenseService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getISTDate } from '../utils/dateUtils';

const colors = {
  primary: { 500: '#0ea5e9', 600: '#0284c7' },
  bg: { white: '#ffffff', light: '#f8fafc' },
  gray: { 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 600: '#475569', 800: '#1e293b' },
  success: { 500: '#10b981' },
  danger: { 500: '#ef4444' },
};

export default function ExpenseScreen() {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [adding, setAdding] = useState(false);

  const todayIST = getISTDate();
  const dateLabel = todayIST.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

  const fetchTodayExpenses = async () => {
    try {
      setLoading(true);
      const result = await getExpenses({ type: 'today' });
      if (Array.isArray(result)) {
        setExpenses(result);
      } else {
        handleServiceError(result, 'getExpenses');
      }
    } catch (error) {
      handleServiceError(error, 'getExpenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayExpenses();
  }, []);

  const onAddExpense = async () => {
    const amt = parseFloat(amount);
    if (!type.trim()) {
      Alert.alert('Validation', 'Enter a type/description');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation', 'Enter a valid amount');
      return;
    }

    try {
      setAdding(true);
      const newExpense: Expense = {
        type: type.trim(),
        amount: amt,
        createdAt: getISTDate(),
      };
      const res = await addExpense(newExpense);
      if (res !== true) {
        handleServiceError(res, 'addExpense');
        return;
      }
      setType('');
      setAmount('');
      await fetchTodayExpenses();
      Alert.alert('Success', 'Expense added');
    } catch (error) {
      handleServiceError(error, 'addExpense');
    } finally {
      setAdding(false);
    }
  };

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
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.subtitle}>Today • {dateLabel} (IST)</Text>
      </View>

      <View style={styles.addForm}>
        <TextInput
          style={styles.input}
          placeholder="Type (e.g. Diesel, Rent, Misc)"
          placeholderTextColor={colors.gray[400]}
          value={type}
          onChangeText={setType}
        />
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor={colors.gray[400]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={styles.addBtn} onPress={onAddExpense} disabled={adding}>
          {adding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Add Expense</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={() => (
            <Text style={styles.empty}>No expenses recorded today</Text>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.white, padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.gray[800] },
  subtitle: { fontSize: 14, color: colors.gray[600], marginTop: 4 },
  addForm: { backgroundColor: colors.bg.light, padding: 12, borderRadius: 12, marginBottom: 12 },
  input: { backgroundColor: '#fff', borderColor: colors.gray[200], borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[600], borderRadius: 10, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.gray[200] },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  expenseType: { fontSize: 16, color: colors.gray[800], fontWeight: '600' },
  expenseTime: { fontSize: 12, color: colors.gray[600], marginTop: 2 },
  amount: { fontSize: 16, color: colors.gray[800], fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.gray[600], marginTop: 24 },
});
