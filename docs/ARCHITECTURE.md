# SpringVaultEMP Architecture (Current)

Last updated: 2026-06-29

## 1) Overview

SpringVaultEMP is a React Native mobile app for water delivery operations.

It supports role-based experiences for:
- Owner
- Employee
- Customer

Primary backend services:
- Firebase Auth for sign-in and session state
- Cloud Firestore for transactional business data

The app uses a service-layer architecture with typed domain models and transaction-first Firestore writes for critical business flows.

## 2) Tech Stack

From package metadata and source code:
- React Native 0.83.1
- React 19.2.0
- TypeScript 5.8.x
- @react-native-firebase/app 23.7.0
- @react-native-firebase/auth 23.7.0
- @react-native-firebase/firestore 23.7.0
- AsyncStorage for lightweight session caching

## 3) Runtime Flow

Entry point:
- `App.tsx`

Authentication and routing behavior:
1. App boot triggers Firestore migration helpers:
   - `migrateLegacyPurchaseHistories()`
   - `migrateLegacyDailyRecords()`
2. `onAuthStateChanged()` listens to Firebase Auth session changes.
3. On sign-in, profile resolution attempts in order:
   - `users/{uid}`
   - query `users` where `id == uid`
   - query `users` where `email == auth.email`
   - query `users` where normalized email matches
4. Role and activity decide dashboard:
   - Owner -> `OwnerDashboard`
   - Employee -> `EmployeeDashboard`
   - Customer -> `CustomerDashboard`
   - inactive/invalid profile -> `InactiveCustomer`

Notes:
- Cached auth user details are stored in AsyncStorage to reduce startup flicker.
- No dedicated navigation framework is used for top-level routing; role routing is state-driven in `App.tsx`.

## 4) Project Structure

Core application layout:
- `src/components/`: screens and feature UI
- `src/services/`: data-access and transaction logic
- `src/shared/`: reusable hooks, layout shell, theme, business rules, config
- `src/types/index.ts`: shared domain types
- `src/utils/`: utility functions (including date/time helpers)

Shared shell and UX primitives:
- `src/shared/layout/DrawerLayout.tsx`
- theme tokens in `src/shared/theme/theme.ts`

## 5) State and UI Patterns

The app uses React hooks and reusable custom hooks instead of global state libraries.

Reusable hooks:
- `useListScreen` for list/search/refresh behavior
- `usePaginatedList` for cursor-based paging
- `useFormState` for form-field state consolidation
- `useModalStack` for multi-modal visibility state
- `useDashboardData` for dashboard-specific data orchestration

Benefits:
- Less duplicate state logic across screens
- Consistent async loading and refresh handling
- Better reuse without introducing Redux/MobX complexity

## 6) Service Layer Design

Error handling:
- All services normalize errors through `handleServiceError` from `src/services/serviceErrorWrapper.ts`

Generic repository:
- `createRepository<T>()` in `src/services/firestoreRepository.ts`
- Used for straightforward CRUD flows (e.g., `orders`, `partyOrders`, `partyDeliveries`)
- Business-critical operations remain in explicit service transactions

Business utility modules:
- Pricing logic: `src/shared/business/pricing.ts`
- Sales aggregation merge logic: `src/shared/business/recordMerge.ts`
- Date/time utilities and IST formatting: `src/utils/dateUtils.ts`

## 7) Firestore Data Model

### Root collections

- `users`
  - auth-linked profile and role fields (`role`, `isActive`, `isAdmin`, etc.)

- `customers`
  - customer identity, address, contact, billing settings
  - financial/inventory fields like `balance`, `canHolding`, `extraCanHolding`

- `stocks`
  - product inventory and price
  - 20L products also track `empty` and `extraCan`

- `orders`
  - pending standard delivery orders

- `partyOrders`
  - pending party-specific orders

- `partyDeliveries`
  - completed party delivery records

- `sales`
  - daily aggregate document keyed by date: `sales/{YYYY-MM-DD}`

- `expenses`
  - expense records

- `vault`
  - cash/online totals (current vault state)

### Nested collections

- `purchaseHistory/{customerId}/purchases/{purchaseId}`
  - one immutable purchase-like event per doc

- `dailyRecord/{productId}/entries/{entryId}`
  - one delivery/payment/empty-return event per doc
  - includes `date: YYYY-MM-DD` and `createdAt`

### Config-driven Firestore constants

In `src/shared/config.ts`:
- Counter sales customer ID: `MyTjc2Kqa6DOMRLhnFSH`
- Daily record product IDs used for fallback querying:
  - `20L_CAN`
  - `20L_PARTY_CAN`
  - `1L_CASE`
  - `500ML_CASE`
  - `300ML_CASE`
  - `Payments`
  - `emptyReturned`

## 8) Transaction-Critical Workflows

