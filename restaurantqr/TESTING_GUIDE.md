# Testing Guide for Ordering System

## Overview
This guide provides instructions for testing the ordering system both manually and automatically.

## Prerequisites

1. **Backend Setup**
   ```bash
   cd server
   npm install
   ```

2. **Frontend Setup**
   ```bash
   cd myapp
   npm install
   ```

3. **Environment Variables**
   - Ensure `.env` files are configured in both `server/` and `myapp/`
   - Backend needs: `MONGO_URI`, `JWT_SECRET`, AWS S3 credentials
   - Frontend needs: `VITE_API_URL`

## Running Tests

### Backend Tests

```bash
cd server
npm test
```

**Test Coverage:**
- Order creation (with/without authentication)
- Order retrieval and filtering
- Order status updates
- Order cancellation
- Vendor accept/reject functionality
- SSE connection establishment

### Frontend Tests

```bash
cd myapp
npm test
```

**Test Coverage:**
- Order placement component
- Cart component functionality
- Order tracking component
- Component interactions and state management

## Manual Testing Checklist

### 1. Order Placement (Regular Order)

**Steps:**
1. Start backend: `cd server && npm run dev`
2. Start frontend: `cd myapp && npm run dev`
3. Login as a user (Employee/Admin)
4. Navigate to `/orders/place`
5. Browse menu items
6. Add items to cart
7. Update quantities
8. Enter delivery address
9. Enter delivery notes (optional)
10. Click "Place Order"

**Expected Results:**
- ✅ Cart displays items correctly
- ✅ Total amount calculates correctly
- ✅ Order is created with status "New"
- ✅ Redirects to order tracking page
- ✅ Order appears in Order Management page

**Verify in Database:**
```javascript
// Check order structure
{
  orderId: "ORD-2024XXXX",
  orderType: "Retail",
  deliveryMode: "Delivery",
  status: "New",
  customer: { name, email, phone },
  amount: <calculated_total>,
  items: [...],
  vendor: <outlet_id>
}
```

### 2. QR Code Order Flow

**Steps:**
1. Navigate to `/qr/scan`
2. Enter QR code data (or scan)
3. Browse menu items for that outlet
4. Add items to cart
5. Enter table number/location
6. Place order

**Expected Results:**
- ✅ Order created without authentication
- ✅ OrderType is "QR"
- ✅ DeliveryMode is "Dine-in" or "Delivery" based on address
- ✅ Order appears in system

### 3. Order Tracking

**Steps:**
1. Place an order (from step 1 or 2)
2. Navigate to `/orders/track/{orderId}`
3. Observe order details

**Expected Results:**
- ✅ Order details displayed correctly
- ✅ Order items shown with quantities
- ✅ Status timeline displayed
- ✅ SSE connection established (check browser console)
- ✅ Real-time status updates work

**Test Real-time Updates:**
1. Open order tracking page
2. In another tab, update order status via API:
   ```bash
   curl -X PATCH http://localhost:5000/api/orders/{orderId}/status \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"status": "Preparing"}'
   ```
3. Verify status updates in tracking page automatically

### 4. Order Management

**Steps:**
1. Navigate to `/orders`
2. View all orders
3. Filter by status
4. Filter by order type
5. Search orders

**Expected Results:**
- ✅ All orders displayed
- ✅ Filters work correctly
- ✅ Search functionality works
- ✅ Real-time updates via SSE

### 5. Order Status Updates

**As Vendor:**
1. Login as vendor user
2. Navigate to `/orders`
3. Find order with status "New"
4. Accept order: `PATCH /api/orders/{id}/accept`
5. Update status to "Preparing"
6. Update status to "Ready"
7. Update status to "Picked"
8. Update status to "In Transit"
9. Update status to "Delivered"

**Expected Results:**
- ✅ Each status update succeeds
- ✅ Status updates broadcast via SSE
- ✅ Order tracking page updates in real-time

### 6. Order Cancellation

**As Customer:**
1. Place an order
2. Navigate to order tracking page
3. Cancel order: `PATCH /api/orders/{id}/cancel`

**As Vendor:**
1. Login as vendor
2. Find order for your outlet
3. Cancel order: `PATCH /api/orders/{id}/cancel`

**Expected Results:**
- ✅ Order status changes to "Cancelled"
- ✅ Cannot cancel delivered orders
- ✅ Cannot cancel already cancelled orders
- ✅ Status update broadcasts via SSE

## API Testing with cURL/Postman

