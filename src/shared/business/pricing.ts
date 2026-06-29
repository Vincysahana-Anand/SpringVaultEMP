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

/**
 * Party-order pricing with optional product-name fallback for 20L party cans.
 */
export function getUnitPriceForPartyOrder(
  customerData: Record<string, unknown> | null | undefined,
  stockData: Record<string, unknown> | null | undefined,
  productId: string,
  productName?: string,
): number {
  const stockUnitPrice = Number(stockData?.price ?? 0) || 0;
  if (!customerData) {
    return stockUnitPrice;
  }

  const customerPrice = Number(customerData.price ?? 0) || 0;
  const customer1LPrice = Number(customerData['1lPrice'] ?? 0) || 0;
  const customer500mlPrice = Number(customerData['500mlPrice'] ?? 0) || 0;
  const customer300mlPrice = Number(customerData['300mlPrice'] ?? 0) || 0;

  switch (String(productId || '')) {
    case '20L_PARTY_CAN':
      return customerPrice > 0 ? customerPrice : stockUnitPrice;
    case '1L_CASE':
      return customer1LPrice > 0 ? customer1LPrice : stockUnitPrice;
    case '500ML_CASE':
      return customer500mlPrice > 0 ? customer500mlPrice : stockUnitPrice;
    case '300ML_CASE':
      return customer300mlPrice > 0 ? customer300mlPrice : stockUnitPrice;
    default: {
      const normalizedName = String(productName || '')
        .toLowerCase()
        .replace(/\s+/g, '');
      const is20LPartyCanByName =
        normalizedName.includes('20l') &&
        (normalizedName.includes('-p') ||
          normalizedName.includes('party') ||
          normalizedName.endsWith('p'));
      if (is20LPartyCanByName && customerPrice > 0) {
        return customerPrice;
      }
      return stockUnitPrice;
    }
  }
}
