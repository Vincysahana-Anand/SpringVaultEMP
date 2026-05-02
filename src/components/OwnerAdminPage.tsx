import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { collection, deleteField, doc, getDocs, getFirestore, limit, query, updateDoc } from '@react-native-firebase/firestore';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';

type Props = {
  onBack: () => void;
};

type CollectionStatus = {
  name: string;
  status: 'hasData' | 'empty' | 'error';
  message: string;
};

type CollectionDocument = {
  id: string;
  fields: Record<string, any>;
};

type DocumentField = {
  key: string;
  value: any;
};

const knownCollections = [
  'customers',
  'customersPurchaseManage',
  'dailyRecord',
  'expenses',
  'orders',
  'partyDeliveries',
  'partyOrders',
  'purchaseHistory',
  'sales',
  'stocks',
  'users',
  'vault',
];

export default function OwnerAdminPage({ onBack }: Props) {
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState('');
  const [documents, setDocuments] = useState<CollectionDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<CollectionDocument | null>(null);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>([]);
  const [deletingFields, setDeletingFields] = useState(false);

  const loadCollections = useCallback(async () => {
    try {
      setLoadingCollections(true);
      const db = getFirestore();

      const results = await Promise.all(
        knownCollections.map(async (name) => {
          try {
            const snap = await getDocs(query(collection(db, name), limit(1)));
            if (snap.empty) {
              return {
                name,
                status: 'empty' as const,
                message: 'No documents yet',
              };
            }

            return {
              name,
              status: 'hasData' as const,
              message: 'Contains documents',
            };
          } catch (error: any) {
            return {
              name,
              status: 'error' as const,
              message: error?.message ? String(error.message) : 'Cannot access collection',
            };
          }
        })
      );

      setCollectionStatus(results);
    } finally {
      setLoadingCollections(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const loadCollectionDocuments = useCallback(async (collectionName: string) => {
    try {
      setLoadingDocuments(true);
      setDocumentsError('');
      const db = getFirestore();
      const snap = await getDocs(query(collection(db, collectionName), limit(100)));
      const docs = snap.docs.map((docSnap: any) => ({
        id: docSnap.id,
        fields: (docSnap.data() as Record<string, any>) || {},
      }));
      setDocuments(docs);
    } catch (error: any) {
      setDocuments([]);
      setDocumentsError(error?.message ? String(error.message) : 'Unable to load documents');
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  const openCollection = useCallback(
    (collectionName: string) => {
      setSelectedCollection(collectionName);
      setSelectedDocument(null);
      setSelectedFieldKeys([]);
      loadCollectionDocuments(collectionName);
    },
    [loadCollectionDocuments]
  );

  const openDocument = useCallback((item: CollectionDocument) => {
    setSelectedDocument(item);
    setSelectedFieldKeys([]);
  }, []);

  const loadSelectedDocument = useCallback(async () => {
    if (!selectedCollection || !selectedDocument) return;

    try {
      setLoadingDocuments(true);
      setDocumentsError('');
      const db = getFirestore();
      const snap = await getDocs(query(collection(db, selectedCollection), limit(100)));
      const docs = snap.docs.map((docSnap: any) => ({
        id: docSnap.id,
        fields: (docSnap.data() as Record<string, any>) || {},
      }));
      setDocuments(docs);
      const nextSelected = docs.find((item: CollectionDocument) => item.id === selectedDocument.id) || null;
      setSelectedDocument(nextSelected);
      setSelectedFieldKeys([]);
    } catch (error: any) {
      setDocumentsError(error?.message ? String(error.message) : 'Unable to load document');
    } finally {
      setLoadingDocuments(false);
    }
  }, [selectedCollection, selectedDocument]);

  const activeRefreshHandler = selectedDocument
    ? loadSelectedDocument
    : selectedCollection
      ? () => loadCollectionDocuments(selectedCollection)
      : loadCollections;
  const activeRefreshing = selectedCollection ? loadingDocuments : loadingCollections;

  const stringifyValue = useCallback((value: any) => {
    if (value === null || value === undefined) return String(value);
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value?.seconds && value?.nanoseconds) return `timestamp(${value.seconds})`;
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
    }
    return String(value);
  }, []);

  const screenTitle = useMemo(() => {
    if (!selectedCollection) return 'Admin Page';
    if (selectedDocument) return `${selectedDocument.id} Fields`;
    return `${selectedCollection} Docs`;
  }, [selectedCollection, selectedDocument]);

  const selectedDocumentFields = useMemo<DocumentField[]>(() => {
    if (!selectedDocument) return [];
    return Object.entries(selectedDocument.fields)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => ({ key, value }));
  }, [selectedDocument]);

  const toggleFieldSelection = useCallback((fieldKey: string) => {
    setSelectedFieldKeys((current) =>
      current.includes(fieldKey) ? current.filter((item) => item !== fieldKey) : [...current, fieldKey]
    );
  }, []);

  const deleteSelectedFields = useCallback(async () => {
    if (!selectedCollection || !selectedDocument || selectedFieldKeys.length === 0 || deletingFields) return;

    try {
      setDeletingFields(true);
      setDocumentsError('');
      const db = getFirestore();
      const updatePayload = selectedFieldKeys.reduce<Record<string, any>>((acc, fieldKey) => {
        acc[fieldKey] = deleteField();
        return acc;
      }, {});

      await updateDoc(doc(db, selectedCollection, selectedDocument.id), updatePayload);
      await loadSelectedDocument();
    } catch (error: any) {
      setDocumentsError(error?.message ? String(error.message) : 'Unable to delete selected fields');
    } finally {
      setDeletingFields(false);
    }
  }, [deletingFields, loadSelectedDocument, selectedCollection, selectedDocument, selectedFieldKeys]);

  const getStatusColor = (status: CollectionStatus['status']) => {
    if (status === 'hasData') return colors.success[600];
    if (status === 'empty') return colors.warning[600];
    return colors.danger[600];
  };

  const getStatusIcon = (status: CollectionStatus['status']) => {
    if (status === 'hasData') return 'check-circle-outline';
    if (status === 'empty') return 'information-outline';
    return 'alert-circle-outline';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (selectedDocument) {
              setSelectedDocument(null);
              setSelectedFieldKeys([]);
              return;
            }
            if (selectedCollection) {
              setSelectedCollection(null);
              setSelectedFieldKeys([]);
              return;
            }
            onBack();
          }}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{screenTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={activeRefreshing} onRefresh={activeRefreshHandler} />}
      >
        {!selectedCollection ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Database Collections</Text>
              <Text style={styles.heroSubtitle}>Tap any collection to open and view its documents.</Text>
            </View>

            <View style={styles.collectionsHeaderRow}>
              <Text style={styles.collectionsTitle}>Collections</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={loadCollections} disabled={loadingCollections}>
                <MaterialCommunityIcons
                  name={loadingCollections ? 'progress-clock' : 'refresh'}
                  size={16}
                  color={colors.primary[700]}
                />
                <Text style={styles.refreshText}>{loadingCollections ? 'Loading' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.collectionsCard}>
              {collectionStatus.length === 0 && !loadingCollections ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No collection data loaded yet.</Text>
                </View>
              ) : null}
              {collectionStatus.map((item, index) => (
                <TouchableOpacity key={item.name} style={[styles.collectionRow, index === collectionStatus.length - 1 ? styles.lastRow : null]} onPress={() => openCollection(item.name)} activeOpacity={0.85}>
                  <View style={styles.collectionNameWrap}>
                    <Text style={styles.collectionName}>{item.name}</Text>
                    <Text style={styles.collectionMeta}>{item.message}</Text>
                  </View>
                  <View style={styles.collectionStateWrap}>
                    <MaterialCommunityIcons name={getStatusIcon(item.status)} size={18} color={getStatusColor(item.status)} />
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.gray[400]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : !selectedDocument ? (
          <>
            <View style={styles.collectionsHeaderRow}>
              <Text style={styles.collectionsTitle}>Documents in {selectedCollection}</Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => loadCollectionDocuments(selectedCollection)}
                disabled={loadingDocuments}
              >
                <MaterialCommunityIcons
                  name={loadingDocuments ? 'progress-clock' : 'refresh'}
                  size={16}
                  color={colors.primary[700]}
                />
                <Text style={styles.refreshText}>{loadingDocuments ? 'Loading' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>

            {documentsError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{documentsError}</Text>
              </View>
            ) : null}

            <View style={styles.collectionsCard}>
              {!loadingDocuments && !documentsError && documents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No documents found in this collection.</Text>
                </View>
              ) : null}

              {documents.map((item, index) => {
                const entries = Object.entries(item.fields);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.documentCard, index === documents.length - 1 ? styles.lastRow : null]}
                    onPress={() => openDocument(item)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.documentHeaderRow}>
                      <Text style={styles.documentId}>ID: {item.id}</Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.gray[400]} />
                    </View>
                    {entries.length === 0 ? <Text style={styles.collectionMeta}>No fields</Text> : null}
                    {entries.slice(0, 3).map(([key, value]) => (
                      <View key={`${item.id}-${key}`} style={styles.documentFieldRow}>
                        <Text style={styles.documentFieldKey}>{key}</Text>
                        <Text style={styles.documentFieldValue}>{stringifyValue(value)}</Text>
                      </View>
                    ))}
                    <Text style={styles.collectionMeta}>
                      {entries.length > 3 ? `Tap to view all ${entries.length} fields` : 'Tap to open document details'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <View style={styles.collectionsHeaderRow}>
              <Text style={styles.collectionsTitle}>Fields in {selectedDocument.id}</Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={loadSelectedDocument}
                disabled={loadingDocuments}
              >
                <MaterialCommunityIcons
                  name={loadingDocuments ? 'progress-clock' : 'refresh'}
                  size={16}
                  color={colors.primary[700]}
                />
                <Text style={styles.refreshText}>{loadingDocuments ? 'Loading' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionsRow}>
              <Text style={styles.selectionText}>{selectedFieldKeys.length} selected</Text>
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  selectedFieldKeys.length === 0 || deletingFields ? styles.deleteButtonDisabled : null,
                ]}
                onPress={deleteSelectedFields}
                disabled={selectedFieldKeys.length === 0 || deletingFields}
              >
                <MaterialCommunityIcons name={deletingFields ? 'progress-clock' : 'delete-outline'} size={18} color="#fff" />
                <Text style={styles.deleteButtonText}>{deletingFields ? 'Deleting' : 'Delete Selected'}</Text>
              </TouchableOpacity>
            </View>

            {documentsError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{documentsError}</Text>
              </View>
            ) : null}

            <View style={styles.collectionsCard}>
              {!loadingDocuments && selectedDocumentFields.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No fields found in this document.</Text>
                </View>
              ) : null}

              {selectedDocumentFields.map((item, index) => {
                const isSelected = selectedFieldKeys.includes(item.key);
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.fieldSelectRow,
                      isSelected ? styles.fieldSelectRowActive : null,
                      index === selectedDocumentFields.length - 1 ? styles.lastRow : null,
                    ]}
                    onPress={() => toggleFieldSelection(item.key)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.fieldCheckbox}>
                      <MaterialCommunityIcons
                        name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={20}
                        color={isSelected ? colors.primary[600] : colors.gray[400]}
                      />
                    </View>
                    <View style={styles.collectionNameWrap}>
                      <Text style={styles.documentFieldKey}>{item.key}</Text>
                      <Text style={styles.documentFieldValueLeft}>{stringifyValue(item.value)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: spacing[24] }} />
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
  headerSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  heroCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[12],
    ...elevation.sm,
  },
  heroTitle: {
    color: colors.gray[900],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: colors.gray[600],
    fontSize: typography.fontSize.sm,
  },
  collectionsHeaderRow: {
    marginTop: spacing[4],
    marginBottom: spacing[8],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collectionsTitle: {
    color: colors.gray[900],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  refreshText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  collectionsCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[12],
    ...elevation.sm,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  collectionNameWrap: {
    flex: 1,
    paddingRight: spacing[10],
  },
  collectionName: {
    color: colors.gray[900],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  collectionMeta: {
    marginTop: 2,
    color: colors.gray[600],
    fontSize: typography.fontSize.xs,
  },
  collectionStateWrap: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  documentCard: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  documentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
  },
  documentId: {
    color: colors.gray[900],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  documentFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
    marginBottom: spacing[4],
  },
  documentFieldKey: {
    flex: 1,
    color: colors.gray[700],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  documentFieldValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.gray[900],
    fontSize: typography.fontSize.xs,
  },
  documentFieldValueLeft: {
    marginTop: spacing[2],
    color: colors.gray[900],
    fontSize: typography.fontSize.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[10],
    gap: spacing[10],
  },
  selectionText: {
    color: colors.gray[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    backgroundColor: colors.danger[600],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: colors.bg.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  fieldSelectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing[8],
  },
  fieldSelectRowActive: {
    backgroundColor: colors.primary[50],
  },
  fieldCheckbox: {
    width: 24,
    paddingTop: 1,
    alignItems: 'center',
  },
  errorCard: {
    backgroundColor: colors.danger[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger[200],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    marginBottom: spacing[10],
  },
  errorText: {
    color: colors.danger[600],
    fontSize: typography.fontSize.sm,
    justifyContent: 'center',
  },
  emptyState: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[14],
  },
  emptyStateText: {
    color: colors.gray[600],
    fontSize: typography.fontSize.sm,
  },
});