# Tasks: Delivery Staff Assignment

## Task 1: Extend Order Model with assignedTo field

- [x] 1.1 Add `assignedTo` field to Order schema in `server/models/Order.js` (type: ObjectId, ref: 'User', default: null)
- [x] 1.2 Add index on `assignedTo` field for efficient querying

## Task 2: Create Assignment API Endpoint

- [x] 2.1 Add `PATCH /orders/:id/assign` route in `server/routes/orders.js`
- [x] 2.2 Implement role authorization check (Vendor, Admin, Company Admin only)
- [x] 2.3 Validate `assignedTo` references an active Delivery Staff user
- [x] 2.4 Validate order status is Preparing or Ready
- [x] 2.5 Save assignment, populate response, broadcast via SSE
- [x] 2.6 Create notification for assigned delivery staff

## Task 3: Enforce Assignment in Status Update Handler

- [x] 3.1 Modify `PATCH /orders/:id/status` to check `assignedTo` before allowing Delivery Staff to set Picked/In Transit/Delivered
- [x] 3.2 Allow Admin/Company Admin to bypass the assignment check
- [x] 3.3 Preserve backward compatibility: allow any Delivery Staff when `assignedTo` is null

## Task 4: Populate assignedTo in Order Queries

- [x] 4.1 Add `.populate('assignedTo', 'name phone')` to all order query endpoints (GET /, GET /:id, GET /outlet/:outletId)
- [x] 4.2 Add `.populate('assignedTo', 'name phone')` to status update and other PATCH responses

## Task 5: OrderManagement UI — Assignment Dropdown

- [x] 5.1 Fetch active delivery staff list on component mount in `OrderManagement.jsx`
- [x] 5.2 Add assignment dropdown for delivery orders in Preparing/Ready status
- [x] 5.3 Implement `handleAssignDelivery` function to call the assign API
- [x] 5.4 Handle assignment errors with user-visible error message
- [x] 5.5 Update order in local state on successful assignment via SSE

## Task 6: DeliveryDashboard — Filter to Assigned Orders Only

- [x] 6.1 Modify `DeliveryDashboard.jsx` to filter orders where `assignedTo` matches logged-in user ID
- [x] 6.2 Update empty state message for when no orders are assigned

## Task 7: OrderTracking — Display Assigned Delivery Person

- [x] 7.1 Add delivery person name and phone display in `OrderTracking.jsx` Delivery Information card when `assignedTo` is populated
- [x] 7.2 Conditionally hide delivery person section when `assignedTo` is null
