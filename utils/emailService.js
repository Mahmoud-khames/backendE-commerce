const nodemailer = require('nodemailer');

// إعداد ناقل البريد الإلكتروني
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

// دالة لإرسال بريد إعادة تعيين كلمة المرور
const sendPasswordResetEmail = async (email, resetToken, locale = 'en') => {
  // إنشاء رابط إعادة تعيين كلمة المرور
  const resetUrl = `${process.env.FRONTEND_URL}/${locale}/auth/reset-password?token=${resetToken}`;
  
  // إعداد محتوى البريد الإلكتروني
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #DB4444; text-align: center;">
          ${locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Password Reset'}
        </h2>
        <p style="margin-bottom: 20px;">
          ${locale === 'ar' 
            ? 'لقد تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بك. انقر على الزر أدناه لإعادة تعيين كلمة المرور:'
            : 'We received a request to reset your password. Click the button below to reset your password:'}
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #DB4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            ${locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
          </a>
        </div>
        <p style="margin-bottom: 10px;">
          ${locale === 'ar'
            ? 'إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد الإلكتروني.'
            : 'If you did not request a password reset, please ignore this email.'}
        </p>
        <p style="color: #777; font-size: 12px; text-align: center; margin-top: 30px;">
          ${locale === 'ar' ? 'هذا بريد إلكتروني تلقائي، يرجى عدم الرد عليه.' : 'This is an automated email, please do not reply.'}
        </p>
      </div>
    `
  };

  // إرسال البريد الإلكتروني
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// دالة لإرسال بريد التحقق
const sendVerificationEmail = async (email, verificationCode, locale = 'en') => {
  // إعداد محتوى البريد الإلكتروني
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: locale === 'ar' ? 'تحقق من بريدك الإلكتروني' : 'Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #DB4444; text-align: center;">
          ${locale === 'ar' ? 'تحقق من بريدك الإلكتروني' : 'Verify Your Email'}
        </h2>
        <p style="margin-bottom: 20px;">
          ${locale === 'ar' 
            ? 'شكرًا للتسجيل! يرجى استخدام الرمز التالي للتحقق من بريدك الإلكتروني:'
            : 'Thank you for signing up! Please use the following code to verify your email:'}
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
            ${verificationCode}
          </div>
        </div>
        <p style="margin-bottom: 10px;">
          ${locale === 'ar'
            ? 'هذا الرمز صالح لمدة ساعة واحدة.'
            : 'This code is valid for one hour.'}
        </p>
        <p style="color: #777; font-size: 12px; text-align: center; margin-top: 30px;">
          ${locale === 'ar' ? 'هذا بريد إلكتروني تلقائي، يرجى عدم الرد عليه.' : 'This is an automated email, please do not reply.'}
        </p>
      </div>
    `
  };

  // إرسال البريد الإلكتروني
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent: ' + info.response);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail
};
