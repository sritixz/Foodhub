# Ordering System Implementation Checklist

## 🔍 Issues Found

### Critical Issues ✅ ALL FIXED
1. ✅ **Order Model Mismatch**: FIXED - Frontend now sends correct data structure
   - ✅ Frontend now sends `customer: {name, email, phone}` object
   - ✅ Frontend calculates and sends `amount` from cart
   - ✅ Frontend sends `deliveryMode` based on order type
   - ✅ Frontend maps `deliveryNotes` to `notes`
   - ✅ Frontend uses `status: 'New'` instead of 'Pending'

2. ✅ **Order Type Mismatch**: FIXED - Frontend now uses correct order types
   - ✅ Frontend maps 'Regular' to 'Retail'
   - ✅ Frontend uses 'QR' for QR orders

3. ✅ **Status Enum Mismatch**: FIXED - Frontend now uses correct status values
   - ✅ Updated OrderTracking to use backend enum values
   - ✅ Updated OrderManagement status badges
   - ✅ Removed 'Pending' and 'Accepted' statuses

### Medium Priority Issues
4. ⚠️ **Missing Validation**: No validation for empty cart before checkout
5. ⚠️ **Missing Error Handling**: Limited error handling in order placement
6. ⚠️ **SSE Connection**: OrderTracking SSE doesn't handle reconnection

## ✅ Implementation Checklist

### Backend Order Routes
- [x] `POST /api/orders` - Create order (with QR order support)
- [x] `GET /api/orders` - Get all orders (with filtering)
- [x] `GET /api/orders/:id` - Get single order
- [x] `GET /api/orders/stream` - SSE endpoint for real-time updates
- [x] `PATCH /api/orders/:id/status` - Update order status
- [x] `PUT /api/orders/:id` - Update order
- [x] `DELETE /api/orders/:id` - Delete order (Admin only)
- [x] `PATCH /api/orders/:id/cancel` - Cancel order endpoint ✅ ADDED
- [x] `PATCH /api/orders/:id/accept` - Vendor accept order ✅ ADDED
- [x] `PATCH /api/orders/:id/reject` - Vendor reject order ✅ ADDED

### Frontend Order Components
- [x] `OrderPlacement.jsx` - Order placement page
- [x] `OrderTracking.jsx` - Real-time order tracking
- [x] `OrderManagement.jsx` - Order management dashboard
- [x] `Cart.jsx` - Shopping cart component
- [x] `MenuItemCard.jsx` - Menu item display card
- [x] `QRMenu.jsx` - QR code menu page
- [x] `QRScan.jsx` - QR code scanning page

### Order Flow Steps
1. **Menu Browsing**
   - [x] Fetch menu items from API
   - [x] Filter by category
   - [x] Filter by food type
   - [x] Search functionality
   - [x] Display available items only

2. **Cart Management**
   - [x] Add items to cart
   - [x] Update item quantity
   - [x] Remove items from cart
   - [x] Calculate total price
   - [x] Display cart summary
   - [ ] Handle item variants properly
   - [ ] Validate item availability before checkout

3. **Order Placement**
   - [x] Collect delivery address
   - [x] Collect delivery notes
   - [x] Submit order to API
   - [ ] Calculate order total (amount) before submission
   - [ ] Map customer data correctly (name, email, phone)
   - [ ] Set deliveryMode based on order type
   - [ ] Handle order type correctly ('Retail' vs 'QR')
   - [ ] Validate required fields before submission

4. **Order Tracking**
   - [x] Fetch order details
   - [x] Display order status
   - [x] Display order items
   - [x] Display delivery information
   - [x] SSE connection for real-time updates
   - [ ] Handle SSE reconnection
   - [ ] Map status values correctly (New vs Pending)

5. **Order Management**
   - [x] List all orders
   - [x] Filter orders by status
   - [x] Filter orders by type
   - [x] Search orders
   - [x] Real-time order updates via SSE
   - [ ] Update order status (Accept/Reject/Cancel)
   - [ ] Filter orders by vendor (for vendor role)

