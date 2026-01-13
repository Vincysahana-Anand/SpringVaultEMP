/**
 * Centralized theme for consistent styling across the app.
 * Includes colors, spacing, typography, and elevation values.
 */

export const colors = {
  // Neutral grays
  gray: {
    50: '#fafbfc',
    100: '#f9fafb',
    200: '#f3f4f6',
    300: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  // Primary (cyan/teal)
  primary: {
    50: '#cffafe',
    100: '#a5f3fc',
    200: '#67e8f9',
    300: '#06b6d4',
    400: '#0ea5b8',
    500: '#0891b2',
    600: '#0e7490',
    700: '#155e75',
  },
  // Success (green)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#10b981',
    800: '#059669',
  },
  // Warning (amber)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },
  // Danger (red)
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
  },
  // Info (blue)
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
  },
  // Purple
  purple: {
    500: '#8b5cf6',
    600: '#7c3aed',
  },
  // Background
  bg: {
    light: '#fafbfc',
    white: '#fff',
    overlay: 'rgba(0, 0, 0, 0.3)',
    overlayDark: 'rgba(0, 0, 0, 0.5)',
  },
  // Borders
  border: '#e5e7eb',
};

export const spacing = {
  0: 0,
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  18: 18,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
};

export const typography = {
  // Font sizes
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
  },
  // Font weights (as numbers for React Native)
  fontWeight: {
    normal: '400' as any,
    medium: '500' as any,
    semibold: '600' as any,
    bold: '700' as any,
  },
  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 16,
  },
};

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};
