const stripe = require('../config/stripe');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const AppError = require('../utils/AppError');

exports.createCheckoutSession = async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return next(new AppError('Stripe configuration error', 500));
    }
    
    const { items, shippingAddress, phoneNumber, total, discount, coupon, locale } = req.body;
    
    if (!req.user || !req.user._id) {
      return next(new AppError('User not authenticated', 401));
    }
    
    const userId = req.user._id;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('No items provided', 400));
    }
    
    // إنشاء عناصر الدفع لـ Stripe
    const lineItems = items.map(item => {
      const priceData = {
        currency: 'usd',
        product_data: {
          name: item.name || 'Product',
        },
        unit_amount: Math.round((item.price || 0) * 100),
      };
      
      if (item.image) {
        priceData.product_data.images = [item.image];
      }
      
      if (item.description && item.description.trim() !== '') {
        priceData.product_data.description = item.description;
      }
      
      return {
        price_data: priceData,
        quantity: item.quantity || 1,
      };
    });
    
    // إعداد البيانات الوصفية
    const metadata = {
      userId: String(userId),
      shippingAddress: String(shippingAddress || ''),
      phoneNumber: String(phoneNumber || ''),
      totalAmount: String(total || 0),
      discountAmount: String(discount || 0),
      couponApplied: String(coupon || '')
    };
    
    // إنشاء جلسة الدفع
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/${locale || 'en'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/${locale || 'en'}/checkout/cancel`,
      metadata: metadata,
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'AE', 'SA', 'EG'],
      },
    });
    
    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Stripe session error:', error);
    next(new AppError('Failed to create payment session: ' + error.message, 500));
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Webhook event received:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    try {
      const { userId, shippingAddress, phoneNumber, totalAmount, discountAmount, couponApplied } = session.metadata || {};
      
      if (!userId) {
        console.error('No user ID in session metadata');
        return res.status(200).json({ received: true });
      }
      
      // الحصول على سلة المستخدم
      const cart = await Cart.findOne({ user: userId }).populate('items.product');
      
      if (!cart || !cart.items || cart.items.length === 0) {
        console.error('Cart not found or empty for user:', userId);
        return res.status(200).json({ received: true });
      }
      
      // إنشاء عناصر الطلب
      const orderItems = cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.price || item.product.price,
        size: item.size || '', 
        color: item.color || ''
      }));
       
      // إنشاء الطلب
      const order = await Order.create({
        items: orderItems,
        user: userId,
        totalAmount: parseFloat(totalAmount || 0),
        shippingAddress: shippingAddress || '',
        phoneNumber: phoneNumber || '', 
        paymentMethod: "Stripe",
        stripePaymentId: session.payment_intent,
        paymentStatus: "Paid",
        couponApplied: couponApplied || '',
        discountAmount: parseFloat(discountAmount || 0)
      });
      
      console.log('Order created successfully:', order._id);
      
      // تفريغ سلة التسوق
      await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [], totalPrice: 0, totalDiscount: 0 } }
      );
      
      console.log('Cart cleared for user:', userId);
    } catch (error) {
      console.error('Order creation error:', error);
    }
  }

  res.status(200).json({ received: true });
};

exports.paymentSuccess = async (req, res) => {
  const { session_id } = req.query;
  
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    res.redirect(`${process.env.FRONTEND_URL}/checkout/success?session_id=${session_id}`);
  } catch (error) {
    console.error('Payment success error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/checkout/error`);
  }
};

exports.paymentCancel = async (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/checkout/cancel`);
};

exports.verifyPayment = async (req, res, next) => {
  const { session_id } = req.query;
  
  if (!session_id) {
    return next(new AppError('Session ID is required', 400));
  }
  
  try {
    console.log('Verifying payment for session:', session_id);
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    console.log('Payment status:', session.payment_status);
    
    res.status(200).json({
      success: true,
      status: session.payment_status,
      customer: session.customer_details || {},
      metadata: session.metadata || {}
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    next(new AppError('Failed to verify payment', 500));
  }
};




