import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { getCustomerPurchaseHistory, PurchaseRecord } from '../services/purchaseHistoryService';
import { handleServiceError } from '../services/serviceErrorWrapper';

interface Customer {
  id: string;
  name: string;
}

interface CustomerPurchaseHistoryScreenProps {
  customer: Customer;
  onBack: () => void;
}

export default function CustomerPurchaseHistoryScreen({
  customer,
  onBack,
}: CustomerPurchaseHistoryScreenProps) {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const parseDeliveredAtTimestamp = (record: PurchaseRecord) => {
    const raw = record.deliveredAt || '';
    // Support dd/MM/yy and dd/MM/yyyy with optional AM/PM
    const match = raw.match(/(\d{2})\/(\d{2})\/(\d{2,4}).*?(\d{2}):(\d{2})\s*([AaPp][Mm])?/);
    if (match) {
      const [, dd, mm, yy, hh, min, meridiem] = match;
      const yearNum = parseInt(yy, 10);
      const year = yy.length === 2 ? 2000 + yearNum : yearNum;
      let hours = parseInt(hh, 10);
      if (meridiem) {
        const isPM = meridiem.toLowerCase() === 'pm';
        hours = (hours % 12) + (isPM ? 12 : 0);
      }
      const date = new Date(year, parseInt(mm, 10) - 1, parseInt(dd, 10), hours, parseInt(min, 10));
      const ts = date.getTime();
      if (!Number.isNaN(ts)) return ts;
    }

    const parsedDelivered = new Date(raw).getTime();
    if (!Number.isNaN(parsedDelivered)) return parsedDelivered;

    const fallback = record.orderedAt ? new Date(record.orderedAt).getTime() : NaN;
    return Number.isNaN(fallback) ? 0 : fallback;
  };

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCustomerPurchaseHistory(customer.id);
      if (Array.isArray(result)) {
        // Show latest entries (highest index) first
        setPurchases([...result].reverse());
      } else {
        handleServiceError(result, 'getCustomerPurchaseHistory');
      }
    } catch (error) {
      handleServiceError(error, 'getCustomerPurchaseHistory');
    } finally {
      setLoading(false);
    }
  }, [customer.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const renderPurchase = ({ item }: { item: PurchaseRecord }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <MaterialCommunityIcons
            name={item.paymentMethod === 'online' ? 'credit-card-outline' : 'cash'}
            size={18}
            color={colors.primary[500]}
          />
          <Text style={styles.cardTitle}>{item.product}</Text>
        </View>
        <Text style={styles.cardAmount}>₹{item.amountPaid}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Delivered</Text>
        <Text style={styles.rowValue}>{item.deliveredQty}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Empty Collected</Text>
        <Text style={styles.rowValue}>{item.emptyQty}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Bill Amount</Text>
        <Text style={styles.rowValue}>₹{item.billAmount}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Delivered At</Text>
        <Text style={styles.rowValue}>{item.deliveredAt}</Text>
      </View>

      {item.paymentRef ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Payment Ref</Text>
          <Text style={styles.rowValue}>{item.paymentRef}</Text>
        </View>
      ) : null}
    </View>
  );

  const emptyState = (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="history" size={48} color={colors.gray[300]} />
      <Text style={styles.emptyTitle}>History yet to be made</Text>
      <Text style={styles.emptySubtitle}>No purchase history found for this customer.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Purchase History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadHistory} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.customerBanner}>
          <MaterialCommunityIcons name="account" size={18} color={colors.primary[500]} />
          <Text style={styles.customerName}>{customer.name}</Text>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
          </View>
        ) : purchases.length === 0 ? (
          emptyState
        ) : (
          <FlatList
            data={purchases}
            renderItem={renderPurchase}
            keyExtractor={(_, index) => `${customer.id}-${index}`}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        )}

        <View style={{ height: spacing[12] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing[8],
    marginLeft: -spacing[8],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
  },
  customerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    backgroundColor: colors.bg.white,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    borderRadius: borderRadius.md,
    marginBottom: spacing[12],
    ...elevation.sm,
  },
  customerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  listContent: {
    gap: spacing[10],
  },
  card: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[14],
    ...elevation.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[8],
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  cardAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
  },
  rowLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  rowValue: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[800],
    fontWeight: typography.fontWeight.semibold,
  },
  emptyContainer: {
    alignItems: 'center',
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[20],
    paddingHorizontal: spacing[12],
    ...elevation.sm,
  },
  emptyTitle: {
    marginTop: spacing[8],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  emptySubtitle: {
    marginTop: spacing[4],
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    textAlign: 'center',
  },
  loaderContainer: {
    paddingVertical: spacing[16],
  },
});
