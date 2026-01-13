import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getOrders, Order, updateOrder, deleteOrder } from '../services/orderService';
import { getStocks, Stock } from '../services/stockService';
import { getCustomers, Customer } from '../services/customerService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import DropletLoader from './DropletLoader';

type DeliveryTab = 'pending' | 'delivered';

interface DeliveriesScreenProps {
  userRole?: 'owner' | 'employee';
  isAdmin?: boolean;
}

export default function DeliveriesScreen({ userRole = 'employee', isAdmin = false }: DeliveriesScreenProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DeliveryTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [fullBottlesDelivered, setFullBottlesDelivered] = useState('0');
  const [emptyBottlesCollected, setEmptyBottlesCollected] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editProductId, setEditProductId] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    loadOrders();
    loadProducts();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [searchQuery, orders, activeTab]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const result = await getOrders();
      if (Array.isArray(result)) {
        // Sort by orderedAt time in descending order (latest first)
        const sorted = result.sort((a, b) => {
          const dateA = new Date(a.timeStamp || 0).getTime();
          const dateB = new Date(b.timeStamp || 0).getTime();
          return dateB - dateA;
        });
        setOrders(sorted);
      } else {
        handleServiceError(result, 'getOrders');
      }
    } catch (error) {
      handleServiceError(error, 'loadOrders');
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Filter by tab (pending = no deliveredAt, delivered = has deliveredAt)
    // Since delivered orders are deleted, all remaining orders are pending
    filtered = orders; // All orders in collection are pending

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((order) => {
        return (
          order.customerName?.toLowerCase().includes(query) ||
          order.mobile?.includes(query) ||
          order.address?.toLowerCase().includes(query) ||
          order.productName?.toLowerCase().includes(query)
        );
      });
    }

    setFilteredOrders(filtered);
  };

  const handleCompleteDelivery = (order: Order) => {
    if (!order.id) return;
    setSelectedOrder(order);
    setFullBottlesDelivered(order.quantity?.toString() || '0');
    setEmptyBottlesCollected('0');
    setAmountPaid('0');
    setShowDeliveryModal(true);
  };

  const handleCloseDeliveryModal = () => {
    setShowDeliveryModal(false);
    setSelectedOrder(null);
    setFullBottlesDelivered('0');
    setEmptyBottlesCollected('0');
    setAmountPaid('0');
  };

  const handleSubmitDelivery = async () => {
    if (!selectedOrder?.id) return;

    // Validate full bottles delivered (mandatory)
    const fullBottles = parseInt(fullBottlesDelivered || '0', 10);
    if (isNaN(fullBottles) || fullBottles <= 0) {
      Alert.alert('Validation Error', 'Please enter at least 1 full water bottle delivered', [{ text: 'OK' }]);
      return;
    }

    // Calculate can holding delta (20L cans in customer possession)
    const emptyBottles = parseInt(emptyBottlesCollected || '0', 10) || 0;
    const amountPaidValue = parseInt(amountPaid || '0', 10) || 0;
    
    // Fetch customer data to get canHolding and extraCanHolding
    const customersResult = await getCustomers();
    if (!Array.isArray(customersResult)) {
      handleServiceError(customersResult, 'getCustomers');
      setSubmitting(false);
      return;
    }
    
    const customer = customersResult.find(c => c.id === selectedOrder.customerId);
    if (!customer) {
      Alert.alert('Error', 'Customer not found', [{ text: 'OK' }]);
      setSubmitting(false);
      return;
    }
    
    // canHolding: number of cans customer SHOULD have
    // extraCanHolding: number of EXTRA cans customer is currently holding
    const canHolding = customer.canHolding ?? 0;
    const currentExtraCanHolding = customer.extraCanHolding ?? 0;
    
    // Total cans currently with customer
    const currentTotalCans = canHolding + currentExtraCanHolding;
    
    // Calculate new total cans after delivery
    const newTotalCans = currentTotalCans + fullBottles - emptyBottles;
    
    // Calculate new extra can holding (can be negative if customer owes cans)
    const newExtraCanHolding = newTotalCans - canHolding;
    console.log('selectedOrder', selectedOrder);
    console.log('Can holding calculation', {
      customerName: selectedOrder.customerName,
      canHolding: canHolding, // Should have
      currentExtraCanHolding: currentExtraCanHolding, // Currently holding extra
      currentTotalCans: currentTotalCans, // Total cans with customer now
      fullBottlesDelivered: fullBottles,
      emptyBottlesCollected: emptyBottles,
      newTotalCans: newTotalCans, // Total cans after delivery
      newExtraCanHolding: newExtraCanHolding, // New extra cans (positive = extra, negative = owed)
      amountPaid: amountPaidValue,
    });

    try {
      setSubmitting(true);
      // Delete the order from collection (temporarily disabled)
      // await deleteOrder(selectedOrder.id);
      // setOrders(orders.filter((o) => o.id !== selectedOrder.id));
      
      handleCloseDeliveryModal();
      Alert.alert('Success', 'Delivery completed successfully', [{ text: 'OK' }]);
    } catch (error) {
      handleServiceError(error, 'completeDelivery');
    } finally {
      setSubmitting(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const result = await getStocks();
      if (Array.isArray(result)) {
        setProducts(result);
      } else {
        handleServiceError(result, 'getStocks');
      }
    } catch (error) {
      handleServiceError(error, 'loadProducts');
    } finally {
      setLoadingProducts(false);
    }
  };

  const formatProductName = (name: string): string => {
    if (!name) return '';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('20') && lowerName.includes('liter')) {
      if (lowerName.includes('party')) return '20L-P';
      return '20L';
    }
    if (lowerName.includes('1') && lowerName.includes('liter')) return '1L';
    if (lowerName.includes('500') && lowerName.includes('ml')) return '500ml';
    if (lowerName.includes('300') && lowerName.includes('ml')) return '300ml';
    return name;
  };

  const getFilteredProducts = (order: Order) => {
    if (!products || products.length === 0) return [];
    // Default to 'Residence' if customerType is not available in order
    const customerType = 'Residence'; // Since Order doesn't have customerType, use default
    let filtered = products.filter((product: Stock) => {
      const name = product.productName.toLowerCase();
      if (customerType === 'Residence') {
        return !name.includes('party');
      } else {
        return !name.includes('20') || name.includes('party');
      }
    });

    const getProductOrder = (name: string): number => {
      const lowerName = name.toLowerCase();
      if (lowerName.includes('20') && lowerName.includes('party')) return 2;
      if (lowerName.includes('20') && lowerName.includes('liter')) return 1;
      if (lowerName.includes('1') && lowerName.includes('liter')) return 3;
      if (lowerName.includes('500') && lowerName.includes('ml')) return 4;
      if (lowerName.includes('300') && lowerName.includes('ml')) return 5;
      return 6;
    };

    filtered.sort((a: Stock, b: Stock) => {
      return getProductOrder(a.productName) - getProductOrder(b.productName);
    });

    return filtered;
  };

  const handleEditOrder = (order: Order) => {
    if (!order.id) return;
    setEditingOrder(order);
    setEditProductId(order.productId || '');
    setEditProductName(order.productName || '');
    setEditQuantity(order.quantity?.toString() || '1');
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingOrder(null);
    setEditProductId('');
    setEditProductName('');
    setEditQuantity('1');
  };

  const handleSubmitEdit = async () => {
    if (!editingOrder?.id) return;

    const quantity = parseInt(editQuantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity', [{ text: 'OK' }]);
      return;
    }

    if (!editProductId) {
      Alert.alert('Validation Error', 'Please select a product', [{ text: 'OK' }]);
      return;
    }

    try {
      setSubmittingEdit(true);
      const updatedOrder = {
        ...editingOrder,
        productId: editProductId,
        productName: editProductName,
        quantity,
      };

      await updateOrder(editingOrder.id, updatedOrder);
      
      // Update local state
      setOrders(orders.map(o => o.id === editingOrder.id ? updatedOrder : o));
      
      handleCloseEditModal();
      Alert.alert('Success', 'Order updated successfully', [{ text: 'OK' }]);
    } catch (error) {
      handleServiceError(error, 'updateOrder');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!order.id) return;

    Alert.alert(
      'Delete Order',
      `Delete order for ${order.customerName}?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              setDeleting(order.id!);
              await deleteOrder(order.id!);
              setOrders(orders.filter((o) => o.id !== order.id));
              Alert.alert('Success', 'Order deleted', [{ text: 'OK' }]);
            } catch (error) {
              handleServiceError(error, 'deleteOrder');
            } finally {
              setDeleting(null);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleTabChange = (tab: DeliveryTab) => {
    setActiveTab(tab);
    setSearchQuery(''); // Clear search when switching tabs
  };

  const handleCallCustomer = (mobile: string) => {
    Linking.openURL(`tel:${mobile}`);
  };

  const renderDeliveryCard = ({ item }: { item: Order }) => (
    <View style={styles.deliveryCard}>
      {/* Customer Info */}
      <View style={styles.cardHeader}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <TouchableOpacity
            style={styles.phoneRow}
            onPress={() => handleCallCustomer(item.mobile || '')}
          >
            <MaterialCommunityIcons name="phone" size={16} color={colors.primary[500]} />
            <Text style={styles.phoneNumber}>{item.mobile}</Text>
          </TouchableOpacity>
          <Text style={styles.address}>{item.address}</Text>
        </View>
      </View>

      {/* Product Row with Actions */}
      <View style={styles.productActionRow}>
        {/* Product and Quantity */}
        <View style={styles.productContainer}>
          <MaterialCommunityIcons name="water" size={18} color={colors.primary[500]} />
          <Text style={styles.productName}>{item.productName}</Text>
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>{item.quantity}</Text>
          </View>
        </View>

        {/* Action Icons */}
        <View style={styles.actionIconsRow}>
          {/* Complete Delivery */}
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => handleCompleteDelivery(item)}
            disabled={deleting === item.id}
          >
            {deleting === item.id ? (
              <MaterialCommunityIcons name="loading" size={18} color={colors.success[500]} />
            ) : (
              <MaterialCommunityIcons name="truck-delivery" size={18} color={colors.success[500]} />
            )}
          </TouchableOpacity>

          {/* Edit - Only for Owner and Admin Employee */}
          {(userRole === 'owner' || (userRole === 'employee' && isAdmin)) && (
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={() => handleEditOrder(item)}
              disabled={deleting === item.id}
            >
              <MaterialCommunityIcons name="pencil" size={18} color={colors.primary[500]} />
            </TouchableOpacity>
          )}

          {/* Delete - Only for Owner and Admin Employee */}
          {(userRole === 'owner' || (userRole === 'employee' && isAdmin)) && (
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={() => handleDeleteOrder(item)}
              disabled={deleting === item.id}
            >
              <MaterialCommunityIcons name="trash-can" size={18} color={colors.danger[500]} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <DropletLoader visible={true} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => handleTabChange('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'delivered' && styles.activeTab]}
          onPress={() => handleTabChange('delivered')}
        >
          <Text style={[styles.tabText, activeTab === 'delivered' && styles.activeTabText]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.gray[400]} style={styles.searchIcon2} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${activeTab === 'pending' ? 'pending' : 'delivered'} deliveries...`}
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

      {/* Deliveries List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="inbox-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No deliveries found' : `No ${activeTab} deliveries`}
          </Text>
          {searchQuery && (
            <Text style={styles.emptySubtext}>Try searching with a different keyword</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderDeliveryCard}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadOrders} />}
        />
      )}

      {/* Complete Delivery Modal */}
      <Modal
        visible={showDeliveryModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDeliveryModal}
      >
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={handleCloseDeliveryModal}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Complete Delivery</Text>
                <TouchableOpacity onPress={handleCloseDeliveryModal} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {selectedOrder && (
                  <>
                    {/* Customer Info */}
                    <View style={styles.customerInfoSection}>
                      <Text style={styles.customerNameModal}>{selectedOrder.customerName}</Text>
                      <Text style={styles.productInfoModal}>{selectedOrder.address}</Text>
                      <View style={styles.productBadgeContainer}>
                        <View style={styles.productBadge}>
                          <Text style={styles.productBadgeText}>
                            {selectedOrder.productName} x {selectedOrder.quantity}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Full Bottles Delivered */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Full Water Bottles Delivered</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        value={fullBottlesDelivered}
                        onChangeText={setFullBottlesDelivered}
                        keyboardType="number-pad"
                        editable={!submitting}
                      />
                    </View>

                    {/* Empty Bottles Collected */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Empty Water Bottles Collected</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        value={emptyBottlesCollected}
                        onChangeText={setEmptyBottlesCollected}
                        onFocus={() => {
                          if (emptyBottlesCollected === '0') {
                            setEmptyBottlesCollected('');
                          }
                        }}
                        onBlur={() => {
                          if (emptyBottlesCollected.trim() === '') {
                            setEmptyBottlesCollected('0');
                          }
                        }}
                        keyboardType="number-pad"
                        editable={!submitting}
                      />
                    </View>

                    {/* Amount Paid */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Amount</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        value={amountPaid}
                        onChangeText={setAmountPaid}
                        onFocus={() => {
                          if (amountPaid === '0') {
                            setAmountPaid('');
                          }
                        }}
                        onBlur={() => {
                          if (amountPaid.trim() === '') {
                            setAmountPaid('0');
                          }
                        }}
                        keyboardType="number-pad"
                        editable={!submitting}
                      />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        submitting && styles.submitButtonDisabled,
                      ]}
                      onPress={handleSubmitDelivery}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color={colors.bg.white} size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>Complete Delivery</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Order Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseEditModal}
      >
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={handleCloseEditModal}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Order</Text>
                <TouchableOpacity onPress={handleCloseEditModal} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {editingOrder && (
                  <>
                    {/* Customer Info */}
                    <View style={styles.customerInfoSection}>
                      <Text style={styles.customerNameModal}>{editingOrder.customerName}</Text>
                      <Text style={styles.productInfoModal}>{editingOrder.address}</Text>
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
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.productSelector}
                          contentContainerStyle={styles.productSelectorContent}
                        >
                          {getFilteredProducts(editingOrder).map((product: Stock) => (
                            <TouchableOpacity
                              key={product.id}
                              style={[
                                styles.productButton,
                                editProductId === product.id && styles.productButtonActive,
                              ]}
                              onPress={() => {
                                setEditProductId(product.id || '');
                                setEditProductName(formatProductName(product.productName));
                              }}
                              disabled={submittingEdit}
                            >
                              <Text
                                style={[
                                  styles.productButtonText,
                                  editProductId === product.id && styles.productButtonTextActive,
                                ]}
                              >
                                {formatProductName(product.productName)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>

                    {/* Quantity Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.modalLabel}>Quantity *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter quantity"
                        placeholderTextColor={colors.gray[400]}
                        value={editQuantity}
                        onChangeText={setEditQuantity}
                        keyboardType="number-pad"
                        editable={!submittingEdit}
                      />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        submittingEdit && styles.submitButtonDisabled,
                      ]}
                      onPress={handleSubmitEdit}
                      disabled={submittingEdit}
                    >
                      {submittingEdit ? (
                        <ActivityIndicator color={colors.bg.white} size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>Update Order</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  searchIcon: {
    padding: spacing[8],
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[12],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary[500],
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[400],
  },
  activeTabText: {
    color: colors.primary[500],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.white,
    marginHorizontal: spacing[16],
    marginVertical: spacing[12],
    paddingHorizontal: spacing[12],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon2: {
    marginRight: spacing[8],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[10],
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
  },
  clearButton: {
    padding: spacing[4],
  },
  listContent: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  deliveryCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  cardHeader: {
    marginBottom: spacing[12],
  },
  customerInfo: {
    gap: spacing[6],
  },
  customerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  phoneNumber: {
    fontSize: typography.fontSize.base,
    color: colors.primary[500],
  },
  address: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    lineHeight: 18,
  },
  productActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[12],
  },
  productContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flex: 1,
  },
  productName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  quantityBadge: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.bg.white,
  },
  actionIconsRow: {
    flexDirection: 'row',
    gap: spacing[8],
    alignItems: 'center',
  },
  actionIcon: {
    padding: spacing[6],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[24],
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
  productInfoModal: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  productBadgeContainer: {
    marginTop: spacing[8],
  },
  productBadge: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[12],
    alignSelf: 'flex-start',
  },
  productBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.bg.white,
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
  },
  loadingText: {
    marginLeft: spacing[8],
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  noProductsText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    textAlign: 'center',
    paddingVertical: spacing[12],
  },
  productSelector: {
    maxHeight: 60,
  },
  productSelectorContent: {
    gap: spacing[8],
    paddingVertical: spacing[4],
  },
  productButton: {
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  productButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  productButtonTextActive: {
    color: colors.bg.white,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  paymentMethodButton: {
    flex: 1,
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[10],
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  paymentMethodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  paymentMethodTextActive: {
    color: colors.bg.white,
  },
});
