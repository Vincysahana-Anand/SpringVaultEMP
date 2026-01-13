import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getIconColor } from '../icons/colorMap';
export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export type StatCardProps = {
  icon: IconName;
  label: string;
  value: string | number;
  subLabel?: string;
  bgColor?: string;
};

export function StatCard({ icon, label, value, subLabel, bgColor = '#fff' }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}> 
      <View style={styles.statContent}>
        <MaterialCommunityIcons name={icon} size={20} color={getIconColor(icon)} style={styles.statIconStyle} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {subLabel && <Text style={styles.subLabel}>{subLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
