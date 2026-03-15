"use strict";

/**
 * Base application error with HTTP status code for use in routes and managers.
 * All app-specific errors should extend this class.
 * @extends Error
 */
class AppError extends Error {
  /**
   * @param {string} message - Error message (client-safe).
   * @param {number} [statusCode=500] - HTTP status code.
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

module.exports = { AppError };
