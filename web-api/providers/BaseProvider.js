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
   * @param {object} [config] - Config with timeout, insecureTls.
   */
  constructor(config) {
    if (this.constructor === BaseProvider) {
      throw new TypeError("BaseProvider is abstract");
    }
    this.config = config || {};
    this.timeout = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const insecureTls = this.config.insecureTls === true;
    this.httpsAgent = insecureTls
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;
  }

  /**
   * Update shared state from new config. Subclasses override to also update URL/key and ready.
   * @param {object} [config] - New config.
   */
  updateConfig(config) {
    this.config = config || {};
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
    const opts = {
      method,
      url,
      timeout: this.timeout,
      ...(this.httpsAgent && { httpsAgent: this.httpsAgent }),
      ...options,
    };
    return axios.request(opts);
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
  _delete(url, options = {}) {
    return this._request("delete", url, options);
  }
}

module.exports = { BaseProvider };
