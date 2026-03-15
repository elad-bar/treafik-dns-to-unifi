"use strict";

const { AppError } = require("./AppError");

/**
 * Not found error (HTTP 404). Use when a resource does not exist.
 * @extends AppError
 */
class NotFoundError extends AppError {
  /**
   * @param {string} [message='Not found'] - Error message.
   */
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

module.exports = { NotFoundError };
