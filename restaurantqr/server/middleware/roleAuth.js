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
export const adminOnly = authAndAuthorize('Admin');
export const companyAdminOrAdmin = authAndAuthorize('Admin', 'Company Admin');
export const vendorOnly = authAndAuthorize('Vendor');
export const deliveryStaffOnly = authAndAuthorize('Delivery Staff');
export const employeeOrStaff = authAndAuthorize('Employee', 'Staff');

export default authorize;
