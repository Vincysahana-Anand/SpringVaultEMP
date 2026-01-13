import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { currencyINR } from '../../utils/format';
import { colors, spacing, elevation, borderRadius, typography } from '../theme/theme';

interface SaleCardProps {
  label: string;
  value: number;
  color?: string;
}

export function SaleCard({ label, value, color = colors.success[700] }: SaleCardProps) {
  return (
    <View style={styles.saleCard}>
      <Text style={[styles.saleLabel, { color }]}>
        {label}
      </Text>
      <Text style={styles.saleValue}>
        {currencyINR(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  saleCard: {
    flex: 1,
    padding: spacing[12],
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saleLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[8],
  },
  saleValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
});
