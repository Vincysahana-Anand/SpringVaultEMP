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
import { getFirestore, collection, query, where, getDocs, limit } from '@react-native-firebase/firestore';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { getOrders } from '../services/orderService';
import { getISTDate } from '../utils/dateUtils';

const logo = require('../assets/banner.png');
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const DRAWER_WIDTH = 280;

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

  const drawerAnimation = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

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
      'water': '#06b6d4',
      'wallet': '#10b981',
      'clipboard-list': '#f59e0b',
      'currency-inr': '#10b981',
      'cash': '#10b981',
      'credit-card': '#3b82f6',
      'account': '#8b5cf6',
      'cube': '#06b6d4',
      'logout': '#ef4444',
      'home': '#3b82f6',
      'shopping': '#f59e0b',
      'receipt': '#10b981',
      'help-circle': '#8b5cf6',
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

  const SaleCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={styles.saleCard}>
      <Text style={[styles.saleLabel, { color }]}>{label}</Text>
      <Text style={styles.saleValue}>₹{value.toLocaleString()}</Text>
    </View>
  );

  const ActionButton = ({ icon, label, primary }: { icon: IconName; label: string; primary?: boolean }) => (
    <TouchableOpacity style={[styles.actionButton, primary && styles.actionButtonPrimary]}>
      <MaterialCommunityIcons name={icon} size={24} color={primary ? '#fff' : getIconColor(icon)} />
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={primary ? '#fff' : '#9ca3af'} />
    </TouchableOpacity>
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
                value={`₹${stats.accountBalance.toLocaleString()}`}
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
              <SaleCard label="Cash Sale" value={sales.cashSale} color="#10b981" />
              <SaleCard label="Online Sale" value={sales.onlineSale} color="#3b82f6" />
            </View>

            <View style={styles.salesGrid}>
              <SaleCard label="Account Sale" value={sales.accountSale} color="#8b5cf6" />
              <SaleCard label="Expense" value={sales.expense} color="#f59e0b" />
            </View>
          </View>

          {/* Today's Balance */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <MaterialCommunityIcons name="cash-multiple" size={24} color="#10b981" />
              <Text style={styles.balanceTitle}>Today's Balance</Text>
            </View>
            <Text style={styles.balanceValue}>₹{todayBalance.toLocaleString()}</Text>
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
            <MenuItem icon="water" label="Order Water" />
            <MenuItem icon="clipboard-text" label="My Orders" />
            <MenuItem icon="wallet" label="My Payments" />
            <MenuItem icon="help-circle" label="Support" />
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
          <TabButton icon="shopping" label="Orders" isActive={activeTab === 'Orders'} />
          <TabButton icon="calendar" label="Schedule" isActive={activeTab === 'Schedule'} />
          <TabButton icon="wallet" label="Earnings" isActive={activeTab === 'Earnings'} />
          <TabButton icon="help-circle" label="Support" isActive={activeTab === 'Support'} />
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
  expenseSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  salesGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  saleCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  saleLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  saleValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  balanceCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#059669',
  },
  actionsSection: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonPrimary: {
    backgroundColor: '#06b6d4',
    borderColor: '#06b6d4',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  actionLabelPrimary: {
    color: '#fff',
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
});
