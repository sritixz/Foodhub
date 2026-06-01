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

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlets"
          element={
            <ProtectedRoute>
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
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <InventoryManagement />
            </ProtectedRoute>
          }
        />
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
            <ProtectedRoute>
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
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrderManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/place"
          element={
            <ProtectedRoute>
              <OrderPlacement />
            </ProtectedRoute>
          }
        />
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
            <ProtectedRoute>
              <LocationDelivery />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse"
          element={
            <ProtectedRoute>
              <WarehouseManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Company Admin', 'Vendor']}>
              <VendorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <CategoryManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/qr/scan" element={<QRScan />} />
        <Route path="/qr/menu" element={<QRMenu />} />
        <Route path="/orders/track/:id" element={<OrderTracking />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
