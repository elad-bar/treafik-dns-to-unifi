"use strict";

const https = require("https");
const axios = require("axios");

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Abstract base for providers (Level 3). External API access only.
 * Holds shared config (timeout, httpsAgent) and base HTTP helpers.
 * Subclasses set `ready` and may override updateConfig.
 * @abstract
 */
class BaseProvider {
  /**
   * @param {object} config - Config with timeout, insecureTls.
   * @param {import("../services/logger")} logger - Logger.
   */
  constructor(config, logger) {
    if (this.constructor === BaseProvider) {
      throw new TypeError("BaseProvider is abstract");
    }
    this.logger = logger;
    this.config = config;
    this.timeout = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const insecureTls = this.config.insecureTls === true;
    this.httpsAgent = insecureTls
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;
  }

  /**
   * Update shared state from new config. Subclasses override to also update URL/key and ready.
   * @param {object} config - New config.
   */
  updateConfig(config) {
    this.config = config;
    this.timeout = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const insecureTls = this.config.insecureTls === true;
    this.httpsAgent = insecureTls
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;
  }

  /**
   * @private
   */
  _request(method, url, options = {}) {
    const start = Date.now();
    this.logger.debug(`HTTP request: ${method.toUpperCase()} ${url}`);
    const opts = {
      method,
      url,
      timeout: this.timeout,
      ...(this.httpsAgent && { httpsAgent: this.httpsAgent }),
      ...options,
    };
    return axios
      .request(opts)
      .then((res) => {
        const durationMs = Date.now() - start;
        const body = !!res.data ? JSON.stringify(res.data) : "";

        this.logger.debug(
          `HTTP response: ${res.status} ${url} (${durationMs}ms) — response body: ${body}`
        );
        return res;
      })
      .catch((err) => {
        this.logger.error("HTTP request failed", {
          method,
          url,
          error: err.message,
          status: err.response?.status,
        });
        throw err;
      });
  }

  /**
   * @private
   */
  _get(url, options = {}) {
    return this._request("get", url, options);
  }

  /**
   * @private
   */
  _post(url, body, options = {}) {
    return this._request("post", url, { ...options, data: body });
  }

  /**
   * @private
   */
  _put(url, body, options = {}) {
    return this._request("put", url, { ...options, data: body });
  }

  /**
   * @private
   */
  _delete(url, options = {}) {
    return this._request("delete", url, options);
  }
}

module.exports = { BaseProvider };
