"use strict";

/**
 * Abstract base for repositories (Level 3). Atomic data access only; no business logic.
 * Subclasses implement read/write or query methods that perform single operations.
 */
class BaseRepository {
  /**
   * @param {string} name - Class name for logging.
   * @param {import("../services/logger")} logger - Root logger.
   */
  constructor(name, logger) {
    if (this.constructor === BaseRepository) {
      throw new TypeError("BaseRepository is abstract");
    }
    this.className = name;
    this.logger = logger.child({ className: this.className });
  }
}

module.exports = { BaseRepository };
