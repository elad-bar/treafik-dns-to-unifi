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
   * @param {import("../services/logger")} logger - Logger.
   */
  constructor(logger) {
    super(logger);
    this.configPath = path.join(__dirname, "..", "config", "config.json");
  }

  /**
   * Read config file and return raw object. Missing file returns {}. Parse errors throw.
   * @returns {object} Raw JSON object from file.
   */
  read() {
    if (!fs.existsSync(this.configPath)) {
      this.logger.debug("Config file missing", { path: this.configPath });
      return {};
    }
    const raw = fs.readFileSync(this.configPath, "utf8");
    try {
      const data = JSON.parse(raw);
      return data && data.constructor === Object ? data : {};
    } catch (err) {
      this.logger.error("Config file invalid", {
        path: this.configPath,
        error: err.message,
      });
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
    this.logger.debug("Config written", { path: this.configPath });
  }
}

module.exports = { ConfigRepository };
