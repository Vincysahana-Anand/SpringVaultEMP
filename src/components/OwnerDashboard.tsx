import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  BackHandler,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StatCard } from '../shared/components/StatCard';
import { MenuItem } from '../shared/components/MenuItem';
import { EdgeIndicator } from '../shared/components/EdgeIndicator';
import { getIconColor } from '../shared/icons/colorMap';
import { currencyINR } from '../utils/format';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getOrders } from '../services/orderService';
import { getCustomers } from '../services/customerService';
import { getStocks } from '../services/stockService';
import { getExpenses } from '../services/expenseService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { DrawerLayout } from '../shared/layout/DrawerLayout';
import CustomersListScreen from './CustomersListScreen';
import DeliveriesScreen from './DeliveriesScreen';
import StockScreen from './StockScreen';
import ExpenseScreen from './ExpenseScreen';

const logo = require('../assets/banner.png');
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function OwnerDashboard() {
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    pendingDeliveries: 0,
    sale: 0,
    expense: 0,
    stock: 0,
    customers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('dashboard');

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    const handleBackPress = () => {
      if (currentScreen === 'customers' || currentScreen === 'deliveries' || currentScreen === 'stock') {
        setCurrentScreen('dashboard');
        setActiveTab('Home');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [currentScreen]);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleNavigateToExpenses = () => {
    setCurrentScreen('expense');
    setActiveTab('Expense');
    setDrawerOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch (e) {
      handleServiceError(e, 'signOut');
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      // Fetch orders
      const ordersResult = await getOrders();
      const orders = Array.isArray(ordersResult) ? ordersResult : [];
      const totalDeliveries = orders.length;
      const pendingDeliveries = orders.filter(o => !o.deliveredAt).length;

      // Fetch customers
      const customersResult = await getCustomers();
      const customers = Array.isArray(customersResult) ? customersResult : [];

      // Fetch stocks
      const stocksResult = await getStocks();
      const stocks = Array.isArray(stocksResult) ? stocksResult : [];
      const totalStock = stocks.reduce((sum, s) => sum + (s.quantity || 0), 0);

      // Fetch expenses (today)
      const expensesResult = await getExpenses({ type: 'today' });
      const expenses = Array.isArray(expensesResult) ? expensesResult : [];
      const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      // Calculate total sales (from orders)
      const totalSale = orders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);

      setStats({
        totalDeliveries,
        pendingDeliveries,
        sale: totalSale,
        expense: totalExpense,
        stock: totalStock,
        customers: customers.length,
      });
      setLoading(false);
    } catch (e) {
      handleServiceError(e, 'fetchDashboardStats');
      setLoading(false);
    }
  };

  // Using shared getIconColor from src/shared/icons/colorMap

  // StatCard now imported from shared/components/StatCard

  // Using shared MenuItem and TabButton

  const handleNavigateToCustomers = () => {
    setCurrentScreen('customers');
    setDrawerOpen(false);
  };

  const drawerMenuContent = (
    <>
      <Text style={styles.drawerTitle}>Menu</Text>
      <MenuItem icon="truck-check" label="Manage Deliveries" />
      <MenuItem icon="account-group" label="Manage Customers" onPress={handleNavigateToCustomers} />
      <MenuItem icon="account-tie" label="Manage Employees" />
      <MenuItem icon="cash" label="Manage Expenses" onPress={handleNavigateToExpenses} />
      <MenuItem icon="water" label="Manage Stock" />
      <MenuItem icon="chart-box" label="Reports" />
      <MenuItem icon="cog" label="Settings" />
      <MenuItem icon="logout" label="Sign Out" onPress={handleSignOut} />
    </>
  );

  const handleTabChange = (tabLabel: string) => {
    setActiveTab(tabLabel);
    if (tabLabel === 'Customers') {
      setCurrentScreen('customers');
    } else if (tabLabel === 'Deliveries') {
      setCurrentScreen('deliveries');
    } else if (tabLabel === 'Stock') {
      setCurrentScreen('stock');
    } else if (tabLabel === 'Expense') {
      setCurrentScreen('expense');
    } else {
      setCurrentScreen('dashboard');
    }
  };

  const tabButtonsConfig = [
    { icon: 'home', label: 'Home' },
    { icon: 'account-group', label: 'Customers' },
    { icon: 'truck', label: 'Deliveries' },
    { icon: 'cash', label: 'Expense' },
    { icon: 'water', label: 'Stock' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <EdgeIndicator />
      <DrawerLayout
        drawerOpen={drawerOpen}
        onDrawerToggle={toggleDrawer}
        drawerContent={drawerMenuContent}
        drawerLogo={logo}
        onTabChange={handleTabChange}
        tabButtons={tabButtonsConfig.map((tab) => ({
          ...tab,
          isActive: activeTab === tab.label,
        }))}
      >
        {currentScreen === 'customers' ? (
          <CustomersListScreen />
        ) : currentScreen === 'deliveries' ? (
          <DeliveriesScreen userRole="owner" isAdmin={true} />
        ) : currentScreen === 'stock' ? (
          <StockScreen userRole="owner" />
        ) : currentScreen === 'expense' ? (
          <ExpenseScreen />
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={fetchDashboardStats} />
            }
          >
          {/* Welcome */}
          <Text style={styles.welcome}>Welcome, Admin!</Text>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                icon="truck"
                label="Total Deliveries"
                value={stats.totalDeliveries}
                subLabel={undefined}
              />
              <StatCard
                icon="clock"
                label="Pending Deliveries"
                value={stats.pendingDeliveries}
                subLabel={undefined}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                icon="cash"
                label="Sale"
                value={currencyINR(stats.sale)}
                subLabel={undefined}
                bgColor="#f0fdf4"
              />
              <StatCard
                icon="chart-line"
                label="Expense"
                value={currencyINR(stats.expense)}
                subLabel={undefined}
                bgColor="#fff5f5"
              />
            </View>
          </View>

          {/* More Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                icon="water"
                label="Stock"
                value={stats.stock}
                subLabel="Bottles"
              />
              <StatCard icon="account-multiple" label="Customers" value={stats.customers} subLabel={undefined} />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
        )}
      </DrawerLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  welcome: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  statsGrid: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
});
