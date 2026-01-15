import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  BackHandler,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from '@react-native-firebase/firestore';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getOrders } from '../services/orderService';
import { getExpenses } from '../services/expenseService';
import { getCustomers } from '../services/customerService';
import { getStocks } from '../services/stockService';
import { getISTDate } from '../utils/dateUtils';
import { StatCard } from '../shared/components/StatCard';
import { getIconColor } from '../shared/icons/colorMap';
import { MenuItem } from '../shared/components/MenuItem';
import { EdgeIndicator } from '../shared/components/EdgeIndicator';
import { currencyINR } from '../utils/format';
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

export default function EmployeeDashboard() {
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    pendingDeliveries: 0,
    totalEarnings: 0,
    todayEarnings: 0,
    stock: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    loadEmployeeData();
    fetchUserProfile();
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
          setIsAdmin(userData.isAdmin || false);
          setUserName(userData.name || user.email?.split('@')[0] || 'Employee');
        }
      }
    } catch (e) {
      handleServiceError(e, 'fetchUserProfile');
    }
  };

  const loadEmployeeData = async () => {
    try {
      setLoading(true);

      // Fetch orders assigned to employee
      const ordersResult = await getOrders();
      const orders = Array.isArray(ordersResult) ? ordersResult : [];
      const totalDeliveries = orders.length;
      const pendingDeliveries = orders.filter(o => !o.deliveredAt).length;
      const completedDeliveries = orders.filter(o => o.deliveredAt).length;

      // Calculate earnings from orders
      const totalEarnings = orders.reduce((sum, o) => sum + (o.amountPaid || 0) * 0.1, 0);

      // Get today's earnings (using IST)
      const today = getISTDate();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const expensesResult = await getExpenses({ type: 'today' });
      const expenses = Array.isArray(expensesResult) ? expensesResult : [];
      const todayEarnings = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      // Fetch stocks
      const stocksResult = await getStocks();
      const stocks = Array.isArray(stocksResult) ? stocksResult : [];
      const totalStock = stocks.reduce((sum, s) => sum + (s.quantity || 0), 0);

      setStats({
        totalDeliveries,
        pendingDeliveries,
        totalEarnings,
        todayEarnings,
        stock: totalStock,
      });

      setLoading(false);
    } catch (e) {
      handleServiceError(e, 'loadEmployeeData');
      setLoading(false);
    }
  };

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen);
    closeDrawer();
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch (e) {
      handleServiceError(e, 'signOut');
    }
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

  const tabButtonsConfig = [
    { icon: 'home', label: 'Home' },
    { icon: 'account-group', label: 'Customers' },
    { icon: 'truck', label: 'Deliveries' },
    { icon: 'cash', label: 'Expense' },
    { icon: 'water', label: 'Stock' },
  ];

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
          <DeliveriesScreen userRole="employee" isAdmin={isAdmin} />
        ) : currentScreen === 'stock' ? (
          <StockScreen userRole="employee" />
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
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadEmployeeData} />
            }
          >
          {/* Welcome */}
          <Text style={styles.welcome}>Welcome, {userName}</Text>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                icon="truck"
                label="Total Deliveries"
                value={stats.totalDeliveries}
              />
              <StatCard
                icon="clock"
                label="Pending Deliveries"
                value={stats.pendingDeliveries}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                icon="water"
                label="Stock"
                value={stats.stock}
                subLabel="Bottles"
              />
              <StatCard
                icon="wallet"
                label="Today's Earnings"
                value={currencyINR(stats.todayEarnings)}
              />
            </View>
          </View>

          {/* Total Earnings */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                icon="cash"
                label="Total Earnings"
                value={currencyINR(stats.totalEarnings)}
                bgColor="#f0fdf4"
              />
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
    paddingTop: 16,
  },
  statsGrid: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  welcome: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
});
