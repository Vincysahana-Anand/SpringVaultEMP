# SpringVaultEMP

SpringVaultEMP is a React Native app for water delivery operations with role-based dashboards for Owner, Employee, and Customer users.

Backend services:
- Firebase Auth for authentication
- Firestore for transactional operational data

For deeper technical details, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Key Features

- Role-based app experience (Owner, Employee, Customer)
- Delivery and order lifecycle management
- Counter sales handling
- Payment collection and balance tracking
- Empty can return tracking
- Party order and party delivery workflows
- Daily sales aggregation and reporting
- Purchase history and daily event records with subcollection-based storage

## Technology

- React Native 0.83.1
- React 19.2.0
- TypeScript
- @react-native-firebase/app
- @react-native-firebase/auth
- @react-native-firebase/firestore
- @react-native-async-storage/async-storage

## Project Structure

- src/components: screen components and feature UI
- src/services: Firestore access and transaction workflows
- src/shared: shared hooks, layout shell, config, business rules, theme
- src/types: domain type definitions
- src/utils: helper utilities (including date/time utilities)
- docs: architecture and technical documentation

## Firestore Summary

Primary collections:
- users
- customers
- stocks
- orders
- partyOrders
- partyDeliveries
- sales
- expenses
- vault

Nested collections:
- purchaseHistory/{customerId}/purchases/{purchaseId}
- dailyRecord/{productId}/entries/{entryId}

Critical workflows use Firestore transactions for atomic updates across customers, stock, sales, and history records.

## Getting Started

### Prerequisites

- Node.js 20+
- Android Studio (for Android)
- Xcode + CocoaPods (for iOS)
- Firebase project configured for Auth + Firestore

### Install dependencies

```sh
npm install
```

### Start Metro

```sh
npm start
```

### Run Android

```sh
npm run android
```

### Run iOS

```sh
bundle install
bundle exec pod install
npm run ios
```

## Scripts

- npm start: start Metro bundler
- npm run android: build and run Android app
- npm run ios: build and run iOS app
- npm test: run tests
- npm run lint: run lint checks

## Notes

- App startup runs Firestore legacy migration helpers for purchase history and daily records.
- Product-level can-return fields apply only to 20L product flows.
- Daily record queries may require Firestore composite indexes for best performance.

## Documentation

- Architecture and data model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Refinement notes: [ARCHITECTURE_REFINEMENTS.md](ARCHITECTURE_REFINEMENTS.md)
