import { useState, useCallback } from 'react';

/**
 * Generic hook for managing form field state as a single object instead of
 * individual useState calls for every field.
 *
 * Usage:
 *   const { values, setValue, patch, reset } = useFormState({
 *     name: '',
 *     mobile: '',
 *     price: '0',
 *   });
 *
 *   // Read a field:  values.name
 *   // Write a field: setValue('name', 'John')
 *   // Bulk update:   patch({ name: 'John', mobile: '9999999999' })
 *   // Full reset:    reset()
 */
export function useFormState<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patch = useCallback((partial: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
  }, [initialValues]);

  return { values, setValue, setValues, patch, reset };
}
