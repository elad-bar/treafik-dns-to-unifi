"use strict";

const express = require("express");
const { SyncManager } = require("../managers/SyncManager");

/**
 * Level 1: Discovered hostnames API (desired set + UDM status). Depends only on SyncManager.
 */
class DiscoveredRoutes {
  /**
   * @param {SyncManager} syncManager - Sync manager (getList + sync).
   * @param {import("../services/logger")} logger - Logger.
   */
  constructor(syncManager, logger) {
    if (!(syncManager instanceof SyncManager)) {
      throw new TypeError("DiscoveredRoutes requires a SyncManager instance");
    }
    this.className = 'DiscoveredRoutes';
    this.syncManager = syncManager;
    this.logger = logger.child({ className: this.className });
    this.router = express.Router();
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.get("/", (req, res) => {
      this.asyncHandler(this.getIndex.bind(this))(req, res);
    });
    this.router.post("/sync", (req, res) => {
      this.asyncHandler(this.postSync.bind(this))(req, res);
    });
    this.router.post("/sync/one", (req, res) => {
      this.asyncHandler(this.postSyncOne.bind(this))(req, res);
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
    if (statusCode >= 500) {
      this.logger.error("Route error", { statusCode, message });
    } else {
      this.logger.warn("Route error", { statusCode, message });
    }
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
   * POST /sync — run Traefik→UDM sync (on demand). Always applies changes; ignores config dryRun.
   */
  async postSync(req, res) {
    await this.syncManager.syncWithRetry({ forceApply: true });
    res.status(200).json({ ok: true });
  }

  /**
   * POST /sync/one — sync a single hostname (create or update its UDM DNS record). Body: { hostname }.
   */
  async postSyncOne(req, res) {
    const hostname = req.body?.hostname;
    const result = await this.syncManager.syncOne(hostname);
    res.status(200).json({ ok: true, action: result.action });
  }

  /**
   * @returns {import("express").Router} Express router.
   */
  getRouter() {
    return this.router;
  }
}

module.exports = { DiscoveredRoutes };
