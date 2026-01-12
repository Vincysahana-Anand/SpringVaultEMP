import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  PanResponder,
  TouchableOpacity,
  Image,
  Pressable,
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

const logo = require('../assets/banner.png');
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const DRAWER_WIDTH = 280;

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  const drawerAnimation = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    loadEmployeeData();
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
    Animated.spring(drawerAnimation, {
      toValue: drawerOpen ? -DRAWER_WIDTH : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setDrawerOpen(!drawerOpen);
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
          const newValue = -gestureState.dx;
          if (newValue <= DRAWER_WIDTH) {
            drawerAnimation.setValue(-newValue);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > DRAWER_WIDTH / 2) {
          toggleDrawer();
        } else if (drawerOpen && gestureState.dx < -DRAWER_WIDTH / 2) {
          toggleDrawer();
        } else {
          Animated.spring(drawerAnimation, {
            toValue: drawerOpen ? 0 : -DRAWER_WIDTH,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const getIconColor = (icon: string) => {
    const colorMap: Record<string, string> = {
      'truck': '#3b82f6',
      'clock': '#f59e0b',
      'cash': '#10b981',
      'chart-line': '#8b5cf6',
      'water': '#06b6d4',
      'account-multiple': '#ec4899',
      'truck-check': '#3b82f6',
      'account-group': '#ec4899',
      'account-tie': '#6366f1',
      'chart-box': '#8b5cf6',
      'cog': '#6b7280',
      'logout': '#ef4444',
      'home': '#3b82f6',
      'schedule': '#f59e0b',
      'wallet': '#10b981',
      'checkmark-circle': '#10b981',
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
      {subLabel && <Text style={styles.subLabel}>{subLabel}</Text>}
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

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch (e) {
      handleServiceError(e, 'signOut');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View {...panResponder.panHandlers} style={styles.container}>
        {/* Edge Indicator */}
        <View style={styles.edgeIndicator}>
          <View style={styles.edgeBar} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} scrollEventThrottle={16}>
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
                value={`$${stats.todayEarnings.toLocaleString()}`}
              />
            </View>
          </View>

          {/* Total Earnings */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                icon="cash"
                label="Total Earnings"
                value={`$${stats.totalEarnings.toLocaleString()}`}
                bgColor="#f0fdf4"
              />
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
            <MenuItem icon="home" label="Dashboard" />
            <MenuItem icon="truck" label="My Deliveries" />
            <MenuItem icon="calendar" label="Schedule" />
            <MenuItem icon="wallet" label="Earnings" />

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
          <TabButton icon="truck" label="Deliveries" isActive={activeTab === 'Deliveries'} />
          <TabButton icon="calendar" label="Schedule" isActive={activeTab === 'Schedule'} />
          <TabButton icon="wallet" label="Earnings" isActive={activeTab === 'Earnings'} />
          {isAdmin && <TabButton icon="cog" label="Admin" isActive={activeTab === 'Admin'} />}
        </View>
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
  statCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statIconStyle: {
    marginRight: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  subLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 16,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    justifyContent: 'flex-start',
  },
  drawerLogo: {
    height: 50,
    width: 50,
  },
  drawerContent: {
    paddingVertical: 12,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  menuIconStyle: {
    width: 20,
  },
  menuLabel: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 15,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#cffafe',
  },
  tabLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#0ea5b8',
    fontWeight: '600',
  },
  welcome: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
});
