# Customers List Feature

## Overview
A Customers List screen that supports search, customer details/edit/history flows, and direct order placement. This screen is available to Owner and Employee roles.

## Features

### 1. **Customer Display**
- Shows customer cards with:
  - Customer name
  - Phone number
  - Full address (door number, floor, street, area)
  - Balance
  - Extra can holdings

### 2. **Search Functionality**
Search customers by:
- Name
- Mobile number
- Address components (door number, floor, street, area)
- Alternate contacts

Search is real-time and case-insensitive.

### 3. **Order Placement**
- Add-order action is available directly from each customer card.
- Prevents duplicate pending orders for same customer + product.
- Uses atomic transaction path (`placeOrderTransaction`) to create order and increment sales order counter.
- Product selection is filtered by customer type (Residence/Shop/Party).

### 4. **Navigation**
Access the Customers List screen from:
- **Owner Dashboard**: 
  - Drawer menu → "Manage Customers"
  - Bottom tab → "Customers"
- **Employee Dashboard**: 
  - Drawer menu → "View Customers"

### 5. **UI Components**
- Clean, card-based layout matching the app's design system
- Search bar with search icon and clear button
- Empty states for no customers or no search results
- Loading indicator while fetching data
- Pull-to-refresh
- Modal/page-based order form based on role context

## File Structure

### New Files
- `src/components/CustomersListScreen.tsx` - Main customers list component

### Modified Files
- `src/components/OwnerDashboard.tsx` - Added navigation to customers screen
- `src/components/EmployeeDashboard.tsx` - Added navigation to customers screen

## Component Details

### CustomersListScreen
**Props:**
- `allowCustomerDelete?: boolean`
- `userRole?: 'owner' | 'employee'`
- `isAdmin?: boolean`

**State management:**
- Uses `useListScreen<Customer>(getCustomers, customerFilter)` for list loading, searching, and refresh.
- Local state handles selected customer, purchase history screen, order modal/page, products, and submit state.

**Key Functions:**
- `loadCustomers()` - Reload callback from `useListScreen`
- `refreshCustomers()` - Pull-to-refresh callback from `useListScreen`
- `getFullAddress()` - Combines address components into display string
- `getFilteredProducts()` - Filters products by customer type
- `handleSubmitOrder()` - Places order via atomic transaction flow

## Data Flow

1. Component mounts → `loadCustomers()` fetches data from Firestore
2. User types in search → `searchQuery` state updates
3. `useListScreen` applies the filter and updates `filteredCustomers`
4. User can open details/edit/history or place an order from customer card
5. Successful order path writes order + sales counter in one transaction

## Search Algorithm

The search filters customers where the search query (case-insensitive) matches:
1. **Name**: Partial match in customer name
2. **Mobile**: Partial match in mobile number
3. **Address**: Partial match in combined address (door + floor + street + area)
4. **Alternate Contacts**: Partial match in any alternate contact number

## Styling

Uses the centralized theme system:
- **Colors**: From `colors` in theme.ts
- **Spacing**: 8-point grid system from theme.ts
- **Typography**: Font sizes and weights from theme.ts
- **Elevation**: Shadow presets for cards
- **Border Radius**: Consistent rounded corners

## Future Enhancements

Potential improvements:
1. Add explicit sort toggles (name, balance, recent activity)
2. Add server-side pagination for very large customer collections
3. Add quick contact actions (call/message) on cards
4. Add bulk customer export (CSV/PDF)
5. Add pending-order badges per customer
