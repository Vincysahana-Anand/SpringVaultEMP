# SpringVaultEMP – Architecture & Data Model

## 1) What this app is
SpringVaultEMP is a React Native app (RN 0.83 / React 19) backed by Firebase Auth and Firestore.

At runtime the app:
- Authenticates users with Firebase Auth.
- Loads a user profile from Firestore `users` (by email).
- Routes the user to one of three role-specific dashboards:
  - Owner
  - Employee
  - Customer

There is no React Navigation currently; most “navigation” is implemented as stateful conditional rendering inside dashboard screens.

## 2) Entry + routing flow
Source: `App.tsx`

1. `onAuthStateChanged()` subscribes to Firebase Auth state.
2. When a user is signed in, we query Firestore `users` where `email == user.email` (limit 1).
3. Routing decision is based on `profile.role` and `profile.isActive`.

## 3) UI shell
Dashboards use a shared shell layout:
- `src/shared/layout/DrawerLayout.tsx`
  - Left drawer (animated) + overlay
  - Bottom tab bar
  - Drawer “Quick Access” items

Common UI atoms:
- `StatCard`, `MenuItem`, `TabButton`, `EdgeIndicator`, `ActionButton`

## 4) Firestore collections used by the app

### `users`
Used for role routing and permissions.

Common fields (as used in code):
- `email` (string)
- `name` (string)
- `role` ("Owner" | "Employee" | "Customer")
- `isActive` (boolean)
- `isAdmin` (boolean)

### `customers`
Represents business customers.

Common fields:
- `name`, `mobile`, `alternateContacts[]`
- Address: `doorNumber`, `floor`, `street`, `area`
- Billing: `customerType`, `billingType`, `price`
- Accounting: `balance`, `advanceAmount`
- Inventory with customer: `canHolding`, `extraCanHolding`

### `stocks`
Represents product-level inventory.

Common fields:
- `productName`
- `quantity`
- (20L / Party): `empty`, `extraCan`
- `price`

Common IDs seen in code:
- `20L_CAN`
- `20L_PARTY_CAN`
- `1L_CASE`
- `500ML_CASE`
- `300ML_CASE`

### `orders`
Represents pending delivery orders.

Common fields:
- `customerId`, `customerName`, `mobile`, `address`
- `productId`, `productName`, `quantity`
- `orderedAt` (string)
- `timeStamp` (Date/Timestamp)
- `deliveredAt` may exist depending on how completion is implemented

### `sales` (daily aggregate)
A document per day with id `YYYY-MM-DD`.

Aggregates:
- `totalSale`, `cashPayment`, `onlinePayment`, `expense`
- `orders`, `delivered`, `deliveredCans`, `emptyCollected`
- `pendingPaymentReceived`, `cashBillsPayment`, `onlineBillsPayment`, `emptyReturned`

### `expenses`
Expense items recorded across time.

Common fields:
- `type`
- `amount`
- `createdAt`

### `purchaseHistory`
Currently: one document per customerId with an array of purchases.

New schema:
- `purchaseHistory/{customerId}/purchases/{purchaseId}`
  - Each purchase is a separate document.
  - Use `createdAt` or `deliveredAt` for ordering and pagination.

### `dailyRecord`
Currently: one document per productId with dynamic fields per date.

New schema:
- `dailyRecord/{productId}/entries/{entryId}`
  - Each delivery/payment record is a separate document.
  - Store `date: YYYY-MM-DD` on each document so date queries work naturally.

## 5) “Delivery completion” transaction (end-to-end)
Primary screen: `src/components/DeliveriesScreen.tsx`

Completing a delivery typically performs multiple writes:
1. Update customer accounting + can holdings
   - `customers/{customerId}`: update `balance`, `extraCanHolding`, etc.
2. Update stock counts
   - `stocks/{productId}`: update `quantity`, `empty`, `extraCan`
3. Append purchase history
   - `purchaseHistory/{customerId}/purchases/{purchaseId}`: write a separate purchase document
4. Update daily sales aggregate
   - `sales/{YYYY-MM-DD}`: increment totals/counters
