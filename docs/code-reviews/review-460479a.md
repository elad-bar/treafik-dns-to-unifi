# Code review: 460479a

| Field | Value |
| --- | --- |
| **Repo** | elad-bar/treafik-dns-to-unifi |
| **Commit** | 460479a41cca323091dbea2efbd777475e76a8ff |
| **Base ref** | main |
| **Branch** | main |
| **PR** | — |
| **Reviewed (UTC)** | 2026-05-31T13:04:00Z |

### Summary

This merge introduces the initial end-to-end application: an Express **web-api** that reads Traefik router hostnames and syncs UniFi UDM static DNS A records, a React **web-ui** for configuration and discovery, Docker/Compose packaging, and CI that builds and pushes a GHCR image. The structure (managers, providers, masked API key in responses, default `dryRun: true`) is sensible for a homelab tool. **Overall risk is high** for any deployment where port 3000 is reachable beyond a trusted network: the management API is unauthenticated and can change UniFi credentials, trigger live DNS writes, and delete records when a managed domain is configured.

### Findings

- **Severity:** blocker  
  **Location:** `web-api/server.js` (`App._mountRoutes`), `web-api/routes/config.js`, `web-api/routes/discovered.js`  
  **Issue:** All `/api/config` and `/api/discovered` routes are open to any client that can reach the server. There is no auth middleware, API token, or network binding restriction. An attacker can read settings, overwrite the UniFi API key and URLs, run `POST /api/discovered/sync` (which applies changes with `forceApply: true`), or invoke `POST /api/discovered/sync/one`.  
  **Suggestion:** Fail closed: require authentication (e.g. shared secret header, basic auth, or reverse-proxy SSO) before mutating routes and before sync endpoints; document that the service must not be exposed publicly without that layer. At minimum, restrict sync/config PUT to localhost or an explicit `ADMIN_TOKEN` env check.

- **Severity:** major  
  **Location:** `web-api/routes/discovered.js` (`postSync`, `postSyncOne`), `web-api/managers/SyncManager.js` (`sync`, `syncOne`)  
  **Issue:** On-demand sync always executes against UDM (`forceApply: true` for full sync; `syncOne` always uses `_modes.execute`), ignoring config `dryRun`. That is reasonable for an explicit “Sync” button but combined with no auth it allows unauthenticated DNS mutation.  
  **Suggestion:** Gate sync endpoints behind the same auth as config writes; optionally honor `dryRun` unless the caller presents an elevated credential, and return a clear JSON body when sync is blocked.

- **Severity:** major  
  **Location:** `web-api/managers/SyncManager.js` (`sync`, managed-domain cleanup ~lines 235–244)  
  **Issue:** When `managedDomain` is set, sync **deletes** UDM A records in that domain that are not in the Traefik/desired set. A typo in managed domain or Traefik outage (empty host list) could remove many internal DNS entries.  
  **Suggestion:** Add a safety guard (e.g. skip deletes if desired set is empty or below a threshold), require explicit opt-in for deletions, or dry-run delete counts in the API response before apply. Document the behavior prominently in README/UI.

- **Severity:** major  
  **Location:** `web-api/server.js` (`App` constructor, `_startSyncInterval`)  
  **Issue:** Listen port and sync interval are fixed at process start. `ConfigManager.updateSystem` can persist new `syncIntervalMinutes` or `port`, but the running server does not rebind the port or reschedule `setInterval`.  
  **Suggestion:** Document that port/interval changes require restart, or reload interval after system config save and expose port only via `PORT` env with restart guidance in the UI.

- **Severity:** minor  
  **Location:** `web-api/managers/SyncManager.js` (`getList`, ~lines 60–65)  
  **Issue:** Traefik/UDM list failures are swallowed with `.catch(() => [])`, so the UI may show an empty table instead of an error when Traefik is misconfigured or unreachable.  
  **Suggestion:** Propagate failures (or partial errors in the JSON response) so the UI can surface `ValidationError`/HTTP 502-style messages.

- **Severity:** minor  
  **Location:** `web-api/providers/BaseProvider.js` (`_request`, ~lines 64–68)  
  **Issue:** At `debug` log level, full HTTP response bodies are logged via `JSON.stringify(res.data)`, which may include sensitive fields from Traefik/UDM responses.  
  **Suggestion:** Log status, URL, and truncated/redacted body only; avoid logging response bodies by default.

