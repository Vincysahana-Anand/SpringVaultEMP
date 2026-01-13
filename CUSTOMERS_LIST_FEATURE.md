# Customers List Feature

## Overview
A dedicated Customers List screen that displays all customers with search functionality. This screen is accessible only to Owners and Employees.

## Features

### 1. **Customer Display**
- Shows customer cards with:
  - Customer name
  - Phone number
  - Full address (door number, floor, street, area)
  - Balance (advance amount)
  - Extra can holdings

### 2. **Search Functionality**
Search customers by:
- Name
- Mobile number
- Address components (door number, floor, street, area)
- Alternate contacts

Search is real-time and case-insensitive.

### 3. **Navigation**
Access the Customers List screen from:
- **Owner Dashboard**: 
  - Drawer menu → "Manage Customers"
  - Bottom tab → "Customers"
- **Employee Dashboard**: 
  - Drawer menu → "View Customers"

### 4. **UI Components**
- Clean, card-based layout matching the app's design system
- Search bar with search icon and clear button
- Empty states for no customers or no search results
- Loading indicator while fetching data
- Back button to return to dashboard

## File Structure

### New Files
- `src/components/CustomersListScreen.tsx` - Main customers list component

### Modified Files
- `src/components/OwnerDashboard.tsx` - Added navigation to customers screen
- `src/components/EmployeeDashboard.tsx` - Added navigation to customers screen

## Component Details

### CustomersListScreen
**Props:**
- `onBack: () => void` - Callback to navigate back to dashboard

**State:**
- `customers` - Full list of customers from database
- `filteredCustomers` - Filtered list based on search query
- `searchQuery` - Current search input
- `loading` - Loading state indicator

**Key Functions:**
- `loadCustomers()` - Fetches all customers from Firestore
- `filterCustomers()` - Filters customers based on search query
- `getFullAddress()` - Combines address components into display string
- `renderCustomerCard()` - Renders individual customer card

## Data Flow

1. Component mounts → `loadCustomers()` fetches data from Firestore
2. User types in search → `searchQuery` state updates
3. `useEffect` triggers `filterCustomers()` on query change
4. Filtered list updates → UI re-renders with results
5. User clicks back → `onBack()` navigates to dashboard

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
1. Click on customer card to view/edit customer details
2. Add filter options (customer type, billing type)
3. Sort options (name, balance, recent activity)
4. Pull-to-refresh functionality
5. Infinite scroll for large customer lists
6. Export customer list to CSV
7. Quick actions on customer cards (call, message)
