const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const firestore = require('firebase-admin/firestore');

async function main() {
  const serviceAccountPath = process.argv[2] || path.resolve(__dirname, '..', 'firebase-service-account.json');
  const outputPath = process.argv[3] || path.resolve(__dirname, '..', 'backup.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Service account file not found: ${serviceAccountPath}`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  if (!admin.apps || !admin.apps.length) {
    admin.initializeApp({
      credential: admin.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const db = firestore.getFirestore();
  const backup = {
    exportedAt: new Date().toISOString(),
    projectId: serviceAccount.project_id,
    collections: {},
  };

  const collections = await db.listCollections();
  for (const collectionRef of collections) {
    console.log(`Exporting collection: ${collectionRef.id}`);
    backup.collections[collectionRef.id] = await exportCollection(collectionRef);
  }

  fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written to ${outputPath}`);
  console.log(`Collections exported: ${Object.keys(backup.collections).length}`);
}

async function exportCollection(collectionRef) {
  const docs = [];
  const snapshot = await collectionRef.get();

  for (const doc of snapshot.docs) {
    const subcollections = {};
    const childCollections = await doc.ref.listCollections();

    for (const childCollection of childCollections) {
      subcollections[childCollection.id] = await exportCollection(childCollection);
    }

    docs.push({
      id: doc.id,
      path: doc.ref.path,
      data: serializeValue(doc.data()),
      subcollections,
    });
  }

  return docs;
}

function serializeValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof firestore.Timestamp) {
    return { __type: 'Timestamp', value: value.toDate().toISOString() };
  }

  if (value instanceof firestore.GeoPoint) {
    return { __type: 'GeoPoint', latitude: value.latitude, longitude: value.longitude };
  }

  if (value instanceof firestore.DocumentReference) {
    return { __type: 'DocumentReference', path: value.path };
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = serializeValue(child);
    }
    return result;
  }

  return value;
}

main().catch((error) => {
  console.error('Firestore export failed:', error);
  process.exit(1);
});
