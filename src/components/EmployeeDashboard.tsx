import React, { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  ScrollView,
  BackHandler,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getFirestore, collection, query, where, getDocs, limit } from '@react-native-firebase/firestore';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError, showSuccess } from '../shared/feedback/messageBus';
import { getOrders } from '../services/orderService';
import { getCustomers } from '../services/customerService';
import { getStocks } from '../services/stockService';
import { getISTDate, formatDateKey } from '../utils/dateUtils';
import { getSalesRecord, submitCashForToday, SalesRecord } from '../services/salesService';
import { getVaultRecord, setVaultRecord, VaultRecord } from '../services/vaultService';
import { getExpenses } from '../services/expenseService';
import { StatCard } from '../shared/components/StatCard';
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
import DropletLoader from './DropletLoader';
import CounterSaleScreen from './CounterSaleScreen';
import CustomerPurchaseHistoryScreen from './CustomerPurchaseHistoryScreen';
import { COUNTER_SALES_CUSTOMER_ID, COUNTER_SALES_CUSTOMER_NAME } from '../services/counterSaleService';
import ReportsScreen from './ReportsScreen';
import UserProfileScreen from './UserProfileScreen';
import PartyOrdersScreen from './PartyOrdersScreen';

const logo = require('../assets/banner.png');

