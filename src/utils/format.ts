export function currencyINR(n: number): string {
  try {
    const formatted = Intl.NumberFormat('en-IN').format(n ?? 0);
    return `₹${formatted}`;
  } catch {
    return `₹${n ?? 0}`;
  }
}

export function numberCompact(n: number): string {
  try {
    return Intl.NumberFormat('en', { notation: 'compact' }).format(n ?? 0);
  } catch {
    return String(n ?? 0);
  }
}
