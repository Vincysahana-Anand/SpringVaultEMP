import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { deleteUser, getUsers, User } from '../services/userService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
import { colors } from '../shared/theme/theme';
import { useListScreen } from '../shared/hooks/useListScreen';

type Props = {
  onBack: () => void;
  onAdd: () => void;
  onSelectUser: (user: User) => void;
  refreshKey?: number;
};

const userFilter = (u: User, q: string) => {
  const needle = q.trim().toLowerCase();
  return (
    String(u.name || '').toLowerCase().includes(needle) ||
    String(u.email || '').toLowerCase().includes(needle) ||
    String(u.phone || '').toLowerCase().includes(needle) ||
    String(u.role || '').toLowerCase().includes(needle)
  );
};

export default function UsersListScreen({ onBack, onAdd, onSelectUser, refreshKey = 0 }: Props) {
  const {
    filteredData: filteredUsers,
    setData: setUsers,
    loading,
    refreshing,
    searchQuery: query,
    setSearchQuery: setQuery,
    refresh: onRefresh,
    reload: fetchUsers,
  } = useListScreen<User>(getUsers, userFilter);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Re-fetch when the parent signals a data change via refreshKey.
  const prevRefreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (prevRefreshKeyRef.current !== refreshKey) {
      prevRefreshKeyRef.current = refreshKey;
      fetchUsers();
    }
  }, [refreshKey, fetchUsers]);

  const roleIconName = (roleValue: string) => {
    const r = String(roleValue || '').toLowerCase();
    if (r === 'owner') return 'crown-outline';
    if (r === 'employee') return 'account-tie-outline';
    return 'account-outline';
  };

  const handleDelete = useCallback(
    (u: User) => {
      if (!u.id) {
        showError('User id missing');
        return;
      }

      Alert.alert('Delete user?', `Delete ${u.name || 'this user'} from the users list?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(u.id as string);
              const res = await deleteUser(u.id as string);
              if (res !== true) {
                const err = handleServiceError(res, 'deleteUser');
                showError(err.message);
                return;
              }
              setUsers((prev) => prev.filter((x) => x.id !== u.id));
            } catch (e) {
              const err = handleServiceError(e, 'deleteUser');
              showError(err.message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Users</Text>
        <TouchableOpacity onPress={onAdd} style={styles.addBtn}>
          <MaterialCommunityIcons name="account-plus" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.gray[600]} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name / mobile / email / role"
          placeholderTextColor={colors.gray[400]}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredUsers.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="account-search" size={26} color={colors.gray[600]} />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySub}>Try changing your search or add a new user.</Text>
            </View>
          ) : (
            filteredUsers.map((u) => {
              const role = String(u.role || '-');
              const isActive = !!u.isActive;
              const iconColor = isActive ? colors.success[600] : colors.danger[500];
              return (
                <TouchableOpacity
                  key={u.id || `${u.email}-${u.phone}`}
                  style={styles.userCard}
                  onPress={() => onSelectUser(u)}
                >
                  <View style={styles.userTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{u.name || '-'}</Text>
                      <Text style={styles.userMeta}>{u.phone || '-'}</Text>
                      <Text style={styles.userMeta}>{u.email || '-'}</Text>
                    </View>

                    <View style={styles.actionsCol}>
                      <View style={styles.actionIconButton}>
                        <MaterialCommunityIcons name={roleIconName(role) as any} size={22} color={iconColor} />
                      </View>

                      <TouchableOpacity
                        style={[styles.actionIconButton, deletingId === u.id && { opacity: 0.5 }]}
                        onPress={() => handleDelete(u)}
                        disabled={!u.id || deletingId === u.id}
                      >
                        {deletingId === u.id ? (
                          <ActivityIndicator size="small" color={colors.danger[500]} />
                        ) : (
                          <MaterialCommunityIcons name="delete-outline" size={22} color={colors.danger[500]} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.gray[100],
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: colors.gray[800] },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary[500],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 10,
    backgroundColor: colors.gray[50],
  },
  searchInput: { flex: 1, padding: 0, color: colors.gray[800] },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.gray[600], fontWeight: '600' },

  content: { paddingHorizontal: 16, paddingBottom: 16 },
  userCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  userTopRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  userName: { fontSize: 15, fontWeight: '800', color: colors.gray[800] },
  userMeta: { marginTop: 6, color: colors.gray[600], fontWeight: '600', fontSize: 12 },

  actionsCol: { alignItems: 'flex-end', gap: 10 },
  actionIconButton: {
    padding: 8,
    marginTop: -8,
    marginRight: -8,
  },

  emptyCard: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.gray[800] },
  emptySub: { color: colors.gray[600], fontWeight: '600', textAlign: 'center' },
});
