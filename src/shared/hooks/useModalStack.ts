import { useState, useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Manages N named modal/page state pairs with a single useState.
 *
 * Many screens need both a "modal" overlay variant (iOS) and a "full-page"
 * variant (Android) of the same dialog. This hook stores both booleans
 * together under a single key and opens the right variant based on Platform.
 *
 * Usage:
 *   const modals = useModalStack(['delivery', 'edit', 'pendingFilter'] as const);
 *
 *   // Open (Platform-aware):
 *   modals.open('delivery');
 *
 *   // Close:
 *   modals.close('delivery');
 *
 *   // Read in JSX:
 *   visible={modals.state.delivery.modal}   // iOS modal
 *   visible={modals.state.delivery.page}    // Android full-page
 *
 *   // Check either:
 *   if (modals.isOpen('delivery')) { ... }
 */
export function useModalStack<Names extends string>(names: readonly Names[]) {
  type Entry = { modal: boolean; page: boolean };
  type State = Record<Names, Entry>;

  const [state, setState] = useState<State>(
    () =>
      Object.fromEntries(names.map((n) => [n, { modal: false, page: false }])) as State,
  );

  /** Opens the named modal. Uses a Modal overlay on iOS, full-page view on Android. */
  const open = useCallback((name: Names) => {
    setState((prev) => ({
      ...prev,
      [name]:
        Platform.OS === 'ios'
          ? { modal: true, page: false }
          : { modal: false, page: true },
    }));
  }, []);

  /** Closes (hides) the named modal on all platforms. */
  const close = useCallback((name: Names) => {
    setState((prev) => ({
      ...prev,
      [name]: { modal: false, page: false },
    }));
  }, []);

  /** Returns true if the modal is open in either variant. */
  const isOpen = useCallback(
    (name: Names) => state[name]?.modal || state[name]?.page,
    [state],
  );

  return { state, open, close, isOpen };
}
