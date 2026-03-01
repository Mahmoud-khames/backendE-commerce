const MongooseFeatures = require('./mongodb/features/index');
const AppError = require('../utils/AppError');
const UserModel = require('../models/userModel');
const { pick } = require('lodash');

class AuthService extends MongooseFeatures {
  constructor() {
    super();
    this.keys = ['firstName','lastName','email','password','role','verified','userImage'];
  }

  async GetUsers(query = {}) {
    const { perPage, page, sorts = [], queries = [] } = pick(query, ['perPage','page','sorts','queries']);
    const result = await this.PaginateHandler(UserModel, Number(perPage)||15, Number(page)||1, sorts, queries);
    return { result, keys: this.keys.slice().sort() };
  }

  async GetOneUser(id) {
    const user = await UserModel.findById(id);
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async AddUser(body) {
    const payload = pick(body, this.keys);
    return this.addDocument(UserModel, payload);
  }

  async EditUser(id, body) {
    const payload = pick(body, this.keys);
    return this.editDocument(UserModel, id, payload);
  }

  async DeleteUser(id) {
    return this.deleteDocument(UserModel, id);
  }
}

module.exports = new AuthService();
