import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Outlet from '../models/Outlet.js';
import Order from '../models/Order.js';
import DailyLedger from '../models/DailyLedger.js';
import InvestorPayout from '../models/InvestorPayout.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roleAuth.js';

const router = express.Router();

// Helper to calculate investor payout details (Supports Multi-Kiosk & Multi-Investor Splits)
export const calculateInvestorPayoutDetails = async (investor, startStr, endStr) => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format');
  }

  // Calculate days in period (inclusive)
  const diffTime = end.getTime() - start.getTime();
  const daysInPeriod = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

  // Assured return rate (annual to daily pro-rated)
  const annualAssured = (investor.investmentAmount || 0) * ((investor.assuredReturnRate || 18) / 100);
  const assuredAmount = (annualAssured / 365) * daysInPeriod;

  // Determine all outlets mapped to this investor
  const outletIds = new Set();
  if (investor.outlet) outletIds.add(investor.outlet._id ? investor.outlet._id.toString() : investor.outlet.toString());
  if (Array.isArray(investor.mappedKiosks)) {
    investor.mappedKiosks.forEach((k) => {
      if (k) outletIds.add(k._id ? k._id.toString() : k.toString());
    });
  }

  const mappedOutlets = await Outlet.find({
    $or: [
      { _id: { $in: Array.from(outletIds) } },
      { 'investors.investor': investor._id },
    ],
  });

  let totalOutletProfit = 0;
  let totalInvestorProfitShare = 0;

  for (const out of mappedOutlets) {
    const ledgers = await DailyLedger.find({
      outlet: out._id,
      date: { $gte: startStr, $lte: endStr },
      status: { $in: ['Submitted', 'Approved'] },
    });

    let outletProfit = 0;
    ledgers.forEach((l) => {
      outletProfit += l.financials?.netProfit || 0;
    });
    totalOutletProfit += outletProfit;

    // Check if this outlet has explicit multi-investor split configured
    const invConfig = (out.investors || []).find(
      (i) => i.investor && i.investor.toString() === investor._id.toString()
    );
    const sharePct = invConfig ? (invConfig.profitSharePercentage || 50) : (investor.profitSharePercentage || 50);
    const equityFactor = (invConfig && invConfig.equityPercentage > 0 && out.investors.length > 1)
      ? (invConfig.equityPercentage / 100)
      : 1;

    totalInvestorProfitShare += outletProfit * (sharePct / 100) * equityFactor;
  }

  const netPayout = Math.max(totalInvestorProfitShare, assuredAmount);

  return {
    daysInPeriod,
    totalOutletProfit,
    profitShareAmount: totalInvestorProfitShare,
    assuredAmount,
    netPayout,
  };
};

