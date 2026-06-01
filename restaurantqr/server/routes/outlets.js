import express from 'express';
import Outlet from '../models/Outlet.js';
import QRCode from '../models/QRCode.js';
import { v4 as uuidv4 } from 'uuid';
import QRCodeLib from 'qrcode';
import authenticate from '../middleware/auth.js';
import { companyAdminOrAdmin } from '../middleware/roleAuth.js';

const router = express.Router();

// Get all outlets
router.get('/', async (req, res) => {
  try {
    const outlets = await Outlet.find().sort({ createdAt: -1 });
    res.json(outlets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single outlet
router.get('/:id', async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }
    res.json(outlet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create outlet (protected - Admin/Company Admin only)
router.post('/', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    const outletData = req.body;

    // Generate outlet ID if not provided - MORE ROBUST LOGIC
    if (!outletData.outletId) {
      const lastOutlet = await Outlet.findOne().sort({ outletId: -1 });
      let nextNumber = 1;
      if (lastOutlet && lastOutlet.outletId) {
        const match = lastOutlet.outletId.match(/OUT(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        } else {
          // If the format is different, fallback to count
          const count = await Outlet.countDocuments();
          nextNumber = count + 1;
        }
      }
      outletData.outletId = `OUT${String(nextNumber).padStart(3, '0')}`;
    }

    const outlet = new Outlet(outletData);
    const savedOutlet = await outlet.save();

    // Generate QR code for the outlet
    await generateQRCode(savedOutlet._id);

    res.status(201).json(savedOutlet);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update outlet (protected)
router.put('/:id', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    const outlet = await Outlet.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }
    res.json(outlet);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete outlet (protected - Admin only)
router.delete('/:id', authenticate, async (req, res) => {
  // Check if user is Admin
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Admin can delete outlets' });
  }
  try {
    const outlet = await Outlet.findByIdAndDelete(req.params.id);
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }
    res.json({ message: 'Outlet deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate QR code for outlet (protected)
router.post('/:id/qrcode', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    await generateQRCode(outlet._id);
    const updatedOutlet = await Outlet.findById(req.params.id);

    res.json({
      qrCodeUrl: updatedOutlet.qrCodeUrl,
      qrCode: updatedOutlet.qrCode,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to generate QR code
const generateQRCode = async (outletId) => {
  try {
    const outlet = await Outlet.findById(outletId);
    if (!outlet) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrData = uuidv4();
    const publicUrl = `${frontendUrl}/qr/menu?outlet=${outletId}`;

    // Generate QR code image
    const qrCodeImage = await QRCodeLib.toDataURL(publicUrl);

    // Save QR code data
    outlet.qrCode = qrData;
    outlet.qrCodeUrl = publicUrl;
    await outlet.save();

    // Create QR code record
    const existingQR = await QRCode.findOne({ outlet: outletId });
    if (existingQR) {
      existingQR.qrCodeData = qrData;
      existingQR.qrCodeImage = qrCodeImage;
      existingQR.publicUrl = publicUrl;
      await existingQR.save();
    } else {
      const qrCode = new QRCode({
        outlet: outletId,
        qrCodeData: qrData,
        qrCodeImage: qrCodeImage,
        publicUrl: publicUrl,
      });
      await qrCode.save();
    }

    return { qrCodeImage, publicUrl };
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

export default router;
