"use strict";

const path = require("path");
const { BaseManager } = require("./BaseManager");
const { ValidationError } = require("../services/errors");

const DEFAULT_SYNC_INTERVAL_MINUTES = 15;
const DEFAULT_PORT = 3000;
const VALID_LOG_LEVELS = ["error", "warn", "info", "debug"];
const DEFAULT_CONFIG = {
  traefikBaseUrl: "",
  udmUrl: "",
  udmApiKey: "",
  targetIp: "",
  syncIntervalMinutes: 15,
  managedDomain: undefined,
  dryRun: true,
  insecureTls: false,
  logLevel: "info",
  dnsOverrides: {},
  port: DEFAULT_PORT,
};

/**
 * Config manager: load/save, defaults, public shape, and section updates with provider validation.
 * @extends BaseManager
 */
class ConfigManager extends BaseManager {
  /**
   * @param {import("../repositories/ConfigRepository")} configRepository - Config repository.
   * @param {import("../services/logger")} [logger] - Optional logger.
   * @param {typeof import("../providers/TraefikProvider")} [TraefikProvider] - Traefik provider class (for validation).
   * @param {typeof import("../providers/UdmProvider")} [UdmProvider] - UDM provider class (for validation).
   */
  constructor(configRepository, logger, TraefikProvider, UdmProvider) {
    super(logger);
    this.repository = configRepository;
    this.TraefikProvider = TraefikProvider;
    this.UdmProvider = UdmProvider;
    this._state = this._emptyState();
  }

  /**
   * @private
   * @returns {object} Empty state shape.
   */
  _emptyState() {
    return {
      traefikBaseUrl: "",
      traefikApiUrl: "",
      udmUrl: "",
      udmApiKey: "",
      targetIp: "",
      syncIntervalMinutes: DEFAULT_SYNC_INTERVAL_MINUTES,
      syncIntervalMs: 0,
      dryRun: true,
      insecureTls: false,
      logLevel: "info",
      managedDomain: undefined,
      dnsOverrides: {},
      port: DEFAULT_PORT,
    };
  }

  /**
   * Load config from repository, apply defaults and normalizations, set internal state.
   * No validation on load; validation happens on PUT (Traefik/UniFi) and when operations require config.
   * @param {object} [options] - Reserved for future use.
   * @returns {ConfigManager} this for chaining.
   */
  load(options = {}) {
    const fromJson = this.repository.read();
    const merged = { ...fromJson };

    const traefikBaseUrl = (merged.traefikBaseUrl || "").trim().replace(/\/$/, "");
    const udmUrl = (merged.udmUrl || "").trim().replace(/\/$/, "");
    const udmApiKey = (merged.udmApiKey || "").trim();
    const targetIp = (merged.targetIp || "").trim();
    const syncIntervalMinutes = Math.max(
      1,
      Math.min(60, Number(merged.syncIntervalMinutes) || DEFAULT_SYNC_INTERVAL_MINUTES)
    );
    const managedDomain = (merged.managedDomain || "").trim() || undefined;
    const dryRun = merged.dryRun === false ? false : true;
    const insecureTls = merged.insecureTls === true;
    const logLevel = VALID_LOG_LEVELS.includes(merged.logLevel) ? merged.logLevel : "info";

    let dnsOverrides = {};
    const rawOverrides = merged.dnsOverrides;
    if (rawOverrides && rawOverrides.constructor === Object) {
      for (const [k, v] of Object.entries(rawOverrides)) {
        const key = String(k).trim();
        const val = String(v).trim();
        if (key && val) dnsOverrides[key] = val;
      }
    }

    const port = Number(merged.port) || Number(process.env.PORT) || DEFAULT_PORT;

    this._state = {
      traefikBaseUrl,
      traefikApiUrl: traefikBaseUrl ? `${traefikBaseUrl}/api/http/routers` : "",
      udmUrl,
      udmApiKey,
      targetIp,
      syncIntervalMinutes,
      syncIntervalMs: syncIntervalMinutes * 60 * 1000,
      dryRun,
      insecureTls,
      logLevel,
      managedDomain,
      dnsOverrides,
      port,
    };

    if (this.logger.level !== this._state.logLevel) {
      this.logger.level = this._state.logLevel;
    }
    return this;
  }