Important update: major business workflows are already atomic and use `runTransaction()`.

### 8.1 Standard delivery completion

Service:
- `src/services/deliveryService.ts`

Atomic writes include:
- read/update `orders` (delete original, optionally create remaining order)
- update `customers` balance and can holdings
- update `stocks` quantity and can counters
- merge `sales/{dateKey}` daily totals
- append one `purchaseHistory/.../purchases` event
- append one `dailyRecord/{productId}/entries` event

### 8.2 Counter sale completion

Service:
- `src/services/counterSaleService.ts`

Atomic writes include:
- counter-sales customer balance update
- stock decrement (and empty/extra updates for 20L only)
- sales aggregate merge
- purchase-history event
- daily-record event

### 8.3 Payment collection

Service:
- `src/services/paymentService.ts`

Atomic writes include:
- customer balance reduction
- sales pending-payment counters merge
- purchase-history payment event
- daily-record payment event under product bucket `Payments`

### 8.4 Empty can return

Service:
- `src/services/emptyCanReturnService.ts`

Atomic writes include:
- customer `extraCanHolding` decrement
- stock `extraCan` decrement and `empty` increment
- sales `emptyReturned` merge
- purchase-history event
- daily-record event under product bucket `emptyReturned`

### 8.5 Party delivery completion

Service:
- `src/services/partyOrderService.ts`

Atomic writes include:
- stock decrement
- sales aggregate merge
- purchase-history event
- daily-record event
- party delivery record creation
- party order deletion

## 9) Legacy Schema Migration

Migration utility:
- `src/services/firestoreHistoryMigration.ts`

### 9.1 Purchase history migration

From:
- `purchaseHistory/{customerId}` with array field `purchases`

To:
- `purchaseHistory/{customerId}/purchases/{legacy-*}` docs

Behavior:
- Migrates array entries into subcollection docs
- Deletes the old root customer doc after migration

### 9.2 Daily record migration

From:
- `dailyRecord/{productId}` with dynamic date-key arrays

To:
- `dailyRecord/{productId}/entries/{legacy-*}` docs

Behavior:
- Converts each array entry into a subcollection document
- writes `date` and `createdAt`
- removes legacy date fields and deletes legacy product doc

Operational note:
- Migrations run on app startup in `App.tsx`.
- Treat backup restore + migration reruns carefully to avoid accidental data churn.

## 10) Query and Index Strategy

Daily record querying uses:
- preferred: indexed query on `collectionGroup('entries')` with `where(date == ...) + orderBy(createdAt desc)`
- fallback: per-product query when index is missing

Where implemented:
- `src/services/dailyRecordService.ts`

Implication:
- production should create required Firestore composite indexes to avoid fallback mode and partial pagination behavior.

## 11) Data and Domain Rules

### Product-specific can logic

20L can tracking fields (`empty`, `extraCan`, can holding adjustments) apply only to:
- `20L_CAN`
- `20L_PARTY_CAN`

Case products should not be treated as returnable-can inventory.

### Pricing resolution

Pricing source order:
1. customer-specific product override
2. fallback to stock product price

Centralized in:
- `src/shared/business/pricing.ts`

### Sales record merge

All additive daily counters are merged through:
- `src/shared/business/recordMerge.ts`

This keeps aggregation behavior consistent across different transaction services.

## 12) Known Risks and Guardrails

### Closed risk: non-atomic delivery writes

Previously high risk; now mitigated because critical flows use Firestore transactions.

### Active risk: index drift

If index definitions are missing, daily-record queries fall back to client-side sorting/paging.

Guardrail:
- maintain and deploy required Firestore composite indexes for date + createdAt patterns.

### Active risk: migration side effects during backup/restore

Automatic migration on startup is convenient but can have unintended consequences if legacy data is reintroduced repeatedly.

Guardrail:
- run backup restore and migration with clear operational sequencing and verification.

### Active risk: undefined/null field hygiene in writes

Firestore writes with inconsistent optional fields can cause runtime write errors or schema drift.

Guardrail:
- validate and normalize transaction payloads at service boundaries before writes.

## 13) Current Architecture Snapshot

What is true today:
- Role-based app shell with state-based top-level routing
- Typed service layer around Firestore
- Transaction-first design for critical financial and inventory workflows
- Event-style history storage via subcollections (`purchases`, `entries`)
- Shared business logic modules for pricing and aggregate merge behavior

This is the baseline architecture to use for future refactors and feature additions.

## 14) Detailed Data Model

This section describes the operational data model currently used in Firestore.

### 14.1 Entity Relationship View

