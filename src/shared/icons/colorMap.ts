export const getIconColor = (icon: string): string => {
  const colorMap: Record<string, string> = {
    // Logistics & time
    'truck': '#3b82f6',
    'truck-check': '#3b82f6',
    'clock': '#f59e0b',
    'schedule': '#f59e0b',

    // Money & reports
    'cash': '#10b981',
    'wallet': '#10b981',
    'currency-inr': '#10b981',
    'cash-multiple': '#10b981',
    'chart-line': '#8b5cf6',
    'chart-box': '#8b5cf6',
    'hand-coin': '#10b981',
    'cash-plus': '#22c55e',

    // Water & stock
    'water': '#06b6d4',
    'cube': '#06b6d4',
    'bottle-soda': '#0ea5e9',
    'bottle-soda-outline': '#38bdf8',
    'bottle-wine': '#f472b6',
    'warehouse': '#6366f1',

    // People
    'account-multiple': '#ec4899',
    'account-group': '#ec4899',
    'account-tie': '#6366f1',
    'account': '#8b5cf6',
    'home-account': '#22c55e',
    'store': '#f97316',
    'party-popper': '#a855f7',

    // Navigation & settings
    'home': '#3b82f6',
    'shopping': '#f59e0b',
    'calendar': '#3b82f6',
    'cog': '#6b7280',
    'menu': '#6b7280',
    'playlist-check': '#3b82f6',
    'truck-delivery': '#2563eb',

    // Others
    'logout': '#ef4444',
    'help-circle': '#8b5cf6',
    'clipboard-list': '#f59e0b',
    'clipboard-text': '#3b82f6',
    'credit-card': '#3b82f6',
    'check-circle': '#10b981',
  };
  return colorMap[icon] || '#6b7280';
};
