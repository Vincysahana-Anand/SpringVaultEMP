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

function stripLegacyData(doc) {
  const nextDoc = { ...doc };
  nextDoc.data = {};
  return nextDoc;
}

function transformDailyRecordCollection(dailyRecordDocs) {
  return dailyRecordDocs.map((doc) => {
    const transformedDoc = stripLegacyData(doc);
    const entries = [];
    const data = doc.data || {};

    Object.entries(data).forEach(([dateKey, entriesForDate]) => {
      if (!Array.isArray(entriesForDate)) return;

      entriesForDate.forEach((entry, index) => {
        const entryId = `${doc.id}-${dateKey}-${index + 1}`;
        const nestedPath = `${doc.path}/entries/${entryId}`;
        const createdAt = toTimestamp(entry.deliveredAt || entry.orderedAt) || { __type: 'Timestamp', value: new Date().toISOString() };

        entries.push({
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

    transformedDoc.subcollections = {
      entries,
    };

    return transformedDoc;
  });
}

function transformPurchaseHistoryCollection(purchaseHistoryDocs) {
  return purchaseHistoryDocs.map((doc) => {
    const transformedDoc = stripLegacyData(doc);
    const purchases = [];
    const data = doc.data || {};
    const legacyPurchases = Array.isArray(data.purchases) ? data.purchases : [];

    legacyPurchases.forEach((purchase, index) => {
      const purchaseId = `${doc.id}-purchase-${index + 1}`;
      const nestedPath = `${doc.path}/purchases/${purchaseId}`;
      const createdAt = toTimestamp(purchase.deliveredAt || purchase.orderedAt) || { __type: 'Timestamp', value: new Date().toISOString() };

      purchases.push({
        id: purchaseId,
        path: nestedPath,
        data: {
          ...purchase,
          createdAt,
        },
        subcollections: {},
      });
    });

    transformedDoc.subcollections = {
      purchases,
    };

    return transformedDoc;
  });
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
