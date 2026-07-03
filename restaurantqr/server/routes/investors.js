import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import DailyLedger from '../models/DailyLedger.js';
import InvestorPayout from '../models/InvestorPayout.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roleAuth.js';

const router = express.Router();

// Helper to calculate investor payout details
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

  // Find daily ledgers within range
  const ledgers = await DailyLedger.find({
    outlet: investor.outlet,
    date: { $gte: startStr, $lte: endStr },
    status: { $in: ['Submitted', 'Approved'] } // Include submitted and approved ledgers
  });

  let totalOutletProfit = 0;
  ledgers.forEach(ledger => {
    totalOutletProfit += ledger.financials?.netProfit || 0;
  });

  const profitShareAmount = totalOutletProfit * ((investor.profitSharePercentage || 50) / 100);
  const netPayout = Math.max(profitShareAmount, assuredAmount);

  return {
    daysInPeriod,
    totalOutletProfit,
    profitShareAmount,
    assuredAmount,
    netPayout
  };
};

// @route   POST /api/investors/calculate-payout
// @desc    Calculate potential investor payout for a date range
// @access  Admin, Company Admin
router.post('/calculate-payout', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { investorId, periodStart, periodEnd } = req.body;

    if (!investorId || !periodStart || !periodEnd) {
      return res.status(400).json({ message: 'investorId, periodStart, and periodEnd are required' });
    }

    const investor = await User.findById(investorId).populate('outlet', 'name outletId');
    if (!investor) {
      return res.status(404).json({ message: 'Investor not found' });
    }

    if (investor.role !== 'Investor') {
      return res.status(400).json({ message: 'User is not registered as an Investor' });
    }

    if (!investor.outlet) {
      return res.status(400).json({ message: 'Investor is not linked to any outlet' });
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
      outlet: {
        id: investor.outlet._id,
        name: investor.outlet.name,
        outletId: investor.outlet.outletId,
      },
      periodStart,
      periodEnd,
      ...calculation
    });
  } catch (error) {
    console.error('Error calculating investor payout:', error.message);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
});

export default router;