export default function EmployeeDashboard() {
  const userRole: 'owner' | 'employee' = 'employee';
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
    vaultCash: 0,
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [snapshotDate, setSnapshotDate] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const snapshotLabel = useMemo(() => {
    return snapshotDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [snapshotDate]);
  const [showCloseSalePage, setShowCloseSalePage] = useState(false);
  const [showCloseSaleModal, setShowCloseSaleModal] = useState(false);
  const [closeCash, setCloseCash] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Refresh stats whenever the dashboard comes back into view.
  useEffect(() => {
    if (currentScreen === 'dashboard') {
      loadEmployeeData();
    }
  }, [currentScreen]);

  // Also refresh when the app returns to foreground while on dashboard.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && currentScreen === 'dashboard') {
        loadEmployeeData();
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

      if (
        currentScreen === 'customers' ||
        currentScreen === 'partyOrders' ||
        currentScreen === 'deliveries' ||
        currentScreen === 'stock' ||
        currentScreen === 'addCustomer' ||
        currentScreen === 'profile' ||
        currentScreen === 'reports' ||
        currentScreen === 'pastDeliveries' ||
        currentScreen === 'paymentBalances' ||
        currentScreen === 'extraCan' ||
        currentScreen === 'pastSales' ||
        currentScreen === 'pastExpenses' ||
        currentScreen === 'counterSale'
      ) {
        setCurrentScreen('dashboard');
        setActiveTab('Home');
        loadEmployeeData();
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
      const err = handleServiceError(e, 'fetchUserProfile');
      showError(err.message);
    }
  };

  const isServiceError = (res: any): res is { code: string; message: string } => {
    return !!(res && typeof res === 'object' && 'code' in res && 'message' in res);
  };

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      const today = getISTDate();
      today.setHours(0, 0, 0, 0);
      setSnapshotDate(today);

      const [ordersResult, salesResult, stocksResult, customersResult, expensesResult, vaultResult] = await Promise.all([
        getOrders(),
        getSalesRecord(formatDateKey(today)),
        getStocks(),
        getCustomers(),
        getExpenses({ type: 'today' }),
        getVaultRecord(),
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

      const expenses = Array.isArray(expensesResult) ? expensesResult : [];
      if (isServiceError(expensesResult)) {
        const err = handleServiceError(expensesResult, 'getExpenses');
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

      const expenseTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      const ordersToday = sales?.orders || 0;
      const deliveredToday = sales?.delivered || 0;
      const deliveredCans = sales?.deliveredCans || 0;
      const emptyCollected = sales?.emptyCollected || 0;
      const pendingDeliveries = openOrders.length;

      const saleTotal = sales?.totalSale || 0;
      const cashPayment = (sales?.cashPayment || 0) + (sales?.cashBillsPayment || 0) || 0;
      const onlinePayment = (sales?.onlinePayment || 0) + (sales?.onlineBillsPayment || 0) || 0;
      const pendingPaymentsReceived = (sales?.pendingPaymentReceived || 0);
      const expenseValue = expenseTotal || sales?.expense || 0;
      // vault cash overrides in-hand calculation
      let computedInHand = cashPayment +  (sales?.cashBillsPayment || 0) - expenseValue;
      let vaultCash = 0;
      if (vaultResult && !(vaultResult as any).code) {
        vaultCash = (vaultResult as any).cash || 0;
        computedInHand = vaultCash;
      }
      const inHandCash = computedInHand;

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
        // optional vaultCash available separately if needed
        vaultCash: vaultCash,
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
      const err = handleServiceError(e, 'loadEmployeeData');
      showError(err.message);
      setLoading(false);
    }
  };

    const openDrawer = () => setDrawerOpen(true);
    const closeDrawer = () => setDrawerOpen(false);

    const handleNavigate = (screen: string) => {
      if (screen === 'reports' && !isAdmin) {
        showError('Admin access required');
        closeDrawer();
        return;
      }
      setCurrentScreen(screen);
      closeDrawer();
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

    const drawerMenuContent = (
      <>
        <MenuItem icon="account-plus" label="Add Customer" onPress={() => handleNavigate('addCustomer')} />
        {isAdmin ? (
          <MenuItem icon="file-chart-outline" label="Reports" onPress={() => handleNavigate('reports')} />
        ) : null}
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

  const handleCloseSale = async () => {
    const cashVal = parseInt(closeCash, 10) || 0;
    // vault update using latest sales numbers (needed to compute vaultCash value)
    let vaultCashVal: number | undefined;
    try {
      const salesRes = await getSalesRecord();
      if (salesRes && !(salesRes as any).code) {
        const sales = salesRes as SalesRecord;
        const vaultRec = await getVaultRecord();
        if (vaultRec && !(vaultRec as any).code) {
          const existingCash = (vaultRec as VaultRecord).cash || 0;
          const existingOnline = (vaultRec as VaultRecord).online || 0;
          const cashIncrement = sales.cashPayment + (sales.cashBillsPayment || 0);
          const onlineIncrement = sales.onlinePayment + (sales.onlineBillsPayment || 0);
          const newCash = existingCash + cashIncrement;
          const newOnline = existingOnline + onlineIncrement;
          const total = newCash + newOnline;
          await setVaultRecord({ cash: newCash, online: newOnline, total });
          vaultCashVal = newCash;
        }
      }
    } catch (e) {
      console.error('Error updating vault after close sale', e);
    }

    // submit cash after vault updated so we can include vaultCash
    try {
      const res = await submitCashForToday(cashVal, vaultCashVal);
      if (res === true) {
        showSuccess(`Marked ₹${cashVal} cash for today's sale`);
      } else {
        const err = res as any;
        showError(err.message || 'Failed to submit cash');
      }
    } catch (e) {
      showError('Unexpected error submitting cash');
    }

    setCloseCash('');
    setShowCloseSalePage(false);
  };
  
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
            <CustomersListScreen allowCustomerDelete={false} userRole="employee" isAdmin={isAdmin} />
          ) : currentScreen === 'partyOrders' ? (
            <PartyOrdersScreen allowCustomerDelete={false} userRole="employee" isAdmin={isAdmin} />
          ) : currentScreen === 'profile' ? (
            <UserProfileScreen
              allowEdit={isAdmin}
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
            />
          ) : currentScreen === 'deliveries' ? (
            <DeliveriesScreen userRole="employee" isAdmin={isAdmin} />
          ) : currentScreen === 'reports' ? (
            <ReportsScreen
              userRole="employee"
              isAdmin={isAdmin}
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
            />
          ) : currentScreen === 'stock' ? (
            <StockScreen userRole="employee" />
          ) : currentScreen === 'expense' ? (
            <ExpenseScreen onAddPress={() => setCurrentScreen('addExpense')} />
          ) : currentScreen === 'addExpense' ? (
            <AddExpenseScreen onBack={() => setCurrentScreen('expense')} />
          ) : currentScreen === 'addCustomer' ? (
            <AddCustomerScreen
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
            />
          ) : currentScreen === 'pastDeliveries' ? (
            <PastDeliveriesScreen
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
            />
          ) : currentScreen === 'paymentBalances' ? (
            <PaymentBalancesScreen
              userRole="employee"
              isAdmin={isAdmin}
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
            />
          ) : currentScreen === 'extraCan' ? (
            <ExtraCanHoldingsScreen
              userRole="employee"
              isAdmin={isAdmin}
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
            />
          ) : currentScreen === 'pastSales' ? (
            <PastSalesScreen
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
            />
          ) : currentScreen === 'pastExpenses' ? (
            <PastExpensesScreen
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
            />
          ) : currentScreen === 'counterSale' ? (
            <CounterSaleScreen
              onBack={() => {
                setCurrentScreen('dashboard');
                setActiveTab('Home');
                loadEmployeeData();
              }}
              onViewHistory={() => setCurrentScreen('counterSaleHistory')}
            />
          ) : currentScreen === 'counterSaleHistory' ? (
            <CustomerPurchaseHistoryScreen
              customer={{ id: COUNTER_SALES_CUSTOMER_ID, name: COUNTER_SALES_CUSTOMER_NAME }}
              onBack={() => setCurrentScreen('counterSale')}
            />          ) : showCloseSalePage ? (
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setShowCloseSalePage(false)} style={{ padding: 6, marginRight: 6 }}>
                  <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700' }}>Close Today's Sale</Text>
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Cash</Text>
                <TextInput
                  style={{ backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' }}
                  value={closeCash}
                  onChangeText={setCloseCash}
                  placeholder="₹"
                  keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowCloseSalePage(false)}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' }}
                >
                  <Text style={{ color: '#475569', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCloseSale}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0ea5e9' }}
                >
                  <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>          ) : (
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={loadEmployeeData} />
              }
            >
              <View style={styles.headerContainer}>
                <View style={styles.headerRowOne}>
                  <Text style={styles.welcome}>Welcome, {userName || 'Employee'}</Text>
                  <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => {
                      setCurrentScreen('profile');
                      setActiveTab('Home');
                      closeDrawer();
                    }}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="account-circle-outline" size={28} color="#334155" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Deliveries</Text>
                <View style={styles.datePill}>
                  <MaterialCommunityIcons name="calendar" size={16} color="#475569" />
                  <Text style={styles.snapshotDate}>{snapshotLabel}</Text>
                </View>
              </View>
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
                  <StatCard icon="wallet" label="Vault cash" value={currencyINR(stats.inHandCash)} bgColor="#ecfeff" />
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
          {/* button visible for owner and employee both; action depends on admin status */}
          <TouchableOpacity
            style={{
              marginTop: 20,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: '#0ea5e9',
              alignItems: 'center',
              marginBottom: 20,
            }}
            onPress={() => {
              // mirror condition used elsewhere for page/modal decision
              if (userRole === 'employee' && !isAdmin) {
                setShowCloseSalePage(true);
                setShowCloseSaleModal(false);
              } else {
                setShowCloseSaleModal(true);
                setShowCloseSalePage(false);
              }
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Close Today's Sale</Text>
          </TouchableOpacity>
            </ScrollView>
          )}

          {/* Close today's sale modal for admins/owners */}
          <Modal
            visible={showCloseSaleModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCloseSaleModal(false)}
          >
            <KeyboardAvoidingView
              style={styles.flex1}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <Pressable style={styles.modalOverlay} onPress={() => setShowCloseSaleModal(false)}>
                <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                  {/* header matches other modals */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Close Today's Sale</Text>
                    <TouchableOpacity onPress={() => setShowCloseSaleModal(false)} style={styles.modalCloseButton}>
                      <MaterialCommunityIcons name="close" size={24} color="#475569" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.modalScrollView}
                    contentContainerStyle={styles.modalScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Cash</Text>
                      <TextInput
                        style={{ backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' }}
                        value={closeCash}
                        onChangeText={setCloseCash}
                        placeholder="₹"
                        keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => setShowCloseSaleModal(false)}
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' }}
                      >
                        <Text style={{ color: '#475569', fontWeight: '600' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleCloseSale}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0ea5e9' }}
                      >
                        <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </Pressable>
              </Pressable>
            </KeyboardAvoidingView>
          </Modal>
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
  statsGrid: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 14,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerContainer: {
    marginBottom: 12,
  },
  headerRowOne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: 0,
  },
  flex1: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    // allow scrolling if content grows
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
});
