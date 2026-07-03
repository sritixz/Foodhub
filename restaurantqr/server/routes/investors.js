import express from 'express';
import User from '../models/User.js';
import DailyLedger from '../models/DailyLedger.js';
import InvestorPayout from '../models/InvestorPayout.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roleAuth.js';

const router = express.Router();

// Placeholder for router setup validation
router.get('/test', authenticate, (req, res) => {
  res.json({ message: 'Investor routes connected successfully', user: req.user.name });
});

export default router;
