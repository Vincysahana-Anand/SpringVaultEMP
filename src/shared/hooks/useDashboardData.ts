import { useState, useCallback, useEffect } from 'react';
import { handleServiceError } from '../../services/serviceErrorWrapper';

interface DashboardState {
  loading: boolean;
  error: Error | null;
  data: any;
}

/**
 * Custom hook for managing dashboard data-fetching state and logic.
 * Provides a standardized pattern for loading, error handling, and retrying data loads.
 *
 * @param fetchFn - Async function that returns dashboard data
 * @param immediate - Whether to fetch data immediately on mount (default: true)
 * @returns { loading, error, data, refetch } - State and refetch function
 */
export function useDashboardData(
  fetchFn: () => Promise<any>,
  immediate: boolean = true
) {
  const [state, setState] = useState<DashboardState>({
    loading: immediate,
    error: null,
    data: null,
  });

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fetchFn();
      setState({
        loading: false,
        error: null,
        data: result,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      handleServiceError(error, 'useDashboardData');
      setState({
        loading: false,
        error,
        data: null,
      });
    }
  }, [fetchFn]);

  // Auto-fetch on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      refetch();
    }
  }, [immediate, refetch]);

  return {
    ...state,
    refetch,
  };
}
