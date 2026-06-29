import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { createUserWithAuthAndProfile } from '../services/userService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError, showSuccess } from '../shared/feedback/messageBus';
import { colors } from '../shared/theme/theme';
import { useFormState } from '../shared/hooks/useFormState';

const ROLES = ['Owner', 'Employee', 'Customer'];

const USER_FORM_INITIAL = {
  name: '',
  phone: '',
  email: '',
  role: 'Employee',
  password: '',
  confirmPassword: '',
};

type Props = {
  onBack: () => void;
  onSaved: () => void;
};

export default function AddUserScreen({ onBack, onSaved }: Props) {
  const { values: form, setValue } = useFormState(USER_FORM_INITIAL);
  const [saving, setSaving] = useState(false);

  const normalizedEmail = useMemo(() => String(form.email || '').trim().toLowerCase(), [form.email]);

  const validate = () => {
    if (!form.name.trim()) {
      showError('Enter name', { title: 'Validation' });
      return false;
    }
    if (!form.phone.trim()) {
      showError('Enter mobile number', { title: 'Validation' });
      return false;
    }
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      showError('Enter a valid email', { title: 'Validation' });
      return false;
    }
    if (!form.role.trim()) {
      showError('Select role', { title: 'Validation' });
      return false;
    }
    if (form.password.length < 6) {
      showError('Password must be at least 6 characters', { title: 'Validation' });
      return false;
    }
    if (form.password !== form.confirmPassword) {
      showError('Password and confirm password do not match', { title: 'Validation' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) return;

    try {
      setSaving(true);
      const res = await createUserWithAuthAndProfile({
        name: form.name,
        phone: form.phone,
        email: normalizedEmail,
        role: form.role,
        password: form.password,
        isActive: true,
        isAdmin: form.role === 'Owner',
      });

      if (res && typeof res === 'object' && 'code' in res && 'message' in res) {
        const err = handleServiceError(res, 'createUser');
        showError(err.message);
        return;
      }

      showSuccess('User created');
      onSaved();
    } catch (e) {
      const err = handleServiceError(e, 'createUser');
      showError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Create User</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={form.name} onChangeText={(v) => setValue('name', v)} placeholder="Full name" placeholderTextColor={colors.gray[400]} />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Mobile</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(v) => setValue('phone', v)}
          placeholder="Mobile number"
          placeholderTextColor={colors.gray[400]}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(v) => setValue('email', v)}
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
            <TouchableOpacity key={r} style={[styles.badge, form.role === r && styles.badgeActive]} onPress={() => setValue('role', r)}>
              <Text style={[styles.badgeText, form.role === r && styles.badgeTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={form.password}
          onChangeText={(v) => setValue('password', v)}
          placeholder="Minimum 6 characters"
          placeholderTextColor={colors.gray[400]}
          secureTextEntry
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          value={form.confirmPassword}
          onChangeText={(v) => setValue('confirmPassword', v)}
          placeholder="Re-enter password"
          placeholderTextColor={colors.gray[400]}
          secureTextEntry
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack} disabled={saving}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
              <Text style={styles.primaryText}>Create</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8fafc' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 14 },

  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d5dce9',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
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
  badgeText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  badgeTextActive: { color: colors.primary[600] },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8, paddingBottom: 12 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5dce9',
  },
  secondaryText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  primaryBtn: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
