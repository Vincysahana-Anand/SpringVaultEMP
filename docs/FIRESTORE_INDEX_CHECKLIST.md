# Firestore Index Checklist

This checklist captures index requirements for current query patterns used in the app.

## Required Composite Indexes

1. collection group entries
- Scope: COLLECTION_GROUP
- Fields:
  - date ASCENDING
  - createdAt DESCENDING
- Why:
  - Needed by daily record global query path in src/services/dailyRecordService.ts
  - Used by where(date == ...) + orderBy(createdAt desc)

2. orders collection
- Scope: COLLECTION
- Fields:
  - customerId ASCENDING
  - productId ASCENDING
- Why:
  - Supports fast duplicate pending order lookup in src/services/orderService.ts
  - Used by where(customerId == ...) + where(productId == ...)

## Current Source of Truth

- Index config file: firestore.indexes.json

## Deploy

1. Install Firebase CLI if needed.
2. Authenticate and select project.
3. Deploy indexes using:

firebase deploy --only firestore:indexes

Or from this repo:

npm run deploy:firestore:indexes

## Validate

1. Open daily records screens and verify there is no missing index fallback warning.
2. Place an order from customers list and confirm duplicate check is fast.
3. Monitor Firestore usage for reduced read volume in high-traffic flows.
