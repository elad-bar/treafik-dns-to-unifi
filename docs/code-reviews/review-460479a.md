# Code review: 460479a

| Field | Value |
| --- | --- |
| **Repo** | elad-bar/treafik-dns-to-unifi |
| **Commit** | 460479a41cca323091dbea2efbd777475e76a8ff |
| **Base ref** | main |
| **Branch** | main |
| **PR** | — |
| **Reviewed (UTC)** | 2026-05-31T11:50:00Z |

### Summary

This commit merges the initial **traefik-dns-to-unifi** application: an Express **web-api** that reads Traefik router hostnames, reconciles DNS A records on UniFi UDM, and exposes configuration/sync endpoints; a React **web-ui** (Vite, MUI, Redux); plus Docker, Compose, and CI publishing to GHCR. The design is layered (routes → managers → providers/repository), defaults to **dry-run** for scheduled sync, and masks the UniFi API key in public config responses. Overall risk is **high** for any network-exposed deployment because the API is unauthenticated and can change UDM DNS and persist secrets, and several operational gaps (interval reload, local run docs, weak CI) should be addressed before treating this as production-ready.

### Findings

- **Severity:** `blocker`
- **Location:** `web-api/server.js` (`App._mountRoutes`), `web-api/routes/config.js`, `web-api/routes/discovered.js`
- **Issue:** All `/api/config` and `/api/discovered` routes are open with no authentication, authorization, or network binding restriction. Any client that can reach the port can read settings, update the UniFi API key, trigger full DNS sync (`POST /api/discovered/sync`), and apply per-host changes (`POST /api/discovered/sync/one`), including deletions when `managedDomain` cleanup runs.
- **Suggestion:** Fail closed: require at least one of API token (header), reverse-proxy auth, or localhost-only bind by default. Document threat model in README/Compose (do not publish port 3000 on untrusted networks without auth).

