const MongooseFeatures = require('./mongodb/features/index');
const OrderModel = require('../models/orderModel');
const { pick } = require('lodash');
const AppError = require('../utils/AppError');

class StripeService extends MongooseFeatures {
  constructor() { super(); this.keys = ['stripePaymentId','paymentStatus','user','totalAmount','items']; }

  async GetPayments(query = {}) {
    const { perPage, page, sorts = [], queries = [] } = pick(query, ['perPage','page','sorts','queries']);
    const result = await this.PaginateHandler(OrderModel, Number(perPage)||15, Number(page)||1, sorts, queries);
    return { result, keys: this.keys.slice().sort() };
  }

  async GetOnePayment(id) {
    const p = await OrderModel.findById(id).populate('user', 'firstName lastName email');
    if (!p) throw new AppError('Payment not found', 404);
    return p;
  }

  async RecordPayment(body) {
    const payload = pick(body, this.keys);
    return this.addDocument(OrderModel, payload);
  }

  async EditPayment(id, body) { const payload = pick(body, this.keys); return this.editDocument(OrderModel, id, payload); }

  async DeletePayment(id) { return this.deleteDocument(OrderModel, id); }
}

module.exports = new StripeService();
