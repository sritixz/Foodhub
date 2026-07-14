# User Credentials - FoodHub Restaurant Management System

## 📋 All User Roles and Credentials

### 🔑 Super Admin / Owner (Owner)
**Full System Access**
- **Email:** `admin@foodhub.com`
- **Password:** `admin123`
- **Phone:** `9999999999`
- **Role:** `Owner` (Legacy: Admin)
- **Permissions:** Full system access, can manage all users, outlets, orders, and settings

---

### 🏢 Company Admin (Management)
**Company Management Access**
- **Email:** `companyadmin@foodhub.com`
- **Password:** `company123`
- **Phone:** `8888888888`
- **Role:** `Management` (Legacy: Company Admin)
- **Permissions:** Employee account management, order/payment reports, budget configuration

---

### 👨‍🍳 Central Kitchen Manager (Central Kitchen Manager)
**Central Kitchen Management Access**
- **Email:** `ckm@foodhub.com`
- **Password:** `ckm123`
- **Phone:** `7777777778`
- **Role:** `Central Kitchen Manager`
- **Outlet:** Main Restaurant (OUT001)
- **Permissions:** View daily logs, update item statuses, manage warehouse inventory

---

### 👨‍💼 Staff (Outlet Sales Representative)
**Restaurant Staff Access**
- **Email:** `staff@foodhub.com`
- **Password:** `staff123`
- **Phone:** `7777777777`
- **Role:** `Outlet Sales Representative` (Legacy: Staff)
- **Outlet:** Main Restaurant (OUT001)
- **Permissions:** Menu browsing, order handling, inventory management

---

### 🍽️ Vendor Manager (Outlet Sales Representative)
**Vendor Access**
- **Email:** `vendor@foodhub.com`
- **Password:** `vendor123`
- **Phone:** `5555555555`
- **Role:** `Outlet Sales Representative` (Legacy: Vendor)
- **Outlet:** Main Restaurant (OUT001)
- **Permissions:** Menu CRUD, availability management, order acceptance/rejection, earnings dashboard

---

### 🚚 Delivery Staff (Driver)
**Delivery Management Access**
- **Email:** `delivery@foodhub.com`
- **Password:** `delivery123`
- **Phone:** `6666666666`
- **Role:** `Driver` (Legacy: Delivery Staff)
- **Outlet:** Main Restaurant (OUT001)
- **Permissions:** View assigned orders, update delivery status, contact customers

---

### 👤 Employee (Customer)
**Employee Access**
- **Email:** `employee@foodhub.com`
- **Password:** `employee123`
- **Phone:** `4444444444`
- **Role:** `Customer` (Legacy: Employee)
- **Permissions:** Menu browsing, place orders, track orders, personal payment history

---

### 💰 Investment Partner (Investment Partner)
**Investor Access**
- **Email:** `investor@foodhub.com`
- **Password:** `investor123`
- **Phone:** `3333333333`
- **Role:** `Investment Partner` (Legacy: Investor)
- **Outlet:** Main Restaurant (OUT001)
- **Permissions:** Stakeholder access to monitor assured returns, profit sharing, and payout history

---

## 🚀 How to Create/Seed Users

### Option 1: Run Seed Script (Recommended)
```bash
cd server
npm run seed:users
```

This will:
- Create all users listed above
- Create a default outlet if none exists
- Skip users that already exist (won't duplicate)
- Display all created credentials

### Option 2: Manual Creation via API
You can create users manually via the registration endpoint:

```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "User Name",
  "email": "user@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "Owner",
  "outlet": null
}
```

**Note:** Registration endpoint may require authentication depending on your setup.

### Option 3: Create via Admin Panel
1. Login as Admin/Owner (`admin@foodhub.com` / `admin123`)
2. Navigate to User Management
3. Click "Add User"
4. Fill in the form and create user

---

## 📝 Role Permissions Summary

| Role (Legacy Role) | Outlet Management | User Management | Menu Management | Order Management | Inventory | Reports |
|------|------------------|-----------------|-----------------|------------------|-----------|---------|
| **Owner** (*Admin*) | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Management** (*Company Admin*) | ✅ View/Edit | ✅ Customers Only | ❌ | ✅ View/Reports | ❌ | ✅ Limited |
| **Central Kitchen Manager** | ❌ | ❌ | ❌ | ❌ | ✅ Full (Warehouse) | ❌ |
| **Outlet Sales Representative** (*Staff/Vendor*) | ❌ | ❌ | ✅ Full (Own Outlet) | ✅ Own Outlet | ✅ Own Outlet | ✅ Own Outlet |
| **Driver** (*Delivery Staff*) | ❌ | ❌ | ❌ | ✅ Assigned Only | ❌ | ❌ |
| **Customer** (*Employee*) | ❌ | ❌ | ✅ View | ✅ Place/Track | ❌ | ❌ |
| **Investment Partner** (*Investor*) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ View (Own Outlet) |

---

## 🔐 Security Notes

⚠️ **Important:**
- These are **default development credentials**
- **Change all passwords** in production
- Use strong, unique passwords for production
- Consider implementing password complexity requirements
- Enable 2FA for admin accounts in production

---

## 🛠️ Troubleshooting

### User Not Found
- Ensure seed script has been run: `npm run seed:users`
- Check MongoDB connection
- Verify user exists in database

### Login Fails
- Verify email is correct (case-insensitive)
- Check password (case-sensitive)
- Ensure user status is "Active"
- Check server logs for errors

### Permission Denied
- Verify user role matches required permissions
- Check if user's outlet assignment is correct
- Review middleware authorization logic

---

## 📞 Support

For issues with user access or credentials, contact the system administrator.

**Last Updated:** 2026-07-14
