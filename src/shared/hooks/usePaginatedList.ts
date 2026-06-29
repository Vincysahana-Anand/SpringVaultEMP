import { useState, useCallback, useRef } from 'react';
import { handleServiceError, ServiceError } from '../../services/serviceErrorWrapper';
import { showError } from '../feedback/messageBus';

export type PageResult<T, C> = {
  records: T[];
  nextCursor: C;
  hasMore: boolean;
};

/**
 * Generic hook for cursor-based paginated lists.
 *
 * @param fetchPage - Async function that accepts a cursor (or null for first page) and
 *   returns a PageResult or ServiceError.
 *
 * Usage:
 *   const { items, loading, loadingMore, hasMore, load, loadMore } =
 *     usePaginatedList<PurchaseRecord, PurchaseHistoryCursor>(
 *       (cursor) => getCustomerPurchaseHistoryPage(customerId, 50, cursor),
 *     );
 */
export function usePaginatedList<T, C = any>(
  fetchPage: (cursor: C | null) => Promise<PageResult<T, C> | ServiceError>,
) {
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<C | null>(null);

  // Use refs for flags needed inside loadMore to avoid stale closure issues.
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const nextCursorRef = useRef(nextCursor);
  nextCursorRef.current = nextCursor;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;

  /** Load (or reload) the first page. */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchPageRef.current(null);
      if (result && typeof result === 'object' && 'records' in result) {
        const page = result as PageResult<T, C>;
        setItems(page.records);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      } else {
        const err = handleServiceError(result, 'usePaginatedList');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'usePaginatedList');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Append the next page. No-op when already at the last page or a load is in flight. */
  const loadMore = useCallback(async () => {
    if (
      !hasMoreRef.current ||
      !nextCursorRef.current ||
      loadingRef.current ||
      loadingMoreRef.current
    ) {
      return;
    }
    try {
      setLoadingMore(true);
      const result = await fetchPageRef.current(nextCursorRef.current);
      if (result && typeof result === 'object' && 'records' in result) {
        const page = result as PageResult<T, C>;
        setItems((prev) => [...prev, ...page.records]);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      } else {
        const err = handleServiceError(result, 'usePaginatedList');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'usePaginatedList');
      showError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  return { items, loading, loadingMore, hasMore, load, loadMore };
}
