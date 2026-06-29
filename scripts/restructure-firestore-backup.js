const fs = require('fs');
const path = require('path');

function toTimestamp(value) {
  if (!value) return null;

  const normalized = String(value).replace(/\u202F|\u00A0/g, ' ').trim();
  const parts = normalized.split(',');
  if (parts.length < 2) return null;

  const datePart = parts[0].trim();
  const timePart = parts[1].trim();
  const [dd, mm, yy] = datePart.split('/').map((segment) => Number(segment.trim()));
  const timeSegments = timePart.split(' ').filter(Boolean);
  if (timeSegments.length < 2) return null;

  const [time, meridiem] = timeSegments;
  const [hourString, minuteString] = time.split(':');
  let hour = Number(hourString);
  const minute = Number(minuteString || 0);

  if (meridiem.toLowerCase() === 'pm' && hour < 12) {
    hour += 12;
  }
  if (meridiem.toLowerCase() === 'am' && hour === 12) {
    hour = 0;
  }

  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  const date = new Date(year, mm - 1, dd, hour, minute);

  return {
    __type: 'Timestamp',
    value: date.toISOString(),
  };
}

function dedupeByPath(docs) {
  const seen = new Set();
  const result = [];
  for (const doc of docs) {
    const key = String(doc.path || doc.id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(doc);
  }
  return result;
}

function transformDailyRecordCollection(dailyRecordDocs) {
  return dailyRecordDocs.map((doc) => {
    const transformedDoc = { ...doc };
    const generatedEntries = [];
    const data = doc.data || {};
    const existingEntries = Array.isArray(doc?.subcollections?.entries)
      ? doc.subcollections.entries
      : [];

    Object.entries(data).forEach(([dateKey, entriesForDate]) => {
      if (!Array.isArray(entriesForDate)) return;

      entriesForDate.forEach((entry, index) => {
        const entryId = `${doc.id}-${dateKey}-${index + 1}`;
        const nestedPath = `${doc.path}/entries/${entryId}`;
        const createdAt = toTimestamp(entry.deliveredAt || entry.orderedAt) || { __type: 'Timestamp', value: new Date().toISOString() };

        generatedEntries.push({
          id: entryId,
          path: nestedPath,
          data: {
            ...entry,
            date: dateKey,
            createdAt,
          },
          subcollections: {},
        });
      });
    });

    const filteredData = {};
    Object.entries(data).forEach(([key, value]) => {
      if (!Array.isArray(value)) {
        filteredData[key] = value;
      }
    });

    transformedDoc.data = filteredData;

    transformedDoc.subcollections = {
      ...(doc.subcollections || {}),
      entries: dedupeByPath([...existingEntries, ...generatedEntries]),
    };

    return transformedDoc;
  });
}

function transformPurchaseHistoryCollection(purchaseHistoryDocs) {
  return purchaseHistoryDocs.map((doc) => {
    const transformedDoc = { ...doc };
    const generatedPurchases = [];
    const data = doc.data || {};
    const legacyPurchases = Array.isArray(data.purchases) ? data.purchases : [];
    const existingPurchases = Array.isArray(doc?.subcollections?.purchases)
      ? doc.subcollections.purchases
      : [];

    legacyPurchases.forEach((purchase, index) => {
      const purchaseId = `${doc.id}-purchase-${index + 1}`;
      const nestedPath = `${doc.path}/purchases/${purchaseId}`;
      const createdAt = toTimestamp(purchase.deliveredAt || purchase.orderedAt) || { __type: 'Timestamp', value: new Date().toISOString() };

      generatedPurchases.push({
        id: purchaseId,
        path: nestedPath,
        data: {
          ...purchase,
          createdAt,
        },
        subcollections: {},
      });
    });

    const filteredData = { ...data };
    delete filteredData.purchases;
    transformedDoc.data = filteredData;

    transformedDoc.subcollections = {
      ...(doc.subcollections || {}),
      purchases: dedupeByPath([...existingPurchases, ...generatedPurchases]),
    };

    return transformedDoc;
  });
}

function transformPurchasesNewCollectionToPurchaseHistory(purchasesNewDocs, existingPurchaseHistoryDocs) {
  const purchaseHistoryByCustomer = new Map();

  for (const doc of existingPurchaseHistoryDocs || []) {
    purchaseHistoryByCustomer.set(doc.id, {
      ...doc,
      data: { ...(doc.data || {}) },
      subcollections: {
        ...(doc.subcollections || {}),
        purchases: Array.isArray(doc?.subcollections?.purchases) ? [...doc.subcollections.purchases] : [],
      },
    });
  }

  for (const purchaseDoc of purchasesNewDocs || []) {
    const payload = purchaseDoc.data || {};
    const customerId = String(payload.customerId || '').trim();
    if (!customerId) {
      continue;
    }

    if (!purchaseHistoryByCustomer.has(customerId)) {
      purchaseHistoryByCustomer.set(customerId, {
        id: customerId,
        path: `purchaseHistory/${customerId}`,
        data: {},
        subcollections: {
          purchases: [],
        },
      });
    }

    const customerDoc = purchaseHistoryByCustomer.get(customerId);
    const { customerId: _customerId, ...normalizedPurchase } = payload;
    const createdAt = normalizedPurchase.createdAt
      ? normalizedPurchase.createdAt
      : toTimestamp(normalizedPurchase.deliveredAt || normalizedPurchase.orderedAt) || {
          __type: 'Timestamp',
          value: new Date().toISOString(),
        };

    customerDoc.subcollections.purchases.push({
      id: purchaseDoc.id,
      path: `purchaseHistory/${customerId}/purchases/${purchaseDoc.id}`,
      data: {
        ...normalizedPurchase,
        createdAt,
      },
      subcollections: {},
    });
  }

  return Array.from(purchaseHistoryByCustomer.values()).map((doc) => ({
    ...doc,
    subcollections: {
      ...(doc.subcollections || {}),
      purchases: dedupeByPath(Array.isArray(doc?.subcollections?.purchases) ? doc.subcollections.purchases : []),
    },
  }));
}

function transformBackupFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const backup = JSON.parse(raw);

  if (!backup.collections) return;

  if (Array.isArray(backup.collections.dailyRecord)) {
    backup.collections.dailyRecord = transformDailyRecordCollection(backup.collections.dailyRecord);
  }

  if (Array.isArray(backup.collections.purchaseHistory)) {
    backup.collections.purchaseHistory = transformPurchaseHistoryCollection(backup.collections.purchaseHistory);
  }

  if (Array.isArray(backup.collections.purchases_new)) {
    const existingPurchaseHistoryDocs = Array.isArray(backup.collections.purchaseHistory)
      ? backup.collections.purchaseHistory
      : [];

    backup.collections.purchaseHistory = transformPurchasesNewCollectionToPurchaseHistory(
      backup.collections.purchases_new,
      existingPurchaseHistoryDocs,
    );

    delete backup.collections.purchases_new;
  }

  fs.writeFileSync(absolutePath, JSON.stringify(backup, null, 2));
  console.log(`Transformed ${absolutePath}`);
}

const targets = ['backup copy.json', 'backup.json'];
for (const target of targets) {
  const fullPath = path.resolve(__dirname, '..', target);
  if (fs.existsSync(fullPath)) {
    transformBackupFile(fullPath);
  }
}
