import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

  useEffect(() => {
    fetchDashboardStats();
  }, []);

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

  const drawerMenuContent = (
    <>
      <Text style={styles.drawerTitle}>Menu</Text>
      <MenuItem icon="truck-check" label="Manage Deliveries" />
      <MenuItem icon="account-group" label="Manage Customers" />
      <MenuItem icon="account-tie" label="Manage Employees" />
      <MenuItem icon="cash" label="Manage Expenses" />
      <MenuItem icon="water" label="Manage Stock" />
      <MenuItem icon="chart-box" label="Reports" />
      <MenuItem icon="cog" label="Settings" />
      <MenuItem icon="logout" label="Sign Out" onPress={handleSignOut} />
    </>
  );

  const tabButtonsConfig = [
    { icon: 'home', label: 'Home' },
    { icon: 'account-group', label: 'Customers' },
    { icon: 'truck', label: 'Deliveries' },
    { icon: 'account-tie', label: 'Employees' },
    { icon: 'chart-box', label: 'Reports' },
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
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
