"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const { ConfigRepository } = require("./repositories/ConfigRepository");
const { TraefikProvider } = require("./providers/TraefikProvider");
const { UdmProvider } = require("./providers/UdmProvider");
const logger = require("./services/logger");
const { ConfigManager } = require("./managers/ConfigManager");
const { SyncManager } = require("./managers/SyncManager");
const { ConfigRoutes } = require("./routes/config");
const { DiscoveredRoutes } = require("./routes/discovered");

/**
 * Application bootstrap. Server settings (port, uiDistPath) come from app config (ConfigManager).
 */
class App {
  constructor() {
    /** @type {import("express").Express} */
    this.express = express();

    this._logger = logger;
    this._configRepository = new ConfigRepository();
    this._configManager = new ConfigManager(
      this._configRepository,
      this._logger,
      TraefikProvider,
      UdmProvider
    );
    this._configManager.getConfig({ exitOnError: false });
    const cfg = this._configManager.getCurrentConfig();
    this._config = {
      port: cfg.port ?? 3000,
      uiDistPath: cfg.uiDistPath ?? path.join(__dirname, "..", "web-ui", "dist"),
      isProduction: process.env.NODE_ENV === "production",
    };
    this._traefikProvider = new TraefikProvider(cfg);
    this._udmProvider = new UdmProvider(cfg);
    this._syncManager = new SyncManager(
      this._configManager,
      this._traefikProvider,
      this._udmProvider,
      this._logger
    );

    // Level 1: Entry (routes depend only on managers)
    this._configRoutes = new ConfigRoutes(
      this._configManager,
      this._traefikProvider,
      this._udmProvider
    );
    this._discoveredRoutes = new DiscoveredRoutes(this._syncManager);

    this._setupMiddleware();
    this._mountRoutes();
    this._mountProductionUi();
  }

  /**
   * Register global middleware (Level 4).
   * @private
   */
  _setupMiddleware() {
    this.express.use(express.json());
  }

  /**
   * Mount API routes (Level 1). Routes depend only on managers.
   * @private
   */
  _mountRoutes() {
    this.express.use("/api/config", this._configRoutes.getRouter());
    this.express.use("/api/discovered", this._discoveredRoutes.getRouter());
  }

  /**
   * In production, serve built UI from config.uiDistPath; reserve /api for API only.
   * @private
   */
  _mountProductionUi() {
    if (!this._config.isProduction) return;
    if (!fs.existsSync(this._config.uiDistPath)) return;
    this.express.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      express.static(this._config.uiDistPath, { index: false })(req, res, next);
    });
    this.express.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(this._config.uiDistPath, "index.html"));
    });
  }

  /**
   * Load app config once at startup (no exit on error; config may be created on first PUT).
   * @returns {void}
   */
  loadInitialConfig() {
    try {
      this._configManager.getConfig({ exitOnError: false });
    } catch (err) {
      // No config file yet; will be created on first PUT
    }
  }

  /**
   * Start the HTTP server. Port and all server behaviour come from config passed to constructor.
   * @returns {import("http").Server}
   */
  start() {
    this.loadInitialConfig();
    this._startSyncInterval();
    return this.express.listen(this._config.port, () => {
      this._logger.info(`Web API listening on port ${this._config.port}`);
    });
  }

  /**
   * Start periodic sync (Traefik hostnames → UDM DNS). Interval from config or 15 min default.
   * @private
   */
  _startSyncInterval() {
    let intervalMs = 15 * 60 * 1000;
    try {
      this._configManager.getConfig({ exitOnError: false });
      const cfg = this._configManager.getCurrentConfig();
      if (cfg.syncIntervalMs && cfg.syncIntervalMs > 0) {
        intervalMs = cfg.syncIntervalMs;
      }
    } catch (_) {
      // use default
    }
    const runSync = () => {
      if (!this._traefikProvider.ready || !this._udmProvider.ready) {
        return;
      }
      this._syncManager.syncWithRetry().catch((err) => {
        this._logger.warn(`Sync failed: ${err.message || err}`);
      });
    };
    setInterval(runSync, intervalMs);
    setTimeout(runSync, 2000);
  }
}

const app = new App();
app.start();
