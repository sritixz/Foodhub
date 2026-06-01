import { useState, useRef } from 'react';
import api from '../utils/api';
import Button from './UI/Button';

const ImageUpload = ({
  label = 'Image',
  value = null,
  onChange,
  folder = 'menu-items',
  maxSize = 5 * 1024 * 1024, // 5MB
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      setError(`File size must be less than ${maxSize / 1024 / 1024}MB`);
      return;
    }

    setError('');
    setUploading(true);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    try {
      // Upload to S3 via backend
      const fieldName = folder === 'menu-items' ? 'image' : 'logo';
      const formData = new FormData();
      formData.append(fieldName, file);

      const endpoint = folder === 'menu-items' ? '/upload/menu-items' : '/upload/outlet-logo';
      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.url) {
        onChange(response.data.url);
        setPreview(response.data.url);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-800/50 relative">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="max-h-48 mx-auto rounded-lg object-cover"
            />
            {!uploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors"
                aria-label="Remove image"
              >
                <span className="material-icons-outlined text-sm">close</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            <span className="material-icons-outlined text-4xl text-slate-300 dark:text-slate-600">
              image
            </span>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-slate-400 mt-1">
              PNG, JPG up to {maxSize / 1024 / 1024}MB
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />

        {uploading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Uploading...</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

export default ImageUpload;
