# Role-Based Access Control (RBAC) Documentation

This document describes the role-based access control system, authentication/authorization flows, and capability mappings currently implemented in this project.

---

## 🔑 User Roles

The database supports seven distinct user roles, defined in the `User` model schema:

1. **Admin (Super Admin)**: Complete system access across all outlets, organizations, and modules.
2. **Company Admin**: Regional or organizational supervisor. Has multi-outlet capabilities restricted to their assigned `organization`.
3. **Vendor**: Outlet-level manager. Controls menu items, schedules, and operations for their specific `outlet`.
4. **Staff**: Outlet-level operator. Handles daily orders, menu availability, and submits end-of-day ledgers.
5. **Delivery Staff**: Delivery operator. Views assigned orders and updates transit/delivery status.
6. **Employee**: Internal customer. Places menu orders and submits expense claims or payment requests.
7. **Investor**: Stakeholder. Linked to a specific outlet to monitor assured returns, profit sharing, and payout history.

---

## 🔄 Authentication and Authorization Flow

### 1. User Authentication
* **Endpoint**: `POST /api/auth/login`
* **Flow**:
  1. The user logs in with email and password.
  2. The server verifies credentials and verifies that the user status is `Active`.
  3. The server issues a JSON Web Token (JWT) signed with the user ID.
  4. The client stores this token and includes it in subsequent requests via the HTTP headers:
     `Authorization: Bearer <token>`

### 2. Backend Security Middleware
* **Authentication**: `authenticate` middleware in `server/middleware/auth.js` extracts the token, verifies its signature, verifies the user exists in the database, verifies the account status is active, and attaches the user document to `req.user`.
* **Authorization**: `authorize(...roles)` middleware in `server/middleware/roleAuth.js` verifies if the authenticated user's role is in the list of allowed roles.

### 3. Contextual and Scoped Restrictions
In addition to role-based middleware, several endpoints enforce context-based rules inside the business logic:
* **Vendor Outlet Limitation**: Vendors can only read, create, or update data (menu items, orders, payouts, inventory) linked to their own `outlet`.
* **Vendor Menu Constraints**: A Vendor cannot edit menu items with an `Available` status. They must mark them `Paused` or `Draft` before editing.
* **Company Admin Organization Filter**: A Company Admin is restricted to users, outlets, payments, and budgets within their designated `organization`. They can manage other users only if those users hold the role of `Employee`, `Staff`, or `Delivery Staff`.
* **Delivery Staff Assignment Check**: Delivery staff can only transition order statuses (`Picked`, `In Transit`, `Delivered`) for orders explicitly assigned to them.
* **Employee Claim Constraints**: Employees can only create payment claims that adhere to their organization's payment policies (single transaction limit, monthly limit, allowed categories).

### 4. Frontend Route Protection
On the React client, pages are wrapped in a `<ProtectedRoute>` component that redirects unauthenticated users or blocks users whose role does not match the `allowedRoles` property.

---

## 📊 Feature Access Matrix

