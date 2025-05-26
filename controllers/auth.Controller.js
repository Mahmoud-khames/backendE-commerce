const { toTitleCase, validateEmail } = require("../config/function");
const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const crypto = require("crypto");
const { sendPasswordResetEmail, sendVerificationEmail } = require("../utils/emailService");

class Auth { 
  async isAdmin(req, res, next) {
    let { loggedInUserId } = req.body;
    try {
      let loggedInUserRole = await userModel.findById(loggedInUserId);
      return res.json({
        role: loggedInUserRole.role === "admin" ? true : false,
      });
    } catch {
      return next(new AppError("Something went wrong", 500));
    }
  }

  async allUser(req, res, next) {
    try {
      let allUser = await userModel.find({});
      return res.json({ users: allUser });
    } catch {
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* User Registration/Signup controller  */
  async postSignup(req, res, next) {
    let {
      firstName,
      lastName,
      email,
      password,
      cPassword,
      role = "user",
      locale = "en"
    } = req.body;

    if (!firstName || !lastName || !email || !password || !cPassword) {
      return next(new AppError("Filed must not be empty", 400));
    }
    if (firstName.length < 3 || firstName.length > 25) {
      return next(new AppError("Name must be 3-25 charecter", 400));
    } else {
      if (validateEmail(email)) {
        firstName = toTitleCase(firstName);
        lastName = toTitleCase(lastName);
        if (password !== cPassword) {
          return next(
            new AppError("Password and confirm password do not match", 400)
          );
        }
        if ((password.length > 255) | (password.length < 8)) {
          return next(new AppError("Password must be 8 charecter", 400));
        } else {
          // If Email & Number exists in Database then:
          try {
            password = bcrypt.hashSync(password, 10);
            const data = await userModel.findOne({ email: email });
            if (data) {
              return next(new AppError("Email already exists", 400));
            } else {
              // Generate verification code (6 digits)
              const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
              const verificationTokenExpires = Date.now() + 3600000; // 1 hour
              
              let newUser = new userModel({
                firstName,
                lastName,
                email,
                password,
                role,
                verified: false,
                verificationToken: verificationCode,
                verificationTokenExpires: verificationTokenExpires
              });
              
              await newUser.save();
              
              // Send verification email
              const emailSent = await sendVerificationEmail(email, verificationCode, locale);
              
              if (!emailSent) {
                return next(new AppError("Failed to send verification email", 500));
              }
              
              return res.json({
                success: true,
                message: locale === 'ar' 
                  ? "تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني" 
                  : "Account created successfully. Please verify your email",
                userId: newUser._id
              });
            }
          } catch (err) {
            console.log(err)
            return next(new AppError("Something went wrong", 500));
          }
        }
      } else {
        error = {
          ...error,
          password: "",
          firstName: "",
          lastName: "",
          email: "Email is not valid",
        };
        console.log(error);
        return next(new AppError(error, 400)); 
      }
    }
  }

  /* User Login/Signin controller  */
  async postSignin(req, res, next) {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.json({
        error: "Fields must not be empty",
      });
    }
    try {
      const data = await userModel.findOne({ email: email });
      if (!data) {
        return next(new AppError("Invalid email or password", 400));
      } else {
        const login = await bcrypt.compare(password, data.password);
        if (login) {
          const token = jwt.sign(
            { _id: data._id, role: data.role },
            process.env.JWT_SECRET
          );
          const encode = jwt.verify(token, process.env.JWT_SECRET);
          return res.json({ 
            token: token,
            success: "Login successfully",
            data,
            user: encode,
          });
        } else {
          return next(new AppError("Invalid email or password", 400));
        }
      }
    } catch (err) {
      console.log(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Forgot Password controller */
  async forgotPassword(req, res, next) {
    const { email, locale = 'en' } = req.body;
    
    if (!email) {
      return next(new AppError("Email is required", 400));
    } 
    
    if (!validateEmail(email)) {
      return next(new AppError("Please provide a valid email", 400));
    }
    
    try {
      const user = await userModel.findOne({ email });
      
      if (!user) {
        return next(new AppError("User with this email does not exist", 404));
      }
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour
      
      // Save to user model
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpiry;
      await user.save();
      
      // Send email with reset link
      const emailSent = await sendPasswordResetEmail(email, resetToken, locale);
      
      if (!emailSent) {
        return next(new AppError("Failed to send reset email", 500));
      }
      
      return res.status(200).json({
        success: true,
        message: locale === 'ar' 
          ? "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني" 
          : "Password reset link sent to your email"
      });
    } catch (err) {
      console.log(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Reset Password controller */
  async resetPassword(req, res, next) {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return next(new AppError("Token and password are required", 400));
    }
    
    if (password.length < 8) {
      return next(new AppError("Password must be at least 8 characters", 400));
    }
    
    try {
      const user = await userModel.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        return next(new AppError("Invalid or expired token", 400));
      }
      
      // Update password
      user.password = bcrypt.hashSync(password, 10);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      
      return res.status(200).json({
        success: true,
        message: "Password has been reset successfully",
        // In production, don't send this in response
      });
    } catch (err) {
      console.log(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Verify Email controller */
  async verifyEmail(req, res, next) {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return next(new AppError("Email and verification code are required", 400));
    }
    
    try {
      const user = await userModel.findOne({
        email: email,
        verificationToken: code,
        verificationTokenExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        return next(new AppError("Invalid or expired verification code", 400));
      }
      
      // Update user verification status
      user.verified = true;
      user.verificationToken = null;
      user.verificationTokenExpires = null;
      await user.save();
      
      return res.status(200).json({
        success: true,
        message: "Email verified successfully. You can now login."
      });
    } catch (err) {
      console.log(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Resend Verification Code controller */
  async resendVerificationCode(req, res, next) {
    const { email, locale = 'en' } = req.body;
    
    if (!email) {
      return next(new AppError("Email is required", 400));
    }
    
    try {
      const user = await userModel.findOne({ email, verified: false });
      
      if (!user) {
        return next(new AppError("User not found or already verified", 404));
      }
      
      // Generate new verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationTokenExpires = Date.now() + 3600000; // 1 hour
      
      // Update user with new verification code
      user.verificationToken = verificationCode;
      user.verificationTokenExpires = verificationTokenExpires;
      await user.save();
      
      // Send verification email
      const emailSent = await sendVerificationEmail(email, verificationCode, locale);
      
      if (!emailSent) {
        return next(new AppError("Failed to send verification email", 500));
      }
      
      return res.status(200).json({
        success: true,
        message: locale === 'ar' 
          ? "تم إرسال رمز التحقق الجديد إلى بريدك الإلكتروني" 
          : "New verification code sent to your email"
      });
    } catch (err) {
      console.log(err);
      return next(new AppError("Something went wrong", 500));
    }
  }
}

const authController = new Auth();
module.exports = authController;
