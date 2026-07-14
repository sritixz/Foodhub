import authenticate from './auth.js';

const roleMap = {
  'Admin': 'Owner',
  'Company Admin': 'Management',
  'Vendor': 'Outlet Sales Representative',
  'Staff': 'Outlet Sales Representative',
  'Delivery Staff': 'Driver',
  'Investor': 'Investment Partner',
  'Employee': 'Customer'
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Expand allowed roles to include legacy/new mapping equivalents
    const expandedRoles = [...roles];
    roles.forEach(role => {
      // If a legacy role is specified, allow the corresponding new role
      if (roleMap[role] && !expandedRoles.includes(roleMap[role])) {
        expandedRoles.push(roleMap[role]);
      }
      // If a new role is specified, allow the corresponding legacy role (reverse map)
      const legacyKey = Object.keys(roleMap).find(key => roleMap[key] === role);
      if (legacyKey && !expandedRoles.includes(legacyKey)) {
        expandedRoles.push(legacyKey);
      }
    });

    if (!expandedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.',
        requiredRoles: expandedRoles,
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
