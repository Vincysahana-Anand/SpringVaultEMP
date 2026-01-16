import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { addExpense } from '../services/expenseService';
import { addExpenseToSales } from '../services/salesService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getISTDate } from '../utils/dateUtils';
import { showError, showSuccess } from '../shared/feedback/messageBus';

const colors = {
  primary: { 50: '#f5f7ff', 200: '#d6e4f7', 500: '#5b9eff', 600: '#4a8ce6' },
  success: { 600: '#4ade80' },
  gray: { 50: '#fafbfc', 100: '#f1f3f7', 150: '#eef1f7', 200: '#e8ecf4', 300: '#d5dce9', 400: '#9ca3b5', 500: '#6b7280', 600: '#525966', 700: '#3a4150', 800: '#1e2936', 900: '#0f1419' },
  border: '#d5dce9',
  bg: { white: '#ffffff', light: '#f5f7fa' },
};

const TYPES = ['Petrol', 'Diesel', 'Food', 'Salary', 'Load', 'Loan', 'Other'];

const typeIcons: { [key: string]: string } = {
  'Petrol': 'gas-cylinder',
  'Diesel': 'gas-cylinder',
  'Food': 'food',
  'Salary': 'cash',
  'Load': 'package',
  'Loan': 'bank',
  'Other': 'dots-horizontal-circle',
};

const typeIconColors: { [key: string]: string } = {
  'Petrol': '#f59e0b',
  'Diesel': '#d97706',
  'Food': '#ef4444',
  'Salary': '#10b981',
  'Load': '#8b5cf6',
  'Loan': '#3b82f6',
  'Other': '#6b7280',
};

const getIconColor = (type: string, isSelected: boolean): string => {
  return isSelected ? '#4a8ce6' : typeIconColors[type] || '#6b7280';
};

export default function AddExpenseScreen({ onBack }: { onBack: () => void }) {
  const [selectedType, setSelectedType] = useState<string>('Petrol');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!selectedType) {
      showError('Select an expense type', { title: 'Validation' });
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      showError('Enter a valid amount', { title: 'Validation' });
      return;
    }
    try {
      setSaving(true);
      const result = await addExpense({ type: selectedType, amount: amt, createdAt: getISTDate() });
      if (result !== true) {
        const err = handleServiceError(result, 'addExpense');
        showError(err.message);
        setSaving(false);
        return;
      }
      const salesRes = await addExpenseToSales(amt);
      if (salesRes !== true) {
        const err = handleServiceError(salesRes, 'addExpenseToSales');
        showError(err.message);
        setSaving(false);
        return;
      }
      showSuccess('Expense saved');
      onBack();
    } catch (e) {
      const err = handleServiceError(e, 'AddExpense');
      showError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Type Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type</Text>
          <View style={styles.badgeContainer}>
            {TYPES.map((t, idx) => (
              <TouchableOpacity
                key={t}
                onPress={() => setSelectedType(t)}
                style={[styles.badge, t === 'Other' && { width: '100%', justifyContent: 'center' }, selectedType === t && styles.badgeActive]}
              >
                <MaterialCommunityIcons 
                  name={typeIcons[t] as any} 
                  size={18} 
                  color={getIconColor(t, selectedType === t)} 
                  style={styles.badgeIcon}
                />
                <Text style={[styles.badgeText, selectedType === t && styles.badgeTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amount Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.gray[400]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Summary Card */}
        {amount && selectedType && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type:</Text>
              <Text style={styles.summaryValue}>{selectedType}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 8 }]}>
              <Text style={styles.summaryLabel}>Amount:</Text>
              <Text style={styles.summaryAmount}>₹ {parseFloat(amount || '0').toFixed(2)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Fixed Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onBack}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
              <Text style={styles.saveText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.bg.light, borderBottomWidth: 0 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: colors.gray[800] },
  content: { paddingBottom: 110, paddingHorizontal: 16, paddingTop: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.gray[800], marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  badge: { width: '48%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.gray[100], borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgeIcon: { },
  badgeActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  badgeText: { color: colors.gray[700], fontWeight: '500', fontSize: 12, textAlign: 'center' },
  badgeTextActive: { color: colors.primary[600], fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.bg.light, paddingHorizontal: 12 },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: colors.gray[600], marginRight: 6 },
  input: { flex: 1, paddingHorizontal: 8, paddingVertical: 12, fontSize: 16, color: colors.gray[800] },
  summaryCard: { backgroundColor: colors.primary[50], borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: colors.primary[200] },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: colors.gray[600], fontWeight: '500' },
  summaryValue: { fontSize: 13, color: colors.gray[700], fontWeight: '600' },
  summaryAmount: { fontSize: 14, color: colors.primary[600], fontWeight: '700' },
  buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, gap: 10, backgroundColor: colors.bg.light, borderTopWidth: 1, borderTopColor: colors.border },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 6, alignItems: 'center', backgroundColor: colors.gray[100], borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.gray[700], fontWeight: '600', fontSize: 13 },
  saveBtn: { flex: 1.2, flexDirection: 'row', paddingVertical: 11, borderRadius: 6, backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center', gap: 6, elevation: 1 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
