const { toTitleCase, validateEmail } = require("../config/function");
const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const crypto = require("crypto");
const { sendPasswordResetEmail, sendVerificationEmail } = require("../utils/emailService");

class Auth {
  /* User Registration controller */
  async register(req, res, next) {
    let {
      firstName,
      lastName,
      email,
      password,
      cPassword,
      phone,
      role = "user",
      locale = "en"
    } = req.body;

    if (!firstName || !lastName || !email || !password || !cPassword) {
      return next(new AppError("All fields are required", 400));
    }

    if (firstName.length < 3 || firstName.length > 25) {
      return next(new AppError("First name must be 3-25 characters", 400));
    }

    if (!validateEmail(email)) {
      return next(new AppError("Please provide a valid email", 400));
    }

    firstName = toTitleCase(firstName);
    lastName = toTitleCase(lastName);

    if (password !== cPassword) {
      return next(new AppError("Passwords do not match", 400));
    }

    if (password.length < 8 || password.length > 255) {
      return next(new AppError("Password must be at least 8 characters", 400));
    }

    try {
      const existingUser = await userModel.findOne({ email });
      if (existingUser) {
        return next(new AppError("Email already exists", 400));
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationTokenExpires = Date.now() + 3600000; // 1 hour
      
      const newUser = new userModel({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone,
        role,
        verified: false,
        verificationToken: verificationCode,
        verificationTokenExpires
      });
      
      await newUser.save();
      
      // Send verification email
      await sendVerificationEmail(email, verificationCode, locale);
      
      // Generate JWT token
      const token = jwt.sign(
        { _id: newUser._id, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { _id: newUser._id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      // Remove password from response
      const userResponse = newUser.toObject();
      delete userResponse.password;
      
      return res.status(201).json({
        success: true,
        message: "Registration successful. Please verify your email",
        token,
        refreshToken,
        user: userResponse
      });
    } catch (err) {
      console.error(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* User Login controller */
  async login(req, res, next) {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return next(new AppError("Email and password are required", 400));
    }
    
    try {
      const user = await userModel.findOne({ email }).select('+password');
      
      if (!user) {
        return next(new AppError("Invalid credentials", 401));
      }
      
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return next(new AppError("Invalid credentials", 401));
      }
      
      if (!user.verified) {
        return next(new AppError("Please verify your email first", 401));
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { _id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { _id: user._id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      // Remove password from response
      const userResponse = user.toObject();
      delete userResponse.password;
      
      return res.json({
        success: true,
        message: "Login successful",
        token,
        refreshToken,
        user: userResponse
      });
    } catch (err) {
      console.error(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Logout controller */
  async logout(req, res, next) {
    try {
      // In a production app, you might want to blacklist the token here
      return res.json({
        success: true,
        message: "Logout successful"
      });
    } catch (err) {
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Get Current User controller */
  async getCurrentUser(req, res, next) {
    try {
      const user = await userModel.findById(req.user._id).select('-password');
      
      if (!user) {
        return next(new AppError("User not found", 404));
      }
      
      return res.json({
        success: true,
        user
      });
    } catch (err) {
      console.error(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Update Profile controller */
  async updateProfile(req, res, next) {
    const { firstName, lastName, phone } = req.body;
    const userId = req.user._id;
    
    try {
      const updateData = {};
      
      if (firstName) {
        updateData.firstName = toTitleCase(firstName);
      }
      
      if (lastName) {
        updateData.lastName = toTitleCase(lastName);
      }
      
      if (phone) {
        updateData.phone = phone;
      }
      
      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');
      
      if (!updatedUser) {
        return next(new AppError("User not found", 404));
      }
      
      return res.json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser
      });
    } catch (err) {
      console.error(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Change Password controller */
  async changePassword(req, res, next) {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;
    
    if (!currentPassword || !newPassword) {
      return next(new AppError("Current password and new password are required", 400));
    }
    
    if (newPassword.length < 8) {
      return next(new AppError("Password must be at least 8 characters", 400));
    }
    
    try {
      const user = await userModel.findById(userId).select('+password');
      
      if (!user) {
        return next(new AppError("User not found", 404));
      }
      
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return next(new AppError("Current password is incorrect", 400));
      }
      
      user.password = bcrypt.hashSync(newPassword, 10);
      await user.save();
      
      return res.json({
        success: true,
        message: "Password changed successfully"
      });
    } catch (err) {
      console.error(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Get All Users - Admin */
  async getAllUsers(req, res, next) {
    try {
      const users = await userModel.find({}).select('-password');
      
      return res.json({
        success: true,
        users
      });
    } catch (err) {
      console.error(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  /* Check if Admin */
  async isAdmin(req, res, next) {
    const { loggedInUserId } = req.body;
    
    try {
      const user = await userModel.findById(loggedInUserId);
      
      if (!user) {
        return next(new AppError("User not found", 404));
      }
      
      return res.json({
        success: true,
        isAdmin: user.role === "admin"
      });
    } catch (err) {
      console.error(err);
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
        // Don't reveal if email exists for security
        return res.json({
          success: true,
          message: "If an account exists with this email, you will receive a password reset link"
        });
      }
      
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour
      
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpiry;
      await user.save();
      
      await sendPasswordResetEmail(email, resetToken, locale);
      
      return res.json({
        success: true,
        message: "Password reset link sent to your email"
      });
    } catch (err) {
      console.error(err);
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
      
      user.password = bcrypt.hashSync(password, 10);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      
      return res.json({
        success: true,
        message: "Password has been reset successfully"
      });
    } catch (err) {
      console.error(err);
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
        email,
        verificationToken: code,
        verificationTokenExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        return next(new AppError("Invalid or expired verification code", 400));
      }
      
      user.verified = true;
      user.verificationToken = null;
      user.verificationTokenExpires = null;
      await user.save();
      
      return res.json({
        success: true,
        message: "Email verified successfully. You can now login."
      });
    } catch (err) {
      console.error(err);
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
      
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationTokenExpires = Date.now() + 3600000; // 1 hour
      
      user.verificationToken = verificationCode;
      user.verificationTokenExpires = verificationTokenExpires;
      await user.save();
      
      await sendVerificationEmail(email, verificationCode, locale);
      
      return res.json({
        success: true,
        message: "New verification code sent to your email"
      });
    } catch (err) {
      console.error(err);
      return next(new AppError("Something went wrong", 500));
    }
  }
}

const authController = new Auth();
module.exports = authController;