| Feature Module | Admin | Company Admin | Vendor | Staff | Delivery Staff | Employee | Investor | Public / Guest |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Manage Outlets** | Full | Full (Org) | View Only | ❌ | ❌ | ❌ | ❌ | View Only |
| **Manage Users** | Full | Scoped (Org)* | ❌ | ❌ | ❌ | Self Profile | ❌ | Register Only |
| **Manage Menu Items** | Full | Full | Full (Own)* | View Only | ❌ | View Only | ❌ | View Only |
| **Manage Orders** | Full | View / Report | Full (Own)* | View / Update | Assigned Only | Place / Track | ❌ | Place / Track (QR) |
| **EOD Daily Ledger** | Full | Full | Full (Own) | Full (Own) | ❌ | ❌ | ❌ | ❌ |
| **Investor Ledger & Payouts** | Full | Full | ❌ | ❌ | ❌ | ❌ | View (Own) | ❌ |
| **Vendor Commissions & Payouts** | Full | View Only | View (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Warehouse & Inventory** | Full | Full | Scoped (Own) | View Only | ❌ | ❌ | ❌ | ❌ |
| **Payment Policies & Approvals** | Full | Scoped (Org) | ❌ | ❌ | ❌ | Request Only | ❌ | ❌ |
| **Marketing Leads & Franchise** | Full | Full | ❌ | ❌ | ❌ | ❌ | ❌ | Submit Request |

\* *Subject to scope limits (e.g. Company Admin cannot manage other admins; Vendor cannot edit active menu items).*

---

## 🛠️ Detailed Endpoint Reference

### 👤 User Management (`/api/users`)
* `GET /api/users`: Admin, Company Admin (Filtered by organization).
* `GET /api/users/:id`: Target user, Admin, Company Admin (Filtered by organization).
* `POST /api/users`: Admin, Company Admin (Can only create Employee, Staff, Delivery Staff).
* `PUT /api/users/:id`: Target user, Admin, Company Admin (Scope limits apply).
* `DELETE /api/users/:id`: Admin, Company Admin (Scope limits apply).

### 🏢 Outlet Management (`/api/outlets`)
* `GET /api/outlets`: Public (No login required).
* `GET /api/outlets/:id`: Public (No login required).
* `POST /api/outlets`: Admin, Company Admin.
* `PUT /api/outlets/:id`: Admin, Company Admin.
* `DELETE /api/outlets/:id`: Admin.
* `POST /api/outlets/:id/qrcode`: Admin, Company Admin, Vendor.

### 🍽️ Menu Items (`/api/menu-items`)
* `GET /api/menu-items`: Public (No login required).
* `GET /api/menu-items/outlet/:outletId`: Public (No login required; filters active items).
* `POST /api/menu-items`: Vendor, Admin, Company Admin.
* `PUT /api/menu-items/:id`: Vendor, Admin, Company Admin (Vendor cannot edit if status is `Available`).
* `PATCH /api/menu-items/:id/status`: Vendor, Admin, Company Admin.
* `DELETE /api/menu-items/:id`: Vendor, Admin, Company Admin.

### 📦 Daily Menu (`/api/daily-menu`)
* `GET /api/daily-menu`: Public (No login required).
* `POST /api/daily-menu`: Vendor, Admin, Company Admin.

### 📋 Order Management (`/api/orders`)
* `GET /api/orders/stream`: Public (SSE connection).
* `POST /api/orders`: Public (QR, Bulk, and Retail orders can be placed anonymously).
* `GET /api/orders`: Authenticated user.
* `GET /api/orders/outlet/:outletId`: Authenticated user.
* `GET /api/orders/:id`: Public (Allows customers to track their orders via QR link).
* `GET /api/orders/delivery-staff/list`: Vendor, Admin, Company Admin.
* `PATCH /api/orders/:id/status`:
  * **Vendor** allowed updates: `Preparing`, `Ready`, `Cancelled`.
  * **Delivery Staff** allowed updates: `Picked`, `In Transit`, `Delivered` (Only if order is assigned to them).
  * **Admin/Company Admin**: Any status.
* `PATCH /api/orders/:id/assign`: Vendor, Admin, Company Admin.
* `PATCH /api/orders/:id/accept`: Vendor (Own outlet only), Admin.
* `PATCH /api/orders/:id/reject`: Vendor (Own outlet only), Admin.

### 📊 Reports (`/api/reports`)
* `GET /api/reports/summary`: Admin, Company Admin, Vendor, Investor (Vendor/Investor limited to own outlet).
* `GET /api/reports/daily-orders`: Admin, Company Admin, Vendor, Investor (Vendor/Investor limited to own outlet).
* `GET /api/reports/order-types`: Admin, Company Admin, Vendor, Investor (Vendor/Investor limited to own outlet).
* `GET /api/reports/payment-summary`: Admin, Company Admin, Vendor, Investor (Vendor/Investor limited to own outlet).
* `GET /api/reports/export/csv`: Admin, Company Admin, Vendor, Investor (Vendor/Investor limited to own outlet).
* `GET /api/reports/revenue-by-outlet`: Admin, Company Admin.

### 📕 Daily Ledger (`/api/ledger`)
* `GET /api/ledger/daily`: Admin, Company Admin.
* `GET /api/ledger/outlet`: Admin, Company Admin, Vendor, Staff (Vendor/Staff limited to own outlet).
* `GET /api/ledger/calculate-sales`: Vendor, Staff, Admin (Vendor/Staff limited to own outlet).
* `POST /api/ledger/submit`: Vendor, Staff, Admin (Vendor/Staff limited to own outlet).
* `POST /api/ledger/dispatch`: Admin, Company Admin.

### 💰 Budgets (`/api/budgets`)
* All budget configurations and limit checks (`GET /`, `GET /spend/:outletId`, `POST /`, `PUT /:id`, `DELETE /:id`): Admin, Company Admin.

### 💳 Payments (`/api/payments`)
* `GET /api/payments`: Employee (Self only), Company Admin (Organization only), Admin (All).
* `POST /api/payments`: Any authenticated user (Subject to organization policy limits if Employee).
* `PATCH /api/payments/:id/status`: Admin, Company Admin.
* `DELETE /api/payments/:id`: Admin.
* `GET/POST/PUT/DELETE /api/payments/policies`: Admin, Company Admin.
* `GET /api/payments/payouts`: Admin, Company Admin.
* `POST /api/payments/payouts`: Admin.
* `PATCH /api/payments/payouts/:id/status`: Admin.
* `GET /api/payments/disputes`: Any authenticated user (Non-admins can only see disputes they raised).
* `POST /api/payments/disputes`: Any authenticated user.
* `PATCH /api/payments/disputes/:id`: Admin, Company Admin.

### 📈 Investors (`/api/investors`)
* `POST /api/investors/calculate-payout`: Admin, Company Admin.
* `POST /api/investors/payouts`: Admin, Company Admin.
* `PATCH /api/investors/payouts/:payoutId/status`: Admin.
* `GET /api/investors/stats`: Investor, Admin, Company Admin (Investor limited to self).
* `GET /api/investors/payouts`: Investor, Admin, Company Admin (Investor limited to self).

### 🏠 Warehouse and Inventory (`/api/warehouse` & `/api/inventory`)
* `GET /api/warehouse`: Admin, Company Admin, Vendor.
* `GET /api/warehouse/:id`: Admin, Company Admin, Vendor.
* `POST /api/warehouse`: Admin, Company Admin.
* `PUT /api/warehouse/:id`: Admin, Company Admin.
* `PUT /api/warehouse/:id/inventory`: Vendor, Admin, Company Admin.
* `PATCH /api/warehouse/:id/inventory/:itemId/adjust`: Vendor, Admin, Company Admin.
* `PATCH /api/warehouse/:id/toggle-kitchen`: Admin, Company Admin.
* `PATCH /api/warehouse/:id/link-kitchen`: Admin, Company Admin.
* `POST /api/warehouse/:id/sync`: Vendor, Admin, Company Admin.
* `DELETE /api/warehouse/:id`: Admin.
* `GET /api/warehouse/alerts/low-stock`: Admin, Company Admin.
* `GET /api/inventory`: Admin, Company Admin, Vendor (Vendor limited to own branch).
* `GET /api/inventory/:id`: Admin, Company Admin, Vendor.
* `POST/PUT/PATCH/DELETE /api/inventory`: Admin, Company Admin.
