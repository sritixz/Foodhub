import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import authenticate from '../middleware/auth.js';
import { companyAdminOrAdmin } from '../middleware/roleAuth.js';

const router = express.Router();
const COMPANY_ADMIN_ALLOWED_ROLES = ['Employee', 'Staff', 'Delivery Staff'];

const applyCompanyAdminScope = (query, user) => {
  if (user.role !== 'Company Admin') {
    return query;
  }

  if (!user.organization) {
    return { ...query, organization: '__missing__' };
  }

  return {
    ...query,
    organization: user.organization,
    role: { $in: COMPANY_ADMIN_ALLOWED_ROLES },
  };
};

const ensureCompanyAdminAccess = (targetUser, currentUser) => {
  if (currentUser.role !== 'Company Admin') {
    return { allowed: true };
  }

  if (!currentUser.organization || !targetUser.organization) {
    return { allowed: false, message: 'Organization is not set' };
  }

  if (currentUser.organization !== targetUser.organization) {
    return { allowed: false, message: 'Access denied' };
  }

  if (!COMPANY_ADMIN_ALLOWED_ROLES.includes(targetUser.role)) {
    return { allowed: false, message: 'Access denied' };
  }

  return { allowed: true };
};

// Get all users (protected - Admin/Company Admin)
router.get('/', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    const { role, status, outlet } = req.query;
    let query = {};

    if (role) query.role = role;
    if (status) query.status = status;
    if (outlet) query.outlet = outlet;

    query = applyCompanyAdminScope(query, req.user);

    const users = await User.find(query)
      .populate('outlet', 'name outletId')
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single user (protected)
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Users can view their own profile, Admin/Company Admin can view any
    if (req.user._id.toString() !== req.params.id && !['Admin', 'Company Admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id)
      .populate('outlet', 'name outletId')
      .select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === 'Company Admin' && req.user._id.toString() !== req.params.id) {
      const access = ensureCompanyAdminAccess(user, req.user);
      if (!access.allowed) {
        return res.status(403).json({ message: access.message });
      }
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create user (protected - Admin/Company Admin)
router.post('/', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    const { password, ...userData } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    if (req.user.role === 'Company Admin') {
      if (!COMPANY_ADMIN_ALLOWED_ROLES.includes(userData.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      userData.organization = req.user.organization || userData.organization;
      if (!userData.organization) {
        return res.status(400).json({ message: 'Organization is required' });
      }
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      ...userData,
      password: hashedPassword,
    });
    const savedUser = await user.save();
    
    const userResponse = await User.findById(savedUser._id)
      .populate('outlet', 'name outletId')
      .select('-password');
    
    res.status(201).json(userResponse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update user (protected)
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Users can update their own profile, Admin/Company Admin can update any
    if (req.user._id.toString() !== req.params.id && !['Admin', 'Company Admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { password, ...updateData } = req.body;
    
    if (req.user.role === 'Company Admin' && req.user._id.toString() !== req.params.id) {
      const targetUser = await User.findById(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const access = ensureCompanyAdminAccess(targetUser, req.user);
      if (!access.allowed) {
        return res.status(403).json({ message: access.message });
      }

      updateData.organization = req.user.organization || targetUser.organization;
      if (!updateData.organization) {
        return res.status(400).json({ message: 'Organization is required' });
      }
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('outlet', 'name outletId')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete user (protected - Admin/Company Admin)
router.delete('/:id', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    if (req.user.role === 'Company Admin') {
      const targetUser = await User.findById(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const access = ensureCompanyAdminAccess(targetUser, req.user);
      if (!access.allowed) {
        return res.status(403).json({ message: access.message });
      }
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current user profile
router.get('/profile/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('outlet', 'name outletId')
      .select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update current user profile
router.put('/profile/me', authenticate, async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('outlet', 'name outletId')
      .select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
