"use strict";

const express = require("express");
const { SyncManager } = require("../managers/SyncManager");

/**
 * Level 1: Discovered hostnames API (desired set + UDM status). Depends only on SyncManager.
 */
class DiscoveredRoutes {
  /**
   * @param {SyncManager} syncManager - Sync manager (getList + sync).
   */
  constructor(syncManager) {
    if (!(syncManager instanceof SyncManager)) {
      throw new TypeError("DiscoveredRoutes requires a SyncManager instance");
    }
    this.syncManager = syncManager;
    this.router = express.Router();
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.get("/", (req, res) => {
      this.asyncHandler(this.getIndex.bind(this))(req, res);
    });
  }

  /**
   * Send error response using AppError.statusCode or 500.
   * @param {import("express").Response} res - Express response.
   * @param {Error & { statusCode?: number }} err - Error.
   */
  sendError(res, err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || String(err);
    res.status(statusCode).json({ error: message });
  }

  /**
   * Wrap async route handler and forward errors to sendError.
   * @param {(req: import("express").Request, res: import("express").Response) => Promise<void>} handler
   * @returns {(req: import("express").Request, res: import("express").Response) => void}
   */
  asyncHandler(handler) {
    return (req, res) => {
      Promise.resolve(handler(req, res)).catch((err) => {
        this.sendError(res, err);
      });
    };
  }

  /**
   * GET / — return list of discovered hostnames with IP and UDM status.
   */
  async getIndex(req, res) {
    const list = await this.syncManager.getList();
    res.json(list);
  }

  /**
   * @returns {import("express").Router} Express router.
   */
  getRouter() {
    return this.router;
  }
}

module.exports = { DiscoveredRoutes };
