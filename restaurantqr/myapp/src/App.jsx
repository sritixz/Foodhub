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
import CSVAnalysis from './pages/admin/CSVAnalysis';
import Leads from './pages/admin/leads/index';
import VendorDailyLog from './pages/VendorDailyLog';
import DailyMenuSetup from './pages/admin/DailyMenuSetup';
import InvestorDashboard from './pages/InvestorDashboard';
import InvestorPayouts from './pages/InvestorPayouts';
import AdminInvestorLedger from './pages/admin/AdminInvestorLedger';
import MakerCheckerApprovals from './pages/admin/MakerCheckerApprovals';

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
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative']}>
              <OutletManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlets/add"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management']}>
              <AddOutlet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlets/edit/:id"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management']}>
              <EditOutlet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlets/:id/qrcode"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative']}>
              <OutletQRCode />
            </ProtectedRoute>
          }
        />

        {/* Inventory */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative']}>
              <InventoryManagement />
            </ProtectedRoute>
          }
        />

        {/* Menu Management */}
        <Route
          path="/menu/add"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative']}>
              <AddMenuItem />
            </ProtectedRoute>
          }
        />
        <Route
          path="/menu/browse"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative', 'Customer']}>
              <MenuBrowse />
            </ProtectedRoute>
          }
        />
        <Route
          path="/menu/edit/:id"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative']}>
              <EditMenuItem />
            </ProtectedRoute>
          }
        />

        {/* Order Management */}
        <Route
          path="/orders"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative']}>
              <OrderManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/place"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative', 'Customer']}>
              <OrderPlacement />
            </ProtectedRoute>
          }
        />

        {/* Delivery */}
        <Route
          path="/delivery"
          element={
            <ProtectedRoute allowedRoles={['Driver', 'Owner', 'Management', 'Outlet Sales Representative']}>
              <DeliveryDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/location-delivery"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative', 'Driver']}>
              <LocationDelivery />
            </ProtectedRoute>
          }
        />

        {/* Warehouse */}
        <Route
          path="/warehouse"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative']}>
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

        {/* Reports */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative', 'Investment Partner']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dispatch"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Central Kitchen Manager']}>
              <CentralKitchenDispatch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investor/dashboard"
          element={
            <ProtectedRoute allowedRoles={['Investment Partner']}>
              <InvestorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investor/payouts"
          element={
            <ProtectedRoute allowedRoles={['Investment Partner']}>
              <InvestorPayouts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/investors"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management']}>
              <AdminInvestorLedger />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/daily-ledger"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Central Kitchen Manager']}>
              <DailyLedgerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/csv-analysis"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management']}>
              <CSVAnalysis />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/daily-menu"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative']}>
              <DailyMenuSetup />
            </ProtectedRoute>
          }
        />

        {/* User Management */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        {/* Maker-Checker Approvals */}
        <Route
          path="/admin/approvals"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Central Kitchen Manager']}>
              <MakerCheckerApprovals />
            </ProtectedRoute>
          }
        />

        {/* Vendor Dashboard */}
        <Route
          path="/vendors"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative']}>
              <VendorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/daily-log"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Outlet Sales Representative']}>
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

        {/* Category Management */}
        <Route
          path="/categories"
          element={
            <ProtectedRoute allowedRoles={['Owner']}>
              <CategoryManagement />
            </ProtectedRoute>
          }
        />

        {/* Budget Configuration */}
        <Route
          path="/budget-config"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management']}>
              <BudgetConfig />
            </ProtectedRoute>
          }
        />

        {/* Payment Module */}
        <Route
          path="/payments"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management', 'Customer']}>
              <PaymentModule />
            </ProtectedRoute>
          }
        />

        {/* Leads Management */}
        <Route
          path="/admin/leads"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management']}>
              <Leads />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/leads/:tab"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Management']}>
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
