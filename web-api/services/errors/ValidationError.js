"use strict";

const { AppError } = require("./AppError");

/**
 * Validation error (HTTP 400). Use when request body or config fails validation.
 * @extends AppError
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Validation error message.
   */
  constructor(message) {
    super(message, 400);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

module.exports = { ValidationError };
