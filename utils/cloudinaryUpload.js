const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// تكوين Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * رفع ملف إلى Cloudinary
 * @param {string} filePath - مسار الملف المحلي
 * @param {string} folder - اسم المجلد في Cloudinary (مثل products, categories, users)
 * @param {string} resourceType - نوع المورد (image, video, raw)
 * @returns {Promise<object>} - نتيجة الرفع من Cloudinary
 */
const uploadToCloudinary = async (filePath, folder = 'general', resourceType = 'image') => {
  try {
    // إنشاء اسم فريد للملف باستخدام هاش
    const fileName = path.basename(filePath);
    const fileHash = crypto.createHash('md5').update(fileName + Date.now()).digest('hex').substring(0, 10);
    const publicId = `${folder}/${fileHash}`;

    // رفع الملف إلى Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: resourceType,
      public_id: publicId,
      folder: folder,
      overwrite: true
    });

    // حذف الملف المؤقت بعد الرفع
    fs.unlinkSync(filePath);
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format
    };
  } catch (error) {
    // حذف الملف المؤقت في حالة فشل الرفع
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
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
