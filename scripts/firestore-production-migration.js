const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

const SCHEMA_VERSION = 2;
const BATCH_LIMIT = 400;

const args = process.argv.slice(2);
const modeArg = args.find((arg) => arg.startsWith('--mode='));
const mode = (modeArg ? modeArg.split('=')[1] : 'dry-run').trim();

if (!['dry-run', 'execute', 'verify'].includes(mode)) {
  console.error('Invalid mode. Use --mode=dry-run|execute|verify');
  process.exit(1);
}

const serviceAccountPath = path.resolve(__dirname, '..', 'firebase-service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps || !admin.apps.length) {
  admin.initializeApp({
    credential: admin.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = getFirestore();

const stats = {
  mode,
  migratedPurchaseLegacyDocs: 0,
  migratedPurchaseRows: 0,
  migratedPurchasesNewRows: 0,
  skippedPurchasesNewRows: 0,
  migratedDailyLegacyDocs: 0,
  migratedDailyEntries: 0,
  removedDuplicatePnewRows: 0,
  purchaseLegacyDocsRemaining: 0,
  dailyLegacyDocsRemaining: 0,
  purchasesNewDocsRemaining: 0,
  purchaseSubcollectionCount: 0,
  dailyEntriesSubcollectionCount: 0,
};

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

const hasLegacyDailyArrayFields = (data) => Object.keys(data || {}).some((key) => Array.isArray(data[key]));

function purchaseRowKeyForCustomer(customerId, row) {
  return [
    customerId,
    row.product,
    row.orderedAt,
    row.deliveredAt,
    String(row.billAmount ?? ''),
    String(row.amountPaid ?? ''),
    row.paymentMethod,
    String(row.emptyQty ?? ''),
    String(row.deliveredQty ?? ''),
  ].join('|');
}

class BatchWriter {
  constructor(applyChanges) {
    this.applyChanges = applyChanges;
    this.batch = db.batch();
    this.count = 0;
    this.commits = 0;
  }

  async set(ref, data, options) {
    if (!this.applyChanges) return;
    this.batch.set(ref, data, options);
    this.count += 1;
    if (this.count >= BATCH_LIMIT) {
      await this.flush();
    }
  }

  async delete(ref) {
    if (!this.applyChanges) return;
    this.batch.delete(ref);
    this.count += 1;
    if (this.count >= BATCH_LIMIT) {
      await this.flush();
    }
  }

  async flush() {
    if (!this.applyChanges || this.count === 0) return;
    await this.batch.commit();
    this.batch = db.batch();
    this.count = 0;
    this.commits += 1;
  }
}

async function migratePurchasesNewCollection(applyChanges, writer) {
  const purchasesNewRef = db.collection('purchases_new');
  const snapshot = await purchasesNewRef.get();

  const existingPurchaseRows = await db.collectionGroup('purchases').get();
  const existingKeys = new Set();

  for (const existing of existingPurchaseRows.docs) {
    const parts = existing.ref.path.split('/');
    const customerId = parts.length >= 4 ? parts[1] : '';
    if (!customerId) continue;
    existingKeys.add(purchaseRowKeyForCustomer(customerId, existing.data() || {}));
  }

  for (const docSnap of snapshot.docs) {
    const row = docSnap.data() || {};
    const customerId = String(row.customerId || '').trim();

    if (!customerId) {
      stats.skippedPurchasesNewRows += 1;
      continue;
    }

    const key = purchaseRowKeyForCustomer(customerId, row);
    if (existingKeys.has(key)) {
      if (applyChanges) {
        await writer.delete(docSnap.ref);
      }
      stats.skippedPurchasesNewRows += 1;
      continue;
    }

    const purchaseDocId = `pnew-${createStableDocId(docSnap.id)}`;
    const purchaseRef = db.doc(`purchaseHistory/${customerId}/purchases/${purchaseDocId}`);

    const { customerId: _customerId, ...rest } = row;
    const payload = {
      ...rest,
      createdAt: FieldValue.serverTimestamp(),
    };

    if (applyChanges) {
      await writer.set(purchaseRef, payload, { merge: true });
      await writer.delete(docSnap.ref);
    }

    existingKeys.add(key);
    stats.migratedPurchasesNewRows += 1;
  }
}

async function cleanupDuplicatePnewRows(applyChanges, writer) {
  const purchasesSnap = await db.collectionGroup('purchases').get();
  const seen = new Set();

  for (const snap of purchasesSnap.docs) {
    const parts = snap.ref.path.split('/');
    const customerId = parts.length >= 4 ? parts[1] : '';
    const row = snap.data() || {};
    const key = purchaseRowKeyForCustomer(customerId, row);
    const isPnewDoc = snap.id.startsWith('pnew-');

    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }

    if (isPnewDoc) {
      if (applyChanges) {
        await writer.delete(snap.ref);
      }
      stats.removedDuplicatePnewRows += 1;
    }
  }
}

async function migratePurchaseHistory(applyChanges, writer) {
  const snapshot = await db.collection('purchaseHistory').get();

  for (const docSnap of snapshot.docs) {
    const customerId = docSnap.id;
    const legacyData = docSnap.data() || {};
    const legacyRecords = Array.isArray(legacyData.purchases) ? legacyData.purchases : [];

    if (!legacyRecords.length) {
      continue;
    }

    const purchasesCollection = db.collection(`purchaseHistory/${customerId}/purchases`);
    for (const record of legacyRecords) {
      const docId = `legacy-${createStableDocId(purchaseRecordKey(record))}`;
      const purchaseRef = purchasesCollection.doc(docId);

      if (applyChanges) {
        await writer.set(purchaseRef, {
          ...record,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      stats.migratedPurchaseRows += 1;
    }

    if (applyChanges) {
      await writer.delete(docSnap.ref);
    }

    stats.migratedPurchaseLegacyDocs += 1;
  }
}

async function migrateDailyRecords(applyChanges, writer) {
  const snapshot = await db.collection('dailyRecord').get();

  for (const docSnap of snapshot.docs) {
    const productId = docSnap.id;
    const data = docSnap.data() || {};
    const dateKeys = Object.keys(data).filter((key) => Array.isArray(data[key]));

    if (!dateKeys.length) {
      continue;
    }

    const entriesCollection = db.collection(`dailyRecord/${productId}/entries`);
    for (const dateKey of dateKeys) {
      const entries = data[dateKey] || [];
      for (const [index, entry] of entries.entries()) {
        const entryRef = entriesCollection.doc(`legacy-${createStableDocId(`${dateKey}-${index}`)}`);

        if (applyChanges) {
          await writer.set(entryRef, {
            ...entry,
            date: dateKey,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        stats.migratedDailyEntries += 1;
      }
    }

    if (applyChanges) {
      await writer.delete(docSnap.ref);
    }

    stats.migratedDailyLegacyDocs += 1;
  }
}

async function verifyMigrationState() {
  const purchaseSnapshot = await db.collection('purchaseHistory').get();
  const dailySnapshot = await db.collection('dailyRecord').get();
  const purchasesNewSnapshot = await db.collection('purchases_new').get();

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

  stats.purchaseLegacyDocsRemaining = purchaseLegacyDocs;
  stats.dailyLegacyDocsRemaining = dailyLegacyDocs;
  stats.purchasesNewDocsRemaining = purchasesNewSnapshot.size;
  stats.purchaseSubcollectionCount = purchaseEntriesSnap.size;
  stats.dailyEntriesSubcollectionCount = dailyEntriesSnap.size;

  if (mode === 'verify' || mode === 'execute') {
    if (purchaseLegacyDocs > 0 || dailyLegacyDocs > 0 || purchasesNewSnapshot.size > 0) {
      throw new Error('Legacy history fields still exist after migration.');
    }
  }
}

async function writeSchemaMarker() {
  await db.doc('meta/firestoreMigrations').set(
    {
      historySchemaVersion: SCHEMA_VERSION,
      mode,
      updatedAt: FieldValue.serverTimestamp(),
      notes: 'purchaseHistory and dailyRecord legacy arrays migrated to subcollections',
    },
    { merge: true },
  );
}

function printSummary(writer) {
  console.log('Firestore production migration summary:');
  console.log(`- mode: ${stats.mode}`);
  console.log(`- migrated purchaseHistory legacy docs: ${stats.migratedPurchaseLegacyDocs}`);
  console.log(`- migrated purchaseHistory rows: ${stats.migratedPurchaseRows}`);
  console.log(`- migrated purchases_new rows: ${stats.migratedPurchasesNewRows}`);
  console.log(`- skipped purchases_new rows: ${stats.skippedPurchasesNewRows}`);
  console.log(`- removed duplicate pnew rows: ${stats.removedDuplicatePnewRows}`);
  console.log(`- migrated dailyRecord legacy docs: ${stats.migratedDailyLegacyDocs}`);
  console.log(`- migrated dailyRecord entries: ${stats.migratedDailyEntries}`);
  console.log(`- purchaseHistory docs with legacy purchases[] remaining: ${stats.purchaseLegacyDocsRemaining}`);
  console.log(`- dailyRecord docs with legacy date arrays remaining: ${stats.dailyLegacyDocsRemaining}`);
  console.log(`- purchases_new docs remaining: ${stats.purchasesNewDocsRemaining}`);
  console.log(`- purchaseHistory subcollection entries count: ${stats.purchaseSubcollectionCount}`);
  console.log(`- dailyRecord entries subcollection count: ${stats.dailyEntriesSubcollectionCount}`);
  if (writer) {
    console.log(`- committed batches: ${writer.commits}`);
  }
}

(async () => {
  const applyChanges = mode === 'execute';
  const writer = new BatchWriter(applyChanges);

  try {
    if (mode !== 'verify') {
      await migratePurchasesNewCollection(applyChanges, writer);
      await cleanupDuplicatePnewRows(applyChanges, writer);
      await migratePurchaseHistory(applyChanges, writer);
      await migrateDailyRecords(applyChanges, writer);
      await writer.flush();
      if (applyChanges) {
        await writeSchemaMarker();
      }
    }

    await verifyMigrationState();
    printSummary(writer);

    if (mode === 'dry-run') {
      console.log('Dry-run completed. No documents were changed.');
    } else if (mode === 'execute') {
      console.log('Migration execute completed successfully.');
    } else {
      console.log('Verification completed successfully.');
    }
  } catch (error) {
    console.error('Firestore production migration failed:', error);
    process.exit(1);
  }
})();