5. Append daily record entry
   - `dailyRecord/{productId}/entries/{entryId}`: write a separate delivery/payment document with `date: YYYY-MM-DD`
6. Update order status / remove order
   - depends on implementation; orders are treated as “pending” in places

This is the most important flow to keep consistent.

## 6) Critical risks & mitigations

### Risk #1 — Multi-step delivery isn’t atomic
**What’s happening**
- Delivery completion triggers multiple separate Firestore writes across multiple documents (`customers`, `stocks`, `sales`, `purchaseHistory`, `dailyRecord`, and possibly `orders`).
- If the app crashes, loses connectivity, or a write fails mid-way, the earlier writes remain committed and later writes may not happen.

**What can go wrong (examples)**
- Customer balance updated but stock not reduced → accounting says delivered, inventory says not.
- Stock updated but purchaseHistory not appended → later audits/reporting disagree.
- Sales aggregate updated but the order still exists as pending.

**Why it matters**
- This produces “split brain” state: UI dashboards (which read multiple collections) can show conflicting numbers.
- Fixing becomes manual and error-prone.

**Recommended fixes (in order of impact)**
1) **Use a Firestore `writeBatch()` or `runTransaction()` for the multi-doc update**
   - Batch writes make all writes succeed/fail together.
   - Transactions additionally ensure reads used for calculations are consistent and safe under concurrent updates.
   - Good when the client is allowed to do the operation.

2) **Move the delivery completion to a Cloud Function (server-side)**
   - Client writes a single “deliveryCompletionRequests” document.
   - Cloud Function validates, computes final values, and performs a transaction/batch.
   - This is the cleanest long-term approach and works well with stricter security rules.

3) **Add idempotency keys + retry strategy**
   - Use a stable `deliveryId` (e.g., `{orderId}-{timestamp}`) stored on all derived records.
   - If the client retries, the server/function can detect “already applied” and avoid double counting.

**Quick tactical mitigation (if you can’t refactor immediately)**
- Write a “delivery audit log” document first (with a deliveryId and status = `started`), and mark it `committed` only after all writes succeed.
- Dashboards can optionally filter or alert on “started but not committed” deliveries.

---

### Risk #2 — Arrays-in-a-doc will hit Firestore limits
**What’s happening**
- `purchaseHistory/{customerId}` stores **all purchases** in a single array field.
- `dailyRecord/{productId}` stores **all deliveries per day** in arrays inside a single document, with one array per date.

**What can go wrong**
- Firestore has a **1 MiB per document** limit. As arrays grow, eventually writes will fail.
- Large documents become slower/expensive to read and update.
- Concurrency can become painful: many simultaneous `arrayUnion` / updates increase contention.

**Recommended fixes**
1) **Switch to subcollections (best practice)**
   - Purchase history:
     - `purchaseHistory/{customerId}/purchases/{purchaseId}` (one doc per purchase)
   - Daily records:
     - `dailyRecord/{productId}/entries/{entryId}` with `date: YYYY-MM-DD`
   Benefits:
   - No document-size blowups
   - Can query pages (limit/orderBy)
   - Easier analytics and exports

2) **Partition/roll up**
   - If you still want “summary docs”, keep a small aggregate doc per month or per day, and store raw events in subcollections.

3) **Use collectionGroup queries for reporting**
   - Once you use subcollections, `collectionGroup('entries')` patterns can produce reporting views without huge documents.

## 7) Notes about time / date
The app uses IST helpers in `src/utils/dateUtils.ts`.

Be careful mixing:
- “String timestamps” (like `deliveredAt: "14/01/26, 02:30 PM"`) with
- Real Firestore Timestamps.

Prefer storing machine timestamps (Firestore Timestamp) and formatting for UI at render time.

---

## 8) Suggested invariants (rules of truth)
These are useful guardrails when you evolve the product:
- Each completed delivery should have a unique `deliveryId`.
- Sales totals should be derived from immutable delivery events OR updated transactionally.
- Orders should have a clear lifecycle (`pending` → `completed/cancelled`) rather than relying on deletion.

