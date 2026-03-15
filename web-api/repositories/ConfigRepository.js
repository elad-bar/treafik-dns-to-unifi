"use strict";

const fs = require("fs");
const path = require("path");
const { BaseRepository } = require("./BaseRepository");

/**
 * Repository for config file. Atomic read/write only; no defaults or business logic.
 * @extends BaseRepository
 */
class ConfigRepository extends BaseRepository {
  /**
   * @param {string} [configPath] - Full path to config JSON file. Defaults to web-api/config/config.json.
   */
  constructor(configPath) {
    super();
    this.configPath =
      configPath || path.join(__dirname, "..", "config", "config.json");
  }

  /**
   * Read config file and return raw object. Missing file returns {}. Parse errors throw.
   * @returns {object} Raw JSON object from file.
   */
  read() {
    if (!fs.existsSync(this.configPath)) {
      return {};
    }
    const raw = fs.readFileSync(this.configPath, "utf8");
    try {
      const data = JSON.parse(raw);
      return data && data.constructor === Object ? data : {};
    } catch (err) {
      throw new Error(`Invalid config file: ${err.message || err}`);
    }
  }

  /**
   * Write object to config file as JSON. Creates parent directory if needed.
   * @param {object} data - Object to serialize (will be written as-is).
   * @returns {void}
   */
  write(data) {
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  }
}

module.exports = { ConfigRepository };