### QR Code Order Flow
1. **QR Scanning**
   - [x] QR scan page
   - [x] Manual QR code entry
   - [ ] Camera-based QR scanning

2. **QR Menu Display**
   - [x] Fetch menu items for outlet
   - [x] Display outlet information
   - [x] Add items to cart
   - [x] Place QR order

3. **QR Order Processing**
   - [x] Create order with orderType: 'QR'
   - [x] Allow order creation without auth for QR orders
   - [ ] Link QR code ID to order

## 🧪 Testing Checklist

### Backend API Tests
- [ ] Test order creation with valid data
- [ ] Test order creation with missing required fields
- [ ] Test order creation for QR orders (no auth)
- [ ] Test order creation for regular orders (with auth)
- [ ] Test order status update
- [ ] Test order cancellation
- [ ] Test SSE connection and broadcasting
- [ ] Test order filtering by vendor
- [ ] Test order filtering by status
- [ ] Test order filtering by type
- [ ] Test order amount calculation

### Frontend Component Tests
- [ ] Test cart add/remove/update functionality
- [ ] Test order placement form validation
- [ ] Test order tracking page loads correctly
- [ ] Test SSE connection in OrderTracking
- [ ] Test order status display
- [ ] Test QR menu page functionality
- [ ] Test order management filtering

### Integration Tests
- [ ] Test complete order flow: Browse → Add to Cart → Checkout → Track
- [ ] Test QR order flow: Scan → Browse → Add to Cart → Checkout → Track
- [ ] Test real-time status updates via SSE
- [ ] Test order cancellation flow
- [ ] Test vendor order acceptance/rejection flow

## 🔧 Required Fixes

### Priority 1: Fix Order Data Structure ✅ COMPLETED
1. ✅ Updated `OrderPlacement.jsx` to send correct order data:
   - ✅ Calculate `amount` from cart items
   - ✅ Map `customer` object with name, email, phone
   - ✅ Set `deliveryMode` based on order type
   - ✅ Map `deliveryNotes` to `notes`
   - ✅ Use correct `orderType` values ('Retail' or 'QR')
   - ✅ Use correct `status` value ('New' instead of 'Pending')

2. ✅ Updated `QRMenu.jsx` with same fixes

3. ✅ Updated `OrderTracking.jsx` status mapping:
   - ✅ Updated status steps to match backend enum
   - ✅ Fixed status color mapping

4. ✅ Updated `OrderManagement.jsx` status badge mapping

### Priority 2: Add Missing Endpoints ✅ COMPLETED
1. ✅ Added order cancellation endpoint (`PATCH /api/orders/:id/cancel`)
2. ✅ Added vendor accept endpoint (`PATCH /api/orders/:id/accept`)
3. ✅ Added vendor reject endpoint (`PATCH /api/orders/:id/reject`)

### Priority 3: Improve Error Handling
1. ✅ Added form validation for delivery address
2. ✅ Added error handling in order placement
3. ⚠️ Still need: More user-friendly error messages (toast notifications)

## 📋 Test Files Created

### Backend Tests
- ✅ `server/tests/orders.test.js` - Comprehensive order API tests
  - Order creation (with/without auth)
  - Order retrieval and filtering
  - Order status updates
  - Order cancellation
  - Vendor accept/reject
  - SSE connection

### Frontend Tests
- ✅ `myapp/src/tests/OrderPlacement.test.jsx` - Order placement component tests
- ✅ `myapp/src/tests/Cart.test.jsx` - Cart component tests
- ✅ `myapp/src/tests/OrderTracking.test.jsx` - Order tracking component tests

## 🧪 Running Tests

### Backend Tests
```bash
cd server
npm install --save-dev jest supertest @jest/globals
npm test
```

### Frontend Tests
```bash
cd myapp
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm test
```

## ✅ Verification Steps