```mermaid
erDiagram
  USERS ||--o{ ORDERS : places
  USERS ||--o{ PARTY_ORDERS : requests
  CUSTOMERS ||--o{ ORDERS : has
  CUSTOMERS ||--o{ PARTY_ORDERS : has
  CUSTOMERS ||--o{ PURCHASES : records
  STOCKS ||--o{ ORDERS : product
  STOCKS ||--o{ PARTY_ORDERS : product
  SALES ||--o{ DAILY_RECORD_ENTRIES : aggregates

  USERS {
    string id
    string email
    string name
    string role
    bool isActive
    bool isAdmin
  }

  CUSTOMERS {
    string id
    string name
    string mobile
    number balance
    number canHolding
    number extraCanHolding
    number price
    number 1lPrice
    number 500mlPrice
    number 300mlPrice
  }

  STOCKS {
    string id
    string productName
    number quantity
    number price
    number empty
    number extraCan
  }

  ORDERS {
    string id
    string customerId
    string productId
    number quantity
    string orderedAt
    date timeStamp
  }

  PARTY_ORDERS {
    string id
    string customerId
    string productId
    number quantity
    string requestedDate
  }

  SALES {
    string id_YYYY_MM_DD
    number totalSale
    number cashPayment
    number onlinePayment
    number orders
    number delivered
    number deliveredCans
    number emptyCollected
    number pendingPaymentReceived
  }

  PURCHASES {
    string purchaseId
    string product
    number deliveredQty
    number emptyQty
    number billAmount
    number amountPaid
    string paymentMethod
    date createdAt
  }

  DAILY_RECORD_ENTRIES {
    string entryId
    string customerId
    string product
    string date
    number deliveredQty
    number emptyQty
    number saleAmount
    number amountPaid
    date createdAt
  }
```

### 14.2 Collection Schemas (Key Fields)

`users/{uid}`
- identity: `name`, `email`, `phone`
- authorization: `role`, `isActive`, `isAdmin`
- metadata: `createdAt`, `updatedAt`

`customers/{customerId}`
- identity/contact: `name`, `mobile`, `alternateContacts[]`
- address: `doorNumber`, `floor`, `street`, `area`
- billing: `billingType`, `customerType`, `price`, `1lPrice`, `500mlPrice`, `300mlPrice`
- balances/holdings: `advanceAmount`, `balance`, `canHolding`, `extraCanHolding`

`stocks/{productId}`
- inventory: `quantity`
- pricing: `price`
- can-only counters: `empty`, `extraCan`

`orders/{orderId}`
- references: `customerId`, `productId`
- denormalized display fields: `customerName`, `productName`, `address`, `mobile`
- ordering/payment: `quantity`, `paymentMethod`, `amountPaid`, `orderedAt`, `timeStamp`

`partyOrders/{orderId}`
- similar to orders with party scheduling (`requestedDate`)

`partyDeliveries/{deliveryId}`
- delivery audit for completed party orders
- includes delivered quantity and delivery timestamp fields

`sales/{YYYY-MM-DD}`
- aggregate counters: `totalSale`, `cashPayment`, `onlinePayment`, `expense`
- operational counters: `orders`, `delivered`, `deliveredCans`, `emptyCollected`
- receivables tracking: `pendingPaymentReceived`, `cashBillsPayment`, `onlineBillsPayment`
- extra metrics: `emptyReturned`, `cashSubmitted`, `vaultCash`

`expenses/{expenseId}`
- `type`, `amount`, `createdAt`

`vault/current`
- `cash`, `online`, `total`

`purchaseHistory/{customerId}/purchases/{purchaseId}`
- per-event fields: `product`, `deliveredQty`, `emptyQty`
- payment fields: `billAmount`, `amountPaid`, `paymentMethod`, `paymentRef`
- timeline: `orderedAt`, `deliveredAt`, `createdAt`

`dailyRecord/{productId}/entries/{entryId}`
- references: `customerId`
- event payload: `product`, `orderedAt`, `deliveredAt`, `orderedQty`, `deliveredQty`, `emptyQty`
- payment payload: `billAmount`, `saleAmount`, `amountPaid`, `paymentMethod`, `paymentRef`, `pendingPaymentReceived`
- query fields: `date`, `createdAt`

### 14.3 Data Invariants

These invariants should remain true for data integrity:
- Every financial/inventory-changing workflow writes through a Firestore transaction.
- `sales/{YYYY-MM-DD}` is additive and merged, not overwritten wholesale.
- `purchaseHistory` and `dailyRecord` are append-oriented event logs.
- Can-specific counters (`empty`, `extraCan`, can holdings) only apply to can products.
- Date partition key for daily analytics is always `YYYY-MM-DD`.

### 14.4 Product and Event Buckets

Configured in `src/shared/config.ts`:
- products: `20L_CAN`, `20L_PARTY_CAN`, `1L_CASE`, `500ML_CASE`, `300ML_CASE`
- synthetic daily-record buckets: `Payments`, `emptyReturned`

The synthetic buckets allow payment and empty-return events to be queried uniformly with delivery events through the daily record model.