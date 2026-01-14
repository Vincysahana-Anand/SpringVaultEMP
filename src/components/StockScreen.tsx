import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getStocks, updateStock, Stock } from '../services/stockService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import EditStockScreen from './EditStockScreen';

interface StockScreenProps {
  userRole?: 'owner' | 'employee';
}

const colors = {
  primary: { 50: '#f0f9ff', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1' },
  success: { 500: '#10b981', 600: '#059669' },
  danger: { 500: '#ef4444', 600: '#dc2626' },
  warning: { 500: '#f59e0b', 600: '#d97706' },
  bg: { white: '#ffffff', light: '#f8fafc', dark: '#1e293b' },
  gray: { 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 800: '#1e293b' },
  border: '#e2e8f0',
};

const typography = {
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24 },
  fontWeight: { normal: '400' as const, semibold: '600' as const, bold: '700' as const },
};

const spacing = {
  2: 8,
  4: 12,
  6: 16,
  8: 24,
  10: 32,
  12: 40,
  16: 64,
  24: 96,
};

const borderRadius = { md: 12, lg: 16, xl: 20 };

export default function StockScreen({ userRole = 'employee' }: StockScreenProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  useEffect(() => {
    loadStocks();
  }, []);

  const sortStocks = (stocksToSort: Stock[]): Stock[] => {
    const order: { [key: string]: number } = {
      '20L_CAN': 1,
      '1L_CASE': 2,
      '500ML_CASE': 3,
      '300ML_CASE': 4,
      '20L_PARTY_CAN': 5,
    };

    return [...stocksToSort].sort((a, b) => {
      const orderA = order[a.id] || 999;
      const orderB = order[b.id] || 999;
      return orderA - orderB;
    });
  };

  const loadStocks = async () => {
    try {
      setLoading(true);
      const result = await getStocks();
      if (Array.isArray(result)) {
        const sorted = sortStocks(result);
        setStocks(sorted);
      } else {
        handleServiceError(result, 'getStocks');
      }
    } catch (error) {
      handleServiceError(error, 'loadStocks');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStocks();
    setRefreshing(false);
  };

  const handleEditStock = (stock: Stock) => {
    setSelectedStock(stock);
  };

  const handleCloseEditScreen = () => {
    setSelectedStock(null);
  };

  const handleEditSuccess = (updatedStock: Stock) => {
    setStocks(stocks.map(s => s.id === updatedStock.id ? updatedStock : s));
    setSelectedStock(null);
  };

  const renderStockCard = ({ item }: { item: Stock }) => {
    // Check if this product type should show empty and extra can
    const is20LOrParty = item.id === '20L_CAN' || item.id === '20L_PARTY_CAN';

    return (
      <TouchableOpacity 
        style={styles.stockCard}
        onPress={() => handleEditStock(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.productInfo}>
            <MaterialCommunityIcons name="water" size={24} color={colors.primary[500]} />
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{item.productName}</Text>
              <Text style={styles.productId}>ID: {item.id}</Text>
            </View>
          </View>
          {userRole === 'owner' && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditStock(item)}
            >
              <MaterialCommunityIcons name="pencil" size={18} color={colors.primary[600]} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.statsContainer}>
          {/* Quantity */}
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Available Qty</Text>
            <Text style={styles.statValue}>{item.quantity || 0}</Text>
            <Text style={styles.statUnit}>Units</Text>
          </View>

          {/* Price */}
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Price</Text>
            <Text style={[styles.statValue, { color: colors.success[600] }]}>₹{(item as any).price || 0}</Text>
            <Text style={styles.statUnit}>Per Unit</Text>
          </View>

          {/* Empty - Only for 20L and Party Can */}
          {is20LOrParty && item.empty !== undefined && (
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Empty</Text>
              <Text style={[styles.statValue, { color: colors.warning[600] }]}>{item.empty || 0}</Text>
              <Text style={styles.statUnit}>Units</Text>
            </View>
          )}

          {/* Extra Can - Only for 20L and Party Can */}
          {is20LOrParty && item.extraCan !== undefined && (
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Extra Can</Text>
              <Text style={[styles.statValue, { color: colors.success[600] }]}>{item.extraCan || 0}</Text>
              <Text style={styles.statUnit}>Units</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading stocks...</Text>
      </View>
    );
  }

  // If a stock is selected for editing, show the edit screen
  if (selectedStock) {
    return (
      <EditStockScreen
        stock={selectedStock}
        userRole={userRole}
        onGoBack={handleCloseEditScreen}
        onSuccess={handleEditSuccess}
      />
    );
  }

  return (
    <View style={styles.container}>

      {stocks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="package-variant-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyText}>No stocks available</Text>
        </View>
      ) : (
        <FlatList
          data={stocks}
          renderItem={renderStockCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.light,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
  },
  header: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.bg.dark,
    marginBottom: spacing[2],
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  listContent: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: spacing[4],
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
  },
  stockCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.bg.dark,
  },
  productId: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
    marginTop: spacing[2],
  },
  editButton: {
    padding: spacing[2],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing[4],
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
    marginBottom: spacing[2],
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[500],
  },
  statUnit: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginTop: spacing[2],
  },
});
