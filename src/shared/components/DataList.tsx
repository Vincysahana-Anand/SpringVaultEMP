import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import type { FlatListProps } from 'react-native';
import { colors, spacing, typography } from '../theme/theme';

interface DataListProps<T> extends Omit<FlatListProps<T>, 'data'> {
  data: T[];
  loading: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  emptyMessage?: string;
  /** Override the default spinner shown while loading. */
  loadingComponent?: React.ReactNode;
}

/**
 * Drop-in replacement for the loading → spinner / empty → message / else → FlatList pattern
 * that is repeated across every list screen.
 *
 * Usage:
 *   <DataList
 *     data={filteredItems}
 *     loading={loading}
 *     refreshing={refreshing}
 *     onRefresh={refresh}
 *     emptyMessage="No customers found"
 *     keyExtractor={(item) => item.id!}
 *     renderItem={renderItem}
 *   />
 */
export function DataList<T>({
  data,
  loading,
  refreshing = false,
  onRefresh,
  emptyMessage = 'No items found',
  loadingComponent,
  ...flatListProps
}: DataListProps<T>) {
  if (loading) {
    return (
      <View style={styles.center}>
        {loadingComponent ?? (
          <ActivityIndicator size="large" color={colors.primary[300]} />
        )}
      </View>
    );
  }

  return (
    <FlatList<T>
      data={data}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
      {...flatListProps}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    marginTop: spacing[8],
  },
  emptyText: {
    ...typography.body,
    color: colors.gray[400],
    textAlign: 'center',
  },
});
