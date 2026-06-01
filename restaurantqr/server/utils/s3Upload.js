import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client, { BUCKET_NAME } from '../config/s3.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimetype - File MIME type
 * @param {string} folder - Folder path in S3 (e.g., 'menu-items', 'outlet-logos')
 * @returns {Promise<{key: string, url: string}>}
 */
export const uploadToS3 = async (fileBuffer, mimetype, folder = 'uploads') => {
  try {
    const fileExtension = mimetype.split('/')[1] || 'jpg';
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimetype,
      // ACL: 'public-read', // Removed as bucket does not support ACLs
    });

    await s3Client.send(command);

    // Return public URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${fileName}`;

    return {
      key: fileName,
      url: url,
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
export const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error('Failed to delete file from S3');
  }
};

/**
 * Get presigned URL for upload (for direct client uploads)
 * @param {string} folder - Folder path
 * @param {string} mimetype - File MIME type
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<{key: string, url: string}>}
 */
export const getPresignedUploadUrl = async (folder = 'uploads', mimetype = 'image/jpeg', expiresIn = 3600) => {
  try {
    const fileExtension = mimetype.split('/')[1] || 'jpg';
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      ContentType: mimetype,
      // ACL: 'public-read', // Removed as bucket does not support ACLs
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    return {
      key: fileName,
      url: url,
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate upload URL');
  }
};

/**
 * Extract S3 key from URL
 * @param {string} url - S3 public URL
 * @returns {string} S3 key
 */
export const extractKeyFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    // Remove leading slash
    return urlObj.pathname.substring(1);
  } catch (error) {
    // If URL parsing fails, try to extract key manually
    const match = url.match(/\.s3\.[^/]+\/(.+)$/);
    return match ? match[1] : null;
  }
};

/**
 * Upload base64 encoded image to S3
 * @param {string} base64Data - Base64 encoded image data (with or without data:image prefix)
 * @param {string} fileName - File name
 * @param {string} folder - Folder path in S3
 * @returns {Promise<string>} S3 URL
 */
export const uploadBase64ToS3 = async (base64Data, fileName, folder = 'uploads') => {
  try {
    // Remove data:image/png;base64, prefix if present
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');

    const key = `${folder}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
    });

    await s3Client.send(command);

    // Return public URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
    return url;
  } catch (error) {
    console.error('Error uploading base64 to S3:', error);
    throw new Error('Failed to upload base64 image to S3');
  }
};
