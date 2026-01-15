import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getCustomers, Customer } from '../services/customerService';
import { handleServiceError } from '../services/serviceErrorWrapper';

interface Props { onBack?: () => void; }

export default function ExtraCanHoldingsScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

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
      const res = await getCustomers();
      if (Array.isArray(res)) {
        const filtered = res.filter(c => (c.extraCanHolding || 0) > 0);
        setCustomers(filtered);
      } else {
        handleServiceError(res, 'getCustomers');
      }
    } catch (e) {
      handleServiceError(e, 'getCustomers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const renderItem = ({ item }: { item: Customer }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="bottle-soda" size={20} color="#8b5cf6" />
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.count}>{item.extraCanHolding || 0} cans</Text>
      </View>
      <Text style={styles.sub}>{item.mobile}</Text>
      <Text style={styles.sub}>{item.area}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Extra Can Holdings</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /></View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No extra cans recorded</Text>}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  count: { fontWeight: '700', color: '#8b5cf6' },
  sub: { marginTop: 4, color: '#475569', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
