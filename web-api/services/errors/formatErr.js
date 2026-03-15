"use strict";

/**
 * Format an axios/HTTP error for logging or messages.
 * @param {Error & { response?: { status: number; statusText?: string; data?: unknown }; code?: string }} err
 * @returns {string}
 */
function formatErr(err) {
  if (err.response != null) {
    const s = err.response.status;
    const t = err.response.statusText || "";
    const d = err.response.data;
    const body =
      d != null && typeof d === "object"
        ? (d.message || d.msg || JSON.stringify(d).slice(0, 80))
        : String(d).slice(0, 80);
    return `HTTP ${s} ${t}${body ? " — " + body : ""}`.trim();
  }
  if (err.code) return `${err.code}: ${err.message || err}`;
  return err.message || String(err);
}

module.exports = { formatErr };
