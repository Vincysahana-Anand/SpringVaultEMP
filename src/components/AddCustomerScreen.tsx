import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, BackHandler } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { addCustomer } from '../services/customerService';
import { handleServiceError } from '../services/serviceErrorWrapper';

interface Props {
  onBack?: () => void;
}

export default function AddCustomerScreen({ onBack }: Props) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternateContacts, setAlternateContacts] = useState('');
  const [doorNumber, setDoorNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [customerType, setCustomerType] = useState<'Residence' | 'Shop' | 'Party'>('Residence');
  const [canHolding, setCanHolding] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSave = async () => {
    if (!name.trim() || !mobile.trim() || !price) {
      Alert.alert('Validation', 'Name, mobile, and price are required');
      return;
    }
    const priceVal = parseInt(price, 10);
    const canVal = parseInt(canHolding || '0', 10) || 0;
    const advanceVal = parseInt(advanceAmount || '0', 10) || 0;
    if (isNaN(priceVal) || priceVal < 0) {
      Alert.alert('Validation', 'Enter a valid price');
      return;
    }
    try {
      setLoading(true);
      const res = await addCustomer({
        name: name.trim(),
        mobile: mobile.trim(),
        alternateContacts: alternateContacts
          .split(',')
          .map(c => c.trim())
          .filter(Boolean),
        doorNumber: doorNumber.trim(),
        floor: floor.trim(),
        street: street.trim(),
        area: area.trim(),
        advanceAmount: advanceVal,
        customerType,
        billingType: 'Cash',
        price: priceVal,
        canHolding: canVal,
        extraCanHolding: 0,
        balance: 0,
      });
      if (res !== undefined && typeof res === 'string') {
        Alert.alert('Success', 'Customer added', [{ text: 'OK', onPress: onBack }]);
      } else {
        handleServiceError(res, 'addCustomer');
      }
    } catch (e) {
      handleServiceError(e, 'addCustomer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add Customer</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Customer name" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Mobile</Text>
        <TextInput style={styles.input} value={mobile} onChangeText={setMobile} placeholder="10-digit mobile" keyboardType="phone-pad" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Alternate Contacts</Text>
        <TextInput style={styles.input} value={alternateContacts} onChangeText={setAlternateContacts} placeholder="Comma separated" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Door Number</Text>
        <TextInput style={styles.input} value={doorNumber} onChangeText={setDoorNumber} placeholder="Door / Flat" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Floor</Text>
        <TextInput style={styles.input} value={floor} onChangeText={setFloor} placeholder="Floor" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Street</Text>
        <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Street" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Area</Text>
        <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="Area / locality" />
      </View>

      <View style={[styles.fieldGroup, { gap: 10 }]}> 
        <Text style={styles.label}>Customer Type</Text>
        <View style={styles.badgeRow}>
          {(['Residence','Shop','Party'] as const).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.badge, customerType === type && styles.badgeActive]}
              onPress={() => setCustomerType(type)}
            >
              <Text style={[styles.badgeText, customerType === type && styles.badgeTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldGroup, { flex: 1 }]}> 
          <Text style={styles.label}>Can Holding</Text>
          <TextInput style={styles.input} value={canHolding} onChangeText={setCanHolding} placeholder="0" keyboardType="number-pad" />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.fieldGroup, { flex: 1 }]}> 
          <Text style={styles.label}>Advance Amount</Text>
          <TextInput style={styles.input} value={advanceAmount} onChangeText={setAdvanceAmount} placeholder="0" keyboardType="number-pad" />
        </View>
      </View>

      <View style={styles.fieldGroup}> 
        <Text style={styles.label}>Price</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="₹" keyboardType="number-pad" />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack} disabled={loading}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={loading}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
          <Text style={styles.primaryText}>{loading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8fafc' },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  row: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  secondaryText: { color: '#475569', fontWeight: '600' },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0ea5e9' },
  primaryText: { color: '#fff', fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: 10 },
  badge: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  badgeActive: { borderColor: '#0ea5e9', backgroundColor: '#e0f2fe' },
  badgeText: { color: '#475569', fontWeight: '600' },
  badgeTextActive: { color: '#0ea5e9' },
});
