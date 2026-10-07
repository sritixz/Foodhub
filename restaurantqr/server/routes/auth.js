import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email
    const user = await User.findOne({ email }).populate('outlet', 'name outletId');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (user.status !== 'Active') {
      return res.status(401).json({ message: 'Account is inactive. Please contact administrator.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data without password
    const userResponse = await User.findById(user._id)
      .populate('outlet', 'name outletId')
      .select('-password');

    res.json({
      token,
      user: userResponse,
      expiresIn: process.env.JWT_EXPIRE || '7d',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// Register (customer facing and admin)
router.post('/register', async (req, res) => {
  try {
    let { name, email, phone, password, role, outlet, companyName, companyCategory, assignedCompany, campus, floor, desk } = req.body;

    role = role || 'Customer';
    phone = (phone && String(phone).trim().length > 0) ? String(phone).trim() : '+91 98765 43210';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields (name, email, password)' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Resolve outlet if string outletId or company name passed
    let outletId = null;
    let matchedCompanyCategory = companyCategory || 'Corporate Client';
    let matchedAssignedCompany = assignedCompany || companyName || null;

    if (outlet || assignedCompany) {
      const searchStr = String(outlet || assignedCompany).trim();
      const Outlet = (await import('../models/Outlet.js')).default;
      const matchedOutlet = await Outlet.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(searchStr) && searchStr.length === 24 ? searchStr : null },
          { outletId: searchStr.toUpperCase() },
          { outletId: searchStr },
          { name: { $regex: new RegExp(searchStr, 'i') } },
        ],
      });
      if (matchedOutlet) {
        outletId = matchedOutlet._id;
        matchedCompanyCategory = matchedOutlet.category || matchedCompanyCategory;
        matchedAssignedCompany = matchedOutlet.name;
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      phone,
      password: hashedPassword,
      role,
      organization: matchedAssignedCompany || companyName || (outlet ? String(outlet).toUpperCase() : 'MOPY Customer'),
      companyCategory: matchedCompanyCategory,
      assignedCompany: matchedAssignedCompany,
      outlet: outletId,
      defaultDeliveryLocation: [floor, desk].filter(Boolean).join(' • ') || null,
      status: 'Active',
    });

    const savedUser = await user.save();

    // Generate token
    const token = generateToken(savedUser._id);

    // Return user data without password
    const userResponse = await User.findById(savedUser._id)
      .populate('outlet', 'name outletId')
      .select('-password');

    res.status(201).json({
      success: true,
      token,
      user: userResponse,
      expiresIn: process.env.JWT_EXPIRE || '7d',
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    res.status(400).json({ message: error.message || 'Registration failed' });
  }
});

// Get current user (protected route)
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('outlet', 'name outletId')
      .select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Refresh token
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    res.json({
      token,
      expiresIn: process.env.JWT_EXPIRE || '7d',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during token refresh', error: error.message });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide email' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If email exists, password reset link has been sent' });
    }

    // Generate reset token (simple implementation - can be enhanced with email service)
    const resetToken = jwt.sign({ userId: user._id, type: 'password-reset' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // TODO: Send email with reset link
    // For now, return token (in production, send via email)
    res.json({
      message: 'Password reset token generated',
      resetToken, // Remove this in production, send via email instead
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Please provide reset token and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

      if (decoded.type !== 'password-reset') {
        return res.status(400).json({ message: 'Invalid reset token' });
      }

      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      await user.save();

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({ message: 'Reset token expired' });
      }
      return res.status(400).json({ message: 'Invalid reset token' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
