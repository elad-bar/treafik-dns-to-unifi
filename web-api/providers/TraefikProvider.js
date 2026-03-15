"use strict";

const { BaseProvider } = require("./BaseProvider");

const HOST_REGEX = /Host\(`([^`]+)`\)/g;

/**
 * Provider for Traefik HTTP API. External API access only (Level 3).
 * @extends BaseProvider
 */
class TraefikProvider extends BaseProvider {
  /**
   * @param {object} config - Config object with traefikApiUrl, insecureTls.
   * @param {import("../services/logger")} logger - Logger.
   */
  constructor(config, logger) {
    super('TraefikProvider', config, logger);
    this.apiUrl = config?.traefikApiUrl;
    this.ready = Boolean(this.apiUrl);
  }

  /**
   * Update config; refresh apiUrl and ready.
   * @param {object} [config]
   */
  updateConfig(config) {
    super.updateConfig(config);
    this.apiUrl = config?.traefikApiUrl;
    this.ready = Boolean(this.apiUrl);
  }

  /**
   * Extract hostnames from a Traefik rule string.
   * @private
   */
  _extractHosts(rule) {
    if (!rule || typeof rule !== "string") return [];
    const hosts = [];
    let match;
    const re = new RegExp(HOST_REGEX.source, "g");
    while ((match = re.exec(rule)) !== null) {
      hosts.push(match[1]);
    }
    return hosts;
  }

  /**
   * Fetch all hostnames from Traefik HTTP routers API.
   * @returns {Promise<string[]>} List of hostnames.
   */
  async getHosts() {
    try {
      const res = await this._get(this.apiUrl, {
        validateStatus: (status) => status === 200,
      });
      const data = res.data;
      if (!Array.isArray(data)) return [];
      const hosts = new Set();
      for (const router of data) {
        if (router.rule) {
          const extracted = this._extractHosts(router.rule);
          extracted.forEach((h) => hosts.add(h));
        }
      }
      return [...hosts];
    } catch (err) {
      const msg = err.response
        ? `Traefik API HTTP ${err.response.status} ${err.response.statusText}`
        : (err.code || err.message) || "Traefik request failed";
      throw new Error(msg);
    }
  }
}

module.exports = { TraefikProvider };
