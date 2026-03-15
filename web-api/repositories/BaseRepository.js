"use strict";

/**
 * Abstract base for repositories (Level 3). Atomic data access only; no business logic.
 * Subclasses implement read/write or query methods that perform single operations.
 */
class BaseRepository {
  /**
   * @param {import("../services/logger")} logger - Logger.
   */
  constructor(logger) {
    if (this.constructor === BaseRepository) {
      throw new TypeError("BaseRepository is abstract");
    }
    this.logger = logger;
  }
}

module.exports = { BaseRepository };
