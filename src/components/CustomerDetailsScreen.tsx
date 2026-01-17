import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  BackHandler,
  RefreshControl,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { deleteCustomer } from '../services/customerService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError, showSuccess } from '../shared/feedback/messageBus';

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
  customerType?: string;
  billingType?: string;
  price?: number;
  '1lPrice'?: number;
  '500mlPrice'?: number;
  '300mlPrice'?: number;
  balance?: number;
}

interface CustomerDetailsScreenProps {
  customer: Customer;
  onBack: () => void;
  onEdit: () => void;
  onViewHistory: () => void;
  allowDelete?: boolean;
  onDeleted?: (customerId: string) => void;
}

export default function CustomerDetailsScreen({
  customer,
  onBack,
  onEdit,
  onViewHistory,
  allowDelete = false,
  onDeleted,
}: CustomerDetailsScreenProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isShopOrParty = ['shop', 'party'].includes(String(customer.customerType || '').toLowerCase());

  React.useEffect(() => {
    const handleBackPress = () => {
      onBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [onBack]);

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const getFullAddress = () => {
    const parts = [customer.doorNumber, customer.floor, customer.street, customer.area].filter(
      Boolean
    );
    return parts.join(', ');
  };

  const onRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const confirmDelete = () => {
    if (!customer.id || deleting) return;

    Alert.alert(
      'Delete customer?',
      'This will permanently delete the customer record. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const result = await deleteCustomer(customer.id);
              if (result !== true) {
                const err = handleServiceError(result, 'deleteCustomer');
                showError(err.message);
                return;
              }
              showSuccess('Customer deleted');
              onDeleted?.(customer.id);
              onBack();
            } catch (e) {
              const err = handleServiceError(e, 'deleteCustomer');
              showError(err.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Details</Text>
        <TouchableOpacity onPress={onEdit} style={styles.editButton}>
          <MaterialCommunityIcons name="pencil" size={20} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        {/* Main Card */}
        <View style={styles.mainCard}>
          {/* Customer Name and Advance */}
          <View style={styles.nameRow}>
            <Text style={styles.customerName}>{customer.name}</Text>
          </View>

          {/* Phone Numbers */}
          <View style={styles.phoneSection}>
            <TouchableOpacity
              style={styles.phoneRow}
              onPress={() => handleCall(customer.mobile)}
            >
              <MaterialCommunityIcons
                name="phone"
                size={20}
                color={colors.primary[500]}
                style={styles.phoneIcon}
              />
              <Text style={styles.phoneNumber}>{customer.mobile}</Text>
            </TouchableOpacity>

            {customer.alternateContacts && customer.alternateContacts.length > 0 && (
              customer.alternateContacts.map((contact, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.phoneRow}
                  onPress={() => handleCall(contact)}
                >
                  <MaterialCommunityIcons
                    name="phone"
                    size={20}
                    color={colors.primary[500]}
                    style={styles.phoneIcon}
                  />
                  <Text style={styles.phoneNumber}>{contact}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Address */}
          <View style={styles.addressRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={20}
              color={colors.gray[600]}
              style={styles.addressIcon}
            />
            <View style={styles.addressContent}>
              <Text style={styles.addressText}>{getFullAddress()}</Text>
            </View>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MaterialCommunityIcons
                  name="wallet"
                  size={20}
                  color={colors.success[700]}
                  style={styles.detailIcon}
                />
                <Text style={styles.detailLabel}>Balance</Text>
              </View>
              <Text style={styles.detailValue}>₹{customer.balance || 0}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MaterialCommunityIcons
                  name="water-outline"
                  size={20}
                  color={colors.info[400]}
                  style={styles.detailIcon}
                />
                <Text style={styles.detailLabel}>Extra Can Holding</Text>
              </View>
              <Text style={styles.detailValue}>{customer.extraCanHolding || 0} Cans</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MaterialCommunityIcons
                  name="file-document"
                  size={20}
                  color={colors.gray[600]}
                  style={styles.detailIcon}
                />
                <Text style={styles.detailLabel}>Billing Type</Text>
              </View>
              <Text style={styles.detailValue}>{customer.billingType || '-'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MaterialCommunityIcons
                  name="cash"
                  size={20}
                  color={colors.warning[500]}
                  style={styles.detailIcon}
                />
                <Text style={styles.detailLabel}>Advance</Text>
              </View>
              <Text style={styles.detailValue}>₹{customer.advanceAmount || 0}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MaterialCommunityIcons
                  name="water"
                  size={20}
                  color={colors.info[500]}
                  style={styles.detailIcon}
                />
                <Text style={styles.detailLabel}>Can Holding</Text>
              </View>
              <Text style={styles.detailValue}>{customer.canHolding || 0}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <MaterialCommunityIcons
                  name="tag"
                  size={20}
                  color={colors.gray[600]}
                  style={styles.detailIcon}
                />
                <Text style={styles.detailLabel}>Price</Text>
              </View>
              <Text style={styles.detailValue}>₹{customer.price || 0}/Can</Text>
            </View>

            {isShopOrParty ? (
              <>
                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <MaterialCommunityIcons
                      name="tag-outline"
                      size={20}
                      color={colors.gray[600]}
                      style={styles.detailIcon}
                    />
                    <Text style={styles.detailLabel}>1L Price</Text>
                  </View>
                  <Text style={styles.detailValue}>₹{customer['1lPrice'] || 0}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <MaterialCommunityIcons
                      name="tag-outline"
                      size={20}
                      color={colors.gray[600]}
                      style={styles.detailIcon}
                    />
                    <Text style={styles.detailLabel}>500ml Price</Text>
                  </View>
                  <Text style={styles.detailValue}>₹{customer['500mlPrice'] || 0}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <MaterialCommunityIcons
                      name="tag-outline"
                      size={20}
                      color={colors.gray[600]}
                      style={styles.detailIcon}
                    />
                    <Text style={styles.detailLabel}>300ml Price</Text>
                  </View>
                  <Text style={styles.detailValue}>₹{customer['300mlPrice'] || 0}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Purchase History Card */}
        <TouchableOpacity style={styles.historyCard} onPress={onViewHistory}>
          <View style={styles.historyLeft}>
            <MaterialCommunityIcons
              name="history"
              size={22}
              color={colors.primary[500]}
              style={styles.historyIcon}
            />
            <View>
              <Text style={styles.historyTitle}>Purchase History</Text>
              <Text style={styles.historySubtitle}>View past deliveries and payments</Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.gray[500]}
          />
        </TouchableOpacity>

        {allowDelete ? (
          <TouchableOpacity
            style={[styles.deleteCard, deleting ? styles.disabledCard : null]}
            onPress={confirmDelete}
            disabled={deleting}
          >
            <View style={styles.historyLeft}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={22}
                color={colors.danger[600]}
                style={styles.historyIcon}
              />
              <View>
                <Text style={styles.deleteTitle}>{deleting ? 'Deleting...' : 'Delete Customer'}</Text>
                <Text style={styles.deleteSubtitle}>Owner only • Permanent action</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.danger[300]} />
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing[8],
    marginLeft: -spacing[8],
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    padding: spacing[8],
    marginRight: -spacing[8],
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  mainCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[16],
    ...elevation.md,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[16],
  },
  customerName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    flex: 1,
  },
  advanceContainer: {
    backgroundColor: colors.bg.light,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.md,
    alignItems: 'flex-end',
  },
  advanceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
    fontWeight: typography.fontWeight.medium,
  },
  advanceValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[500],
  },
  phoneSection: {
    marginBottom: spacing[16],
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  phoneIcon: {
    marginRight: spacing[12],
  },
  phoneNumber: {
    fontSize: typography.fontSize.base,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.medium,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing[16],
  },
  typeBadge: {
    backgroundColor: colors.info[100],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    borderRadius: borderRadius.full,
  },
  typeText: {
    fontSize: typography.fontSize.sm,
    color: colors.info[600],
    fontWeight: typography.fontWeight.medium,
  },
  addressRow: {
    flexDirection: 'row',
    paddingVertical: spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addressIcon: {
    marginRight: spacing[12],
    marginTop: spacing[4],
  },
  addressContent: {
    flex: 1,
  },
  addressText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[700],
    lineHeight: 20,
  },
  detailsSection: {
    marginBottom: spacing[16],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    marginBottom: spacing[12],
  },
  detailCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...elevation.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailIcon: {
    marginRight: spacing[12],
  },
  detailLabel: {
    fontSize: typography.fontSize.base,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.medium,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
    fontWeight: typography.fontWeight.semibold,
  },
  historyCard: {
    marginTop: spacing[8],
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...elevation.sm,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    flex: 1,
  },
  historyIcon: {
    marginRight: spacing[4],
  },
  historyTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  historySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    marginTop: spacing[2],
  },
  deleteCard: {
    marginTop: spacing[12],
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.danger[200],
    ...elevation.sm,
  },
  deleteTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.danger[600],
  },
  deleteSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.danger[500],
    marginTop: spacing[2],
  },
  disabledCard: {
    opacity: 0.6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing[16],
  },
});

