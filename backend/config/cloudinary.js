const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Uploads a file Buffer or file path to Cloudinary.
 * @param {Buffer|string} fileBufferOrPath - Buffer or path to the file to upload.
 * @param {object} [options] - Additional Cloudinary upload options.
 * @returns {Promise<{ url: string, publicId: string, format: string, resourceType: string }>}
 */
const uploadToCloudinary = (fileBufferOrPath, options = {}) => {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(
      new Error('Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured.')
    );
  }

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: 'medi-queue/reports',
      resource_type: 'auto',
      ...options,
    };

    if (Buffer.isBuffer(fileBufferOrPath)) {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format || result.resource_type,
          resourceType: result.resource_type,
        });
      });
      stream.end(fileBufferOrPath);
    } else {
      cloudinary.uploader.upload(fileBufferOrPath, uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format || result.resource_type,
          resourceType: result.resource_type,
        });
      });
    }
  });
};

/**
 * Deletes a file from Cloudinary by public ID.
 * @param {string} publicId - The Cloudinary public_id of the file to remove.
 */
const deleteFromCloudinary = async (publicId) => {
  if (!isCloudinaryConfigured() || !publicId) return;

  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    if (res && res.result === 'not found') {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    }
  } catch (error) {
    console.error(`Failed to delete file from Cloudinary (publicId: ${publicId}):`, error.message);
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
};

