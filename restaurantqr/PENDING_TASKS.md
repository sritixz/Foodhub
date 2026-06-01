# Pending Tasks List

## 🔴 High Priority

### 1. Environment Variables Setup
- [ ] Add `JWT_SECRET` to server `.env` file
  - Generate a secure random string: `openssl rand -base64 32`
  - Add to `.env`: `JWT_SECRET=your_generated_secret_here`
- [ ] Add `JWT_EXPIRE` to server `.env` (optional, defaults to 7d)
  - Example: `JWT_EXPIRE=7d`
- [ ] Create frontend `.env` file in `myapp/` directory
  - Add: `VITE_API_URL=http://localhost:5000/api`
  - Update for production when deploying

### 2. Install Dependencies
- [ ] Navigate to `server/` directory and run: `npm install`
  - This will install: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer`
- [ ] Navigate to `myapp/` directory and run: `npm install`
  - This will install: `axios`

### 3. Replace localStorage with API Calls
The following pages still use localStorage and need to be migrated to API calls:

- [ ] **OutletManagement.jsx**
  - Replace `getData('outlets')` with API call: `api.get('/outlets')`
  - Replace `deleteData('outlets', id)` with API call: `api.delete('/outlets/${id}')`
  - Add loading states and error handling

- [ ] **AddOutlet.jsx**
  - Replace `addData('outlets', outletData)` with API call: `api.post('/outlets', outletData)`
  - Handle image upload for outlet logo using S3
  - Add form validation and error handling

- [ ] **EditOutlet.jsx**
  - Replace `getItemById('outlets', id)` with API call: `api.get('/outlets/${id}')`
  - Replace `updateData('outlets', id, outletData)` with API call: `api.put('/outlets/${id}', outletData)`
  - Add loading states

- [ ] **InventoryManagement.jsx**
  - Replace `getData('inventory')` with API call: `api.get('/inventory')`
  - Add CRUD operations via API
  - Add loading states

- [ ] **OrderManagement.jsx**
  - Replace `getData('orders')` with API call: `api.get('/orders')`
  - Integrate SSE for real-time updates
  - Add order status update functionality

- [ ] **UserManagement.jsx**
  - Replace `getData('users')` with API call: `api.get('/users')`
  - Add user creation/update/delete via API
  - Add loading states

## 🟡 Medium Priority

### 4. Backend Enhancements

- [ ] **Order Cancellation Endpoint**
  - Add `PATCH /api/orders/:id/cancel` endpoint
  - Allow customers/vendors to cancel orders based on status
  - Update order status to 'Cancelled'

- [ ] **Vendor Order Acceptance/Rejection**
  - Add `PATCH /api/orders/:id/accept` endpoint
  - Add `PATCH /api/orders/:id/reject` endpoint
  - Update order status accordingly

- [ ] **Menu Item Search Endpoint**
  - Enhance `GET /api/menu-items` with search query parameter
  - Add full-text search capability
  - Filter by multiple criteria

- [ ] **Notification Integration**
  - Create notifications when order status changes
  - Create notifications for new orders (for vendors)
  - Integrate notification creation in order routes

### 5. Frontend Enhancements

- [ ] **Order Management Page Updates**
  - Add order status update buttons (Accept, Reject, Cancel)
  - Add real-time order updates using SSE
  - Add order filtering and sorting

- [ ] **Inventory Management Updates**
  - Add inventory item creation form
  - Add inventory item editing
  - Add stock transfer functionality UI
  - Add low stock alerts

- [ ] **Outlet Management Updates**
  - Add outlet logo upload functionality
  - Add QR code generation UI
  - Add outlet status management

- [ ] **User Management Updates**
  - Add user creation form
  - Add user role assignment
  - Add user status management (Active/Inactive)

### 6. QR Code Features

- [ ] **QR Code Generation UI**
  - Add QR code generation button in outlet management
  - Display QR code image for download/print
  - Add table number assignment for QR codes

- [ ] **QR Code Scanning**
  - Implement camera-based QR scanning (using browser APIs)
  - Add QR code validation
  - Handle invalid/expired QR codes

## 🟢 Low Priority / Future Enhancements

### 7. Testing & Quality Assurance

- [ ] **Unit Tests**
  - Write tests for authentication middleware
  - Write tests for S3 upload utilities
  - Write tests for API routes

- [ ] **Integration Tests**
  - Test complete order flow
  - Test file upload flow
  - Test authentication flow

- [ ] **E2E Tests**
  - Test user registration and login
  - Test menu item creation with image upload
  - Test order placement and tracking

### 8. Performance & Optimization

- [ ] **Image Optimization**
  - Add image compression before upload
  - Add image resizing for thumbnails
  - Implement lazy loading for menu images

- [ ] **API Optimization**
  - Add pagination to list endpoints
  - Add caching for frequently accessed data
  - Optimize database queries

- [ ] **Frontend Optimization**
  - Add code splitting for routes
  - Implement virtual scrolling for long lists
  - Add service worker for offline support

### 9. Documentation

- [ ] **API Documentation**
  - Document all API endpoints
  - Add request/response examples
  - Create Postman collection

- [ ] **User Documentation**
  - Create user guide for each role
  - Add screenshots and tutorials
  - Document deployment process

### 10. Security Enhancements

- [ ] **Input Validation**
  - Add server-side validation for all inputs
  - Sanitize user inputs
  - Add rate limiting for API endpoints

- [ ] **File Upload Security**
  - Add file type validation
  - Add file size limits
  - Scan uploaded files for malware

- [ ] **Authentication Security**
  - Implement refresh token rotation
  - Add password strength requirements
  - Add account lockout after failed attempts

### 11. Additional Features

- [ ] **Email Notifications**
  - Set up email service (SendGrid, AWS SES, etc.)
  - Send order confirmation emails
  - Send password reset emails

- [ ] **SMS Notifications**
  - Integrate SMS service for order updates
  - Send delivery notifications

- [ ] **Analytics Dashboard**
  - Add sales analytics
  - Add order statistics
  - Add user activity tracking

- [ ] **Reporting**
  - Generate sales reports
  - Generate inventory reports
  - Export data to CSV/PDF

## 📝 Notes

- All new pages (MenuBrowse, OrderPlacement, OrderTracking, QR pages, UserProfile) already use API calls
- Authentication and file upload features are fully implemented
- Notification system backend is ready, frontend component is integrated
- Some older pages still need migration from localStorage to API calls

## 🚀 Quick Start Checklist

Before running the application:

1. [ ] Install server dependencies: `cd server && npm install`
2. [ ] Install frontend dependencies: `cd myapp && npm install`
3. [ ] Set up server `.env` file with:
   - `MONGO_URI` (already set)
   - `AWS_ACCESS_KEY_ID` (already set)
   - `AWS_SECRET_ACCESS_KEY` (already set)
   - `AWS_REGION` (already set)
   - `AWS_S3_BUCKET` (already set)
   - `JWT_SECRET` (needs to be added)
4. [ ] Set up frontend `.env` file with:
   - `VITE_API_URL=http://localhost:5000/api`
5. [ ] Start server: `cd server && npm run dev`
6. [ ] Start frontend: `cd myapp && npm run dev`
7. [ ] Create first admin user via API or MongoDB directly
