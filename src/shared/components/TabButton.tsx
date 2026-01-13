import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  icon: IconName;
  label: string;
  isActive: boolean;
  onPress?: () => void;
};

export function TabButton({ icon, label, isActive, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, isActive && styles.tabButtonActive]}>
      <MaterialCommunityIcons name={icon} size={22} color={isActive ? '#0ea5b8' : '#6b7280'} />
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#cffafe',
  },
  tabLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#0ea5b8',
    fontWeight: '600',
  },
});
