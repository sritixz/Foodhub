import express from 'express';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';
import MakerCheckerRequest from '../models/MakerCheckerRequest.js';

const router = express.Router();

// Helper to determine if a checker is authorized to check a maker's request
const canCheck = (checkerRole, makerRole, targetModel) => {
  if (checkerRole === 'Owner') {
    return true;
  }
  if (checkerRole === 'Management') {
    return ['Outlet Sales Representative', 'Central Kitchen Manager', 'Driver'].includes(makerRole);
  }
  if (checkerRole === 'Central Kitchen Manager') {
    return makerRole === 'Outlet Sales Representative' && ['Inventory', 'DailyLedger', 'MenuItem'].includes(targetModel);
  }
  return false;
};

// GET /api/maker-checker/pending - List pending requests for checkers
router.get('/pending', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager'), async (req, res) => {
  try {
    const pending = await MakerCheckerRequest.find({ status: 'Pending' })
      .populate('maker', 'name role email')
      .sort({ createdAt: 1 });

    // Filter pending list based on current user's checker capabilities
    const filtered = pending.filter((request) => {
      if (!request.maker) return false;
      return canCheck(req.user.role, request.maker.role, request.targetModel);
    });

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving pending requests', error: error.message });
  }
});

// POST /api/maker-checker/:id/approve - Approve request, executing the database operation
router.post('/:id/approve', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager'), async (req, res) => {
  try {
    const request = await MakerCheckerRequest.findById(req.params.id).populate('maker', 'name role email');
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({ message: `Request is already ${request.status}` });
    }

    // 1. Authorize checker
    if (!canCheck(req.user.role, request.maker.role, request.targetModel)) {
      return res.status(403).json({ message: 'You are not authorized to check/approve this request' });
    }

    const { actionType, targetModel, targetId, proposedData } = request;

    // 2. Perform the database operation dynamically based on actionType
    console.log(`Executing approved action: ${actionType} on model ${targetModel}`);
    
    if (actionType === 'CREATE_USER') {
      const User = (await import('../models/User.js')).default;
      const bcrypt = (await import('bcryptjs')).default;
      const { password, ...userData } = proposedData.body;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await User.create({ ...userData, password: hashedPassword });
    } 
    else if (actionType === 'UPDATE_USER') {
      const User = (await import('../models/User.js')).default;
      const bcrypt = (await import('bcryptjs')).default;
      const { password, ...updateData } = proposedData.body;
      if (password) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(password, salt);
      }
      const updated = await User.findByIdAndUpdate(targetId, updateData, { new: true, runValidators: true });
      if (!updated) throw new Error('Target user not found for update');
    } 
    else if (actionType === 'DELETE_USER') {
      const User = (await import('../models/User.js')).default;
      await User.findByIdAndDelete(targetId);
    }
    else if (actionType === 'CREATE_MENU_ITEM') {
      const MenuItem = (await import('../models/MenuItem.js')).default;
      await MenuItem.create(proposedData.body);
    }
    else if (actionType === 'UPDATE_MENU_ITEM') {
      const MenuItem = (await import('../models/MenuItem.js')).default;
      const updated = await MenuItem.findByIdAndUpdate(targetId, proposedData.body, { new: true, runValidators: true });
      if (!updated) throw new Error('Target menu item not found for update');
    }
    else if (actionType === 'DELETE_MENU_ITEM') {
      const MenuItem = (await import('../models/MenuItem.js')).default;
      await MenuItem.findByIdAndDelete(targetId);
    }
    else if (actionType === 'TOGGLE_MENU_ITEM_STATUS') {
      const MenuItem = (await import('../models/MenuItem.js')).default;
      const updated = await MenuItem.findByIdAndUpdate(targetId, { status: proposedData.body.status }, { new: true, runValidators: true });
      if (!updated) throw new Error('Target menu item not found for status toggle');
    }
    else if (actionType === 'CREATE_INVENTORY_ITEM') {
      const Inventory = (await import('../models/Inventory.js')).default;
      await Inventory.create(proposedData.body);
    }
    else if (actionType === 'UPDATE_INVENTORY_ITEM') {
      const Inventory = (await import('../models/Inventory.js')).default;
      const updated = await Inventory.findByIdAndUpdate(targetId, proposedData.body, { new: true, runValidators: true });
      if (!updated) throw new Error('Target inventory item not found for update');
    }
    else if (actionType === 'ADJUST_INVENTORY_QUANTITY') {
      const Inventory = (await import('../models/Inventory.js')).default;
      const { quantity, operation } = proposedData.body;
      const item = await Inventory.findById(targetId);
      if (!item) throw new Error('Target inventory item not found for quantity adjustment');
      
      if (operation === 'add') {
        item.quantity += quantity;
      } else if (operation === 'subtract') {
        item.quantity = Math.max(0, item.quantity - quantity);
      } else {
        item.quantity = quantity;
      }
      item.lastUpdated = new Date();
      await item.save();
    }
    else if (actionType === 'DELETE_INVENTORY_ITEM') {
      const Inventory = (await import('../models/Inventory.js')).default;
      await Inventory.findByIdAndDelete(targetId);
    }
    else if (actionType === 'SUBMIT_DAILY_LEDGER') {
      const DailyLedger = (await import('../models/DailyLedger.js')).default;
      const { date, outlet, items, collections, expenses, financials } = proposedData.body;
      
      let ledger = await DailyLedger.findOne({ date, outlet });
      if (ledger) {
        ledger.items = items;
        ledger.collections = collections;
        ledger.expenses = expenses;
        ledger.financials = financials;
        ledger.submittedBy = request.maker;
        ledger.status = 'Approved';
        await ledger.save();
      } else {
        await DailyLedger.create({
          date,
          outlet,
          submittedBy: request.maker,
          items,
          collections,
          expenses,
          financials,
          status: 'Approved'
        });
      }
    }
    else {
      return res.status(400).json({ message: `Unsupported action type: ${actionType}` });
    }

    // 3. Mark request as Approved
    request.status = 'Approved';
    request.checker = req.user._id;
    request.comments = req.body.comments || 'Approved';
    await request.save();

    res.json({ message: 'Request approved and changes applied successfully.', request });
  } catch (error) {
    console.error('Approval execution error:', error);
    res.status(500).json({ message: 'Error applying approved changes', error: error.message });
  }
});

// POST /api/maker-checker/:id/reject - Reject request
router.post('/:id/reject', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager'), async (req, res) => {
  try {
    const request = await MakerCheckerRequest.findById(req.params.id).populate('maker', 'name role email');
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({ message: `Request is already ${request.status}` });
    }

    // Authorize checker
    if (!canCheck(req.user.role, request.maker.role, request.targetModel)) {
      return res.status(403).json({ message: 'You are not authorized to check/reject this request' });
    }

    // Mark request as Rejected
    request.status = 'Rejected';
    request.checker = req.user._id;
    request.comments = req.body.comments || 'Rejected';
    await request.save();

    res.json({ message: 'Request rejected successfully.', request });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting request', error: error.message });
  }
});

export default router;
