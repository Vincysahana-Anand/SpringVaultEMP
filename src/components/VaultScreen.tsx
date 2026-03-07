import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, ScrollView, Modal, KeyboardAvoidingView, Pressable } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getVaultRecord, setVaultRecord, VaultRecord } from '../services/vaultService';
import { showError, showSuccess } from '../shared/feedback/messageBus';
import { StatCard } from '../shared/components/StatCard';

interface Props {
  allowEdit: boolean;
  onBack: () => void;
}

export default function VaultScreen({ allowEdit, onBack }: Props) {
  const [vault, setVault] = useState<VaultRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [cash, setCash] = useState<string>('');
  const [online, setOnline] = useState<string>('');

  const loadVault = async () => {
    try {
      const res = await getVaultRecord();
      if (res && !(res as any).code) {
        const rec = res as VaultRecord;
        setVault(rec);
        setCash(String(rec.cash));
        setOnline(String(rec.online));
      }
    } catch (e) {
      showError('Failed to load vault totals');
    }
  };

  useEffect(() => {
    loadVault();
  }, []);

  const handleSave = async () => {
    const cashVal = parseFloat(cash) || 0;
    const onlineVal = parseFloat(online) || 0;
    const total = cashVal + onlineVal;
    try {
      const res = await setVaultRecord({ cash: cashVal, online: onlineVal, total });
      if (res === true) {
        showSuccess('Vault updated');
        setShowEditModal(false);
        setVault({ cash: cashVal, online: onlineVal, total });
      } else {
        const err = res as any;
        showError(err.message || 'Unable to save vault');
      }
    } catch (e) {
      showError('Unexpected error saving vault');
    }
  };

  const displayField = (label: string, value: number) => (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value.toFixed(2)}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Vault</Text>
        {allowEdit ? (
          <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.editButton}>
            <MaterialCommunityIcons name="pencil" size={20} color="#0ea5e9" />
          </TouchableOpacity>
        ) : null}
      </View>

      {vault ? (
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard icon="cash" label="Cash" value={vault.cash} />
            <StatCard icon="credit-card" label="Online" value={vault.online} />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="bank" label="Total" value={vault.total} />
          </View>
        </View>
      ) : null}

      {/* edit modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Vault</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={24} color="#475569" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Cash</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                    value={cash}
                    onChangeText={setCash}
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Online</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                    value={online}
                    onChangeText={setOnline}
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Total</Text>
                  <Text style={styles.fieldValue}>{(parseFloat(cash) + parseFloat(online) || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(false)}
                    style={[styles.button, styles.cancelButton]}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} style={[styles.button, styles.saveButton]}>
                    <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    color: '#0f172a',
  },
  editButton: {
    padding: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 120,
    textAlign: 'right',
    color: '#0f172a',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  saveButton: {
    backgroundColor: '#0ea5e9',
  },
  buttonText: {
    fontWeight: '600',
    color: '#475569',
  },
  statsGrid: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 14,
  },
  flex1: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {},
  modalScrollContent: {
    paddingBottom: 20,
  },
});