import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
  TextInput,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  doc,
} from '@react-native-firebase/firestore';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError, showSuccess } from '../shared/feedback/messageBus';

type Props = {
  onBack: () => void;
  allowEdit: boolean;
  showAdminPageLink?: boolean;
  onOpenAdminPage?: () => void;
};

const normalizeEmail = (email: string) => String(email || '').trim().toLowerCase();

export default function UserProfileScreen({ onBack, allowEdit, showAdminPageLink = false, onOpenAdminPage }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [docId, setDocId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const authUser = useMemo(() => getAuth().currentUser, []);

  useEffect(() => {
    const handleBackPress = () => {
      onBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [onBack]);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const user = getAuth().currentUser;
      if (!user) {
        showError('User not logged in');
        return;
      }

      const userEmail = normalizeEmail(user.email || '');
      setEmail(userEmail);

      const db = getFirestore();
      const usersQuery = query(collection(db, 'users'), where('email', '==', userEmail), limit(1));
      const snap = await getDocs(usersQuery);

      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data() as any;
        setDocId(d.id);
        setName(String(data.name || user.displayName || userEmail.split('@')[0] || '').trim());
        setPhone(String(data.phone || '').trim());
      } else {
        // If profile doc doesn't exist (common for owner), initialize from auth and allow saving.
        setDocId(user.uid);
        setName(String(user.displayName || userEmail.split('@')[0] || '').trim());
        setPhone('');
      }
    } catch (e) {
      const err = handleServiceError(e, 'loadProfile');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onSave = useCallback(async () => {
    if (!allowEdit) return;
    if (saving) return;

    const n = name.trim();
    const p = phone.trim();

    if (!n) {
      showError('Enter name', { title: 'Validation' });
      return;
    }
    if (!p) {
      showError('Enter mobile number', { title: 'Validation' });
      return;
    }

    try {
      setSaving(true);
      const user = getAuth().currentUser;
      if (!user) {
        showError('User not logged in');
        return;
      }

      const userEmail = normalizeEmail(user.email || '');
      const targetId = docId || user.uid;

      const payload = {
        name: n,
        phone: p,
        email: userEmail,
        updatedAt: serverTimestamp(),
      };

      // If we found a doc by email, update it. Otherwise create/update at users/{uid}.
      if (docId) {
        await updateDoc(doc(getFirestore(), 'users', targetId), payload as any);
      } else {
        await setDoc(doc(getFirestore(), 'users', user.uid), { ...payload, createdAt: serverTimestamp() } as any, { merge: true });
        setDocId(user.uid);
      }

      showSuccess('Profile updated');
    } catch (e) {
      const err = handleServiceError(e, 'saveProfile');
      showError(err.message);
    } finally {
      setSaving(false);
    }
  }, [allowEdit, docId, name, phone, saving]);

  const onRefresh = () => {
    loadProfile();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {allowEdit ? (
          <TouchableOpacity onPress={onSave} style={styles.saveButton} disabled={saving}>
            <MaterialCommunityIcons
              name={saving ? 'progress-clock' : 'content-save-outline'}
              size={20}
              color={colors.primary[600]}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.saveButton} />
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        <View style={styles.mainCard}>
          <View style={styles.nameRow}>
            <MaterialCommunityIcons name="account" size={20} color={colors.primary[600]} style={styles.fieldIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                editable={allowEdit}
                placeholder="Name"
                placeholderTextColor={colors.gray[400]}
                style={[styles.fieldInput, !allowEdit ? styles.fieldInputDisabled : null]}
              />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.nameRow}>
            <MaterialCommunityIcons name="phone" size={20} color={colors.primary[600]} style={styles.fieldIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                editable={allowEdit}
                placeholder="Mobile number"
                placeholderTextColor={colors.gray[400]}
                keyboardType="phone-pad"
                style={[styles.fieldInput, !allowEdit ? styles.fieldInputDisabled : null]}
              />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.nameRow}>
            <MaterialCommunityIcons name="email-outline" size={20} color={colors.gray[600]} style={styles.fieldIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.readonlyValue}>{email || authUser?.email || ''}</Text>
            </View>
          </View>
        </View>

        {showAdminPageLink && onOpenAdminPage ? (
          <TouchableOpacity style={styles.adminLinkCard} onPress={onOpenAdminPage} activeOpacity={0.9}>
            <View style={styles.adminLinkLeft}>
              <View style={styles.adminIconWrap}>
                <MaterialCommunityIcons name="shield-account-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminLinkTitle}>Admin Page</Text>
                <Text style={styles.adminLinkSubtitle}>Open owner controls and management tools.</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.gray[500]} />
          </TouchableOpacity>
        ) : null}

        {!allowEdit ? (
          <View style={styles.hintCard}>
            <MaterialCommunityIcons name="lock-outline" size={18} color={colors.gray[600]} />
            <Text style={styles.hintText}>Only admin can edit profile details.</Text>
          </View>
        ) : null}

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
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg.white,
  },
  backButton: {
    padding: spacing[8],
    marginRight: spacing[8],
    borderRadius: borderRadius.full,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
  },
  fieldIcon: {
    marginTop: 2,
  },
  fieldLabel: {
    color: colors.gray[600],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    color: colors.gray[900],
    fontSize: typography.fontSize.sm,
    backgroundColor: colors.bg.white,
  },
  fieldInputDisabled: {
    backgroundColor: colors.gray[50],
    color: colors.gray[700],
  },
  readonlyValue: {
    color: colors.gray[900],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    paddingVertical: spacing[10],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing[14],
  },
  hintCard: {
    marginTop: spacing[12],
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  adminLinkCard: {
    marginTop: spacing[12],
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...elevation.sm,
  },
  adminLinkLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  adminIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminLinkTitle: {
    color: colors.gray[900],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  adminLinkSubtitle: {
    marginTop: 2,
    color: colors.gray[600],
    fontSize: typography.fontSize.xs,
  },
  hintText: {
    flex: 1,
    color: colors.gray[700],
    fontSize: typography.fontSize.sm,
  },
});
