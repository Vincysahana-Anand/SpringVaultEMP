import { useState, useEffect, useCallback, useRef } from 'react';
import { handleServiceError, ServiceError } from '../../services/serviceErrorWrapper';
import { showError } from '../feedback/messageBus';

/**
 * Generic hook for list screens with loading, search-filtering, and pull-to-refresh.
 *
 * @param fetchFn - Async function that returns the full data array or a ServiceError.
 * @param filterFn - Predicate to filter a single item against the current search query.
 *
 * Usage:
 *   const { filteredData, loading, refreshing, searchQuery, setSearchQuery, refresh, reload, setData } =
 *     useListScreen<Customer>(getCustomers, (c, q) => c.name.toLowerCase().includes(q.toLowerCase()));
 */
export function useListScreen<T>(
  fetchFn: () => Promise<T[] | ServiceError>,
  filterFn: (item: T, query: string) => boolean,
) {
  // Use refs so that callbacks remain stable even if props change between renders.
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;

  const [data, setData] = useState<T[]>([]);
  const [filteredData, setFilteredData] = useState<T[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const result = await fetchFnRef.current();
      if (Array.isArray(result)) {
        setData(result);
      } else {
        const err = handleServiceError(result, 'useListScreen');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'useListScreen');
      showError(err.message);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []); // stable — reads fetchFnRef internally

  // Initial load on mount.
  useEffect(() => {
    load();
  }, [load]);

  // Re-filter whenever data or search query changes.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(data);
    } else {
      setFilteredData(data.filter((item) => filterFnRef.current(item, searchQuery)));
    }
  }, [searchQuery, data]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    data,
    /** Directly overwrite the data array (useful for optimistic deletes/updates). */
    setData,
    filteredData,
    searchQuery,
    setSearchQuery,
    loading,
    refreshing,
    /** Pull-to-refresh handler. */
    refresh,
    /** Re-fetch the full list (non-refresh, shows full loading state). */
    reload: load,
  };
}
