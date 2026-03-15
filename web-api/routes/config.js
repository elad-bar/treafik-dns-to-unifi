"use strict";

const express = require("express");
const { ConfigManager } = require("../managers/ConfigManager");

/**
 * Level 1: Config API routes. Depends on ConfigManager and provider instances for post-save refresh.
 */
class ConfigRoutes {
  /**
   * @param {ConfigManager} configManager - Config manager.
   * @param {import("../providers/TraefikProvider")} traefikProvider - Traefik provider instance (for refresh after save).
   * @param {import("../providers/UdmProvider")} udmProvider - UDM provider instance (for refresh after save).
   * @param {import("../services/logger")} logger - Logger.
   */
  constructor(configManager, traefikProvider, udmProvider, logger) {
    if (!(configManager instanceof ConfigManager)) {
      throw new TypeError("ConfigRoutes requires a ConfigManager instance");
    }
    this.className = 'ConfigRoutes';
    this.configManager = configManager;
    this._traefikProvider = traefikProvider;
    this._udmProvider = udmProvider;
    this.logger = logger.child({ className: this.className });
    this.router = express.Router();
    this.registerRoutes();
  }

  /**
   * After config save, refresh live provider config so they use the new settings.
   */
  _refreshProviders() {
    const cfg = this.configManager.getCurrentConfig();
    this._traefikProvider.updateConfig(cfg);
    this._udmProvider.updateConfig(cfg);
  }

  registerRoutes() {
    this.router.get("/", (req, res) => {
      this.getIndex(req, res);
    });
    this.router.put("/unifi", (req, res) => {
      this.asyncHandler(this.putUnifi.bind(this))(req, res);
    });
    this.router.put("/traefik", (req, res) => {
      this.asyncHandler(this.putTraefik.bind(this))(req, res);
    });
    this.router.put("/system", (req, res) => {
      this.putSystem(req, res);
    });
    this.router.put("/overrides", (req, res) => {
      this.putOverrides(req, res);
    });
  }

  /**
   * Send error response using AppError.statusCode or 500.
   * @param {import("express").Response} res - Express response.
   * @param {Error & { statusCode?: number }} err - Error (AppError has statusCode).
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
   * GET / — return public config and provider readiness.
   */
  getIndex(req, res) {
    try {
      const publicConfig = this.configManager.getPublic();
      const body = {
        ...publicConfig,
        traefikReady: this._traefikProvider ? this._traefikProvider.ready : false,
        udmReady: this._udmProvider ? this._udmProvider.ready : false,
      };
      res.json(body);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  /**
   * PUT /unifi — update UniFi config, validate, return public config.
   */
  async putUnifi(req, res) {
    await this.configManager.updateUnifi(req.body);
    this._refreshProviders();
    res.json(this.configManager.getPublic());
  }

  /**
   * PUT /traefik — update Traefik config, validate, return public config.
   */
  async putTraefik(req, res) {
    await this.configManager.updateTraefik(req.body);
    this._refreshProviders();
    res.json(this.configManager.getPublic());
  }

  /**
   * PUT /system — update system options, return public config.
   */
  putSystem(req, res) {
    try {
      this.configManager.updateSystem(req.body);
      this._refreshProviders();
      res.json(this.configManager.getPublic());
    } catch (err) {
      this.sendError(res, err);
    }
  }

  /**
   * PUT /overrides — update DNS overrides, return public config.
   */
  putOverrides(req, res) {
    try {
      this.configManager.updateOverrides(req.body);
      this._refreshProviders();
      res.json(this.configManager.getPublic());
    } catch (err) {
      this.sendError(res, err);
    }
  }

  /**
   * @returns {import("express").Router} Express router.
   */
  getRouter() {
    return this.router;
  }
}

module.exports = { ConfigRoutes };
