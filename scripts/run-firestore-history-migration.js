console.warn(
  '[deprecated] scripts/run-firestore-history-migration.js is deprecated. ' +
  'Use scripts/firestore-production-migration.js with --mode=dry-run|execute|verify.',
);

if (!process.argv.some((arg) => String(arg).startsWith('--mode='))) {
  process.argv.push('--mode=execute');
}
require('./firestore-production-migration.js');