### Manual Testing Checklist

#### 1. Order Placement Flow
- [ ] Navigate to `/orders/place`
- [ ] Browse menu items
- [ ] Add items to cart
- [ ] Update item quantities
- [ ] Remove items from cart
- [ ] Enter delivery address
- [ ] Enter delivery notes
- [ ] Click "Place Order"
- [ ] Verify order is created successfully
- [ ] Verify redirect to order tracking page

#### 2. QR Order Flow
- [ ] Navigate to `/qr/scan`
- [ ] Enter QR code manually (or scan)
- [ ] Navigate to QR menu page
- [ ] Browse menu items
- [ ] Add items to cart
- [ ] Enter table number/location
- [ ] Place order
- [ ] Verify order is created with orderType: 'QR'
- [ ] Verify order doesn't require authentication

#### 3. Order Tracking Flow
- [ ] Navigate to order tracking page
- [ ] Verify order details are displayed
- [ ] Verify order items are displayed
- [ ] Verify order status is shown
- [ ] Verify status timeline is displayed
- [ ] Verify SSE connection is established
- [ ] Simulate status update (via backend)
- [ ] Verify status updates in real-time

#### 4. Order Management Flow
- [ ] Navigate to `/orders`
- [ ] Verify orders are listed
- [ ] Filter orders by status
- [ ] Filter orders by type
- [ ] Search orders
- [ ] Verify real-time updates via SSE
- [ ] Click on order to view details

#### 5. Order Status Updates
- [ ] As vendor, accept an order
- [ ] Verify status changes to 'Preparing'
- [ ] Update status to 'Ready'
- [ ] Update status to 'Picked'
- [ ] Update status to 'In Transit'
- [ ] Update status to 'Delivered'
- [ ] Verify all status changes broadcast via SSE

#### 6. Order Cancellation
- [ ] As customer, cancel an order (status: New)
- [ ] Verify order status changes to 'Cancelled'
- [ ] Try to cancel delivered order (should fail)
- [ ] As vendor, cancel an order
- [ ] As admin, cancel any order

## 🐛 Known Issues & Fixes Applied

### Fixed Issues ✅
1. ✅ Order data structure mismatch - Fixed in OrderPlacement.jsx and QRMenu.jsx
2. ✅ Status enum mismatch - Fixed status values throughout frontend
3. ✅ Missing amount calculation - Added calculation before order submission
4. ✅ Missing deliveryMode - Added based on order type
5. ✅ Customer data structure - Fixed to send object instead of ID
6. ✅ Missing cancel/accept/reject endpoints - Added to backend

### Remaining Issues ⚠️
1. ⚠️ SSE reconnection logic not implemented
2. ⚠️ Error messages use alerts instead of toast notifications
3. ⚠️ Order variant handling needs improvement
4. ⚠️ Order amount validation on backend (should match calculated total)
5. ⚠️ Order cancellation reason not captured
6. ⚠️ Order history/pagination not implemented

## 📝 Test Coverage Goals

### Backend API Coverage
- [ ] Order creation: 100%
- [ ] Order retrieval: 100%
- [ ] Order status updates: 100%
- [ ] Order cancellation: 100%
- [ ] Vendor accept/reject: 100%
- [ ] SSE broadcasting: 80%

### Frontend Component Coverage
- [ ] OrderPlacement: 80%
- [ ] OrderTracking: 80%
- [ ] Cart: 90%
- [ ] OrderManagement: 70%
- [ ] QRMenu: 70%

## 🚀 Next Steps

1. Install test dependencies: `npm install` in both server and myapp
2. Run backend tests: `cd server && npm test`
3. Run frontend tests: `cd myapp && npm test`
4. Fix any failing tests
5. Add integration tests for complete order flow
6. Add E2E tests using Playwright or Cypress
7. Implement SSE reconnection logic
8. Replace alert() with toast notifications
9. Add order variant selection UI
10. Add order amount validation on backend
