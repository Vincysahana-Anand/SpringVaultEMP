import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getOrders, Order } from '../services/orderService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getISTDate } from '../utils/dateUtils';

interface Props { onBack?: () => void; }

type DailySale = { date: string; amount: number; orders: number };

export default function PastSalesScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<DailySale[]>([]);

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
      const res = await getOrders();
      if (Array.isArray(res)) {
        const map: Record<string, DailySale> = {};
        res.forEach((o: Order) => {
          const ts = (o.timeStamp as any)?.toDate ? (o.timeStamp as any).toDate() : new Date(o.timeStamp || o.deliveredAt || o.orderedAt || 0);
          if (!ts || isNaN(ts.getTime())) return;
          const y = ts.getFullYear();
          const m = String(ts.getMonth() + 1).padStart(2, '0');
          const d = String(ts.getDate()).padStart(2, '0');
          const key = `${y}-${m}-${d}`;
          const amount = o.amountPaid || 0;
          if (!map[key]) map[key] = { date: key, amount: 0, orders: 0 };
          map[key].amount += amount;
          map[key].orders += 1;
        });
        const sorted = Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1));
        setDays(sorted);
      } else {
        handleServiceError(res, 'getOrders');
      }
    } catch (e) {
      handleServiceError(e, 'getOrders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const renderItem = ({ item }: { item: DailySale }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="chart-line" size={20} color="#0ea5e9" />
        <Text style={styles.title}>{item.date}</Text>
        <Text style={styles.amount}>₹{item.amount.toFixed(2)}</Text>
      </View>
      <Text style={styles.sub}>{item.orders} orders</Text>
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
        <Text style={styles.headerTitle}>Past Sales</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0ea5e9" /></View>
      ) : (
        <FlatList
          data={days}
          keyExtractor={(item, idx) => item.date + idx}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No sales found</Text>}
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
  amount: { fontWeight: '700', color: '#0ea5e9' },
  sub: { marginTop: 4, color: '#475569', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
