/**
 * Shared customer-specific unit price resolution.
 */
export function getUnitPriceForCustomer(
  customerData: Record<string, unknown> | null | undefined,
  stockData: Record<string, unknown> | null | undefined,
  productId: string,
): number {
  const stockFallback = Number(stockData?.price ?? 0) || 0;
  const getNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  if (!customerData) {
    return stockFallback;
  }

  if (productId === '1L_CASE') {
    const n = getNum(customerData['1lPrice']);
    return n > 0 ? n : stockFallback;
  }
  if (productId === '500ML_CASE') {
    const n = getNum(customerData['500mlPrice']);
    return n > 0 ? n : stockFallback;
  }
  if (productId === '300ML_CASE') {
    const n = getNum(customerData['300mlPrice']);
    return n > 0 ? n : stockFallback;
  }

  const n = getNum(customerData.price);
  return n > 0 ? n : stockFallback;
}
