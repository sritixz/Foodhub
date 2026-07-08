import authenticate from './auth.js';

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Combined middleware: authenticate + authorize
export const authAndAuthorize = (...roles) => {
  return [authenticate, authorize(...roles)];
};

// Convenience middleware for common role combinations
export const ownerOnly = authAndAuthorize('Owner');
export const adminOnly = ownerOnly; // Legacy alias

export const managementOrOwner = authAndAuthorize('Owner', 'Management');
export const companyAdminOrAdmin = managementOrOwner; // Legacy alias

export const outletSalesRepresentativeOnly = authAndAuthorize('Outlet Sales Representative');
export const vendorOnly = outletSalesRepresentativeOnly; // Legacy alias

export const driverOnly = authAndAuthorize('Driver');
export const deliveryStaffOnly = driverOnly; // Legacy alias

export const customerOnly = authAndAuthorize('Customer');
export const employeeOrStaff = authAndAuthorize('Customer', 'Outlet Sales Representative'); // Legacy alias mapping

export const centralKitchenManagerOnly = authAndAuthorize('Central Kitchen Manager');
export const investmentPartnerOnly = authAndAuthorize('Investment Partner');
export const nonCoreStaffOnly = authAndAuthorize('Non-Core Staff');

export default authorize;
