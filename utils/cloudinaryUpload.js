const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const streamifier = require("streamifier");
// تكوين Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});



/**
 * رفع Buffer إلى Cloudinary مباشرة
 * @param {Buffer} buffer - بيانات الصورة في شكل buffer
 * @param {string} folder - اسم المجلد
 * @param {string} resourceType - نوع المورد
 * @returns {Promise<object>}
 */
const uploadToCloudinary  = (buffer, folder = 'general', resourceType = 'image') => {
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
 * حذف ملف من Cloudinary
 * @param {string} publicId - معرف الملف العام في Cloudinary
 * @param {string} folder - اسم المجلد في Cloudinary
 * @returns {Promise<object>} - نتيجة الحذف من Cloudinary
 */
const deleteFromCloudinary = async (publicId, folder = 'general') => {
  try {
    // إذا كان publicId يحتوي على URL كامل، استخرج معرف الملف فقط
    if (publicId.includes('/')) {
      const parts = publicId.split('/');
      publicId = parts[parts.length - 1];
    }
    
    // تأكد من أن المعرف يتضمن اسم المجلد
    const fullPublicId = publicId.includes(folder) ? publicId : `${folder}/${publicId}`;
    
    const result = await cloudinary.uploader.destroy(fullPublicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * رفع صور متعددة إلى Cloudinary
 * @param {Array<string>} filePaths - مسارات الملفات المحلية
 * @param {string} folder - اسم المجلد في Cloudinary
 * @returns {Promise<Array<object>>} - نتائج الرفع من Cloudinary
 */
const uploadMultipleToCloudinary = async (filePaths, folder = 'general') => {
  try {
    const uploadPromises = filePaths.map(filePath => uploadToCloudinary(filePath, folder));
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
