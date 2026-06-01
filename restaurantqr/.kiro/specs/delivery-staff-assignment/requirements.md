# Requirements Document

## Introduction

This document defines the requirements for the Delivery Staff Assignment feature. The feature enables Vendor, Admin, and Company Admin users to manually assign a specific delivery staff member to a delivery order. Once assigned, only the designated delivery staff can progress the order through delivery statuses (Picked, In Transit, Delivered). The feature maintains backward compatibility for unassigned orders.

## Glossary

- **Assignment_API**: The Express.js route handler at `PATCH /orders/:id/assign` responsible for assigning delivery staff to orders
- **Status_Guard**: The enforcement logic within the existing `PATCH /orders/:id/status` handler that validates delivery staff identity before allowing status transitions
- **Order_Model**: The Mongoose schema representing an order in MongoDB, extended with an `assignedTo` field
- **SSE_Broadcaster**: The server-sent events system that pushes real-time order updates to connected clients
- **Notification_Service**: The system component that creates in-app notifications for users
- **OrderManagement_UI**: The React page component used by Vendor/Admin to manage orders, including the assignment dropdown
- **DeliveryDashboard_UI**: The React page component used by Delivery Staff to view and act on their assigned orders
- **OrderTracking_UI**: The public React page component that displays order status and delivery information to customers
- **Delivery_Staff**: A user with role "Delivery Staff" and status "Active" in the system
- **Assignable_Status**: An order status of "Preparing" or "Ready" — the only statuses during which assignment is permitted
- **Delivery_Status**: One of "Picked", "In Transit", or "Delivered" — statuses that only the assigned delivery staff may set

## Requirements

### Requirement 1: Assign Delivery Staff to Order

**User Story:** As a Vendor/Admin/Company Admin, I want to assign a specific delivery staff member to a delivery order, so that I can control who handles each delivery.

#### Acceptance Criteria

1. WHEN a Vendor, Admin, or Company Admin sends an assignment request with a valid Delivery_Staff user ID, THE Assignment_API SHALL set the order's `assignedTo` field to that user ID and return the updated order with populated staff details
2. IF a user with a role other than Vendor, Admin, or Company Admin attempts to assign delivery staff, THEN THE Assignment_API SHALL reject the request with a 403 status
3. IF the provided `assignedTo` user ID does not reference an active Delivery_Staff, THEN THE Assignment_API SHALL reject the request with a 400 status and a descriptive error message
4. IF the order status is not in Assignable_Status, THEN THE Assignment_API SHALL reject the request with a 400 status indicating assignment is only allowed for Preparing or Ready orders
5. WHEN a valid assignment is made, THE Assignment_API SHALL allow reassignment by overwriting the previous `assignedTo` value

### Requirement 2: Enforce Assignment on Status Updates

**User Story:** As a system operator, I want only the assigned delivery staff to progress an order through delivery statuses, so that accountability is maintained for each delivery.

#### Acceptance Criteria

1. WHILE an order has a non-null `assignedTo` field, THE Status_Guard SHALL reject status updates to any Delivery_Status from any Delivery_Staff whose user ID does not match `assignedTo`, returning a 403 status
2. WHILE an order has a null `assignedTo` field, THE Status_Guard SHALL allow any Delivery_Staff to update the order to a Delivery_Status (backward compatibility)
3. WHEN an Admin or Company Admin updates an order status, THE Status_Guard SHALL allow the update regardless of the `assignedTo` field

### Requirement 3: Order Model Extension

**User Story:** As a developer, I want the Order schema to include an `assignedTo` field, so that delivery staff assignments are persisted.

#### Acceptance Criteria

1. THE Order_Model SHALL include an `assignedTo` field of type ObjectId referencing the User collection, defaulting to null
2. WHEN an order is queried, THE Order_Model SHALL support population of the `assignedTo` field with the user's name and phone number

### Requirement 4: Notification on Assignment

**User Story:** As a delivery staff member, I want to receive a notification when I am assigned to an order, so that I am aware of my new delivery responsibility.

#### Acceptance Criteria

1. WHEN a delivery staff member is successfully assigned to an order, THE Notification_Service SHALL create a notification for that user with type "delivery" and a message containing the order ID
2. WHEN a reassignment occurs, THE Notification_Service SHALL create a notification for the newly assigned delivery staff member

### Requirement 5: SSE Broadcast on Assignment

**User Story:** As a connected client, I want to receive real-time updates when delivery staff is assigned to an order, so that all dashboards reflect the current assignment state.

#### Acceptance Criteria

1. WHEN a delivery staff assignment is successfully saved, THE SSE_Broadcaster SHALL broadcast the updated order (with populated `assignedTo`) to all connected clients
2. THE SSE_Broadcaster SHALL use the existing `order_update` event type for assignment broadcasts

### Requirement 6: Assignment UI in Order Management

**User Story:** As a Vendor/Admin, I want a dropdown in the Order Management page to assign delivery staff to delivery orders, so that I can make assignments without leaving the order list.

#### Acceptance Criteria

1. WHILE viewing a delivery order in Assignable_Status, THE OrderManagement_UI SHALL display a dropdown populated with all active Delivery_Staff users
2. WHEN a user selects a delivery staff member from the dropdown, THE OrderManagement_UI SHALL send an assignment request to the Assignment_API and update the displayed order on success
3. IF the assignment request fails, THEN THE OrderManagement_UI SHALL display an error message to the user
4. THE OrderManagement_UI SHALL only show the assignment dropdown for orders where `deliveryMode` is "Delivery"

### Requirement 7: Delivery Dashboard Filtering

**User Story:** As a delivery staff member, I want my dashboard to show only orders assigned to me, so that I can focus on my responsibilities.

#### Acceptance Criteria

1. WHEN a Delivery_Staff user views the DeliveryDashboard_UI, THE DeliveryDashboard_UI SHALL display only orders where `assignedTo` matches the logged-in user's ID
2. WHEN no orders are assigned to the current user, THE DeliveryDashboard_UI SHALL display an empty state message

### Requirement 8: Order Tracking Shows Assigned Staff

**User Story:** As a customer, I want to see who is delivering my order, so that I know who to expect at my door.

#### Acceptance Criteria

1. WHILE an order has an assigned delivery staff member, THE OrderTracking_UI SHALL display the delivery person's name in the Delivery Information section
2. WHILE an order has an assigned delivery staff member with a phone number, THE OrderTracking_UI SHALL display the delivery person's phone number
3. WHILE an order has no assigned delivery staff, THE OrderTracking_UI SHALL not display any delivery person information

### Requirement 9: Backward Compatibility

**User Story:** As a system operator, I want existing order workflows to remain unaffected by the new assignment feature, so that no regressions are introduced.

#### Acceptance Criteria

1. WHEN an order has no `assignedTo` value, THE Status_Guard SHALL allow any Delivery_Staff to update the order status to Delivery_Status values, preserving existing behavior
2. THE Order_Model SHALL default `assignedTo` to null, ensuring all existing orders remain unassigned and functional
3. WHEN a non-delivery order (Pickup or Dine-in) is processed, THE Assignment_API SHALL not interfere with its status update workflow