- **Severity:** minor  
  **Location:** `web-api/repositories/ConfigRepository.js` (`write`)  
  **Issue:** Config is written directly with `writeFileSync` (no write-to-temp + rename). A crash mid-write can corrupt `config.json` containing the UniFi API key.  
  **Suggestion:** Use atomic write (temp file in same directory, then `rename`).

- **Severity:** minor  
  **Location:** `.github/workflows/ci.yml` (Test Docker image step), repo-wide  
  **Issue:** CI only runs `node --version` inside the image; there are no unit/integration tests for providers, `SyncManager`, or routes. Regressions in DNS sync or validation will not be caught in CI.  
  **Suggestion:** Add a minimal test job (e.g. supertest against routes with mocked providers) and/or smoke test that the container starts and `GET /api/config` returns 200.

- **Severity:** minor  
  **Location:** `Dockerfile`, `docker-compose.yml`  
  **Issue:** No `HEALTHCHECK` and CI does not verify the app HTTP endpoint after build. Orchestrators cannot detect a hung Node process easily.  
  **Suggestion:** Add `HEALTHCHECK` curling `GET /api/config` (or a dedicated `/health`) and extend CI to run the container briefly and hit that endpoint.

- **Severity:** minor  
  **Location:** `web-api/providers/TraefikProvider.js` (`_extractHosts`, `HOST_REGEX`)  
  **Issue:** Hostnames are parsed only from `Host(\`...\`)` rules. Routers using `HostRegexp`, `HostSNI`, or combined rules may be omitted from sync.  
  **Suggestion:** Document limitation; extend parsing or use Traefik’s structured rule API if available.

- **Severity:** minor  
  **Location:** `web-api/managers/ConfigManager.js` (`updateOverrides`)  
  **Issue:** DNS override IPs are not validated (format, private-range policy). Invalid values will fail later at UDM API with opaque errors.  
  **Suggestion:** Validate IPv4 (and optional IPv6) before save; return `ValidationError` with a clear message.

- **Severity:** nit  
  **Location:** `web-ui/src/components/UnifiSection.jsx` (save handler), `web-api/managers/ConfigManager.js` (`updateUnifi`)  
  **Issue:** Masked key handling (`***`) is implemented correctly on the server; ensure UI never sends literal `***` when the user clears the password field intending to remove the key (empty string currently preserves the old key).  
  **Suggestion:** If “clear API key” is a product requirement, add an explicit control; otherwise document that leaving the field unchanged keeps the stored key.

- **Severity:** nit  
  **Location:** Repository naming (`treafik-dns-to-unifi` in CI image / compose vs `traefik-dns-to-unifi` in `package.json`)  
  **Issue:** Typo inconsistency may confuse operators searching GHCR or docs.  
  **Suggestion:** Align naming in a follow-up if renaming the GHCR package is feasible.

**Positive notes:** UniFi API key is masked in `ConfigManager.toPublic`; `updateUnifi` ignores placeholder `***`; default `dryRun: true` limits scheduled sync damage; Traefik/UniFi settings are validated live before save; `config.json` is gitignored; Docker volume path matches `ConfigRepository.configPath`.

### Test plan

- Run `npm run install:all` and `npm run dev`; configure Traefik and UniFi with invalid URLs and confirm PUT returns 400 with readable errors and no partial secret write.
- With valid Traefik/UniFi (or mocks), confirm `GET /api/discovered` lists hostnames and UDM status; toggle `dryRun`, wait for scheduled sync, and verify UDM is not modified until “Active” is enabled.
- Click **Sync** in the UI (`POST /api/discovered/sync`) and verify records create/update; with `managedDomain` set, verify cleanup only removes expected names and document behavior if Traefik returns zero hosts.
- Deploy via `docker build` / `docker compose up`; confirm UI loads on `:3000`, config persists under `./config`, and restart preserves settings.
- Security: from another host on the LAN, call `PUT /api/config/unifi` and `POST /api/discovered/sync` without credentials—confirm this matches your threat model or add auth and retest.
- CI: extend locally with `docker run -p 3000:3000` and `curl -sf http://localhost:3000/api/config` after image build.
- Set `LOG_LEVEL=debug` and exercise Traefik/UDM calls; confirm logs do not contain API keys or full sensitive response payloads.
