import express from 'express';
import QRCode from '../models/QRCode.js';
import Outlet from '../models/Outlet.js';
import MenuItem from '../models/MenuItem.js';
import QRCodeLib from 'qrcode';

const router = express.Router();

// Get QR code by data (for scanning)
router.get('/scan/:qrData', async (req, res) => {
  try {
    const { qrData } = req.params;
    const qrCode = await QRCode.findOne({ qrCodeData: qrData, isActive: true })
      .populate('outlet', 'name outletId logo');

    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found or inactive' });
    }

    // Update scan count
    qrCode.scanCount += 1;
    qrCode.lastScanned = new Date();
    await qrCode.save();

    // Get menu items for this outlet
    const menuItems = await MenuItem.find({
      $or: [
        { vendor: qrCode.outlet._id },
        { outlets: qrCode.outlet._id },
        { applyToAll: true },
      ],
      status: 'Available',
    })
      .populate('vendor', 'name outletId')
      .sort({ category: 1, name: 1 });

    res.json({
      qrCode,
      outlet: qrCode.outlet,
      menuItems,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get QR codes for an outlet
router.get('/outlet/:outletId', async (req, res) => {
  try {
    const { outletId } = req.params;
    const qrCodes = await QRCode.find({ outlet: outletId })
      .populate('outlet', 'name outletId')
      .sort({ createdAt: -1 });
    res.json(qrCodes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate QR code for outlet
router.post('/outlet/:outletId', async (req, res) => {
  try {
    const { outletId } = req.params;
    const { tableNumber } = req.body;

    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    // Generate frontend URL for QR code - Always use outlet ID only
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const publicUrl = `${frontendUrl}/qr/menu?outlet=${outletId}`;
    // Note: Table number is no longer used in the main URL to ensure consistency across all outlets

    const qrCodeImage = await QRCodeLib.toDataURL(publicUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
    });

    // Upload QR code to S3
    let s3Url = null;
    try {
      const { uploadBase64ToS3 } = await import('../utils/s3Upload.js');
      const fileName = `qr-${outletId}-${Date.now()}.png`;
      s3Url = await uploadBase64ToS3(qrCodeImage, fileName, 'qr-codes');
    } catch (s3Error) {
      console.error('S3 upload failed:', s3Error);
      // Continue even if S3 upload fails
    }

    // Create or update QR code - Always use outlet ID for consistency
    // Find the main QR code for this outlet (without table number)
    let qrCode = await QRCode.findOne({ outlet: outletId, tableNumber: null });

    if (qrCode) {
      // Update existing QR code with new image and URL
      qrCode.qrCodeImage = qrCodeImage;
      qrCode.publicUrl = publicUrl;
      qrCode.qrCodeData = `qr-${outletId}-${Date.now()}`; // Update qrCodeData to ensure uniqueness
      if (s3Url) qrCode.s3Url = s3Url;
      await qrCode.save();
    } else {
      // Create new QR code
      qrCode = new QRCode({
        outlet: outletId,
        tableNumber: null, // Always null for main outlet QR code
        qrCodeData: `qr-${outletId}-${Date.now()}`,
        qrCodeImage: qrCodeImage,
        publicUrl: publicUrl,
        s3Url: s3Url,
      });
      await qrCode.save();
    }

    // Update outlet with QR code URL
    outlet.qrCodeUrl = publicUrl;
    await outlet.save();

    res.json({
      qrCode,
      qrCodeImage,
      publicUrl,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get QR code image
router.get('/image/:qrData', async (req, res) => {
  try {
    const { qrData } = req.params;
    const qrCode = await QRCode.findOne({ qrCodeData: qrData });

    if (!qrCode || !qrCode.qrCodeImage) {
      return res.status(404).json({ message: 'QR code image not found' });
    }

    const base64Data = qrCode.qrCodeImage.replace(/^data:image\/png;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
    });
    res.end(imageBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle QR code active status
router.patch('/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    const qrCode = await QRCode.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).populate('outlet', 'name outletId');

    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found' });
    }
    res.json(qrCode);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
