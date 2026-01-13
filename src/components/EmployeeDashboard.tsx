import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  BackHandler,
  RefreshControl,
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
      if (currentScreen === 'customers' || currentScreen === 'deliveries') {
        setCurrentScreen('dashboard');
        setActiveTab('Home');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [currentScreen]);

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

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch (e) {
      handleServiceError(e, 'signOut');
    }
  };

  const handleNavigateToCustomers = () => {
    setCurrentScreen('customers');
    setDrawerOpen(false);
  };

  const drawerMenuContent = (
    <>
      <Text style={styles.drawerTitle}>Menu</Text>
      <MenuItem icon="home" label="Dashboard" />
      <MenuItem icon="truck" label="My Deliveries" />
      <MenuItem icon="calendar" label="Schedule" />
      <MenuItem icon="wallet" label="Earnings" />
      <MenuItem icon="account-group" label="View Customers" onPress={handleNavigateToCustomers} />

      {isAdmin && (
        <>
          <Text style={[styles.drawerTitle, { marginTop: 20 }]}>Admin Options</Text>
          <MenuItem icon="account-group" label="Manage Employees" />
          <MenuItem icon="cash" label="Manage Expenses" />
          <MenuItem icon="chart-box" label="Reports" />
          <MenuItem icon="cog" label="Settings" />
        </>
      )}

      <MenuItem icon="logout" label="Sign Out" onPress={handleSignOut} />
    </>
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
    } else {
      setCurrentScreen('dashboard');
    }
  };

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
          <DeliveriesScreen userRole="employee" isAdmin={isAdmin} />
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