### Create Order (Regular)
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "{outlet_id}",
    "items": [
      {
        "menuItem": "{menu_item_id}",
        "quantity": 2,
        "price": 150
      }
    ],
    "orderType": "Retail",
    "deliveryMode": "Delivery",
    "deliveryAddress": "123 Test Street",
    "customer": {
      "name": "Test Customer",
      "email": "customer@test.com",
      "phone": "1234567890"
    },
    "amount": 300
  }'
```

### Create QR Order
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "{outlet_id}",
    "items": [
      {
        "menuItem": "{menu_item_id}",
        "quantity": 1,
        "price": 150
      }
    ],
    "orderType": "QR",
    "deliveryMode": "Dine-in",
    "customer": {
      "name": "Guest",
      "email": null,
      "phone": null
    },
    "amount": 150
  }'
```

### Get All Orders
```bash
curl -X GET http://localhost:5000/api/orders \
  -H "Authorization: Bearer {token}"
```

### Get Order by ID
```bash
curl -X GET http://localhost:5000/api/orders/{orderId} \
  -H "Authorization: Bearer {token}"
```

### Update Order Status
```bash
curl -X PATCH http://localhost:5000/api/orders/{orderId}/status \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "Preparing"}'
```

### Cancel Order
```bash
curl -X PATCH http://localhost:5000/api/orders/{orderId}/cancel \
  -H "Authorization: Bearer {token}"
```

### Accept Order (Vendor)
```bash
curl -X PATCH http://localhost:5000/api/orders/{orderId}/accept \
  -H "Authorization: Bearer {vendor_token}"
```

### Reject Order (Vendor)
```bash
curl -X PATCH http://localhost:5000/api/orders/{orderId}/reject \
  -H "Authorization: Bearer {vendor_token}"
```

## Common Issues & Solutions

### Issue: Order creation fails with validation error
**Solution:** Ensure all required fields are provided:
- vendor (outlet ID)
- items (array with menuItem, quantity, price)
- orderType ('Retail', 'Bulk', or 'QR')
- deliveryMode ('Delivery', 'Pickup', or 'Dine-in')
- customer (object with name, email, phone)
- amount (calculated total)

### Issue: SSE not working
**Solution:**
- Check browser console for errors
- Verify SSE endpoint is accessible: `GET /api/orders/stream`
- Check CORS settings in server
- Ensure EventSource is supported in browser

### Issue: Status updates not reflecting
**Solution:**
- Verify SSE connection is established
- Check backend logs for broadcast errors
- Verify order ID matches in SSE message
- Check browser network tab for SSE events

### Issue: Authentication errors
**Solution:**
- Verify JWT token is valid
- Check token expiration
- Ensure Authorization header format: `Bearer {token}`
- For QR orders, ensure orderType is 'QR'

## Test Data Setup

### Create Test Outlet
```bash
curl -X POST http://localhost:5000/api/outlets \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Restaurant",
    "businessType": "Dine-In",
    "fssaiLicense": "TEST123",
    "contact": {
      "name": "Test Owner",
      "email": "owner@test.com",
      "phone": "1234567890"
    },
    "location": {
      "address": "123 Test St",
      "city": "Test City",
      "state": "Test State"
    }
  }'
```

### Create Test Menu Item
```bash
curl -X POST http://localhost:5000/api/menu-items \
  -H "Authorization: Bearer {vendor_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Burger",
    "category": "Main Course",
    "description": "A test burger",
    "foodType": "Non-Veg",
    "status": "Available",
    "basePrice": 150,
    "vendor": "{outlet_id}"
  }'
```

## Performance Testing

### Load Test Order Creation
```bash
# Using Apache Bench
ab -n 100 -c 10 -H "Authorization: Bearer {token}" \
   -p order.json -T application/json \
   http://localhost:5000/api/orders
```

### SSE Connection Test
- Open multiple browser tabs with order tracking
- Verify all connections receive updates
- Monitor server resources

## Security Testing

1. **Unauthorized Access**
   - Try accessing orders without token
   - Try accessing other users' orders
   - Try cancelling orders you don't own

2. **Input Validation**
   - Try creating order with negative quantity
   - Try creating order with invalid status
   - Try creating order with missing required fields

3. **SQL Injection / NoSQL Injection**
   - Test order ID parameter
   - Test filter parameters
   - Test search functionality

## Reporting Issues

When reporting test failures, include:
1. Test case name
2. Steps to reproduce
3. Expected vs actual results
4. Error messages/logs
5. Environment details (OS, Node version, browser)
6. Screenshots if applicable
