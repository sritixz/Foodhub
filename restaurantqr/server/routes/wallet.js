import express from 'express';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

// 1. Top-Up Wallet (Credits balance & appends ledger record)
router.post('/topup', async (req, res) => {
  try {
    const { amount, paymentMethod = 'UPI', referenceId } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid top-up amount greater than 0' });
    }

    // Try to get authenticated user, or fallback to first Customer for demo requests
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
      } catch (_) {}
    }

    if (!user) {
      user = await User.findOne({ role: 'Customer' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    user.walletBalance = (user.walletBalance || 0) + numAmount;
    if (!user.walletTransactions) user.walletTransactions = [];

    const newTx = {
      amount: numAmount,
      type: 'CREDIT',
      description: `Pantry Wallet Top-Up (${paymentMethod})`,
      date: new Date(),
    };
    user.walletTransactions.unshift(newTx);

    // Give loyalty reward points (1 point per ₹20 topped up)
    const pointsEarned = Math.floor(numAmount / 20);
    user.availablePoints = (user.availablePoints || 0) + pointsEarned;

    await user.save();

    res.json({
      success: true,
      message: `Successfully added ₹${numAmount.toFixed(2)} to MOPY Wallet!`,
      walletBalance: user.walletBalance,
      availablePoints: user.availablePoints,
      transaction: newTx,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get User Wallet Transactions
router.get('/transactions', async (req, res) => {
  try {
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
      } catch (_) {}
    }

    if (!user) {
      user = await User.findOne({ role: 'Customer' });
    }

    if (!user) {
      return res.json({ success: true, transactions: [], walletBalance: 0, availablePoints: 0 });
    }

    const txs = (user.walletTransactions || []).map((t, idx) => ({
      id: t._id ? t._id.toString() : `tx-${idx}`,
      title: t.description || 'Pantry Transaction',
      amount: t.type === 'DEBIT' ? `-₹${t.amount.toFixed(2)}` : `+₹${t.amount.toFixed(2)}`,
      type: t.type ? t.type.toLowerCase() : 'credit',
      isDebit: t.type === 'DEBIT',
      date: t.date ? new Date(t.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently',
    }));

    res.json({
      success: true,
      walletBalance: user.walletBalance || 0,
      availablePoints: user.availablePoints || 0,
      membership: user.membership || 'MOPY Corporate Gold',
      transactions: txs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get Wallet Balance & Points
router.get('/balance', async (req, res) => {
  try {
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
      } catch (_) {}
    }

    if (!user) {
      user = await User.findOne({ role: 'Customer' });
    }

    res.json({
      success: true,
      walletBalance: user?.walletBalance || 0,
      availablePoints: user?.availablePoints || 0,
      membership: user?.membership || 'MOPY Corporate Gold',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
