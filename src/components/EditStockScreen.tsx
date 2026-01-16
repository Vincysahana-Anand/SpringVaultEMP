import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { updateStock, Stock } from '../services/stockService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError, showSuccess } from '../shared/feedback/messageBus';

interface EditStockScreenProps {
  stock: Stock;
  userRole: 'owner' | 'employee';
  onGoBack: () => void;
  onSuccess: (updatedStock: Stock) => void;
}

const colors = {
  primary: { 50: '#f0f9ff', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1' },
  success: { 500: '#10b981', 600: '#059669' },
  danger: { 500: '#ef4444', 600: '#dc2626' },
  warning: { 500: '#f59e0b', 600: '#d97706' },
  bg: { white: '#ffffff', light: '#f8fafc', dark: '#1e293b' },
  gray: { 100: '#f3f4f6', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 800: '#1e293b' },
  border: '#e2e8f0',
};

const typography = {
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24 },
  fontWeight: { normal: '400' as const, semibold: '600' as const, bold: '700' as const },
};

const spacing = {
  2: 8,
  4: 12,
  6: 16,
  8: 24,
  10: 32,
  12: 40,
  16: 64,
  24: 96,
};

const borderRadius = { md: 12, lg: 16, xl: 20 };

export default function EditStockScreen({
  stock,
  userRole,
  onGoBack,
  onSuccess,
}: EditStockScreenProps) {
  const [editQuantity, setEditQuantity] = useState(stock.quantity?.toString() || '0');
  const [editPrice, setEditPrice] = useState((stock as any).price?.toString() || '0');
  const [editEmpty, setEditEmpty] = useState((stock.empty?.toString() || '0'));
  const [editTotal, setEditTotal] = useState((stock.total?.toString() || '0'));
  const [editExtraCan, setEditExtraCan] = useState((stock.extraCan?.toString() || '0'));
  const [submitting, setSubmitting] = useState(false);
  const [originalQuantity] = useState(stock.quantity || 0);
  const [originalEmpty] = useState(stock.empty || 0);

  const is20LOrParty = stock.id === '20L_CAN' || stock.id === '20L_PARTY_CAN';

  // Auto-adjust empty field when quantity changes for 20L products
  useEffect(() => {
    if (is20LOrParty) {
      const newQuantity = parseInt(editQuantity || '0', 10);
      const quantityChange = newQuantity - originalQuantity;
      
      if (quantityChange !== 0) {
        // If quantity increased, reduce empty by the added amount
        // If quantity decreased, increase empty by the reduced amount (viceversa)
        const newEmpty = Math.max(0, originalEmpty - quantityChange);
        setEditEmpty(newEmpty.toString());
      } else {
        // If quantity unchanged, reset to original empty
        setEditEmpty(originalEmpty.toString());
      }
    }
  }, [editQuantity, is20LOrParty, originalQuantity, originalEmpty]);

  const handleSubmit = async () => {
    const quantity = parseInt(editQuantity || '0', 10);

    if (isNaN(quantity) || quantity < 0) {
      showError('Please enter a valid quantity', { title: 'Validation' });
      return;
    }

    try {
      setSubmitting(true);

      const updateData: Partial<Stock> = {
        quantity,
      };

      // Add price for owner
      if (userRole === 'owner') {
        const price = parseInt(editPrice || '0', 10);
        if (!isNaN(price) && price >= 0) {
          (updateData as any).price = price;
        }
      }

      // Add empty field for 20L products (for both owner and employee since it auto-adjusts)
      if (is20LOrParty) {
        const empty = parseInt(editEmpty || '0', 10);
        if (!isNaN(empty) && empty >= 0) {
          updateData.empty = empty;
        }
      }

      // Only add total and extraCan fields if owner and is 20L product
      if (userRole === 'owner' && is20LOrParty) {
        const total = parseInt(editTotal || '0', 10);
        const extraCan = parseInt(editExtraCan || '0', 10);

        if (!isNaN(total) && total >= 0) {
          updateData.total = total;
        }
        if (!isNaN(extraCan) && extraCan >= 0) {
          updateData.extraCan = extraCan;
        }
      }

      const result = await updateStock(stock.id, updateData);
      if (result !== true) {
        const err = handleServiceError(result, 'updateStock');
        showError(err.message);
        setSubmitting(false);
        return;
      }

      const updatedStock: Stock = {
        ...stock,
        quantity,
        ...(userRole === 'owner' && { price: parseInt(editPrice || '0', 10) || (stock as any).price } as any),
        empty: is20LOrParty ? (parseInt(editEmpty || '0', 10) || stock.empty) : stock.empty,
        total: userRole === 'owner' && is20LOrParty ? (parseInt(editTotal || '0', 10) || stock.total) : stock.total,
        extraCan: userRole === 'owner' && is20LOrParty ? (parseInt(editExtraCan || '0', 10) || stock.extraCan) : stock.extraCan,
      };

      setSubmitting(false);
      showSuccess('Stock updated successfully');
      onSuccess(updatedStock);
    } catch (error) {
      const err = handleServiceError(error, 'updateStock');
      showError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Stock</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Info Card */}
        <View style={styles.productCard}>
          <View style={styles.productHeader}>
            <MaterialCommunityIcons name="water" size={18} color={colors.primary[500]} />
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{stock.productName}</Text>
            </View>
          </View>
        </View>

        {/* Quantity Field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Available Quantity *</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.gray[400]}
            value={editQuantity}
            onChangeText={setEditQuantity}
            keyboardType="number-pad"
            editable={!submitting}
          />
          <Text style={styles.fieldHint}>Current: {stock.quantity || 0} units</Text>
        </View>

        {/* Price Field - Always shown, editable only for owner */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, userRole !== 'owner' ? styles.disabledLabel : {}]}>
            Price per Unit
          </Text>
          <TextInput
            style={[
              styles.input,
              userRole !== 'owner' && styles.disabledInput,
            ]}
            placeholder="0"
            placeholderTextColor={colors.gray[400]}
            value={editPrice}
            onChangeText={setEditPrice}
            keyboardType="number-pad"
            editable={userRole === 'owner' && !submitting}
          />
          <Text style={styles.fieldHint}>Current: ₹{(stock as any).price || 0} per unit</Text>
        </View>

        {/* Empty Field - Only shown for 20L products, editable only for owner */}
        {is20LOrParty && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, userRole !== 'owner' ? styles.disabledLabel : {}]}>
              Empty Units
            </Text>
            <TextInput
              style={[
                styles.input,
                userRole !== 'owner' && styles.disabledInput,
              ]}
              placeholder="0"
              placeholderTextColor={colors.gray[400]}
              value={editEmpty}
              onChangeText={setEditEmpty}
              keyboardType="number-pad"
              editable={userRole === 'owner' && !submitting}
            />
            <Text style={styles.fieldHint}>Current: {stock.empty || 0} units</Text>
          </View>
        )}

        {/* Extra Can Field - Only shown for 20L products, editable only for owner */}
        {is20LOrParty && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, userRole !== 'owner' ? styles.disabledLabel : {}]}>
              Extra Can
            </Text>
            <TextInput
              style={[
                styles.input,
                userRole !== 'owner' && styles.disabledInput,
              ]}
              placeholder="0"
              placeholderTextColor={colors.gray[400]}
              value={editExtraCan}
              onChangeText={setEditExtraCan}
              keyboardType="number-pad"
              editable={userRole === 'owner' && !submitting}
            />
            <Text style={styles.fieldHint}>Current: {stock.extraCan || 0} units</Text>
          </View>
        )}

        {/* Total Stock Field - Only shown for 20L products, editable only for owner */}
        {is20LOrParty && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, userRole !== 'owner' ? styles.disabledLabel : {}]}>
              Total Stock
            </Text>
            <TextInput
              style={[
                styles.input,
                userRole !== 'owner' && styles.disabledInput,
              ]}
              placeholder="0"
              placeholderTextColor={colors.gray[400]}
              value={editTotal}
              onChangeText={setEditTotal}
              keyboardType="number-pad"
              editable={userRole === 'owner' && !submitting}
            />
            <Text style={styles.fieldHint}>Current: {stock.total || 0} units</Text>
          </View>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.buttonSecondary, submitting && styles.buttonDisabled]}
          onPress={onGoBack}
          disabled={submitting}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buttonPrimary, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.bg.white} size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle" size={18} color={colors.bg.white} />
              <Text style={styles.buttonPrimaryText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.white,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: '#0f172a',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  productCard: {
    backgroundColor: colors.bg.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    color: '#0f172a',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.md,
    marginBottom: spacing[6],
    gap: spacing[2],
  },
  roleBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[600],
    marginBottom: 6,
  },
  disabledLabel: {
    color: colors.gray[500],
  },
  input: {
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  disabledInput: {
    backgroundColor: '#f1f5f9',
    color: colors.gray[500],
    borderColor: colors.border,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.gray[500],
    marginTop: 6,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.md,
    marginBottom: spacing[6],
    gap: spacing[4],
  },
  noticeText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bg.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buttonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: {
    fontSize: 13,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  buttonPrimary: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
  },
  buttonPrimaryText: {
    fontSize: 13,
    fontWeight: typography.fontWeight.semibold,
    color: colors.bg.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
