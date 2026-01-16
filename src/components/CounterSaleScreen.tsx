import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  BackHandler,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { getStocks, Stock } from '../services/stockService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError, showSuccess } from '../shared/feedback/messageBus';
import DropletLoader from './DropletLoader';
import {
  completeCounterSaleTransaction,
  COUNTER_SALES_CUSTOMER_ID,
  COUNTER_SALES_CUSTOMER_NAME,
} from '../services/counterSaleService';

type AllowedProductId = '20L_CAN' | '1L_CASE' | '500ML_CASE' | '300ML_CASE';

const ALLOWED_PRODUCT_IDS: AllowedProductId[] = ['20L_CAN', '1L_CASE', '500ML_CASE', '300ML_CASE'];

type Props = {
  onBack: () => void;
  onViewHistory?: () => void;
};

const toNumber = (text: string) => {
  const n = Number(String(text || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const formatProductName = (productName: string) => {
  const name = String(productName || '').toLowerCase();

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

  return productName;
};

export default function CounterSaleScreen({ onBack, onViewHistory }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);

  const [productId, setProductId] = useState<AllowedProductId>('20L_CAN');
  const [quantityText, setQuantityText] = useState('1');
  const [emptyQtyText, setEmptyQtyText] = useState('');
  const [unitPriceText, setUnitPriceText] = useState('25');

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [amountPaidText, setAmountPaidText] = useState('');
  const [paymentRefText, setPaymentRefText] = useState('');

  useEffect(() => {
    const handleBackPress = () => {
      onBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [onBack]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getStocks();
      if (Array.isArray(res)) {
        setStocks(res);
      } else {
        const err = handleServiceError(res, 'getStocks');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'getStocks');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedStock = useMemo(() => {
    return stocks.find((s) => s.id === productId);
  }, [stocks, productId]);

  const getProductLabel = (id: AllowedProductId) => {
    const stockName = stocks.find((s) => s.id === id)?.productName;
    if (stockName) return formatProductName(stockName);
    return id;
  };

  // Apply pricing rules whenever product changes (but allow user override after that).
  useEffect(() => {
    if (productId === '20L_CAN') {
      setUnitPriceText('25');
    } else {
      const stockPrice = selectedStock?.price ?? 0;
      setUnitPriceText(String(stockPrice || 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const quantity = useMemo(() => Math.max(0, Math.floor(toNumber(quantityText))), [quantityText]);
  const emptyQty = useMemo(() => Math.max(0, Math.floor(toNumber(emptyQtyText))), [emptyQtyText]);
  const unitPrice = useMemo(() => Math.max(0, toNumber(unitPriceText)), [unitPriceText]);

  const saleAmount = useMemo(() => {
    return Number((quantity * unitPrice).toFixed(2));
  }, [quantity, unitPrice]);

  const amountPaid = useMemo(() => {
    if (!amountPaidText) return saleAmount;
    return Math.max(0, toNumber(amountPaidText));
  }, [amountPaidText, saleAmount]);

  const stockAvailable = Number(selectedStock?.quantity ?? 0) || 0;

  const submit = async () => {
    if (saving) return;

    if (!ALLOWED_PRODUCT_IDS.includes(productId)) {
      showError('Invalid product for counter sale');
      return;
    }

    if (quantity <= 0) {
      showError('Enter a valid quantity');
      return;
    }

    if (unitPrice < 0) {
      showError('Enter a valid unit price');
      return;
    }

    if (stockAvailable < quantity) {
      showError(`Insufficient stock. Available: ${stockAvailable}`);
      return;
    }

    try {
      setSaving(true);

      const txResult = await completeCounterSaleTransaction({
        productId,
        quantity,
        emptyQty: productId === '20L_CAN' ? emptyQty : undefined,
        unitPrice,
        paymentMethod,
        amountPaid,
        paymentRef: paymentMethod === 'online' ? paymentRefText : undefined,
      });

      if (!('ok' in txResult)) {
        const err = handleServiceError(txResult, 'completeCounterSaleTransaction');
        showError(err.message);
        return;
      }

      showSuccess('Counter sale saved');

      // Reset fields for next entry.
      setQuantityText('1');
      setAmountPaidText('');
      setPaymentRefText('');
      setPaymentMethod('cash');
      setEmptyQtyText('');

      await load();
    } catch (e) {
      const err = handleServiceError(e, 'completeCounterSaleTransaction');
      showError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <DropletLoader visible={loading || saving} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Counter Sale</Text>
        <TouchableOpacity
          onPress={onViewHistory}
          disabled={!onViewHistory}
          style={[styles.headerActionBtn, !onViewHistory ? styles.headerActionDisabled : null]}
        >
          <MaterialCommunityIcons name="history" size={20} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.customerName}>{COUNTER_SALES_CUSTOMER_NAME}</Text>
            <Text style={styles.customerMeta}>ID: {COUNTER_SALES_CUSTOMER_ID}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Product</Text>

          <View style={styles.chipsRow}>
            {ALLOWED_PRODUCT_IDS.map((id) => {
              const active = id === productId;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.chip, active ? styles.chipActive : null]}
                  onPress={() => setProductId(id)}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                    {getProductLabel(id)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Available: {stockAvailable}</Text>
            <Text style={styles.metaText}>{selectedStock?.productName || ''}</Text>
          </View>

          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={quantityText}
                onChangeText={setQuantityText}
                keyboardType="numeric"
                placeholder="Qty"
                placeholderTextColor={colors.gray[400]}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unit Price (₹)</Text>
              <TextInput
                style={styles.input}
                value={unitPriceText}
                onChangeText={setUnitPriceText}
                keyboardType="numeric"
                placeholder="Price"
                placeholderTextColor={colors.gray[400]}
              />
            </View>
          </View>

          {productId === '20L_CAN' ? (
            <>
              <Text style={[styles.label, { marginTop: spacing[12] }]}>Empty</Text>
              <TextInput
                style={styles.input}
                value={emptyQtyText}
                onChangeText={setEmptyQtyText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.gray[400]}
              />
            </>
          ) : null}

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{saleAmount}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>

          <Text style={styles.label}>Method</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, paymentMethod === 'cash' ? styles.toggleBtnActive : null]}
              onPress={() => setPaymentMethod('cash')}
            >
              <Text style={[styles.toggleText, paymentMethod === 'cash' ? styles.toggleTextActive : null]}>Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, paymentMethod === 'online' ? styles.toggleBtnActive : null]}
              onPress={() => setPaymentMethod('online')}
            >
              <Text style={[styles.toggleText, paymentMethod === 'online' ? styles.toggleTextActive : null]}>Online</Text>
            </TouchableOpacity>
          </View>

          {paymentMethod === 'online' ? (
            <>
              <Text style={[styles.label, { marginTop: spacing[12] }]}>Payment Ref (optional)</Text>
              <TextInput
                style={styles.input}
                value={paymentRefText}
                onChangeText={setPaymentRefText}
                keyboardType="numeric"
                placeholder="UPI Ref / Txn ID"
                placeholderTextColor={colors.gray[400]}
              />
            </>
          ) : null}

          <Text style={[styles.label, { marginTop: spacing[12] }]}>Amount Paid (₹)</Text>
          <TextInput
            style={styles.input}
            value={amountPaidText}
            onChangeText={setAmountPaidText}
            keyboardType="numeric"
            placeholder={`Default: ${saleAmount}`}
            placeholderTextColor={colors.gray[400]}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, saving ? styles.btnDisabled : null]}
            onPress={submit}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Add Counter Sale'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  headerActionDisabled: {
    opacity: 0.4,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  card: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[16],
    ...elevation.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    marginBottom: spacing[12],
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing[12],
  },
  customerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
  },
  customerMeta: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.full,
    backgroundColor: colors.bg.white,
  },
  chipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.semibold,
  },
  chipTextActive: {
    color: colors.primary[700],
  },
  metaRow: {
    marginTop: spacing[10],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  fieldRow: {
    marginTop: spacing[12],
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing[6],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
    fontSize: typography.fontSize.base,
    color: colors.gray[800],
    backgroundColor: colors.bg.white,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing[10],
  },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[10],
    alignItems: 'center',
    backgroundColor: colors.bg.white,
  },
  toggleBtnActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  toggleText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.semibold,
  },
  toggleTextActive: {
    color: colors.primary[700],
  },
  totalBox: {
    marginTop: spacing[14],
    padding: spacing[12],
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.light,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: typography.fontSize.base,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.semibold,
  },
  totalValue: {
    fontSize: typography.fontSize.lg,
    color: colors.gray[900],
    fontWeight: typography.fontWeight.bold,
  },
  primaryBtn: {
    marginTop: spacing[12],
    backgroundColor: colors.primary[600],
    paddingVertical: spacing[12],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.bg.white,
  },
  btnDisabled: {
    opacity: 0.7,
  },
});
