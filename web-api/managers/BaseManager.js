"use strict";

/**
 * Base class for all managers (Level 2). Orchestration managers extend this directly.
 * Domain, Formatting, and Processing managers extend specialized subclasses.
 */
class BaseManager {
  /**
   * @param {import("../services/logger")} [logger] - Optional logger instance.
   */
  constructor(logger) {
    this.logger = logger || null;
  }
}

module.exports = { BaseManager };
