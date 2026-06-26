import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OutletManagement from './pages/OutletManagement';
import AddOutlet from './pages/AddOutlet';
import EditOutlet from './pages/EditOutlet';
import OutletQRCode from './pages/OutletQRCode';
import InventoryManagement from './pages/InventoryManagement';
import AddMenuItem from './pages/AddMenuItem';
import EditMenuItem from './pages/EditMenuItem';
import MenuBrowse from './pages/MenuBrowse';
import OrderManagement from './pages/OrderManagement';
import OrderPlacement from './pages/OrderPlacement';
import OrderTracking from './pages/OrderTracking';
import QRScan from './pages/QRScan';
import QRMenu from './pages/QRMenu';
import UserProfile from './pages/UserProfile';
import UserManagement from './pages/UserManagement';
import VendorDashboard from './pages/VendorDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';
import LocationDelivery from './pages/LocationDelivery';
import WarehouseManagement from './pages/WarehouseManagement';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import CategoryManagement from './pages/CategoryManagement';
import BudgetConfig from './pages/BudgetConfig';
import PaymentModule from './pages/PaymentModule';
import CustomerOrderTracking from './pages/CustomerOrderTracking';
import CentralKitchenDispatch from './pages/admin/CentralKitchenDispatch';
import DailyLedgerDashboard from './pages/admin/DailyLedgerDashboard';
import Leads from './pages/admin/leads/index';
import VendorDailyLog from './pages/VendorDailyLog';

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/qr/scan" element={<QRScan />} />
        <Route path="/qr/menu" element={<QRMenu />} />
        <Route path="/orders/track/:id" element={<OrderTracking />} />
        {/* Customer-dedicated tracking page (no Layout, with ratings) */}
        <Route path="/customer/track/:id" element={<CustomerOrderTracking />} />

        {/* Dashboard - all authenticated users */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Outlet Management */}
        <Route
          path="/outlets"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <OutletManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlets/add"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <AddOutlet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlets/edit/:id"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <EditOutlet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlets/:id/qrcode"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <OutletQRCode />
            </ProtectedRoute>
          }
        />

        {/* Inventory - Admin/Company Admin/Vendor */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <InventoryManagement />
            </ProtectedRoute>
          }
        />

        {/* Menu Management */}
        <Route
          path="/menu/add"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <AddMenuItem />
            </ProtectedRoute>
          }
        />
        <Route
          path="/menu/browse"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor', 'Staff', 'Employee']}>
              <MenuBrowse />
            </ProtectedRoute>
          }
        />
        <Route
          path="/menu/edit/:id"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <EditMenuItem />
            </ProtectedRoute>
          }
        />

        {/* Order Management - Admin/Company Admin/Vendor/Staff */}
        <Route
          path="/orders"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor', 'Staff']}>
              <OrderManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/place"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor', 'Employee', 'Staff']}>
              <OrderPlacement />
            </ProtectedRoute>
          }
        />

        {/* Delivery */}
        <Route
          path="/delivery"
          element={
            <ProtectedRoute allowedRoles={['Delivery Staff', 'Admin', 'Company Admin', 'Vendor']}>
              <DeliveryDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/location-delivery"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor', 'Delivery Staff']}>
              <LocationDelivery />
            </ProtectedRoute>
          }
        />

        {/* Warehouse - Admin/Company Admin/Vendor */}
        <Route
          path="/warehouse"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <WarehouseManagement />
            </ProtectedRoute>
          }
        />

        {/* Notifications - all authenticated users */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />

        {/* Reports - Admin/Company Admin/Vendor */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dispatch"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <CentralKitchenDispatch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/daily-ledger"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <DailyLedgerDashboard />
            </ProtectedRoute>
          }
        />

        {/* User Management - Admin/Company Admin */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        {/* Vendor Dashboard */}
        <Route
          path="/vendors"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <VendorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/daily-log"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <VendorDailyLog />
            </ProtectedRoute>
          }
        />

        {/* Profile - all authenticated users */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />

        {/* Category Management - Admin only */}
        <Route
          path="/categories"
          element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <CategoryManagement />
            </ProtectedRoute>
          }
        />

        {/* Budget Configuration - Company Admin / Admin */}
        <Route
          path="/budget-config"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <BudgetConfig />
            </ProtectedRoute>
          }
        />

        {/* Payment Module - Employee / Company Admin / Admin */}
        <Route
          path="/payments"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Employee']}>
              <PaymentModule />
            </ProtectedRoute>
          }
        />

        {/* Leads Management - Company Admin / Admin */}
        <Route
          path="/admin/leads"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <Leads />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/leads/:tab"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <Leads />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
