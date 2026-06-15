import express from 'express';
import Lead from '../models/Lead.js';
import FranchiseRequest from '../models/FranchiseRequest.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

// ========== PUBLIC ROUTES ==========

// POST /api/leads/menu-lead — Create menu download lead
router.post('/menu-lead', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }

    const lead = new Lead({ name, phone, type: 'menu_download' });
    const savedLead = await lead.save();
    res.status(201).json(savedLead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/leads/franchise-request — Create franchise request
router.post('/franchise-request', async (req, res) => {
  try {
    const { name, phone, city, message } = req.body;

    if (!name || !phone || !city) {
      return res.status(400).json({ message: 'Name, phone, and city are required' });
    }

    const request = new FranchiseRequest({ name, phone, city, message });
    const savedRequest = await request.save();
    res.status(201).json(savedRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/leads/newsletter-subscribe — Create newsletter subscriber
router.post('/newsletter-subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const lead = new Lead({ email, type: 'newsletter_subscribe' });
    const savedLead = await lead.save();
    res.status(201).json(savedLead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========== PROTECTED ROUTES (Company Admin / Admin) ==========

// GET /api/leads/menu-leads — List all menu download leads
router.get('/menu-leads', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { type: 'menu_download' };

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const leads = await Lead.find(filter).sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/leads/franchise-requests — List all franchise requests
router.get('/franchise-requests', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { status, city, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const requests = await FranchiseRequest.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/leads/newsletter-subscribers — List all newsletter subscribers
router.get('/newsletter-subscribers', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { type: 'newsletter_subscribe' };

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const leads = await Lead.find(filter).sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/leads/menu-leads/:id — Update menu lead
router.patch('/menu-leads/:id', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;

    const lead = await Lead.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/leads/franchise-requests/:id — Update franchise request
router.patch('/franchise-requests/:id', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { status, assignedTo, notes } = req.body;
    const update = {};
    if (status) update.status = status;
    if (assignedTo !== undefined) update.assignedTo = assignedTo;
    if (notes !== undefined) update.notes = notes;

    const request = await FranchiseRequest.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('assignedTo', 'name email');
    if (!request) {
      return res.status(404).json({ message: 'Franchise request not found' });
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/leads/newsletter-subscribers/:id — Update newsletter subscriber
router.patch('/newsletter-subscribers/:id', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const update = {};
    if (status) update.status = status;

    const lead = await Lead.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!lead) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
