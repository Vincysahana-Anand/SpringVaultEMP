const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, '..', 'firebase-service-account.json');

if (!serviceAccountPath) {
  console.error('Missing Firebase service account path.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps || !admin.apps.length) {
  admin.initializeApp({
    credential: admin.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = getFirestore();

const purchaseRecordKey = (record) => [
  record.product,
  record.orderedAt,
  record.deliveredAt,
  String(record.billAmount ?? ''),
  String(record.amountPaid ?? ''),
  record.paymentMethod,
  String(record.emptyQty ?? ''),
  String(record.deliveredQty ?? ''),
].join('|');

const createStableDocId = (value) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);

async function migratePurchaseHistory() {
  const snapshot = await db.collection('purchaseHistory').get();
  let migrated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const customerId = docSnap.id;
    const legacyData = docSnap.data() || {};
    const legacyRecords = Array.isArray(legacyData.purchases) ? legacyData.purchases : [];

    if (!legacyRecords.length) {
      await docSnap.ref.delete();
      skipped += 1;
      continue;
    }

    const purchasesCollection = db.collection(`purchaseHistory/${customerId}/purchases`);
    for (const record of legacyRecords) {
      const docId = `legacy-${createStableDocId(purchaseRecordKey(record))}`;
      await purchasesCollection.doc(docId).set({
        ...record,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await docSnap.ref.delete();
    migrated += 1;
  }

  console.log(`Purchase history migrated: ${migrated}; skipped empty: ${skipped}`);
}

async function migrateDailyRecords() {
  const snapshot = await db.collection('dailyRecord').get();
  let migrated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const productId = docSnap.id;
    const data = docSnap.data() || {};
    const dateKeys = Object.keys(data).filter((key) => Array.isArray(data[key]));

    if (!dateKeys.length) {
      await docSnap.ref.delete();
      skipped += 1;
      continue;
    }

    const entriesCollection = db.collection(`dailyRecord/${productId}/entries`);
    for (const dateKey of dateKeys) {
      const entries = data[dateKey] || [];
      for (const [index, entry] of entries.entries()) {
        const entryRef = entriesCollection.doc(`legacy-${createStableDocId(`${dateKey}-${index}`)}`);
        await entryRef.set({
          ...entry,
          date: dateKey,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await docSnap.ref.delete();
    migrated += 1;
  }

  console.log(`Daily records migrated: ${migrated}; skipped empty: ${skipped}`);
}

function hasLegacyDailyArrayFields(data) {
  return Object.keys(data || {}).some((key) => Array.isArray(data[key]));
}

async function verifyMigrationState() {
  const purchaseSnapshot = await db.collection('purchaseHistory').get();
  const dailySnapshot = await db.collection('dailyRecord').get();

  let purchaseLegacyDocs = 0;
  for (const docSnap of purchaseSnapshot.docs) {
    const data = docSnap.data() || {};
    if (Array.isArray(data.purchases)) {
      purchaseLegacyDocs += 1;
    }
  }

  let dailyLegacyDocs = 0;
  for (const docSnap of dailySnapshot.docs) {
    if (hasLegacyDailyArrayFields(docSnap.data() || {})) {
      dailyLegacyDocs += 1;
    }
  }

  const [purchaseEntriesSnap, dailyEntriesSnap] = await Promise.all([
    db.collectionGroup('purchases').get(),
    db.collectionGroup('entries').get(),
  ]);

  console.log('Migration verification summary:');
  console.log(`- purchaseHistory docs with legacy purchases[]: ${purchaseLegacyDocs}`);
  console.log(`- dailyRecord docs with legacy date arrays: ${dailyLegacyDocs}`);
  console.log(`- purchaseHistory subcollection entries: ${purchaseEntriesSnap.size}`);
  console.log(`- dailyRecord subcollection entries: ${dailyEntriesSnap.size}`);

  if (purchaseLegacyDocs > 0 || dailyLegacyDocs > 0) {
    throw new Error('Legacy history fields still exist after migration.');
  }
}

(async () => {
  try {
    await migratePurchaseHistory();
    await migrateDailyRecords();
    await verifyMigrationState();
    console.log('Firestore history migration completed.');
  } catch (error) {
    console.error('Firestore history migration failed:', error);
    process.exit(1);
  }
})();