- **Severity:** `major`
- **Location:** `README.md` (Run locally), `web-api/server.js` (`App._mountProductionUi`)
- **Issue:** README tells users to run `npm run start:api` and open http://localhost:3000, but the UI is only served when `NODE_ENV === "production"` and `web-ui/dist` exists. A dev-only API start leaves port 3000 as JSON API only; the UI expects Vite dev server (proxy in `web-ui/vite.config.js`) or a production Docker build.
- **Suggestion:** Document `npm run dev` for local UI+API, or build UI and set `NODE_ENV=production` for single-port local runs. Align README URL with the chosen workflow (e.g. http://localhost:5173 for Vite dev).

- **Severity:** `major`
- **Location:** `web-api/server.js` (`App._startSyncInterval`), `web-api/managers/ConfigManager.js` (`updateSystem`)
- **Issue:** Sync interval is read once at startup and stored in `setInterval`. Changing `syncIntervalMinutes` via `PUT /api/config/system` updates persisted config but does not reschedule the timer until the process restarts.
- **Suggestion:** Hold interval handle on `App`, clear/reschedule when system config is saved (e.g. callback from `ConfigRoutes.putSystem` or event from `ConfigManager`), or document that interval changes require restart.

- **Severity:** `major`
- **Location:** `web-api/routes/discovered.js` (`postSync`, `postSyncOne`), `web-api/managers/SyncManager.js` (`sync`, `syncOne`)
- **Issue:** Manual `POST /api/discovered/sync` uses `forceApply: true` and ignores config `dryRun` (commented intentionally). `syncOne` always uses `_modes.execute`, so a single-host sync writes to UDM even when `dryRun` is enabled—while the periodic job respects dry-run. This is easy to misconfigure if the UI later exposes per-host sync without clear labeling.
- **Suggestion:** Either honor `dryRun` for `sync/one` unless `forceApply` is passed, or restrict `sync/one` to authenticated callers and surface “live apply” prominently in the UI/docs.

- **Severity:** `minor`
- **Location:** `web-api/managers/SyncManager.js` (`getList`)
- **Issue:** Traefik host fetch and UDM list failures are swallowed (`.catch(() => [])`), so the API can return an empty or partial list without an error status—operators may think Traefik has no routes or UDM is empty when the upstream call failed.
- **Suggestion:** Propagate failures as `502`/`503` with a clear message, or include a `warnings`/`degraded` field in the JSON when a provider call fails.

- **Severity:** `minor`
- **Location:** `web-api/providers/BaseProvider.js` (`_request`)
- **Issue:** At `debug` log level, full HTTP response bodies are logged (`JSON.stringify(res.data)`). UniFi/Traefik responses can include sensitive or large payloads and increase leak risk in centralized logs.
- **Suggestion:** Log status, duration, and truncated/summarized body at debug; never log request headers that carry `x-api-key`.

- **Severity:** `minor`
- **Location:** `.github/workflows/ci.yml` (`Test Docker image`)
- **Issue:** CI validates the image by running `node --version` only. It does not start the app, hit `/api/config`, or verify the UI build is present in the image.
- **Suggestion:** Add a smoke step: run container with a temp config volume, `curl -f http://localhost:3000/api/config`, and optionally check `web-ui/dist/index.html` exists in the image.

- **Severity:** `minor`
- **Location:** `Dockerfile`, `docker-compose.yml`
- **Issue:** No `HEALTHCHECK` and no documented liveness endpoint (the app has no `/health`). Orchestrators cannot detect a hung process vs. a healthy one.
- **Suggestion:** Add a lightweight `GET /api/health` (or `/health`) and `HEALTHCHECK` in the Dockerfile.

- **Severity:** `minor`
- **Location:** Repository root (no `web-api/**/*.test.js` or similar)
- **Issue:** No automated tests for hostname parsing (`TraefikProvider._extractHosts`), desired-set/sync logic (`SyncManager`), or config validation/masking (`ConfigManager.updateUnifi`, `toPublic`).
- **Suggestion:** Add focused unit tests for sync diff logic and Traefik rule parsing; optional supertest smoke tests for config routes.

- **Severity:** `minor`
- **Location:** `web-api/repositories/ConfigRepository.js` (`write`), `docker-compose.yml` (volume mount)
- **Issue:** UniFi API keys are stored in plaintext JSON on the mounted volume with default filesystem permissions; combined with unauthenticated API, compromise of either the host directory or the HTTP port exposes credentials and DNS control.
- **Suggestion:** Document volume permissions; consider env-based secret for API key with file only for non-secret settings; optional `chmod` guidance in README.

- **Severity:** `nit`
- **Location:** `docker-compose.yml`, `.github/workflows/ci.yml` (`IMAGE_NAME`), GHCR image name
- **Issue:** Product/repo naming uses **treafik** (typo) in registry paths while the project name is **traefik-dns-to-unifi**, which can confuse operators searching for the correct image.
- **Suggestion:** Align naming in a follow-up if renaming the GHCR package is acceptable; otherwise call out the typo explicitly in README.

### Test plan

- Run `npm run install:all` and `npm run dev`; confirm UI loads (Vite port), config saves via PUT endpoints through the proxy, and `GET /api/config` returns masked `udmApiKey`.
- Run production path: `docker build`, `docker run -p 3000:3000 -v ./config:/app/web-api/config`, open http://localhost:3000, complete Traefik + UniFi setup with **dry run on**, verify scheduled sync logs “Would create/update” only.
- With dry run enabled, call `POST /api/discovered/sync` and confirm UDM records actually change; call `POST /api/discovered/sync/one` with a test hostname and confirm behavior vs. dry-run expectation.
- Set `managedDomain`, add stray A record in UDM under that domain, run sync with dry run off, confirm cleanup deletes only in-scope names.
- Change `syncIntervalMinutes` in UI without restarting container; observe whether interval changes (expected failure today—note for fix verification).
- Enable `logLevel: debug`, run sync, confirm logs do not contain API keys or full UDM payloads.
- Run CI workflow locally or on branch: build image and add manual `curl` smoke test to `/api/config`.
- Negative tests: invalid Traefik URL on `PUT /api/config/traefik` returns 400; `GET /api/discovered` with Traefik down should not silently succeed with empty list (after fix).
