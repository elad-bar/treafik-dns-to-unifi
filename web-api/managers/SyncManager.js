"use strict";

const { BaseManager } = require("./BaseManager");
const { formatErr, ValidationError } = require("../services/errors");

const SYNC_RETRY_DELAY_MS = 2000;
const SYNC_MAX_RETRIES = 2;

/**
 * Manager for Traefik→UDM DNS: list desired state (gaps) and run sync.
 * @extends BaseManager
 */
class SyncManager extends BaseManager {
  /**
   * @param {import("./ConfigManager")} configManager - Config manager.
   * @param {import("../providers/TraefikProvider")} traefikProvider - Traefik provider instance.
   * @param {import("../providers/UdmProvider")} udmProvider - UDM provider instance.
   * @param {import("../services/logger")} logger - Logger.
   */
  constructor(configManager, traefikProvider, udmProvider, logger) {
    super('SyncManager', logger);
    this._configManager = configManager;
    this._traefikProvider = traefikProvider;
    this._udmProvider = udmProvider;
    this._modes = {
      dryRun: {
        update: this._logWouldUpdate.bind(this),
        create: this._logWouldCreate.bind(this),
        delete: this._logWouldDelete.bind(this),
        actionLabels: { create: "would create", update: "would update", delete: "would delete" },
      },
      execute: {
        update: this._performUpdate.bind(this),
        create: this._performCreate.bind(this),
        delete: this._performDelete.bind(this),
        actionLabels: { create: "created", update: "updated", delete: "deleted" },
      },
    };
  }

  /**
   * Get list of hostnames (desired set) with IP, override flag, and UDM registration status.
   * When UDM is not configured, registeredInUdm is null (UI can show "Unknown").
   * When record exists in UDM, enabledInUdm indicates if it is enabled (orange when false).
   * @returns {Promise<Array<{hostname: string, ip: string, isOverride: boolean, registeredInUdm: boolean|null, enabledInUdm?: boolean}>>}
   */
  async getList() {
    try {
      this._configManager.getConfig({ exitOnError: false });
    } catch (e) {
      this.logger.debug("getList: no config, returning empty list");
      return [];
    }
    const config = this._configManager.getCurrentConfig();
    if (!this._traefikProvider.ready) {
      throw new ValidationError("Traefik is not configured. Set traefikBaseUrl in config.");
    }
    let udmByLower = new Map();
    if (this._udmProvider.ready) {
      const udmRecords = await this._udmProvider.listDnsRecords().catch(() => []);
      for (const r of udmRecords) {
        udmByLower.set(r.name.toLowerCase(), { enabled: r.enabled });
      }
    }
    const hosts = await this._traefikProvider.getHosts().catch(() => []);
    const overrides = config.dnsOverrides || {};
    const targetIp = config.targetIp || "";
    const hostSet = new Set(hosts.map((h) => h.toLowerCase()));
    const overrideByLower = {};
    for (const [k, v] of Object.entries(overrides)) {
      const lower = k.trim().toLowerCase();
      const val = String(v).trim();
      if (lower && val) overrideByLower[lower] = val;
    }
    for (const key of Object.keys(overrideByLower)) hostSet.add(key);
    const list = [];
    const udmKnown = this._udmProvider.ready;
    for (const hostname of hostSet) {
      const overrideIp = overrideByLower[hostname];
      const ip = overrideIp != null ? overrideIp : targetIp;
      const udmRecord = udmKnown ? udmByLower.get(hostname) : null;
      const registeredInUdm = udmKnown ? !!udmRecord : null;
      const item = {
        hostname,
        ip,
        isOverride: overrideIp != null,
        registeredInUdm,
      };
      if (udmRecord != null) {
        item.enabledInUdm = udmRecord.enabled;
      }
      list.push(item);
    }
    list.sort((a, b) => a.hostname.localeCompare(b.hostname));
    this.logger.debug("getList: %d entries", list.length);
    return list;
  }

  /**
   * @private
   */
  _isInManagedDomain(hostname, managedDomain) {
    if (!managedDomain) return true;
    const h = hostname.toLowerCase();
    const d = managedDomain.toLowerCase();
    return h === d || h.endsWith("." + d);
  }

