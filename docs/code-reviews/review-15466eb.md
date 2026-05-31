# Code review: 15466eb

| Field | Value |
| --- | --- |
| **Repo** | elad-bar/treafik-dns-to-unifi |
| **Commit** | 15466eb3b05ff09d8f3f55d0a23734f150b2622f |
| **Base ref** | main |
| **Branch** | main |
| **PR** | — |
| **Reviewed (UTC)** | 2026-05-31T11:45:00Z |

### Summary

This commit is the initial import of **traefik-dns-to-unifi**: an Express **web-api** that reads Traefik router hostnames, reconciles UniFi UDM static DNS A records (with optional managed-domain cleanup), a React **web-ui** for configuration and manual sync, and Docker/CI packaging. The layering (routes → managers → providers/repository) and validation-before-save for Traefik/UniFi endpoints are sensible, and API keys are masked in public config responses. Overall risk is **high** for any deployment reachable beyond a trusted admin network: configuration and DNS mutation APIs have no authentication, managed-domain sync can delete UDM records, and several sync/error paths report success or empty data when underlying operations fail.

### Findings

- **Severity:** blocker  
  **Location:** `web-api/server.js`, `web-api/routes/config.js`, `web-api/routes/discovered.js`  
  **Issue:** All `/api/config` PUT and `/api/discovered` POST endpoints are unauthenticated. Any client that can reach the service can read/update UniFi credentials (stored in `config/config.json`), change `targetIp` / overrides, and trigger full or per-host DNS writes (manual sync uses `forceApply: true` and ignores `dryRun`).  
  **Suggestion:** Fail closed: require auth (API token, mTLS, or reverse-proxy auth) before mutating routes; at minimum document that the service must not be exposed publicly and bind only to a trusted interface. Consider separating read-only vs admin scopes.

- **Severity:** major  
  **Location:** `web-api/managers/SyncManager.js` (`syncOne`, `_performCreate`, `_performUpdate`)  
  **Issue:** `syncOne` always returns `{ action: 'created' | 'updated' | 'unchanged' }` after calling execute-mode helpers that swallow failures (`_performCreate` / `_performUpdate` catch errors, log, and return `0` without rethrowing). The API responds `200 { ok: true, action: 'created' }` even when UDM create/update failed.  
  **Suggestion:** Propagate failures from execute helpers (or check return value in `syncOne` and throw `AppError`), and return 502/503 with a clear message when UDM operations fail.

- **Severity:** major  
  **Location:** `web-api/managers/SyncManager.js` (`sync`, managed-domain cleanup)  
  **Issue:** When `managedDomain` is set, sync deletes existing UDM A records in that domain that are not in the desired set. Manual `POST /api/discovered/sync` forces apply (`forceApply: true`), so a misconfigured domain or Traefik outage can remove production DNS entries.  
  **Suggestion:** Gate deletes behind an explicit config flag (e.g. `allowCleanup`), require dry-run preview in UI for deletes, or default cleanup to off. Log delete candidates at `warn` and surface counts in the API response.

- **Severity:** major  
  **Location:** `web-api/managers/SyncManager.js` (`getList`)  
  **Issue:** Traefik and UDM list calls use `.catch(() => [])`, so transient API failures produce an empty or stale-looking list without an error to the client; the UI may show “not in UDM” incorrectly.  
  **Suggestion:** Fail the GET with a 502/503 and message when a configured provider’s list call fails, or include a `degraded` / `errors[]` field in the response.

- **Severity:** minor  
  **Location:** `web-api/server.js` (`_startSyncInterval`)  
  **Issue:** The periodic sync interval is fixed at process start. Changing `syncIntervalMinutes` via `PUT /api/config/system` updates persisted config but does not reschedule `setInterval`.  
  **Suggestion:** Restart or reschedule the timer when system config is saved (e.g. callback from `ConfigRoutes` after `updateSystem`).

- **Severity:** minor  
  **Location:** `web-api/providers/BaseProvider.js` (`_request`)  
  **Issue:** Debug logging serializes the full HTTP response body (`JSON.stringify(res.data)`), which can include UniFi DNS payloads and other sensitive data in logs when `logLevel` is `debug`.  
  **Suggestion:** Log status, URL, and duration only; truncate or redact bodies at debug, or omit body logging for UDM/Traefik providers.

- **Severity:** minor  
  **Location:** `web-api/repositories/ConfigRepository.js` (`write`)  
  **Issue:** Config is written directly with `writeFileSync` (no write-to-temp + rename). A crash mid-write can corrupt `config.json` containing the UniFi API key.  
  **Suggestion:** Atomic write pattern (temp file in same directory, then `rename`).

- **Severity:** minor  
  **Location:** `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`  
  **Issue:** No container `HEALTHCHECK`; compose has no health check. CI “Test Docker image” only runs `node --version`, so a broken UI build or missing `web-ui/dist` in production would not be caught.  
  **Suggestion:** Add `HEALTHCHECK` hitting `GET /api/config` (or a dedicated `/health`). In CI, run the container briefly and curl `/api/config`, or assert `web-ui/dist/index.html` exists after build.

- **Severity:** minor  
  **Location:** Repository (web-api / web-ui)  
  **Issue:** No automated unit or integration tests for `ConfigManager`, `SyncManager`, or route handlers despite DNS mutation behavior.  
  **Suggestion:** Add tests for config merge/masking, managed-domain filter logic, dry-run vs execute, and ValidationError paths on routes (can use mocked providers).

- **Severity:** nit  
  **Location:** `web-api/managers/ConfigManager.js` (`updateSystem`, dryRun)  
  **Issue:** `next.dryRun = body.dryRun === true` is easy to misread and treats non-boolean truthy values inconsistently compared to `load()` / `save()` (`dryRun === false ? false : true`).  
  **Suggestion:** Use the same normalization as elsewhere: `next.dryRun = body.dryRun !== false` when enabling “active” mode, or accept explicit boolean only with schema validation.

- **Severity:** nit  
  **Location:** `web-api/routes/discovered.js` (`POST /sync/one`)  
  **Issue:** Endpoint is implemented but not exposed in `web-ui/src/api/client.js` (dead API surface for now).  
  **Suggestion:** Wire UI per-row sync or remove until needed to reduce attack surface.

### Test plan

- Run `npm run install:all`, `npm run dev`, and verify UI loads via Vite proxy; save Traefik and UniFi settings with invalid URLs and confirm `400` + error message; valid settings set `traefikReady` / `udmReady` on `GET /api/config`.
- With Traefik and UDM reachable: `GET /api/discovered` lists hostnames; enable **Active** (`dryRun: false`) and confirm scheduled sync creates/updates records; keep **dryRun** on and confirm logs show “would create/update” without UDM changes.
- Set `managedDomain` and verify only matching hosts sync; confirm cleanup delete behavior in a lab UDM before production.
- `POST /api/discovered/sync` with `dryRun: true` in config still applies changes—confirm this matches operator expectations.
- `POST /api/discovered/sync/one` with a failing UDM (wrong key): confirm API should fail (after fix); today verify it incorrectly returns success.
- Docker: `docker build` and `docker run -p 3000:3000 -v ./config:/app/web-api/config`; open UI at port 3000 in production mode; confirm static assets and `/api/*` routing.
- Security: from another host on the LAN, call `PUT /api/config/unifi` without auth—document/mitigate before any non-local deployment.
- CI: extend pipeline to smoke-test HTTP or dist artifact, not only `node --version`.
