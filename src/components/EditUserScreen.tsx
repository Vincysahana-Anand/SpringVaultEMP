import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Switch,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { updateUser, User } from '../services/userService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError, showSuccess, showWarning } from '../shared/feedback/messageBus';

const colors = {
  primary: { 50: '#f5f7ff', 200: '#d6e4f7', 500: '#5b9eff', 600: '#4a8ce6' },
  gray: {
    50: '#fafbfc',
    100: '#f1f3f7',
    200: '#e8ecf4',
    400: '#9ca3b5',
    600: '#525966',
    700: '#3a4150',
    800: '#1e2936',
  },
  border: '#d5dce9',
  bg: { white: '#ffffff', light: '#f5f7fa' },
  success: '#16a34a',
  danger: '#ef4444',
};

const ROLES = ['Owner', 'Employee', 'Customer'];

type Props = {
  user: User;
  onBack: () => void;
  onSaved: () => void;
};

export default function EditUserScreen({ user, onBack, onSaved }: Props) {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState<string>(user.role || 'Employee');
  const [isActive, setIsActive] = useState<boolean>(!!user.isActive);
  const [saving, setSaving] = useState(false);

  const userId = user.id || '';
  const normalizedEmail = useMemo(() => String(email || '').trim().toLowerCase(), [email]);

  const validate = () => {
    if (!userId) {
      showError('Missing user id', { title: 'Error' });
      return false;
    }
    if (!name.trim()) {
      showError('Enter name', { title: 'Validation' });
      return false;
    }
    if (!phone.trim()) {
      showError('Enter mobile number', { title: 'Validation' });
      return false;
    }
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      showError('Enter a valid email', { title: 'Validation' });
      return false;
    }
    if (!role.trim()) {
      showError('Select role', { title: 'Validation' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) return;

    try {
      setSaving(true);
      const res = await updateUser(userId, {
        name,
        phone,
        email: normalizedEmail,
        role,
        isActive,
        isAdmin: role === 'Owner',
      });

      if (res !== true) {
        const err = handleServiceError(res, 'updateUser');
        showError(err.message);
        return;
      }

      if (normalizedEmail !== String(user.email || '').trim().toLowerCase()) {
        showWarning('Updated Firestore email only. Login email remains unchanged.', { title: 'Note' });
      }

      showSuccess('User updated');
      onSaved();
    } catch (e) {
      const err = handleServiceError(e, 'updateUser');
      showError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <TouchableOpacity onPress={onBack} style={styles.backIconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit User</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.gray[400]} />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Mobile</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Mobile number"
          placeholderTextColor={colors.gray[400]}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.gray[400]}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={[styles.fieldGroup, { gap: 10 }]}>
        <Text style={styles.label}>Role</Text>
        <View style={styles.badgeRow}>
          {ROLES.map((r) => (
            <TouchableOpacity key={r} style={[styles.badge, role === r && styles.badgeActive]} onPress={() => setRole(r)}>
              <Text style={[styles.badgeText, role === r && styles.badgeTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.subLabel}>{isActive ? 'Active' : 'Inactive'}</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: colors.danger, true: colors.success }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
              <Text style={styles.primaryText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8fafc' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  backIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },

  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  subLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#d5dce9',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
  },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d5dce9',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  badgeActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  badgeText: { fontWeight: '700', color: '#334155' },
  badgeTextActive: { color: colors.primary[600] },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d5dce9',
    backgroundColor: '#ffffff',
  },

  actions: { marginTop: 8 },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});
