import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getIconColor } from '../icons/colorMap';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  icon: IconName;
  label: string;
  onPress?: () => void;
};

export function MenuItem({ icon, label, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={20} color={getIconColor(icon)} style={styles.menuIconStyle} />
      <Text style={styles.menuLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  menuIconStyle: {
    width: 20,
  },
  menuLabel: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
  },
});
