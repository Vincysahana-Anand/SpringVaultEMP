import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getFirestore, collection, query, where, getDocs, limit } from '@react-native-firebase/firestore';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getOrders } from '../services/orderService';
import { getISTDate } from '../utils/dateUtils';
import { StatCard } from '../shared/components/StatCard';
import { MenuItem } from '../shared/components/MenuItem';
import { EdgeIndicator } from '../shared/components/EdgeIndicator';
import { ActionButton } from '../shared/components/ActionButton';
import { SaleCard } from '../shared/components/SaleCard';
import { getIconColor } from '../shared/icons/colorMap';
import { currencyINR } from '../utils/format';
import { DrawerLayout } from '../shared/layout/DrawerLayout';
import { colors, spacing, elevation, typography, borderRadius } from '../shared/theme/theme';

const logo = require('../assets/banner.png');
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function CustomerDashboard() {
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    myBottles: 0,
    accountBalance: 0,
    pendingOrders: 0,
  });
  const [sales, setSales] = useState({
    cashSale: 0,
    onlineSale: 0,
    accountSale: 0,
    expense: 0,
  });
  const [todayBalance, setTodayBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [customerId, setCustomerId] = useState('');

  useEffect(() => {
    loadCustomerData();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user && user.email) {
        const db = getFirestore();
        const usersQuery = query(collection(db, 'users'), where('email', '==', user.email), limit(1));
        const snap = await getDocs(usersQuery);
        if (!snap.empty) {
          const userData = snap.docs[0].data() as any;
          setCustomerId(snap.docs[0].id);
          setUserName(userData.name || user.email?.split('@')[0] || 'Customer');
        }
      }
    } catch (e) {
      handleServiceError(e, 'fetchUserProfile');
    }
  };

  const loadCustomerData = async () => {
    try {
      setLoading(true);

      // Fetch orders for customer
      const ordersResult = await getOrders();
      const orders = Array.isArray(ordersResult) ? ordersResult : [];
      
      const totalDeliveries = orders.length;
      const pendingOrders = orders.filter(o => !o.deliveredAt).length;
      
      // Calculate bottles (assuming quantity field in orders)
      const myBottles = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
      
      // Calculate account balance (total amount paid)
      const accountBalance = orders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);

      // Calculate sales breakdown
      const cashSale = orders
        .filter(o => o.paymentMethod === 'cash')
        .reduce((sum, o) => sum + (o.amountPaid || 0), 0);
      
      const onlineSale = orders
        .filter(o => o.paymentMethod === 'online')
        .reduce((sum, o) => sum + (o.amountPaid || 0), 0);
      
      const accountSale = orders
        .filter(o => o.paymentMethod === 'account')
        .reduce((sum, o) => sum + (o.amountPaid || 0), 0);

      // For expense, we'll use a placeholder value of 0 since Order doesn't have expense field
      const expense = 0;

      // Today's balance calculation
      const todayBalance = cashSale + onlineSale + accountSale - expense;

      setStats({
        totalDeliveries,
        myBottles,
        accountBalance,
        pendingOrders,
      });

      setSales({
        cashSale,
        onlineSale,
        accountSale,
        expense,
      });

      setTodayBalance(todayBalance);
      setLoading(false);
    } catch (e) {
      handleServiceError(e, 'loadCustomerData');
      setLoading(false);
    }
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Using shared ActionButton and SaleCard components

  // Using shared MenuItem and TabButton

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch (e) {
      handleServiceError(e, 'signOut');
    }
  };

  const drawerMenuContent = (
    <>
      <Text style={styles.drawerTitle}>Menu</Text>
      <MenuItem icon="home" label="Dashboard" />
      <MenuItem icon="water" label="Order Water" />
      <MenuItem icon="clipboard-text" label="My Orders" />
      <MenuItem icon="wallet" label="My Payments" />
      <MenuItem icon="help-circle" label="Support" />
      <MenuItem icon="logout" label="Sign Out" onPress={handleSignOut} />
    </>
  );

  const tabButtonsConfig = [
    { icon: 'home', label: 'Home' },
    { icon: 'account', label: 'User' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <EdgeIndicator />
      <DrawerLayout
        drawerOpen={drawerOpen}
        onDrawerToggle={toggleDrawer}
        drawerContent={drawerMenuContent}
        drawerLogo={logo}
        onTabChange={setActiveTab}
        tabButtons={tabButtonsConfig.map((tab) => ({
          ...tab,
          isActive: activeTab === tab.label,
        }))}
      >
        <ScrollView
          style={styles.content}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadCustomerData} />
          }
        >
          {/* Welcome */}
          <Text style={styles.welcome}>Welcome, {userName}!</Text>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                icon="truck"
                label="Total Deliveries"
                value={stats.totalDeliveries}
              />
              <StatCard
                icon="water"
                label="My Bottles"
                value={stats.myBottles}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                icon="wallet"
                label="Account Balance"
                value={currencyINR(stats.accountBalance)}
                bgColor="#f0fdf4"
              />
              <StatCard
                icon="clipboard-list"
                label="Pending Orders"
                value={stats.pendingOrders}
                bgColor="#fff7ed"
              />
            </View>
          </View>

          {/* Expense Section */}
          <View style={styles.expenseSection}>
            <View style={styles.expenseHeader}>
              <MaterialCommunityIcons name="currency-inr" size={24} color="#10b981" />
              <Text style={styles.expenseTitle}>Expense</Text>
            </View>

            <View style={styles.salesGrid}>
              <SaleCard label="Cash Sale" value={sales.cashSale} color={colors.success[700]} />
              <SaleCard label="Online Sale" value={sales.onlineSale} color={colors.info[500]} />
            </View>

            <View style={styles.salesGrid}>
              <SaleCard label="Account Sale" value={sales.accountSale} color={colors.purple[500]} />
              <SaleCard label="Expense" value={sales.expense} color={colors.warning[500]} />
            </View>
          </View>

          {/* Today's Balance */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <MaterialCommunityIcons name="cash-multiple" size={24} color="#10b981" />
              <Text style={styles.balanceTitle}>Today's Balance</Text>
            </View>
            <Text style={styles.balanceValue}>{currencyINR(todayBalance)}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <ActionButton icon="water" label="Order Water" primary />
            <ActionButton icon="clipboard-text" label="My Orders" />
            <ActionButton icon="wallet" label="My Payments" />
            <ActionButton icon="help-circle" label="Support" />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </DrawerLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.light,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  welcome: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    marginBottom: spacing[20],
  },
  statsGrid: {
    marginBottom: spacing[16],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[12],
    marginBottom: spacing[12],
  },
  expenseSection: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[16],
  },
  expenseTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  salesGrid: {
    flexDirection: 'row',
    gap: spacing[12],
    marginBottom: spacing[12],
  },
  saleCard: {
    flex: 1,
    padding: spacing[12],
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saleLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[8],
  },
  saleValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  balanceCard: {
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[16],
    borderWidth: 1,
    borderColor: colors.success[700],
    ...elevation.sm,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[12],
  },
  balanceTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  balanceValue: {
    fontSize: typography.fontSize['5xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  actionsSection: {
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  drawerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    paddingHorizontal: spacing[20],
    marginTop: spacing[12],
    marginBottom: spacing[8],
  },
});