// @route   POST /api/investors/calculate-payout
// @desc    Calculate potential investor payout for a date range
// @access  Admin, Company Admin
router.post('/calculate-payout', authenticate, authorize('Admin', 'Company Admin', 'Owner', 'Management'), async (req, res) => {
  try {
    const { investorId, periodStart, periodEnd } = req.body;

    if (!investorId || !periodStart || !periodEnd) {
      return res.status(400).json({ message: 'investorId, periodStart, and periodEnd are required' });
    }

    const investor = await User.findById(investorId).populate('outlet', 'name outletId');
    if (!investor) {
      return res.status(404).json({ message: 'Investor not found' });
    }

    if (!['Investor', 'Investment Partner'].includes(investor.role)) {
      return res.status(400).json({ message: 'User is not registered as an Investor' });
    }

    const calculation = await calculateInvestorPayoutDetails(investor, periodStart, periodEnd);

    res.json({
      investor: {
        id: investor._id,
        name: investor.name,
        email: investor.email,
        phone: investor.phone,
        investmentAmount: investor.investmentAmount,
        assuredReturnRate: investor.assuredReturnRate,
        profitSharePercentage: investor.profitSharePercentage,
      },
      outlet: investor.outlet ? {
        id: investor.outlet._id,
        name: investor.outlet.name,
        outletId: investor.outlet.outletId,
      } : null,
      periodStart,
      periodEnd,
      ...calculation
    });
  } catch (error) {
    console.error('Error calculating investor payout:', error.message);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
});

// @route   GET /api/investors/stats
// @desc    Get live dashboard stats, mapped kiosks, and P&L for logged-in or specific investor
// @access  Investor, Admin, Company Admin, Owner
router.get('/stats', authenticate, async (req, res) => {
  try {
    let investorId = req.user._id || req.user.id;

    // Admins can request stats for any specific investor
    if (['Admin', 'Company Admin', 'Owner', 'Management'].includes(req.user.role) && req.query.investorId) {
      investorId = req.query.investorId;
    }

    const investor = await User.findById(investorId)
      .populate('outlet', 'name outletId location isActive')
      .populate('mappedKiosks', 'name outletId location isActive');
    if (!investor) {
      return res.status(404).json({ message: 'Investor not found' });
    }

    if (!['Investor', 'Investment Partner', 'Owner', 'Management'].includes(investor.role)) {
      return res.status(400).json({ message: 'User is not an Investor' });
    }

    // Collect all mapped outlets
    const outletIds = new Set();
    if (investor.outlet) outletIds.add(investor.outlet._id.toString());
    if (Array.isArray(investor.mappedKiosks)) {
      investor.mappedKiosks.forEach((k) => outletIds.add(k._id.toString()));
    }

    const outlets = await Outlet.find({
      $or: [
        { _id: { $in: Array.from(outletIds) } },
        { 'investors.investor': investor._id },
      ],
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const kiosksSummary = [];
    for (const out of outlets) {
      const todayOrders = await Order.find({
        vendor: out._id,
        createdAt: { $gte: todayStart },
        status: { $ne: 'Cancelled' },
      });
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

      kiosksSummary.push({
        id: out._id,
        outletId: out.outletId,
        name: out.name,
        location: out.location?.address || out.location?.city || '',
        isOnline: out.isActive !== false,
        todayRevenue,
        todayOrders: todayOrders.length,
        avgOrderValue: todayOrders.length > 0 ? Math.round(todayRevenue / todayOrders.length) : 0,
      });
    }

    // Get recent daily ledgers across mapped outlets
    const recentLedgers = await DailyLedger.find({
      outlet: { $in: outlets.map((o) => o._id) },
    })
      .populate('outlet', 'name outletId')
      .sort({ date: -1 })
      .limit(30);

    // Get payout summaries (Paid vs Pending/Processing)
    const payouts = await InvestorPayout.find({ investor: investor._id })
      .populate('outlet', 'name outletId')
      .sort({ createdAt: -1 });
    const totalPaidOut = payouts
      .filter(p => p.status === 'Paid')
      .reduce((sum, p) => sum + p.netPayout, 0);

    const pendingPayout = payouts
      .filter(p => ['Pending', 'Processing'].includes(p.status))
      .reduce((sum, p) => sum + p.netPayout, 0);

    // Calculate current month's estimated accrual so far
    let currentMonthAccrual = 0;
    let mtdDetails = null;
    if (outlets.length > 0) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const startStr = `${year}-${month}-01`;
      const endStr = now.toISOString().split('T')[0];

      try {
        mtdDetails = await calculateInvestorPayoutDetails(investor, startStr, endStr);
        currentMonthAccrual = mtdDetails.netPayout;
      } catch (err) {
        console.error('Error estimating current month accrual:', err.message);
      }
    }

    res.json({
      success: true,
      investor: {
        id: investor._id,
        name: investor.name,
        email: investor.email,
        phone: investor.phone,
        investmentAmount: investor.investmentAmount || 0,
        assuredReturnRate: investor.assuredReturnRate || 18,
        profitSharePercentage: investor.profitSharePercentage || 50,
      },
      outlet: investor.outlet ? {
        id: investor.outlet._id,
        name: investor.outlet.name,
        outletId: investor.outlet.outletId,
      } : (outlets[0] ? { id: outlets[0]._id, name: outlets[0].name, outletId: outlets[0].outletId } : null),
      kiosks: kiosksSummary,
      dailyLedgers: recentLedgers,
      payouts,
      mtdDetails,
      stats: {
        totalPaidOut,
        pendingPayout,
        currentMonthAccrual
      }
    });
  } catch (error) {
    console.error('Error fetching investor stats:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/investors/payouts
// @desc    Get payout history for an investor
// @access  Investor, Admin, Company Admin
router.get('/payouts', authenticate, async (req, res) => {
  try {
    let query = {};

    if (['Investor', 'Investment Partner'].includes(req.user.role)) {
      query.investor = req.user.id;
    } else if (['Admin', 'Company Admin'].includes(req.user.role)) {
      if (req.query.investorId) {
        query.investor = req.query.investorId;
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { limit = 20, status } = req.query;
    if (status) {
      query.status = status;
    }

    const payouts = await InvestorPayout.find(query)
      .populate('investor', 'name email phone')
      .populate('outlet', 'name outletId')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(payouts);
  } catch (error) {
    console.error('Error fetching investor payouts:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/investors/payouts
// @desc    Create/Record a new investor payout (Admin only)
// @access  Admin, Company Admin
router.post('/payouts', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { investorId, periodStart, periodEnd, notes } = req.body;

    if (!investorId || !periodStart || !periodEnd) {
      return res.status(400).json({ message: 'investorId, periodStart, and periodEnd are required' });
    }

    const investor = await User.findById(investorId);
    if (!investor || !['Investor', 'Investment Partner'].includes(investor.role)) {
      return res.status(404).json({ message: 'Investor not found or invalid role' });
    }

    if (!investor.outlet) {
      return res.status(400).json({ message: 'Investor is not linked to an outlet' });
    }

    // Run the calculation helper
    const calc = await calculateInvestorPayoutDetails(investor, periodStart, periodEnd);

    // Save payout record
    const payout = new InvestorPayout({
      investor: investorId,
      outlet: investor.outlet,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalOutletProfit: calc.totalOutletProfit,
      profitShareAmount: calc.profitShareAmount,
      assuredReturnAmount: calc.assuredAmount,
      netPayout: calc.netPayout,
      notes: notes || null,
      createdBy: req.user.id,
      status: 'Pending',
    });

    const saved = await payout.save();
    const populated = await InvestorPayout.findById(saved._id)
      .populate('investor', 'name email')
      .populate('outlet', 'name')
      .populate('createdBy', 'name');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error saving investor payout:', error.message);
    res.status(400).json({ message: error.message || 'Bad Request' });
  }
});

// @route   PATCH /api/investors/payouts/:payoutId/status
// @desc    Update payout status (Admin only)
// @access  Admin
router.patch('/payouts/:payoutId/status', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Processing', 'Paid', 'Failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const update = { status };
    if (status === 'Paid') {
      update.paidAt = new Date();
    }

    const payout = await InvestorPayout.findByIdAndUpdate(
      req.params.payoutId,
      update,
      { new: true }
    )
      .populate('investor', 'name email')
      .populate('outlet', 'name')
      .populate('createdBy', 'name');

    if (!payout) {
      return res.status(404).json({ message: 'Payout record not found' });
    }

    res.json(payout);
  } catch (error) {
    console.error('Error updating payout status:', error.message);
    res.status(400).json({ message: error.message });
  }
});

export default router;