  _logWouldUpdate(record, entry) {
    this.logger.info(
      `Would update DNS: ${record.name} -> ${entry.ip}${record.enabled === false ? " (enable)" : ""}`
    );
    return Promise.resolve(1);
  }

  _logWouldCreate(entry) {
    this.logger.info(`Would create DNS: ${entry.hostname} -> ${entry.ip}`);
    return Promise.resolve(1);
  }

  _logWouldDelete(record) {
    this.logger.info(`Would delete DNS: ${record.name}`);
    return Promise.resolve(1);
  }

  async _performUpdate(record, entry) {
    try {
      // UDM API expects the full record body; send existing record with our changes.
      const body = {
        ...record.raw,
        key: entry.hostname,
        enabled: true,
        value: entry.ip,
      };
      await this._udmProvider.updateDnsRecord(record.id, body);
      this.logger.info(`Updated DNS: ${record.name} -> ${entry.ip}`);
      return 1;
    } catch (e) {
      this.logger.error(`DNS update failed: ${record.name} — ${formatErr(e)}`);
      return 0;
    }
  }

  async _performCreate(entry) {
    try {
      await this._udmProvider.createDnsRecord(entry.hostname, entry.ip);
      this.logger.info(`Created DNS: ${entry.hostname} -> ${entry.ip}`);
      return 1;
    } catch (e) {
      this.logger.error(`DNS create failed: ${entry.hostname} — ${formatErr(e)}`);
      return 0;
    }
  }

  async _performDelete(record) {
    try {
      await this._udmProvider.deleteDnsRecord(record.id);
      this.logger.info(`Deleted DNS: ${record.name}`);
      return 1;
    } catch (e) {
      this.logger.error(`DNS delete failed: ${record.name} — ${formatErr(e)}`);
      return 0;
    }
  }

  /**
   * Run one sync: fetch hosts from Traefik, compute desired DNS set, create/delete UDM records.
   * @param {{ forceApply?: boolean }} [options] - forceApply: true = ignore config dryRun and write to UDM (e.g. manual Sync button).
   * @returns {Promise<void>}
   */
  async sync(options = {}) {
    this._configManager.getConfig({ exitOnError: false });
    const config = this._configManager.getCurrentConfig();
    const dryRun = options.forceApply ? false : config.dryRun;
    if (!this._traefikProvider.ready) {
      throw new ValidationError("Traefik is not configured. Set traefikBaseUrl in config.");
    }
    if (!this._udmProvider.ready) {
      throw new ValidationError("UniFi is not configured. Set udmUrl and udmApiKey in config.");
    }

    let hostsFromTraefik = await this._traefikProvider.getHosts();
    if (config.managedDomain) {
      hostsFromTraefik = hostsFromTraefik.filter((h) =>
        this._isInManagedDomain(h, config.managedDomain)
      );
      this.logger.info(
        `Managed domain: ${config.managedDomain} (only syncing and cleaning this domain and subdomains).`
      );
    }

    const desired = new Map();
    for (const host of hostsFromTraefik) {
      desired.set(host.toLowerCase(), {
        hostname: host,
        ip: config.targetIp,
      });
    }
    const overrides = config.dnsOverrides || {};
    for (const key of Object.keys(overrides)) {
      const hostname = key.trim();
      const ip = overrides[key];
      desired.set(hostname.toLowerCase(), { hostname, ip });
    }

    const existingRecords = await this._udmProvider.listDnsRecords();
    const existingByLower = new Map(
      existingRecords.map((r) => [r.name.toLowerCase(), r])
    );
    const existingSet = new Set(existingByLower.keys());

    const desiredSet = new Set(desired.keys());
    const toCreate = [...desired.values()].filter(
      (entry) => !existingSet.has(entry.hostname.toLowerCase())
    );

    const mode = dryRun ? this._modes.dryRun : this._modes.execute;
    const labels = mode.actionLabels;

    let updated = 0;
    for (const hostnameLower of desiredSet) {
      const record = existingByLower.get(hostnameLower);
      const entry = desired.get(hostnameLower);
      if (!record || !entry) continue;
      if (record.enabled !== false && record.value === entry.ip) continue;
      updated += await mode.update(record, entry);
    }

    let created = 0;
    for (const entry of toCreate) {
      created += await mode.create(entry);
    }

    let deleted = 0;
    if (config.managedDomain) {
      const toDelete = existingRecords.filter(
        (r) =>
          this._isInManagedDomain(r.name, config.managedDomain) &&
          !desiredSet.has(r.name)
      );
      for (const record of toDelete) {
        deleted += await mode.delete(record);
      }
    }

    const already = desired.size - toCreate.length;
    const overrideCount = Object.keys(overrides).length;
    let msg = `Sync done: ${hostsFromTraefik.length} from Traefik${overrideCount ? `, ${overrideCount} overrides` : ""}, ${desired.size} desired, ${already} already in UDM, ${created} ${labels.create}, ${updated} ${labels.update}.`;
    if (config.managedDomain !== undefined) {
      msg += ` Cleanup: ${deleted} ${labels.delete}.`;
    }
    this.logger.info(msg);
  }