  /**
   * @private
   * @returns {boolean} True if config file exists on disk.
   */
  _configFileExists() {
    const fs = require("fs");
    return fs.existsSync(this.repository.configPath);
  }

  /**
   * Load then return this for chaining.
   * @param {{ exitOnError?: boolean }} [options]
   * @returns {ConfigManager} this
   */
  getConfig(options = {}) {
    this.load(options);
    return this;
  }

  /**
   * Return current in-memory config as a plain object (for other managers).
   * @returns {object} Current config with traefikBaseUrl, traefikApiUrl, udmUrl, udmApiKey, targetIp, syncIntervalMinutes, managedDomain, dryRun, insecureTls, logLevel, dnsOverrides.
   */
  getCurrentConfig() {
    return { ...this._state };
  }

  /**
   * Return public config shape (udmApiKey masked as "***") for API responses.
   * @param {object|null} configData - Full config from getCurrentConfig().
   * @returns {object|null} Public shape or null if configData is null.
   */
  toPublic(configData) {
    if (!configData) return null;
    return {
      traefikBaseUrl: configData.traefikBaseUrl ?? "",
      udmUrl: configData.udmUrl ?? "",
      udmApiKey: configData.udmApiKey ? "***" : "",
      targetIp: configData.targetIp ?? "",
      syncIntervalMinutes: configData.syncIntervalMinutes ?? 15,
      managedDomain: configData.managedDomain || "",
      dryRun: configData.dryRun !== false,
      insecureTls: configData.insecureTls === true,
      logLevel: configData.logLevel ?? "info",
      dnsOverrides: configData.dnsOverrides || {},
      port: configData.port ?? DEFAULT_PORT,
    };
  }

  /**
   * Normalize dto and write to repository. No validation against external APIs.
   * @param {object} dto - Config to save (partial or full).
   * @returns {void}
   */
  save(dto) {
    const normalized = {
      traefikBaseUrl: dto.traefikBaseUrl ?? "",
      udmUrl: dto.udmUrl ?? "",
      udmApiKey: dto.udmApiKey ?? "",
      targetIp: dto.targetIp ?? "",
      syncIntervalMinutes:
        dto.syncIntervalMinutes ?? DEFAULT_SYNC_INTERVAL_MINUTES,
      managedDomain: dto.managedDomain ?? "",
      dryRun: dto.dryRun !== false,
      insecureTls: dto.insecureTls === true,
      logLevel: VALID_LOG_LEVELS.includes(dto.logLevel) ? dto.logLevel : "info",
      dnsOverrides: dto.dnsOverrides || {},
      port: dto.port != null ? Number(dto.port) || DEFAULT_PORT : this._state.port,
    };
    this.repository.write(normalized);
    this._state = {
      ...this._state,
      ...normalized,
      traefikApiUrl: normalized.traefikBaseUrl
        ? `${normalized.traefikBaseUrl}/api/http/routers`
        : "",
      syncIntervalMs: (normalized.syncIntervalMinutes || 15) * 60 * 1000,
    };
  }

