import express from 'express';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import PaymentPolicy from '../models/PaymentPolicy.js';
import Dispute from '../models/Dispute.js';
import Payout from '../models/Payout.js';
import Outlet from '../models/Outlet.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const isOwnerOrManagement = (role) => ['Owner', 'Management'].includes(role);

// Get active policy for an organization / fallback global
const getPolicy = async (organization) => {
  if (organization) {
    const orgPolicy = await PaymentPolicy.findOne({ organization, isActive: true });
    if (orgPolicy) return orgPolicy;
  }
  return PaymentPolicy.findOne({ organization: null, isActive: true });
};

// Monthly spend for an employee
const monthlySpend = async (userId) => {
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const result = await Payment.aggregate([
    { $match: { requestedBy: userId, createdAt: { $gte: start }, status: { $nin: ['Rejected'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
};

/* ─────────────────────────────────────────
   PAYMENT SUMMARY  (Admin / Company Admin)
───────────────────────────────────────── */
router.get('/summary', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let since = new Date();
    if (period === 'week') since.setDate(now.getDate() - 7);
    else if (period === 'month') since.setMonth(now.getMonth() - 1);
    else if (period === 'year') since.setFullYear(now.getFullYear() - 1);

    const [paymentStats, payoutStats, disputeStats] = await Promise.all([
      Payment.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      Payout.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$netPayout' } } },
      ]),
      Dispute.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const toMap = (arr, key = '_id') => arr.reduce((m, x) => { m[x[key]] = x; return m; }, {});
    res.json({
      payments: toMap(paymentStats),
      payouts:  toMap(payoutStats),
      disputes: toMap(disputeStats),
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* ─────────────────────────────────────────
   PAYMENTS  (CRUD)
───────────────────────────────────────── */

// List — scoped by role
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, type, limit = 50, page = 1 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type)   query.type   = type;

    // Customer sees only their own
    if (req.user.role === 'Customer') {
      query.requestedBy = req.user._id;
    } else if (req.user.role === 'Management') {
      const customers = await User.find({ organization: req.user.organization }).select('_id');
      query.requestedBy = { $in: customers.map(c => c._id) };
    }
    // Owner sees all

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('requestedBy', 'name email role')
        .populate('approvedBy', 'name')
        .populate('vendor', 'name outletId')
        .sort({ createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      Payment.countDocuments(query),
    ]);
    res.json({ payments, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Create payment request (Employee / any auth user for their own)
router.post('/', authenticate, async (req, res) => {
  try {
    const { amount, description, category, type = 'employee_expense', receiptUrl, vendor } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid amount is required' });

    // Policy check for customers
    if (req.user.role === 'Customer') {
      const policy = await getPolicy(req.user.organization);
      if (policy) {
        if (policy.singleTxLimit && amount > policy.singleTxLimit)
          return res.status(400).json({ message: `Amount exceeds single transaction limit of ₹${policy.singleTxLimit}` });
        if (policy.monthlyLimit) {
          const spent = await monthlySpend(req.user._id);
          if (spent + amount > policy.monthlyLimit)
            return res.status(400).json({ message: `Monthly limit of ₹${policy.monthlyLimit} would be exceeded` });
        }
        if (policy.allowedCategories?.length && !policy.allowedCategories.includes(category))
          return res.status(400).json({ message: `Category '${category}' is not allowed by policy` });
      }
    }

    const payment = await Payment.create({
      type,
      amount,
      description,
      category: category || 'Other',
      receiptUrl: receiptUrl || null,
      vendor: vendor || null,
      requestedBy: req.user._id,
      status: 'Pending',
    });

    const populated = await Payment.findById(payment._id)
      .populate('requestedBy', 'name email role')
      .populate('vendor', 'name');
    res.status(201).json(populated);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// Approve / Reject (Owner / Management)
router.patch('/:id/status', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['Approved', 'Rejected', 'Processing', 'Paid'].includes(status))
      return res.status(400).json({ message: 'Invalid status' });

    const update = { status, notes: notes || null, approvedBy: req.user._id };
    if (status === 'Paid') update.paidAt = new Date();
    if (status === 'Rejected') update.rejectedAt = new Date();

    const payment = await Payment.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('requestedBy', 'name email role')
      .populate('approvedBy', 'name')
      .populate('vendor', 'name');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// Delete (Owner only)
router.delete('/:id', authenticate, authorize('Owner'), async (req, res) => {
  try {
    const p = await Payment.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ message: 'Payment not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* ─────────────────────────────────────────
   PAYMENT POLICIES  (Management / Owner)
   ───────────────────────────────────────── */
router.get('/policies', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const query = req.user.role === 'Management' ? { organization: req.user.organization } : {};
    const policies = await PaymentPolicy.find(query).populate('createdBy', 'name').sort({ createdAt: -1 });
    res.json(policies);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/policies', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const policy = await PaymentPolicy.create({
      ...req.body,
      organization: req.user.role === 'Management' ? req.user.organization : (req.body.organization || null),
      createdBy: req.user._id,
    });
    res.status(201).json(policy);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.put('/policies/:id', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const policy = await PaymentPolicy.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!policy) return res.status(404).json({ message: 'Policy not found' });
    res.json(policy);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.delete('/policies/:id', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    await PaymentPolicy.findByIdAndDelete(req.params.id);
    res.json({ message: 'Policy deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* ─────────────────────────────────────────
   VENDOR PAYOUTS  (Owner / Management)
   ───────────────────────────────────────── */
router.get('/payouts', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const query = status ? { status } : {};
    const payouts = await Payout.find(query)
      .populate('vendor', 'name outletId commissionRate')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    res.json(payouts);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Create payout (Owner)
router.post('/payouts', authenticate, authorize('Owner'), async (req, res) => {
  try {
    const { vendorId, periodStart, periodEnd, notes } = req.body;
    if (!vendorId || !periodStart || !periodEnd)
      return res.status(400).json({ message: 'vendorId, periodStart, periodEnd required' });

    const outlet = await Outlet.findById(vendorId);
    if (!outlet) return res.status(404).json({ message: 'Vendor not found' });

    const start = new Date(periodStart), end = new Date(periodEnd);
    const [stats] = await Order.aggregate([
      { $match: { vendor: outlet._id, status: 'Delivered', createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' }, totalOrders: { $sum: 1 } } },
    ]);
    if (!stats || stats.totalRevenue <= 0)
      return res.status(400).json({ message: 'No delivered revenue for this period' });

    const commissionRate = outlet.commissionRate || 0;
    const commissionAmount = (stats.totalRevenue * commissionRate) / 100;
    const netPayout = stats.totalRevenue - commissionAmount;

    const payout = await Payout.create({
      vendor: vendorId, periodStart: start, periodEnd: end,
      totalOrders: stats.totalOrders, grossRevenue: stats.totalRevenue,
      commissionRate, commissionAmount, netPayout,
      status: 'Pending', notes: notes || null, createdBy: req.user._id,
    });
    const populated = await Payout.findById(payout._id)
      .populate('vendor', 'name outletId').populate('createdBy', 'name');
    res.status(201).json(populated);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// Update payout status (Owner)
router.patch('/payouts/:id/status', authenticate, authorize('Owner'), async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['Pending', 'Processing', 'Paid', 'Failed'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const update = { status };
    if (status === 'Paid') update.paidAt = new Date();
    const payout = await Payout.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('vendor', 'name outletId').populate('createdBy', 'name');
    if (!payout) return res.status(404).json({ message: 'Payout not found' });
    res.json(payout);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

/* ─────────────────────────────────────────
   DISPUTES
───────────────────────────────────────── */
router.get('/disputes', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    // Non-admin sees only their disputes
    if (!isOwnerOrManagement(req.user.role)) query.raisedBy = req.user._id;
    const disputes = await Dispute.find(query)
      .populate('raisedBy', 'name role')
      .populate('assignedTo', 'name')
      .populate('vendor', 'name outletId')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(disputes);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/disputes', authenticate, async (req, res) => {
  try {
    const { title, description, type, priority, vendor, relatedPayment, relatedPayout, amount } = req.body;
    if (!title || !description || !type) return res.status(400).json({ message: 'title, description, type required' });
    const dispute = await Dispute.create({
      title, description, type, priority: priority || 'Medium',
      raisedBy: req.user._id, vendor: vendor || null,
      relatedPayment: relatedPayment || null, relatedPayout: relatedPayout || null,
      amount: amount || null,
    });
    const populated = await Dispute.findById(dispute._id).populate('raisedBy', 'name role').populate('vendor', 'name');
    res.status(201).json(populated);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// Add comment to dispute
router.post('/disputes/:id/comment', authenticate, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });
    dispute.comments.push({ author: req.user._id, text: req.body.text });
    await dispute.save();
    const populated = await Dispute.findById(dispute._id)
      .populate('raisedBy', 'name role').populate('assignedTo', 'name')
      .populate('comments.author', 'name role').populate('vendor', 'name');
    res.json(populated);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// Resolve / update dispute status (Owner / Management)
router.patch('/disputes/:id', authenticate, authorize('Owner', 'Management'), async (req, res) => {
  try {
    const { status, resolution, assignedTo } = req.body;
    const update = {};
    if (status)     update.status = status;
    if (resolution) update.resolution = resolution;
    if (assignedTo) update.assignedTo = assignedTo;
    if (status === 'Resolved') { update.resolvedAt = new Date(); update.resolvedBy = req.user._id; }
    const dispute = await Dispute.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('raisedBy', 'name role').populate('assignedTo', 'name')
      .populate('resolvedBy', 'name').populate('vendor', 'name')
      .populate('comments.author', 'name role');
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });
    res.json(dispute);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

export default router;
