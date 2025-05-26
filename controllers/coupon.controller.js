const couponModel = require("../models/couponModel");

class Coupon {
  async getAllCoupons(req, res) {
    try {
      const coupons = await couponModel.find();
      return res.json({ coupons });
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to get coupons" });
    }
  }
  async getCouponById(req, res) {
    const { id } = req.params;
    const coupon = await couponModel.findById(id);
    try {
      if (coupon) {
        return res.json({ coupon });
      } else {
        return res.json({ error: "Coupon not found" });
      }
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to get coupon" });
    }
  }
  async createCoupon(req, res) {
    const { code, discount, expiry, status, maxUses } = req.body;
    try {
      const coupon = await couponModel.create({ 
        code, 
        discount, 
        expiry, 
        status: status !== undefined ? status : true,
        maxUses: maxUses || 0
      });
      if (coupon) {
        return res.json({ success: "Coupon created successfully", coupon });
      } else {
        return res.json({ error: "Failed to create coupon" });
      }
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to create coupon" });
    }
  }

  async updateCoupon(req, res) {
    const { id } = req.params;
    const { code, discount, expiry, status, maxUses } = req.body;
    try {
      const coupon = await couponModel.findByIdAndUpdate(
        id, 
        { code, discount, expiry, status, maxUses },
        { new: true }
      );
      if (coupon) {
        return res.json({ success: "Coupon updated successfully", coupon });
      } else {
        return res.json({ error: "Coupon not found" });
      }
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to update coupon" });
    }
  }

  async deleteCoupon(req, res) {    
    const { id } = req.params;
    try {
      const coupon = await couponModel.findByIdAndDelete(id);
      if (coupon) {
        return res.json({ success: "Coupon deleted successfully" });
      } else {
        return res.json({ error: "Coupon not found" });
      }
    } catch (error) {
      console.log(error);
      return res.json({ error: "Failed to delete coupon" });
    }
  }

  async validateCoupon(req, res) {
    const { code } = req.params;
    try {
      const coupon = await couponModel.findOne({ code });
      
      if (!coupon) {
        return res.json({ valid: false, message: "Coupon not found" });
      }
      
      // Check if coupon is active
      if (!coupon.status) {
        return res.json({ valid: false, message: "Coupon is inactive" });
      }
      
      // Check if coupon is expired
      const now = new Date();
      if (now > new Date(coupon.expiry)) {
        return res.json({ valid: false, message: "Coupon has expired" });
      }
      
      return res.json({ valid: true, coupon });
    } catch (error) {
      console.log(error);
      return res.json({ valid: false, message: "Error validating coupon" });
    }
  }

  async calculateDiscount(req, res) {
    const { code } = req.params;
    const { total } = req.query;
    
    if (!total || isNaN(total)) {
      return res.json({ error: "Invalid total amount" });
    }
    
    try {
      const coupon = await couponModel.findOne({ code });
      
      if (!coupon) {
        return res.json({ error: "Coupon not found" });
      }
      
      if (!coupon.status) {
        return res.json({ error: "Coupon is inactive" });
      }
      
      const now = new Date();
      if (now > new Date(coupon.expiry)) {
        return res.json({ error: "Coupon has expired" });
      }
      
      const discountAmount = (parseFloat(total) * coupon.discount) / 100;
      const discountedTotal = parseFloat(total) - discountAmount;
      
      return res.json({ 
        discount: discountAmount, 
        discountedTotal,
        discountPercentage: coupon.discount
      });
    } catch (error) {
      console.log(error);
      return res.json({ error: "Error calculating discount" });
    }
  }
}

const couponController = new Coupon();
module.exports = couponController;