  /**
   * Sync a single hostname: create or update its UDM DNS record to match desired state.
   * @param {string} hostname - Hostname to sync (e.g. "zigbee.baru.sh").
   * @returns {Promise<{ action: 'created'|'updated'|'unchanged' }>}
   */
  async syncOne(hostname) {
    this._configManager.getConfig({ exitOnError: false });
    const config = this._configManager.getCurrentConfig();
    if (!this._traefikProvider.ready) {
      throw new ValidationError("Traefik is not configured. Set traefikBaseUrl in config.");
    }
    if (!this._udmProvider.ready) {
      throw new ValidationError("UniFi is not configured. Set udmUrl and udmApiKey in config.");
    }

    let hostsFromTraefik = await this._traefikProvider.getHosts();
    if (config.managedDomain) {
      hostsFromTraefik = hostsFromTraefik.filter((h) =>
        this._isInManagedDomain(h, config.managedDomain)
      );
    }
    const desired = new Map();
    for (const host of hostsFromTraefik) {
      desired.set(host.toLowerCase(), { hostname: host, ip: config.targetIp });
    }
    const overrides = config.dnsOverrides || {};
    for (const key of Object.keys(overrides)) {
      const h = key.trim();
      desired.set(h.toLowerCase(), { hostname: h, ip: overrides[key] });
    }

    const hostnameLower = String(hostname || "").trim().toLowerCase();
    if (!hostnameLower) {
      throw new ValidationError("Hostname is required.");
    }
    const entry = desired.get(hostnameLower);
    if (!entry) {
      throw new ValidationError(`Hostname "${hostname}" is not in the desired set (Traefik hosts or overrides).`);
    }

    const existingRecords = await this._udmProvider.listDnsRecords();
    const existingByLower = new Map(
      existingRecords.map((r) => [r.name.toLowerCase(), r])
    );
    const record = existingByLower.get(hostnameLower);
    const mode = this._modes.execute;

    if (!record) {
      await mode.create(entry);
      this.logger.info(`Sync one: created DNS: ${entry.hostname} -> ${entry.ip}`);
      return { action: "created" };
    }
    if (record.enabled === false || record.value !== entry.ip) {
      await mode.update(record, entry);
      this.logger.info(`Sync one: updated DNS: ${record.name} -> ${entry.ip}`);
      return { action: "updated" };
    }
    this.logger.debug(`Sync one: ${entry.hostname} already in sync`);
    return { action: "unchanged" };
  }

  /**
   * Run sync with retries.
   * @param {{ forceApply?: boolean }} [options] - forceApply: true for manual Sync button (ignore config dryRun).
   * @returns {Promise<void>}
   */
  async syncWithRetry(options = {}) {
    let lastErr;
    for (let attempt = 1; attempt <= SYNC_MAX_RETRIES; attempt++) {
      try {
        await this.sync(options);
        return;
      } catch (err) {
        lastErr = err;
        if (err instanceof ValidationError) {
          throw err;
        }
        this.logger.warn(
          `Sync attempt ${attempt}/${SYNC_MAX_RETRIES} failed: ${formatErr(err)}`
        );
        if (attempt < SYNC_MAX_RETRIES) {
          this.logger.info(
            `Retrying in ${SYNC_RETRY_DELAY_MS / 1000}s...`
          );
          await new Promise((r) => setTimeout(r, SYNC_RETRY_DELAY_MS));
        }
      }
    }
    throw lastErr;
  }
}

module.exports = { SyncManager };
