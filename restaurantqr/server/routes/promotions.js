import express from 'express';
import Promotion from '../models/Promotion.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

// 1. List Promotions (filtered by outlet & customerType)
router.get('/', async (req, res) => {
  try {
    const { outlet, customerType, all } = req.query;
    const query = all === 'true' ? {} : { isActive: true };

    if (outlet) {
      query.$or = [{ applicableOutlets: outlet }, { applyToAllOutlets: true }];
    }
    if (customerType && customerType !== 'All') {
      query.applicableCustomerType = { $in: [customerType, 'All'] };
    }

    const promotions = await Promotion.find(query)
      .populate('applicableOutlets', 'name outletId')
      .sort({ createdAt: -1 });

    res.json(promotions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch promotions', error: err.message });
  }
});

// 2. Validate Coupon in Cart
router.post('/validate', async (req, res) => {
  try {
    const { code, cartSubtotal, outletId, customerType } = req.body;
    if (!code) {
      return res.status(400).json({ valid: false, message: 'Please enter a coupon code' });
    }

    const promo = await Promotion.findOne({
      code: code.trim().toUpperCase(),
      isActive: true,
    });

    if (!promo) {
      return res.status(404).json({ valid: false, message: 'Invalid or expired coupon code' });
    }

    // Check expiry
    if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
      return res.status(400).json({ valid: false, message: 'Coupon code has expired' });
    }

    // Check minimum order amount
    const subtotal = Number(cartSubtotal) || 0;
    if (subtotal < promo.minOrderAmount) {
      return res.status(400).json({
        valid: false,
        message: `Minimum order amount of ₹${promo.minOrderAmount} required for this coupon`,
      });
    }

    // Check outlet scope
    if (!promo.applyToAllOutlets && outletId && promo.applicableOutlets && promo.applicableOutlets.length > 0) {
      const isAllowed = promo.applicableOutlets.some(
        (o) => o.toString() === outletId.toString()
      );
      if (!isAllowed) {
        return res.status(400).json({
          valid: false,
          message: 'This coupon is not valid at your selected outlet',
        });
      }
    }

    // Check customer type scope
    if (promo.applicableCustomerType !== 'All' && customerType && promo.applicableCustomerType !== customerType) {
      return res.status(400).json({
        valid: false,
        message: `This promotion is only available for ${promo.applicableCustomerType} customers`,
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (promo.discountType === 'percentage') {
      discountAmount = (subtotal * promo.discountValue) / 100;
      if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else {
      discountAmount = promo.discountValue;
    }

    discountAmount = Math.min(discountAmount, subtotal);

    res.json({
      valid: true,
      code: promo.code,
      title: promo.title,
      discountAmount: Math.round(discountAmount * 100) / 100,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      message: `Coupon '${promo.code}' applied successfully! Saved ₹${discountAmount.toFixed(2)}`,
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: err.message });
  }
});

// 3. Create Promotion (Admin)
router.post('/', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      applicableOutlets,
      applyToAllOutlets,
      applicableCustomerType,
      validUntil,
      badge,
    } = req.body;

    if (!code || !title || discountValue === undefined) {
      return res.status(400).json({ message: 'code, title, and discountValue are required' });
    }

    const existing = await Promotion.findOne({ code: code.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: `Promotion with code '${code}' already exists` });
    }

    const newPromo = new Promotion({
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description || '',
      discountType: discountType || 'percentage',
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      applicableOutlets: applicableOutlets || [],
      applyToAllOutlets: applyToAllOutlets !== false,
      applicableCustomerType: applicableCustomerType || 'All',
      validUntil: validUntil ? new Date(validUntil) : null,
      badge: badge || 'HOT OFFER',
    });

    await newPromo.save();
    res.status(201).json({ success: true, promotion: newPromo });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 4. Toggle Promotion Active State
router.patch('/:id/toggle', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const promo = await Promotion.findById(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });

    promo.isActive = !promo.isActive;
    await promo.save();
    res.json({ success: true, isActive: promo.isActive, promotion: promo });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 5. Delete Promotion
router.delete('/:id', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const promo = await Promotion.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });
    res.json({ success: true, message: 'Promotion deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
