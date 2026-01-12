import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getOrders } from '../services/orderService';
import { getCustomers } from '../services/customerService';
import { getStocks } from '../services/stockService';
import { getExpenses } from '../services/expenseService';
import { handleServiceError } from '../services/serviceErrorWrapper';

const logo = require('../assets/banner.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = 280;

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
  const drawerAnimation = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const toggleDrawer = () => {
    const toValue = drawerOpen ? -DRAWER_WIDTH : 0;
    Animated.spring(drawerAnimation, {
      toValue,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setDrawerOpen(!drawerOpen);
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch (e) {
      handleServiceError(e, 'signOut');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        const { locationX } = evt.nativeEvent;
        return locationX < 20 && !drawerOpen;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx <= DRAWER_WIDTH) {
          drawerAnimation.setValue(-DRAWER_WIDTH + gestureState.dx);
        } else if (drawerOpen && gestureState.dx < 0) {
          // Allow dragging left to close when drawer is open
          const newValue = -gestureState.dx;
          if (newValue <= DRAWER_WIDTH) {
            drawerAnimation.setValue(-newValue);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > DRAWER_WIDTH / 2) {
          // Open drawer
          toggleDrawer();
        } else if (drawerOpen && gestureState.dx < -DRAWER_WIDTH / 2) {
          // Close drawer when dragged left
          toggleDrawer();
        } else {
          // Snap back
          Animated.spring(drawerAnimation, {
            toValue: drawerOpen ? 0 : -DRAWER_WIDTH,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

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

  const getIconColor = (icon: string) => {
    const colorMap: Record<string, string> = {
      'truck': '#3b82f6',           // Blue
      'clock': '#f59e0b',           // Amber
      'cash': '#10b981',            // Emerald
      'chart-line': '#8b5cf6',      // Violet
      'water': '#06b6d4',           // Cyan
      'account-multiple': '#ec4899', // Pink
      'truck-check': '#3b82f6',     // Blue
      'account-group': '#ec4899',   // Pink
      'account-tie': '#6366f1',     // Indigo
      'chart-box': '#8b5cf6',       // Violet
      'cog': '#6b7280',             // Gray
      'logout': '#ef4444',          // Red
      'menu': '#6b7280',            // Gray
    };
    return colorMap[icon] || '#6b7280';
  };

  const StatCard = ({ icon, label, value, subLabel, bgColor = '#fff' }: { icon: IconName; label: string; value: string | number; subLabel?: string; bgColor?: string }) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={styles.statContent}>
        <MaterialCommunityIcons name={icon} size={20} color={getIconColor(icon)} style={styles.statIconStyle} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {subLabel && <Text style={styles.statSubLabel}>{subLabel}</Text>}
    </View>
  );

  const MenuItem = ({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={20} color={getIconColor(icon)} style={styles.menuIconStyle} />
      <Text style={styles.menuLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  const TabButton = ({ icon, label, isActive }: { icon: IconName; label: string; isActive: boolean }) => (
    <Pressable
      onPress={() => setActiveTab(label)}
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={isActive ? '#0ea5b8' : '#6b7280'}
      />
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Left Edge Indicator Bar */}
      <View style={styles.edgeIndicator} {...panResponder.panHandlers}>
        <View style={styles.edgeBar} />
      </View>

      {/* Main Content */}
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
              value={`$${stats.sale.toLocaleString()}`}
              subLabel={undefined}
              bgColor="#f0fdf4"
            />
            <StatCard
              icon="chart-line"
              label="Expense"
              value={`$${stats.expense.toLocaleString()}`}
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

      {/* Drawer Menu */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: drawerAnimation }] },
        ]}
      >
        <View style={styles.drawerHeader}>
          <Image source={logo} style={styles.drawerLogo} resizeMode="contain" />
        </View>
        
        <ScrollView style={styles.drawerContent}>
          <Text style={styles.drawerTitle}>Menu</Text>
          <MenuItem icon="truck-check" label="Manage Deliveries" />
          <MenuItem icon="account-group" label="Manage Customers" />
          <MenuItem icon="account-tie" label="Manage Employees" />
          <MenuItem icon="cash" label="Manage Expenses" />
          <MenuItem icon="water" label="Manage Stock" />
          <MenuItem icon="chart-box" label="Reports" />
          <MenuItem icon="cog" label="Settings" />
          <MenuItem icon="logout" label="Sign Out" onPress={handleSignOut} />
        </ScrollView>
      </Animated.View>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={toggleDrawer}
        />
      )}

      {/* Bottom Tab Navigation */}
      <View style={styles.tabBar}>
        <TabButton icon="home" label="Home" isActive={activeTab === 'Home'} />
        <TabButton
          icon="account-group"
          label="Customers"
          isActive={activeTab === 'Customers'}
        />
        <TabButton
          icon="truck"
          label="Deliveries"
          isActive={activeTab === 'Deliveries'}
        />
        <TabButton
          icon="account-tie"
          label="Employees"
          isActive={activeTab === 'Employees'}
        />
        <TabButton
          icon="chart-box"
          label="Reports"
          isActive={activeTab === 'Reports'}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
  },
  edgeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    zIndex: 10,
    justifyContent: 'center',
  },
  edgeBar: {
    width: 4,
    height: 40,
    backgroundColor: '#06b6d4',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    marginLeft: 0,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 2, height: 0 },
    shadowRadius: 8,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  drawerLogo: {
    width: '100%',
    height: 100,
  },
  drawerContent: {
    flex: 1,
    paddingVertical: 12,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: DRAWER_WIDTH,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 99,
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
  statCard: {
    flex: 1,
    marginHorizontal: 6,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconStyle: {
    marginRight: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  statSubLabel: {
    fontSize: 12,
    color: '#0ea5b8',
    fontWeight: '600',
  },
  menuSection: {
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuIconStyle: {
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabButtonActive: {},

  tabLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#0ea5b8',
    fontWeight: '600',
  },
});
