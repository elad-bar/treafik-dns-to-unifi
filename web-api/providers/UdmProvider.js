"use strict";

const { BaseProvider } = require("./BaseProvider");

const DNS_RECORDS_PATH = "/proxy/network/v2/api/site/default/static-dns";

/**
 * Provider for UniFi UDM DNS API. External API access only (Level 3).
 * @extends BaseProvider
 */
class UdmProvider extends BaseProvider {
  /**
   * @param {object} config - Config with udmUrl, udmApiKey, insecureTls.
   * @param {import("../services/logger")} logger - Logger.
   */
  constructor(config, logger) {
    super(config, logger);
    this.baseUrl = (config?.udmUrl || "").replace(/\/$/, "");
    this.apiKey = config?.udmApiKey;
    this.ready = Boolean(this.baseUrl && this.apiKey);
  }

  /**
   * Update config; refresh baseUrl, apiKey, ready.
   * @param {object} [config]
   */
  updateConfig(config) {
    super.updateConfig(config);
    this.baseUrl = (config?.udmUrl || "").replace(/\/$/, "");
    this.apiKey = config?.udmApiKey;
    this.ready = Boolean(this.baseUrl && this.apiKey);
  }

  /** @private */
  _getUdmOptions(extra = {}) {
    return {
      headers: { "x-api-key": this.apiKey },
      ...extra,
    };
  }

  /** @private */
  _wrapError(err, context) {
    if (err.response != null) {
      const s = err.response.status;
      const t = err.response.statusText || "";
      const d = err.response.data;
      const body =
        d != null && typeof d === "object"
          ? (d.message || d.msg || String(JSON.stringify(d)).slice(0, 60))
          : String(d).slice(0, 60);
      return new Error(
        `UDM ${context}: HTTP ${s} ${t}${body ? " — " + body : ""}`.trim()
      );
    }
    return new Error(`UDM ${context}: ${err.code || err.message || err}`);
  }

  async listDnsRecords() {
    try {
      const res = await this._get(
        `${this.baseUrl}${DNS_RECORDS_PATH}`,
        this._getUdmOptions({ validateStatus: (status) => status === 200 })
      );
      const data = res.data?.data ?? res.data;
      if (!Array.isArray(data)) return [];
      return data
        .filter(
          (r) =>
            (r.type || r.record_type || "") === "A" ||
            (!r.type && !r.record_type)
        )
        .map((r) => {
          const name = r.key != null ? String(r.key).toLowerCase() : "";
          const id = r._id || r.id;
          const enabled = r.enabled !== false;
          const value = r.value != null ? String(r.value).trim() : "";
          if (!name || !id) return null;
          return { id: String(id), name, enabled, value };
        })
        .filter(Boolean);
    } catch (err) {
      throw this._wrapError(err, "list DNS");
    }
  }

  async deleteDnsRecord(id) {
    try {
      await this._delete(
        `${this.baseUrl}${DNS_RECORDS_PATH}/${id}`,
        this._getUdmOptions({
          validateStatus: (status) => status >= 200 && status < 300,
        })
      );
    } catch (err) {
      throw this._wrapError(err, "delete DNS");
    }
  }

  async createDnsRecord(hostname, ip) {
    try {
      await this._post(
        `${this.baseUrl}${DNS_RECORDS_PATH}`,
        { key: hostname, record_type: "A", value: ip, enabled: true },
        this._getUdmOptions()
      );
    } catch (err) {
      throw this._wrapError(err, "create DNS");
    }
  }

  /**
   * Update an existing DNS record (e.g. set enabled: true).
   * @param {string} id - Record id (_id from list).
   * @param {object} body - Fields to update (e.g. { enabled: true }).
   */
  async updateDnsRecord(id, body) {
    try {
      await this._put(
        `${this.baseUrl}${DNS_RECORDS_PATH}/${id}`,
        body,
        this._getUdmOptions({
          validateStatus: (status) => status >= 200 && status < 300,
        })
      );
    } catch (err) {
      throw this._wrapError(err, "update DNS");
    }
  }
}

module.exports = { UdmProvider };
