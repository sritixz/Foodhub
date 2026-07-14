import express from 'express';
import authenticate from '../middleware/auth.js';
import { uploadSingleToS3, uploadMultipleToS3, uploadDocSingleToS3 } from '../middleware/upload.js';
import { deleteFromS3, extractKeyFromUrl } from '../utils/s3Upload.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client, { BUCKET_NAME } from '../config/s3.js';

const router = express.Router();

// Upload menu item image (protected - Vendor/Admin)
router.post('/menu-items', authenticate, uploadSingleToS3('image', 'menu-items'), async (req, res) => {
  try {
    // Check if user has permission (Vendor, Admin, or Company Admin / new counterparts)
    if (!['Vendor', 'Admin', 'Company Admin', 'Outlet Sales Representative', 'Owner', 'Management'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    res.json({
      message: 'File uploaded successfully',
      key: req.file.s3Key,
      url: req.file.s3Url,
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

// Upload outlet logo (protected - Admin/Company Admin)
router.post('/outlet-logo', authenticate, uploadSingleToS3('logo', 'outlet-logos'), async (req, res) => {
  try {
    // Check if user has permission
    if (!['Admin', 'Company Admin', 'Owner', 'Management'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    res.json({
      message: 'Logo uploaded successfully',
      key: req.file.s3Key,
      url: req.file.s3Url,
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

// Upload outlet documents (protected - Admin/Company Admin)
router.post('/outlet-documents', authenticate, uploadDocSingleToS3('document', 'outlet-documents'), async (req, res) => {
  try {
    if (!['Admin', 'Company Admin', 'Owner', 'Management'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.json({
      message: 'Document uploaded successfully',
      key: req.file.s3Key,
      url: req.file.s3Url,
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

// Generate presigned URL for viewing a file (protected)
router.post('/presigned-url', authenticate, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    // Extract S3 key from the URL
    const key = extractKeyFromUrl(url);
    if (!key) return res.status(400).json({ message: 'Invalid S3 URL' });

    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min

    res.json({ url: presignedUrl });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate presigned URL', error: error.message });
  }
});

// Delete image from S3 (protected)
router.delete('/:imageKey', authenticate, async (req, res) => {
  try {
    const { imageKey } = req.params;

    // Decode URL-encoded key
    const decodedKey = decodeURIComponent(imageKey);

    // If it's a full URL, extract the key
    const key = decodedKey.includes('amazonaws.com')
      ? extractKeyFromUrl(decodedKey)
      : decodedKey;

    if (!key) {
      return res.status(400).json({ message: 'Invalid image key or URL' });
    }

    await deleteFromS3(key);

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Delete failed', error: error.message });
  }
});

export default router;
