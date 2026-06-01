import multer from 'multer';
import { uploadToS3 } from '../utils/s3Upload.js';

// Configure multer to store files in memory
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Middleware to upload single file to S3
export const uploadSingleToS3 = (fieldName, folder) => {
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      if (!req.file) {
        return next();
      }

      try {
        const result = await uploadToS3(req.file.buffer, req.file.mimetype, folder);
        req.file.s3Key = result.key;
        req.file.s3Url = result.url;
        next();
      } catch (error) {
        return res.status(500).json({ message: 'File upload failed', error: error.message });
      }
    });
  };
};

// Middleware to upload multiple files to S3
export const uploadMultipleToS3 = (fieldName, folder, maxCount = 10) => {
  return async (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return next();
      }

      try {
        const uploadPromises = req.files.map(file =>
          uploadToS3(file.buffer, file.mimetype, folder)
        );
        const results = await Promise.all(uploadPromises);
        
        req.files = req.files.map((file, index) => ({
          ...file,
          s3Key: results[index].key,
          s3Url: results[index].url,
        }));
        
        next();
      } catch (error) {
        return res.status(500).json({ message: 'File upload failed', error: error.message });
      }
    });
  };
};

export default upload;
