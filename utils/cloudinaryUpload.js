const cloudinary = require('cloudinary').v2;
const streamifier = require("streamifier");

// إعدادات Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * رفع buffer إلى Cloudinary
 */
const uploadToCloudinary = (buffer, folder = 'general', resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format
        });
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * حذف صورة من Cloudinary
 */
const deleteFromCloudinary = async (publicId, folder = 'general') => {
  try {
    if (publicId.includes('/')) {
      const parts = publicId.split('/');
      publicId = parts[parts.length - 1];
    }
    const fullPublicId = publicId.includes(folder) ? publicId : `${folder}/${publicId}`;
    const result = await cloudinary.uploader.destroy(fullPublicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * رفع صور متعددة
 */
const uploadMultipleToCloudinary = async (fileBuffers, folder = 'general') => {
  try {
    const uploadPromises = fileBuffers.map(buffer => uploadToCloudinary(buffer, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple files to Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadMultipleToCloudinary
};
