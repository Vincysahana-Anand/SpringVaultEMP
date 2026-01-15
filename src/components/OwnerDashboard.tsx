import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  BackHandler,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
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
import AddExpenseScreen from './AddExpenseScreen';
import AddCustomerScreen from './AddCustomerScreen';
import PastDeliveriesScreen from './PastDeliveriesScreen';
import PaymentBalancesScreen from './PaymentBalancesScreen';
import ExtraCanHoldingsScreen from './ExtraCanHoldingsScreen';
import PastSalesScreen from './PastSalesScreen';
import PastExpensesScreen from './PastExpensesScreen';

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
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (currentScreen === 'customers' || currentScreen === 'deliveries' || currentScreen === 'stock') {
        setCurrentScreen('dashboard');
        setActiveTab('Home');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [currentScreen, drawerOpen]);

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

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

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen);
    closeDrawer();
  };

  const drawerMenuContent = (
    <>
      <Text style={styles.drawerTitle}>Quick Access</Text>
      <MenuItem icon="account-plus" label="Add Customer" onPress={() => handleNavigate('addCustomer')} />
      <MenuItem icon="history" label="Past Deliveries" onPress={() => handleNavigate('pastDeliveries')} />
      <MenuItem icon="wallet-outline" label="Payment Balances" onPress={() => handleNavigate('paymentBalances')} />
      <MenuItem icon="bottle-soda" label="Extra Can Holdings" onPress={() => handleNavigate('extraCan')} />
      <MenuItem icon="chart-line" label="Past Sales" onPress={() => handleNavigate('pastSales')} />
      <MenuItem icon="cash-multiple" label="Past Expenses" onPress={() => handleNavigate('pastExpenses')} />
    </>
  );

  const drawerFooter = (
    <View style={{ gap: 12 }}>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
        onPress={() => handleNavigate('counterSale')}
      >
        <MaterialCommunityIcons name="cart-outline" size={20} color="#0ea5e9" />
        <Text style={{ color: '#0ea5e9', fontWeight: '700' }}>Counter Sale</Text>
      </TouchableOpacity>

      <View style={{ height: 1, backgroundColor: '#e5e7eb' }} />

      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
        onPress={handleSignOut}
      >
        <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
        <Text style={{ color: '#ef4444', fontWeight: '700' }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  const PlaceholderCard = ({ title, subtitle, icon }: { title: string; subtitle: string; icon: any }) => (
    <View style={{ padding: 16 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MaterialCommunityIcons name={icon} size={22} color="#0ea5e9" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>{title}</Text>
        </View>
        <Text style={{ marginTop: 10, color: '#475569', lineHeight: 20 }}>{subtitle}</Text>
      </View>
    </View>
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
        onDrawerOpen={openDrawer}
        onDrawerClose={closeDrawer}
        drawerContent={drawerMenuContent}
        drawerFooter={drawerFooter}
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
          <ExpenseScreen onAddPress={() => setCurrentScreen('addExpense')} />
        ) : currentScreen === 'addExpense' ? (
          <AddExpenseScreen onBack={() => setCurrentScreen('expense')} />
        ) : currentScreen === 'addCustomer' ? (
          <AddCustomerScreen onBack={() => setCurrentScreen('dashboard')} />
        ) : currentScreen === 'pastDeliveries' ? (
          <PastDeliveriesScreen onBack={() => setCurrentScreen('dashboard')} />
        ) : currentScreen === 'paymentBalances' ? (
          <PaymentBalancesScreen onBack={() => setCurrentScreen('dashboard')} />
        ) : currentScreen === 'extraCan' ? (
          <ExtraCanHoldingsScreen onBack={() => setCurrentScreen('dashboard')} />
        ) : currentScreen === 'pastSales' ? (
          <PastSalesScreen onBack={() => setCurrentScreen('dashboard')} />
        ) : currentScreen === 'pastExpenses' ? (
          <PastExpensesScreen onBack={() => setCurrentScreen('dashboard')} />
        ) : currentScreen === 'counterSale' ? (
          <PlaceholderCard
            title="Counter Sale"
            subtitle="Quick counter billing will appear here."
            icon="cart-outline"
          />
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
