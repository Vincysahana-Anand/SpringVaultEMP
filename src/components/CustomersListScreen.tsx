import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getCustomers } from '../services/customerService';
import { getStocks, Stock } from '../services/stockService';
import { updateSalesRecord } from '../services/salesService';
import { addOrder, getOrders, Order } from '../services/orderService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { currencyINR } from '../utils/format';
import { getISTDate } from '../utils/dateUtils';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { showError, showInfo, showSuccess } from '../shared/feedback/messageBus';
import DropletLoader from './DropletLoader';
import CustomerDetailsScreen from './CustomerDetailsScreen';
import EditCustomerScreen from './EditCustomerScreen';
import CustomerPurchaseHistoryScreen from './CustomerPurchaseHistoryScreen';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  doorNumber?: string;
  floor?: string;
  street?: string;
  area?: string;
  alternateContacts?: string[];
  advanceAmount?: number;
  canHolding?: number;
  extraCanHolding?: number;
  balance?: number;
  customerType?: string;
}

export default function CustomersListScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderCustomer, setOrderCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Stock[]>([]);
  const [orderProduct, setOrderProduct] = useState<Stock | null>(null);
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, []);

  useEffect(() => {
    const handleBackPress = () => {
      if (selectedCustomer) {
        setSelectedCustomer(null);
        return true;
      }
      // Let parent handle back navigation
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const result = await getCustomers();
      const customersData = Array.isArray(result) ? result : [];
      setCustomers(customersData as Customer[]);
      setFilteredCustomers(customersData as Customer[]);
    } catch (e) {
      const err = handleServiceError(e, 'loadCustomers');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const result = await getStocks();
      if (Array.isArray(result)) {
        setProducts(result);
        if (result.length > 0) {
          setOrderProduct(result[0]);
        }
      } else {
        const err = handleServiceError(result, 'getStocks');
        showError(err.message);
      }
    } catch (error) {
      const err = handleServiceError(error, 'getStocks');
      showError(err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const filterCustomers = () => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = customers.filter((customer) => {
      // Search by name
      if (customer.name?.toLowerCase().includes(query)) {
        return true;
      }

      // Search by mobile
      if (customer.mobile?.includes(query)) {
        return true;
      }

      // Search by address components
      const fullAddress = [
        customer.doorNumber,
        customer.floor,
        customer.street,
        customer.area,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (fullAddress.includes(query)) {
        return true;
      }

      // Search by alternate contacts
      if (customer.alternateContacts?.some((contact) => contact.includes(query))) {
        return true;
      }

      return false;
    });

    setFilteredCustomers(filtered);
  };

  const getFullAddress = (customer: Customer) => {
    const parts = [customer.doorNumber, customer.floor, customer.street, customer.area].filter(Boolean);
    return parts.join(', ');
  };

  const formatProductName = (productName: string) => {
    const name = productName.toLowerCase();
    
    if (name.includes('20') && name.includes('party')) {
      return '20L-P';
    } else if (name.includes('20') && name.includes('liter')) {
      return '20L';
    } else if (name.includes('1') && name.includes('liter')) {
      return '1L';
    } else if (name.includes('500') && name.includes('ml')) {
      return '500ml';
    } else if (name.includes('300') && name.includes('ml')) {
      return '300ml';
    }
    
    return productName; // Return original if no match
  };

  const getProductOrder = (productName: string) => {
    const name = productName.toLowerCase();
    
    if (name.includes('20') && name.includes('liter') && !name.includes('party')) {
      return 1; // 20L
    } else if (name.includes('20') && name.includes('party')) {
      return 2; // 20L-P
    } else if (name.includes('1') && name.includes('liter')) {
      return 3; // 1L
    } else if (name.includes('500') && name.includes('ml')) {
      return 4; // 500ml
    } else if (name.includes('300') && name.includes('ml')) {
      return 5; // 300ml
    }
    
    return 999; // Unknown products go to end
  };

  const getFilteredProducts = (customer: Customer) => {
    const isResidence = customer.customerType?.toLowerCase() === 'residence';
    
    const filtered = products.filter((product) => {
      const name = product.productName.toLowerCase();
      
      // If customer is Residence, exclude 20L-P (party)
      if (isResidence && name.includes('20') && name.includes('party')) {
        return false;
      }
      
      // If customer is NOT Residence (Shop or Party), exclude regular 20L
      if (!isResidence && name.includes('20') && name.includes('liter') && !name.includes('party')) {
        return false;
      }
      
      return true;
    });

    // Sort products in the desired order: 20L, 20L-P, 1L, 500ml, 300ml
    return filtered.sort((a, b) => getProductOrder(a.productName) - getProductOrder(b.productName));
  };

  const handleOpenOrderModal = (customer: Customer, event: any) => {
    event.stopPropagation();
    setOrderCustomer(customer);
    
    // Set default product based on customer type
    const isResidence = customer.customerType?.toLowerCase() === 'residence';
    const defaultProduct = products.find((product) => {
      const name = product.productName.toLowerCase();
      
      // For Residence, default to 20L
      if (isResidence && name.includes('20') && name.includes('liter') && !name.includes('party')) {
        return true;
      }
      
      // For Shop/Party, default to 20L-P
      if (!isResidence && name.includes('20') && name.includes('party')) {
        return true;
      }
      
      return false;
    });
    
    setOrderProduct(defaultProduct || (products.length > 0 ? products[0] : null));
    setOrderQuantity('1');
    setShowOrderModal(true);
  };

  const handleCloseOrderModal = () => {
    setShowOrderModal(false);
    setOrderCustomer(null);
    setOrderProduct(products.length > 0 ? products[0] : null);
    setOrderQuantity('1');
    setSubmittingOrder(false);
  };

  const handleSubmitOrder = async () => {
    if (!orderCustomer || !orderProduct || !orderQuantity || parseInt(orderQuantity) <= 0) {
      return;
    }

    try {
      setSubmittingOrder(true);
      
      // Check for existing orders for this customer
      const ordersResult = await getOrders();
      
      if (Array.isArray(ordersResult)) {
        const existingOrder = ordersResult.find(
          (order: Order) => order.customerId === orderCustomer.id
        );
        
        if (existingOrder) {
          setSubmittingOrder(false);
          showInfo(
            `An order is already pending for ${orderCustomer.name}. Product: ${existingOrder.productName} (Qty: ${existingOrder.quantity})`,
            { title: 'Order Already Pending', durationMs: 3500 }
          );
          return;
        }
      }
      
      // Format timestamp in IST
      const now = getISTDate();
      const formattedDate = now.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      
      // Prepare order data
      const orderData = {
        customerId: orderCustomer.id,
        customerName: orderCustomer.name,
        mobile: orderCustomer.mobile,
        address: getFullAddress(orderCustomer),
        productId: orderProduct.id,
        productName: orderProduct.productName,
        quantity: parseInt(orderQuantity),
        paymentMethod: 'Pending',
        orderedAt: formattedDate,
        timeStamp: now,
      };
      
      // Add order to Firebase
      const result = await addOrder(orderData);
      
      if (result === true) {
        // Update sales record
        const fullBottles = 0, emptyBottles = 0, cashPaidValue = 0, onlinePaidValue = 0, billAmountValue = 0, isDeliveredCan = false, saleAmount = 0, pendingPaymentReceived = 0; // Dummy values for illustration
        const ordersCount = 1, deliveredCount = 0;
        const salesUpdateResult = await updateSalesRecord(
                Number(fullBottles),
                Number(emptyBottles),
                Number(cashPaidValue),
                Number(onlinePaidValue),
                Number(billAmountValue),
                isDeliveredCan,
                Number(saleAmount),
                Number(pendingPaymentReceived),
                ordersCount,
                deliveredCount
              );
              if (salesUpdateResult !== true) {
                console.error('Sales record update failed:', salesUpdateResult);
                const err = handleServiceError(salesUpdateResult, 'updateSalesRecord');
                showError(err.message);
                setSubmittingOrder(false);
                return;
              }
              console.log('Sales record updated successfully');

        // Clear fields and close modal
        handleCloseOrderModal();
        
        // Show success message
        showSuccess(`Order placed successfully for ${orderCustomer.name}`);
      } else {
        // Show error message
        showError('Failed to place order. Please try again.');
      }
    } catch (e) {
      console.error('Error placing order:', e);
      showError('An unexpected error occurred. Please try again.');
      setSubmittingOrder(false);
    } finally {
      if (submittingOrder) {
        setSubmittingOrder(false);
      }
    }
  };

  const renderCustomerCard = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      activeOpacity={0.7}
      onPress={() => setSelectedCustomer(item)}
    >
      <View style={styles.cardContent}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          <Text style={styles.customerMobile}>{item.mobile}</Text>
          <Text style={styles.customerAddress}>{getFullAddress(item)}</Text>
        </View>

        <TouchableOpacity
          style={styles.orderIconButton}
          onPress={(e) => handleOpenOrderModal(item, e)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="water-plus" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <View style={styles.customerStats}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="wallet" size={16} color={colors.success[500]} />
          <Text style={styles.statLabel}>Balance: {currencyINR(item.balance || 0)}</Text>
        </View>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="water" size={16} color={colors.info[500]} />
          <Text style={styles.statLabel}>Extra Can: {item.extraCanHolding || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {historyCustomer ? (
        <View style={styles.detailsContainer}>
          <CustomerPurchaseHistoryScreen
            customer={historyCustomer}
            onBack={() => setHistoryCustomer(null)}
          />
        </View>
      ) : selectedCustomer ? (
        <View style={styles.detailsContainer}>
          {selectedCustomer.id?.includes('edit-') ? (
            <EditCustomerScreen
              customer={{ ...selectedCustomer, id: selectedCustomer.id?.replace('edit-', '') || '' }}
              onBack={() => setSelectedCustomer(null)}
              onSave={(updatedCustomer) => {
                setCustomers((prev) =>
                  prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c))
                );
                setSelectedCustomer(updatedCustomer);
              }}
            />
          ) : (
            <CustomerDetailsScreen
              customer={selectedCustomer}
              onBack={() => setSelectedCustomer(null)}
              onEdit={() => setSelectedCustomer({ ...selectedCustomer, id: `edit-${selectedCustomer.id}` })}
              onViewHistory={() => setHistoryCustomer(selectedCustomer)}
            />
          )}
        </View>
      ) : (
        <>
          <DropletLoader visible={loading} />

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={colors.gray[400]}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customer..."
              placeholderTextColor={colors.gray[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <MaterialCommunityIcons name="close-circle" size={20} color={colors.gray[400]} />
              </TouchableOpacity>
            )}
          </View>

          {/* Customer List */}
          {!loading && filteredCustomers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-group-outline" size={64} color={colors.gray[300]} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No customers found' : 'No customers yet'}
              </Text>
              {searchQuery && (
                <Text style={styles.emptySubtext}>
                  Try searching with a different keyword
                </Text>
              )}
            </View>
          ) : !loading ? (
            <FlatList
              data={filteredCustomers}
              renderItem={renderCustomerCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={loadCustomers} />
              }
            />
          ) : null}
        </>
      )}

      {/* Add Order Modal */}
      <Modal
        visible={showOrderModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseOrderModal}
      >
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={handleCloseOrderModal}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Order</Text>
                <TouchableOpacity onPress={handleCloseOrderModal} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {orderCustomer && (
                  <>
                    {/* Customer Info */}
                    <View style={styles.customerInfoSection}>
                      <Text style={styles.customerNameModal}>{orderCustomer.name}</Text>
                      <Text style={styles.customerAddressModal}>{getFullAddress(orderCustomer)}</Text>
                    </View>

                    {/* Product Selection */}
                    <View style={styles.formGroup}>
                  <Text style={styles.modalLabel}>Product *</Text>
                  {loadingProducts ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                      <Text style={styles.loadingText}>Loading products...</Text>
                    </View>
                  ) : products.length === 0 ? (
                    <Text style={styles.noProductsText}>No products available</Text>
                  ) : (
                    <View style={styles.productSelector}>
                      {getFilteredProducts(orderCustomer).map((product) => (
                        <TouchableOpacity
                          key={product.id}
                          style={[
                            styles.productButton,
                            orderProduct?.id === product.id && styles.productButtonActive,
                          ]}
                          onPress={() => setOrderProduct(product)}
                          disabled={submittingOrder}
                        >
                          <View style={styles.productButtonContent}>
                            <Text
                              style={[
                                styles.productButtonText,
                                orderProduct?.id === product.id && styles.productButtonTextActive,
                              ]}
                            >
                              {formatProductName(product.productName)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Quantity Input */}
                <View style={styles.formGroup}>
                  <Text style={styles.modalLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter quantity"
                    placeholderTextColor={colors.gray[400]}
                    value={orderQuantity}
                    onChangeText={setOrderQuantity}
                    keyboardType="number-pad"
                    editable={!submittingOrder}
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (submittingOrder || !orderProduct) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmitOrder}
                  disabled={submittingOrder || !orderProduct || !orderQuantity || parseInt(orderQuantity) <= 0}
                >
                  {submittingOrder ? (
                    <ActivityIndicator color={colors.bg.white} size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Order</Text>
                  )}
                </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.light,
  },
  detailsContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.white,
    marginHorizontal: spacing[16],
    marginVertical: spacing[16],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  searchIcon: {
    marginRight: spacing[8],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
    padding: 0,
  },
  clearButton: {
    padding: spacing[4],
  },
  listContent: {
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[20],
  },
  customerCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[12],
  },
  customerInfo: {
    flex: 1,
  },
  orderIconButton: {
    padding: spacing[8],
    marginTop: -spacing[8],
    marginRight: -spacing[8],
  },
  customerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[4],
  },
  customerMobile: {
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
    marginBottom: spacing[4],
  },
  customerAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    lineHeight: 18,
  },
  customerStats: {
    flexDirection: 'row',
    gap: spacing[16],
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    fontWeight: typography.fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[32],
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[600],
    marginTop: spacing[16],
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
    marginTop: spacing[8],
    textAlign: 'center',
  },
  flex1: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[16],
  },
  modalContent: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...elevation.lg,
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[20],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSize['xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  modalCloseButton: {
    padding: spacing[4],
  },
  customerInfoSection: {
    backgroundColor: colors.bg.light,
    padding: spacing[12],
    borderRadius: borderRadius.md,
    marginBottom: spacing[20],
  },
  customerNameModal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[4],
  },
  customerAddressModal: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: spacing[16],
  },
  modalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing[8],
  },
  productSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  productButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[12],
    backgroundColor: colors.bg.white,
    flex: 1,
    minWidth: 80,
  },
  productButtonActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  productButtonContent: {
    alignItems: 'center',
  },
  productButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[700],
    textAlign: 'center',
  },
  productButtonTextActive: {
    color: colors.primary[700],
  },
  productStockText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginTop: spacing[4],
  },
  productStockTextActive: {
    color: colors.primary[600],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    gap: spacing[8],
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  noProductsText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    textAlign: 'center',
    paddingVertical: spacing[16],
  },
  modalInput: {
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
  },
  submitButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[12],
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[8],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.bg.white,
  },
});
