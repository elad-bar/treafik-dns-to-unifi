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
    super(logger);
    this._configManager = configManager;
    this._traefikProvider = traefikProvider;
    this._udmProvider = udmProvider;
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

  /**
   * Run one sync: fetch hosts from Traefik, compute desired DNS set, create/delete UDM records.
   * @returns {Promise<void>}
   */
  async sync() {
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

    let updated = 0;
    for (const hostnameLower of desiredSet) {
      const record = existingByLower.get(hostnameLower);
      const entry = desired.get(hostnameLower);
      if (!record || !entry) continue;
      const needsUpdate =
        record.enabled === false || record.value !== entry.ip;
      if (!needsUpdate) continue;
      if (config.dryRun) {
        this.logger.info(
          `Would update DNS: ${record.name} -> ${entry.ip}${record.enabled === false ? " (enable)" : ""}`
        );
        updated++;
      } else {
        try {
          await this._udmProvider.updateDnsRecord(record.id, {
            enabled: true,
            value: entry.ip,
          });
          updated++;
          this.logger.info(`Updated DNS: ${record.name} -> ${entry.ip}`);
        } catch (e) {
          this.logger.error(
            `DNS update failed: ${record.name} — ${formatErr(e)}`
          );
        }
      }
    }

    let created = 0;
    for (const entry of toCreate) {
      if (config.dryRun) {
        this.logger.info(
          `Would create DNS: ${entry.hostname} -> ${entry.ip}`
        );
        created++;
      } else {
        try {
          await this._udmProvider.createDnsRecord(entry.hostname, entry.ip);
          created++;
          this.logger.info(`Created DNS: ${entry.hostname} -> ${entry.ip}`);
        } catch (e) {
          this.logger.error(
            `DNS create failed: ${entry.hostname} — ${formatErr(e)}`
          );
        }
      }
    }

    let deleted = 0;
    if (config.managedDomain) {
      const toDelete = existingRecords.filter(
        (r) =>
          this._isInManagedDomain(r.name, config.managedDomain) &&
          !desiredSet.has(r.name)
      );
      for (const record of toDelete) {
        if (config.dryRun) {
          this.logger.info(`Would delete DNS: ${record.name}`);
          deleted++;
        } else {
          try {
            await this._udmProvider.deleteDnsRecord(record.id);
            deleted++;
            this.logger.info(`Deleted DNS: ${record.name}`);
          } catch (e) {
            this.logger.error(
              `DNS delete failed: ${record.name} — ${formatErr(e)}`
            );
          }
        }
      }
    }

    const already = desired.size - toCreate.length;
    const actionCreate = config.dryRun ? "would create" : "created";
    const actionUpdate = config.dryRun ? "would update" : "updated";
    const overrideCount = Object.keys(overrides).length;
    let msg = `Sync done: ${hostsFromTraefik.length} from Traefik${overrideCount ? `, ${overrideCount} overrides` : ""}, ${desired.size} desired, ${already} already in UDM, ${created} ${actionCreate}, ${updated} ${actionUpdate}.`;
    if (config.managedDomain !== undefined) {
      const actionDelete = config.dryRun ? "would delete" : "deleted";
      msg += ` Cleanup: ${deleted} ${actionDelete}.`;
    }
    this.logger.info(msg);
  }

  /**
   * Run sync with retries.
   * @returns {Promise<void>}
   */
  async syncWithRetry() {
    let lastErr;
    for (let attempt = 1; attempt <= SYNC_MAX_RETRIES; attempt++) {
      try {
        await this.sync();
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
