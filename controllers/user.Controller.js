const path = require("path");
const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const AppError = require("../utils/AppError");

class User {
  async getAllUser(req, res, next) {
    try {
      const users = await userModel.find({isDeleted : false}).sort({ _id: -1 });

      res.status(200).json({
        success: true,
        message: "Users fetched successfully",
        users,
      });
    } catch (error) {
      next(new AppError("Failed to fetch users", 500));
    }
  }

  async getSingleUser(req, res, next) {
    const { uId } = req.params;
    if (!uId) {
      return next(new AppError("All filled must be required", 400));
    } else {
      try {
        const User = await userModel
          .findById(uId)
          .select("firstName lastName email phone updatedAt createdAt");
        if (User) {
          return res.json({ User });
        }
      } catch (err) {
        console.log(err);
      }
    }
  }

  async postAddUser(req, res, next) {
    let { firstName, lastName, email, phone, password, role } = req.body;
    if (!firstName || !lastName || !email || !phone || !password) {
      return next(new AppError("All fields must be required", 400));
    } else {
      try {
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
          return next(new AppError("User already exists", 400));
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        // إنشاء مستخدم جديد
        const newUser = new userModel({
          firstName,
          lastName,
          email,
          phone,
          password: hashedPassword,
          role: role || "user",
        });

        // معالجة الصورة إذا تم تحميلها
        if (req.files && req.files.length > 0) {
          const userImageFile = req.files.find(
            (f) => f.fieldname === "userImage"
          );
          if (userImageFile) {
            newUser.userImage = `/backend/uploads/users/${userImageFile.filename}`;
          }
        }

        await newUser.save();

        res.status(201).json({
          success: true,
          message: "User created successfully",
          user: newUser,
        });
      } catch (err) {
        console.error(err);
        return next(new AppError("Something went wrong", 500));
      }
    }
  }

  async postEditUser(req, res, next) {
    try {
      const { uId } = req.params;
      const { firstName, lastName, email, phone, password, role } = req.body;

      if (!firstName || !lastName || !email) {
        return next(new AppError("Name and email are required", 400));
      }
console.log(req.body);
      // البحث عن المستخدم
      const user = await userModel.findById(uId);
      if (!user) {
        return next(new AppError("User not found", 404));
      }

      // تحديث بيانات المستخدم
      const updateData = {
        firstName,
        lastName,
        email,
        phone,
        role: role ,
      };

      // تحديث كلمة المرور فقط إذا تم تقديمها وليست "currentpassword"
      if (password && password !== "currentpassword") {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateData.password = hashedPassword;
      }

      // معالجة الصورة إذا تم تحميلها
     console.log(req.files);
      if (req.files && req.files.length > 0) {
        const userImageFile = req.files.find(
          (f) => f.fieldname === "userImage"
        );
        console.log(userImageFile);
        if (userImageFile) {
          updateData.userImage = `/backend/uploads/users/${userImageFile.filename}`;
        }
      }

      // تحديث المستخدم
      const updatedUser = await userModel.findByIdAndUpdate(uId, updateData, {
        new: true,
        runValidators: true, 
      }); 
 
      res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (err) {
      console.error(err);
      return next(new AppError("Something went wrong", 500));
    }
  }

  async getDeleteUser(req, res, next) {
    const { uId } = req.params;    // تحديد المعرف المستخدم من الطلب
    if (!uId) {
      return next(new AppError("All filled must be required", 400));
    } else {
      const currentUser = await userModel.findByIdAndUpdate(uId, {
        isDeleted: true,
      });
      if (currentUser) {
        return res.json({ success: "User deleted successfully" });
      } else {
        return next(new AppError("User not found", 404));
      }
    } 
  }

  async changePassword(req, res, next) { 
    let { uId, oldPassword, newPassword } = req.body;
    if (!uId || !oldPassword || !newPassword) {
      return next(new AppError("All filled must be required", 400));
    } else {
      const data = await userModel.findOne({ _id: uId });
      if (!data) {
        return next(new AppError("Invalid user", 400));
      } else {
        const oldPassCheck = await bcrypt.compare(oldPassword, data.password);
        if (oldPassCheck) {
          newPassword = bcrypt.hashSync(newPassword, 10);
          let passChange = userModel.findByIdAndUpdate(uId, {
            password: newPassword,
          });
          passChange.exec((err, result) => {
            if (err) console.log(err);
            return res.json({ success: "Password updated successfully" });
          });
        } else {
          return next(new AppError("Your old password is wrong!!", 400));
        }
      }
    }
  }

  async getUsersCount(req, res, next) {
    try {
      const count = await userModel.countDocuments({ isDeleted: false });
      res.status(200).json({
        success: true,
        count
      });
    } catch (error) {
      console.error("Error counting users:", error);
      next(new AppError("Failed to count users", 500));
    }
  }
 
}

const ordersController = new User();
module.exports = ordersController;
