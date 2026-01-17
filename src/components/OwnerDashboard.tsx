import React, { useState, useEffect, useMemo } from 'react';
import {
  AppState,
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
import { currencyINR } from '../utils/format';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getCustomers } from '../services/customerService';
import { getStocks } from '../services/stockService';
import { getExpenses } from '../services/expenseService';
import { getSalesRecord } from '../services/salesService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
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
import { getISTDate } from '../utils/dateUtils';
import { getOrders } from '../services/orderService';
import DropletLoader from './DropletLoader';
import CounterSaleScreen from './CounterSaleScreen';
import CustomerPurchaseHistoryScreen from './CustomerPurchaseHistoryScreen';
import { COUNTER_SALES_CUSTOMER_ID, COUNTER_SALES_CUSTOMER_NAME } from '../services/counterSaleService';
import UsersListScreen from './UsersListScreen';
import AddUserScreen from './AddUserScreen';
import EditUserScreen from './EditUserScreen';
import { User } from '../services/userService';

const logo = require('../assets/banner.png');

export default function OwnerDashboard() {
  const [stats, setStats] = useState({
    ordersToday: 0,
    deliveredToday: 0,
    pendingDeliveries: 0,
    deliveredCans: 0,
    emptyCollected: 0,
    sale: 0,
    cashPayment: 0,
    onlinePayment: 0,
    pendingPaymentsReceived: 0,
    expense: 0,
    inHandCash: 0,
    stockTotal: 0,
    stock20L: 0,
    stock20LEmpty: 0,
    stock20LExtra: 0,
    customers: 0,
    customersResidence: 0,
    customersShop: 0,
    customersParty: 0,
  });
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [snapshotDate, setSnapshotDate] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Refresh stats whenever the dashboard comes back into view.
  useEffect(() => {
    if (currentScreen === 'dashboard') {
      fetchDashboardStats();
    }
  }, [currentScreen]);

  // Also refresh when the app returns to foreground while on dashboard.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && currentScreen === 'dashboard') {
        fetchDashboardStats();
      }
    });

    return () => subscription.remove();
  }, [currentScreen]);

  useEffect(() => {
    const handleBackPress = () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }

      if (currentScreen === 'counterSaleHistory') {
        setCurrentScreen('counterSale');
        return true;
      }

      if (currentScreen === 'addUser' || currentScreen === 'editUser') {
        setCurrentScreen('users');
        return true;
      }

      if (
        currentScreen === 'customers' ||
        currentScreen === 'deliveries' ||
        currentScreen === 'stock' ||
        currentScreen === 'addCustomer' ||
        currentScreen === 'users' ||
        currentScreen === 'pastDeliveries' ||
        currentScreen === 'paymentBalances' ||
        currentScreen === 'extraCan' ||
        currentScreen === 'pastSales' ||
        currentScreen === 'pastExpenses' ||
        currentScreen === 'counterSale'
      ) {
        setCurrentScreen('dashboard');
        setActiveTab('Home');
        fetchDashboardStats();
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
    if (signingOut) return;
    try {
      setSigningOut(true);
      closeDrawer();
      await signOut(getAuth());
    } catch (e) {
      const err = handleServiceError(e, 'signOut');
      showError(err.message);
      setSigningOut(false);
    }
  };

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isServiceError = (res: any): res is { code: string; message: string } => {
    return !!(res && typeof res === 'object' && 'code' in res && 'message' in res);
  };

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const today = getISTDate();
      today.setHours(0, 0, 0, 0);
      setSnapshotDate(today);

      const [ordersResult, salesResult, stocksResult, customersResult, expensesResult] = await Promise.all([
        getOrders(),
        getSalesRecord(formatDateKey(today)),
        getStocks(),
        getCustomers(),
        getExpenses({ type: 'today' }),
      ]);

      const orders = Array.isArray(ordersResult) ? ordersResult : [];
      if (isServiceError(ordersResult)) {
        const err = handleServiceError(ordersResult, 'getOrders');
        showError(err.message);
      }

      const openOrders = orders.filter((order) => !order.deliveredAt);

      const sales = !isServiceError(salesResult) && salesResult ? salesResult : null;
      if (isServiceError(salesResult)) {
        const err = handleServiceError(salesResult, 'getSalesRecord');
        showError(err.message);
      }

      const stocks = Array.isArray(stocksResult) ? stocksResult : [];
      if (isServiceError(stocksResult)) {
        const err = handleServiceError(stocksResult, 'getStocks');
        showError(err.message);
      }

      const customers = Array.isArray(customersResult) ? customersResult : [];
      if (isServiceError(customersResult)) {
        const err = handleServiceError(customersResult, 'getCustomers');
        showError(err.message);
      }

      const customerTypeCounts = customers.reduce(
        (acc, cur) => {
          if (cur.customerType === 'Residence') acc.residence += 1;
          else if (cur.customerType === 'Shop') acc.shop += 1;
          else if (cur.customerType === 'Party') acc.party += 1;
          return acc;
        },
        { residence: 0, shop: 0, party: 0 }
      );

      const expenses = Array.isArray(expensesResult) ? expensesResult : [];
      if (isServiceError(expensesResult)) {
        const err = handleServiceError(expensesResult, 'getExpenses');
        showError(err.message);
      }

      const expenseTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      const ordersToday = sales?.orders || 0;
      const deliveredToday = sales?.delivered || 0;
      const deliveredCans = sales?.deliveredCans || 0;
      const emptyCollected = sales?.emptyCollected || 0;
      const pendingDeliveries = openOrders.length;

      const saleTotal = sales?.totalSale || 0;
      const cashPayment = sales?.cashPayment || 0;
      const onlinePayment = sales?.onlinePayment || 0;
      const pendingPaymentsReceived = (sales?.pendingPaymentReceived || 0) + (sales?.cashBillsPayment || 0) + (sales?.onlineBillsPayment || 0);
      const expenseValue = expenseTotal || sales?.expense || 0;
      const inHandCash = cashPayment + (sales?.pendingPaymentReceived || 0) + (sales?.cashBillsPayment || 0) - expenseValue;

      const stock20L = stocks.find((s) => s.id === '20L_CAN' || s.productName?.toLowerCase().includes('20') || s.productName?.toLowerCase().includes('20l'));
      const stock20LEmpty = stock20L?.empty || 0;
      const stock20LExtra = stock20L?.extraCan || 0;
      const stock20LQty = stock20L?.quantity || 0;
      const totalStock = (stock20L?.total as number | undefined) ?? stock20LQty;

      setStats({
        ordersToday,
        deliveredToday,
        pendingDeliveries,
        deliveredCans,
        emptyCollected,
        sale: saleTotal,
        cashPayment,
        onlinePayment,
        pendingPaymentsReceived,
        expense: expenseValue,
        inHandCash,
        stockTotal: totalStock,
        stock20L: stock20LQty,
        stock20LEmpty,
        stock20LExtra,
        customers: customers.length,
        customersResidence: customerTypeCounts.residence,
        customersShop: customerTypeCounts.shop,
        customersParty: customerTypeCounts.party,
      });
      setLoading(false);
    } catch (e) {
      const err = handleServiceError(e, 'fetchDashboardStats');
      showError(err.message);
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
      <MenuItem
        icon="account-cog-outline"
        label="Users"
        onPress={() => {
          setCurrentScreen('users');
          setActiveTab('Home');
          closeDrawer();
        }}
      />
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
        disabled={signingOut}
      >
        <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
        <Text style={{ color: '#ef4444', fontWeight: '700' }}>{signingOut ? 'Signing out...' : 'Sign Out'}</Text>
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

  const snapshotLabel = useMemo(() => {
    return snapshotDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [snapshotDate]);

  return (
    <SafeAreaView style={styles.container}>
      <EdgeIndicator />
      <DropletLoader visible={signingOut} />
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
          <CustomersListScreen allowCustomerDelete={true} />
        ) : currentScreen === 'users' ? (
          <UsersListScreen
            refreshKey={usersRefreshKey}
            onBack={() => {
              setCurrentScreen('dashboard');
              setActiveTab('Home');
              fetchDashboardStats();
            }}
            onAdd={() => {
              setSelectedUser(null);
              setCurrentScreen('addUser');
            }}
            onSelectUser={(u) => {
              setSelectedUser(u);
              setCurrentScreen('editUser');
            }}
          />
        ) : currentScreen === 'addUser' ? (
          <AddUserScreen
            onBack={() => setCurrentScreen('users')}
            onSaved={() => {
              setUsersRefreshKey((k) => k + 1);
              setCurrentScreen('users');
            }}
          />
        ) : currentScreen === 'editUser' ? (
          selectedUser ? (
            <EditUserScreen
              user={selectedUser}
              onBack={() => setCurrentScreen('users')}
              onSaved={() => {
                setUsersRefreshKey((k) => k + 1);
                setCurrentScreen('users');
              }}
            />
          ) : (
            <PlaceholderCard title="User not selected" subtitle="Please open a user from the list." icon="account-alert-outline" />
          )
        ) : currentScreen === 'deliveries' ? (
          <DeliveriesScreen userRole="owner" isAdmin={true} />
        ) : currentScreen === 'stock' ? (
          <StockScreen userRole="owner" />
        ) : currentScreen === 'expense' ? (
          <ExpenseScreen onAddPress={() => setCurrentScreen('addExpense')} />
        ) : currentScreen === 'addExpense' ? (
          <AddExpenseScreen onBack={() => setCurrentScreen('expense')} />
        ) : currentScreen === 'addCustomer' ? (
          <AddCustomerScreen
            onBack={() => {
              setCurrentScreen('dashboard');
              setActiveTab('Home');
              fetchDashboardStats();
            }}
          />
        ) : currentScreen === 'pastDeliveries' ? (
          <PastDeliveriesScreen
            onBack={() => {
              setCurrentScreen('dashboard');
              setActiveTab('Home');
              fetchDashboardStats();
            }}
          />
        ) : currentScreen === 'paymentBalances' ? (
          <PaymentBalancesScreen
            onBack={() => {
              setCurrentScreen('dashboard');
              setActiveTab('Home');
              fetchDashboardStats();
            }}
          />
        ) : currentScreen === 'extraCan' ? (
          <ExtraCanHoldingsScreen
            onBack={() => {
              setCurrentScreen('dashboard');
              setActiveTab('Home');
              fetchDashboardStats();
            }}
          />
        ) : currentScreen === 'pastSales' ? (
          <PastSalesScreen
            onBack={() => {
              setCurrentScreen('dashboard');
              setActiveTab('Home');
              fetchDashboardStats();
            }}
          />
        ) : currentScreen === 'pastExpenses' ? (
          <PastExpensesScreen
            onBack={() => {
              setCurrentScreen('dashboard');
              setActiveTab('Home');
              fetchDashboardStats();
            }}
          />
        ) : currentScreen === 'counterSale' ? (
          <CounterSaleScreen
            onBack={() => {
              setCurrentScreen('dashboard');
              setActiveTab('Home');
              fetchDashboardStats();
            }}
            onViewHistory={() => setCurrentScreen('counterSaleHistory')}
          />
        ) : currentScreen === 'counterSaleHistory' ? (
          <CustomerPurchaseHistoryScreen
            customer={{ id: COUNTER_SALES_CUSTOMER_ID, name: COUNTER_SALES_CUSTOMER_NAME }}
            onBack={() => setCurrentScreen('counterSale')}
          />
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={fetchDashboardStats} />
            }
          >
          <View style={styles.topRow}>
            <Text style={styles.welcome}>Welcome, Admin</Text>
            <View style={styles.datePill}>
              <MaterialCommunityIcons name="calendar" size={16} color="#475569" />
              <Text style={styles.snapshotDate}>{snapshotLabel}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Deliveries</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard icon="playlist-check" label="Pending deliveries" value={stats.pendingDeliveries} />
              <StatCard icon="truck-delivery" label="Delivered today" value={stats.deliveredToday} />
            </View>
            <View style={styles.statsRow}>
              <StatCard icon="bottle-soda" label="Delivered cans" value={stats.deliveredCans} />
              <StatCard icon="bottle-wine" label="Empty collected" value={stats.emptyCollected} />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Sales & Cash</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard icon="cash-plus" label="Cash payments" value={currencyINR(stats.cashPayment)} />
              <StatCard icon="credit-card" label="Online payments" value={currencyINR(stats.onlinePayment)} />
            </View>
            <View style={styles.statsRow}>
              <StatCard icon="cash" label="Sale" value={currencyINR(stats.sale)} bgColor="#f0fdf4" />
              <StatCard icon="hand-coin" label="Pending received" value={currencyINR(stats.pendingPaymentsReceived)} bgColor="#f5f3ff" />
            </View>
            <View style={styles.statsRow}>
              <StatCard icon="chart-line" label="Expense" value={currencyINR(stats.expense)} bgColor="#fff5f5" />
              <StatCard icon="wallet" label="In-hand cash" value={currencyINR(stats.inHandCash)} bgColor="#ecfeff" />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Inventory</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard icon="water" label="20L full" value={stats.stock20L} />
              <StatCard icon="bottle-wine" label="Empty cans" value={stats.stock20LEmpty} />
            </View>
            <View style={styles.statsRow}>
              <StatCard icon="bottle-soda-outline" label="Extra cans" value={stats.stock20LExtra} />
              <StatCard icon="warehouse" label="Total stock" value={stats.stockTotal} />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Customers</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard icon="home-account" label="Residence" value={stats.customersResidence} />
              <StatCard icon="store" label="Shop" value={stats.customersShop} />
            </View>
            <View style={styles.statsRow}>
              <StatCard icon="party-popper" label="Party" value={stats.customersParty} />
              <StatCard icon="account-multiple" label="Total customers" value={stats.customers} />
            </View>
          </View>

          <View style={{ height: 24 }} />
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  snapshotDate: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  statsGrid: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: 8,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
});
