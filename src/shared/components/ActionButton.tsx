import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getIconColor } from '../icons/colorMap';
import { colors, spacing, elevation, borderRadius, typography } from '../theme/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ActionButtonProps {
  icon: IconName;
  label: string;
  primary?: boolean;
  onPress?: () => void;
}

export function ActionButton({ icon, label, primary, onPress }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        primary && styles.actionButtonPrimary,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={primary ? colors.bg.white : getIconColor(icon as string)}
      />
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>
        {label}
      </Text>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={primary ? colors.bg.white : colors.gray[400]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[16],
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[12],
    ...elevation.sm,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary[300],
    borderColor: colors.primary[300],
  },
  actionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    flex: 1,
  },
  actionLabelPrimary: {
    color: colors.bg.white,
  },
});
