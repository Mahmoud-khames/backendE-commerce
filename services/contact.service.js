const MongooseFeatures = require('./mongodb/features/index');
const ContactModel = require('../models/contactModel');
const { pick } = require('lodash');
const AppError = require('../utils/AppError');

class ContactService extends MongooseFeatures {
  constructor() { super(); this.keys = ['name','email','phone','message','status']; }

  async GetContacts(query = {}) {
    const { perPage, page, sorts = [], queries = [] } = pick(query, ['perPage','page','sorts','queries']);
    const result = await this.PaginateHandler(ContactModel, Number(perPage)||15, Number(page)||1, sorts, queries);
    return { result, keys: this.keys.slice().sort() };
  }

  async GetOneContact(id) {
    const c = await ContactModel.findById(id);
    if (!c) throw new AppError('Contact not found', 404);
    return c;
  }

  async AddContact(body) {
    const payload = pick(body, this.keys);
    return this.addDocument(ContactModel, payload);
  }

  async EditContact(id, body) {
    const payload = pick(body, this.keys);
    return this.editDocument(ContactModel, id, payload);
  }

  async DeleteContact(id) { return this.deleteDocument(ContactModel, id); }
}

module.exports = new ContactService();
