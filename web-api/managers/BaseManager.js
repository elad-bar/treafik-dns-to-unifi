"use strict";

/**
 * Base class for all managers (Level 2). Orchestration managers extend this directly.
 * Domain, Formatting, and Processing managers extend specialized subclasses.
 */
class BaseManager {
  /**
   * @param {string} name - Class name for logging.
   * @param {import("../services/logger")} logger - Root logger (required).
   */
  constructor(name, logger) {
    this.className = name;
    this.logger = logger.child({ className: this.className });
  }
}

module.exports = { BaseManager };
