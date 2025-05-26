class AppError extends Error {
  constructor(message, statusCode, errors = {}) {
    super(typeof message === 'string' ? message : 'Validation failed');
    this.statusCode = statusCode;
    this.errors = errors;
    
    if (typeof message === 'object') {
      this.errors = message.errors || {};
    }
  }
}

module.exports = AppError;