  /**
   * Load config (no exit on error) and return current config (full).
   * @returns {object} Current config.
   */
  getCurrent() {
    try {
      this.getConfig({ exitOnError: false });
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
    return this.getCurrentConfig();
  }

  /**
   * Return current config in public shape (udmApiKey masked) for API responses.
   * @returns {object} Public config.
   */
  getPublic() {
    return this.toPublic(this.getCurrent());
  }

  /**
   * Get current config as plain object (for merge). Never throws; returns defaults if load fails.
   * @returns {object}
   */
  getCurrentAsObject() {
    try {
      this.getConfig({ exitOnError: false });
      return this.getCurrentConfig();
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  /** @private */
  _buildTraefikConfig(traefikBaseUrl, insecureTls) {
    const base = (traefikBaseUrl || "").trim().replace(/\/$/, "");
    return {
      traefikBaseUrl: base,
      traefikApiUrl: base ? `${base}/api/http/routers` : "",
      insecureTls: insecureTls === true,
    };
  }

  /** @private */
  _buildUdmConfig(udmUrl, udmApiKey, insecureTls) {
    return {
      udmUrl: (udmUrl || "").trim().replace(/\/$/, ""),
      udmApiKey: (udmApiKey || "").trim(),
      insecureTls: insecureTls === true,
    };
  }

  /** @private */
  _toSaveObject(merged) {
    return {
      traefikBaseUrl: merged.traefikBaseUrl,
      udmUrl: merged.udmUrl,
      udmApiKey: merged.udmApiKey,
      targetIp: merged.targetIp,
      syncIntervalMinutes: merged.syncIntervalMinutes,
      managedDomain: merged.managedDomain ?? "",
      dryRun: merged.dryRun,
      insecureTls: merged.insecureTls,
      logLevel: merged.logLevel,
      dnsOverrides: merged.dnsOverrides,
      port: merged.port ?? DEFAULT_PORT,
    };
  }

  async validateTraefik(traefikBaseUrl, insecureTls) {
    if (!this.TraefikProvider) return { ok: false, error: "Traefik provider not configured" };
    try {
      const config = this._buildTraefikConfig(traefikBaseUrl, insecureTls);
      const provider = new this.TraefikProvider(config);
      if (!provider.ready) return { ok: false, error: "Traefik is not configured. Set traefikBaseUrl in config." };
      await provider.getHosts();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  async validateUnifi(udmUrl, udmApiKey, insecureTls) {
    if (!this.UdmProvider) return { ok: false, error: "UDM provider not configured" };
    try {
      const config = this._buildUdmConfig(udmUrl, udmApiKey, insecureTls);
      const provider = new this.UdmProvider(config);
      if (!provider.ready) return { ok: false, error: "UniFi is not configured. Set udmUrl and udmApiKey in config." };
      await provider.listDnsRecords();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  async updateUnifi(body) {
    const current = this.getCurrentAsObject();
    const next = { ...current };
    if (body.udmUrl !== undefined) {
      next.udmUrl = String(body.udmUrl).trim().replace(/\/$/, "");
    }
    if (
      body.udmApiKey !== undefined &&
      body.udmApiKey !== "***" &&
      String(body.udmApiKey).trim() !== ""
    ) {
      next.udmApiKey = String(body.udmApiKey).trim();
    }
    const result = await this.validateUnifi(next.udmUrl, next.udmApiKey, next.insecureTls);
    if (!result.ok) throw new ValidationError(result.error);
    this.save(this._toSaveObject(next));
    this.getConfig({ exitOnError: false });
    return this.getCurrentConfig();
  }

  async updateTraefik(body) {
    const current = this.getCurrentAsObject();
    const next = { ...current };
    if (body.traefikBaseUrl !== undefined) {
      next.traefikBaseUrl = String(body.traefikBaseUrl).trim().replace(/\/$/, "");
    }
    if (body.managedDomain !== undefined) {
      next.managedDomain = String(body.managedDomain).trim() || undefined;
    }
    if (body.targetIp !== undefined) {
      next.targetIp = String(body.targetIp).trim();
    }
    const result = await this.validateTraefik(next.traefikBaseUrl, next.insecureTls);
    if (!result.ok) throw new ValidationError(result.error);
    this.save(this._toSaveObject(next));
    this.getConfig({ exitOnError: false });
    return this.getCurrentConfig();
  }

  updateSystem(body) {
    const current = this.getCurrentAsObject();
    const next = { ...current };
    if (body.syncIntervalMinutes !== undefined) {
      const n = parseInt(body.syncIntervalMinutes, 10);
      next.syncIntervalMinutes = Number.isNaN(n) ? 15 : Math.max(1, Math.min(60, n));
    }
    if (body.insecureTls !== undefined) next.insecureTls = body.insecureTls === true;
    if (body.logLevel !== undefined && VALID_LOG_LEVELS.includes(body.logLevel)) {
      next.logLevel = body.logLevel;
    }
    if (body.dryRun !== undefined) next.dryRun = body.dryRun === true;
    this.save(this._toSaveObject(next));
    this.getConfig({ exitOnError: false });
    return this.getCurrentConfig();
  }

  updateOverrides(body) {
    const current = this.getCurrentAsObject();
    const next = { ...current };
    const raw = body.dnsOverrides;
    if (raw && raw.constructor === Object) {
      next.dnsOverrides = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = String(k).trim();
        const val = String(v).trim();
        if (key && val) next.dnsOverrides[key] = val;
      }
    }
    this.save(this._toSaveObject(next));
    this.getConfig({ exitOnError: false });
    return this.getCurrentConfig();
  }
}

module.exports = { ConfigManager };
