# Development Standards

This document is the **project development standard** for **traefik-dns-to-unifi**. It defines **how** we build: structure, APIs, UI, configuration, and conventions. The rules in this document **MUST** be followed; Key Principles and Access Rules are **enforced**.

---

## Table of Contents

1. [Code Quality](#code-quality)
2. [Architecture Standards (4-Level)](#architecture-standards-4-level)
3. [Dependency Rules](#dependency-rules)
4. [Base Class Hierarchy](#base-class-hierarchy)
5. [Naming Conventions](#naming-conventions)
6. [Project Structure](#project-structure)
7. [Project Configuration Files](#project-configuration-files)
8. [Development Setup](#development-setup)
9. [Production: UI Served by API](#production-ui-served-by-api)
10. [Docker](#docker)
11. [CI/CD](#cicd)
12. [Logging](#logging)
13. [Error Handling](#error-handling)
14. [API Response Format](#api-response-format)
15. [UI (MUI, Redux, API Layer)](#ui-mui-redux-api-layer)
16. [Environment Variables](#environment-variables)
17. [Key Principles](#key-principles)
18. [Access Rules](#access-rules)

---

## Code Quality

- All functions in **web-api** should be **JSDoc documented** to enable IntelliSense.
- Use clear parameter and return types in JSDoc where it helps.

---

## Architecture Standards (4-Level)

The backend **MUST** use a **4-level architecture**. Dependencies flow downward only.

**Level 1: Entry** (Routers, Jobs)
- Routers depend on **Managers** and **Middleware** only.
- Jobs depend on **Managers** only (NOT Repositories or Providers).
- Level 1 MUST NOT depend on other Level 1 components.
- Level 1 MUST NOT access Repositories or Providers directly.
- When routers need user/provider configuration, they get it from managers and pass as data objects (not manager instances).

**Level 2: Business Logic** (Managers)
- **Type A — Domain Managers:** One domain = one repository; extend `BaseDomainManager`. Can depend on Repositories (Level 3), Services (Level 4), other Domain Managers (with caution). MUST NOT depend on Routers, Jobs, Formatting Managers, Processing Managers.
- **Type B — Formatting Managers:** Transform data for external/API responses; extend `BaseFormattingManager`. Can depend on Domain Managers, Providers (Level 3). MUST NOT depend on Repositories (use Domain Managers), Routers, Jobs, Processing Managers. Receive user/provider configuration as data objects (parameters), NOT manager instances.
- **Type C — Processing Managers:** Process data (e.g. sync jobs); extend `BaseProcessingManager`. Can depend on Providers (Level 3), Domain Managers. MUST NOT depend on Repositories (use Domain Managers for data), Routers, Jobs, Formatting Managers.
- **Type D — Orchestration Managers:** Coordinate across domains; extend `BaseManager`. Can depend on Domain Managers, Services (Level 4), Repositories (Level 3, for cross-domain cleanup only). MUST NOT depend on Routers, Jobs, Formatting Managers, Processing Managers.

**Level 3: Data Access** (Repositories, Providers)
- **Repositories:** Atomic data access only (e.g. config file read/write). NO business logic.
- **Providers:** External API access only (e.g. Traefik, UDM clients).
- Level 3 MUST NOT depend on Managers, Routers, Jobs, Services.

**Level 4: Infrastructure** (Services, Middleware)
- **Services:** Standalone infrastructure (logging, etc.).
- **Middleware:** Authentication/authorization only when present.
- Level 4 MUST NOT depend on Managers, Repositories, Providers, Routers.

---

## Dependency Rules

1. **No circular dependencies:** Managers MUST NOT have circular dependencies.
2. **No lazy injection:** All dependencies via constructor only (no setters).
3. **Downward only:** Each level depends only on levels below it.
4. **Explicit dependencies:** All dependencies MUST be declared in constructors.
5. **No instance parameters:** Pass data/configuration objects, NOT manager instances as function parameters.
6. **No optional dependencies:** Either required or not present (no `= null` or `= undefined` for deps).

---

## Base Class Hierarchy

Managers **MUST** extend the appropriate base class:

```
BaseManager (base for all managers)
├── BaseDomainManager (domain managers: repository reference, domain data operations)
├── BaseFormattingManager (formatting managers: transform for API/external)
├── BaseProcessingManager (processing managers: e.g. sync using providers + domain managers)
└── (Orchestration Managers extend BaseManager directly)
```

Repositories extend `BaseRepository`; Providers extend `BaseProvider`. See [Project Structure](#project-structure).

---

## Naming Conventions

- **Properties and API bodies:** Use **camelCase** everywhere (e.g. `traefikBaseUrl`, `udmUrl`, `syncIntervalMinutes`, `dnsOverrides`).
- **API route paths:** Use kebab-case (e.g. `/api/config`, `/api/discovered`).
- **Config file keys:** camelCase to match the rest of the stack.

---

## Project Structure

### Root (Monorepo)

```
project-root/
├── web-api/           # Backend API (Node.js/Express)
├── web-ui/            # Frontend (React + Vite + MUI + Redux)
├── docs/              # Project documentation
├── config/            # Default/config file location (if used at root)
├── .github/workflows/ # CI
├── package.json       # Root scripts (start:api, dev, install:all, etc.)
├── Dockerfile
└── README.md
```

### Web API (4-level)

```
web-api/
├── routes/              # Level 1: API routes (depend on Managers, Middleware only)
├── jobs/                # Level 1: Scheduled jobs (depend on Managers only)
├── managers/            # Level 2: Business logic
│   ├── BaseManager.js
│   ├── domain/          # Type A: Domain Managers (BaseDomainManager)
│   ├── formatting/      # Type B: Formatting Managers (BaseFormattingManager)
│   ├── processing/      # Type C: Processing Managers (BaseProcessingManager)
│   └── orchestration/   # Type D: Orchestration Managers (BaseManager)
├── repositories/        # Level 3: Atomic data access (BaseRepository)
├── providers/           # Level 3: External APIs (BaseProvider), e.g. Traefik, UDM
├── services/            # Level 4: Infrastructure (e.g. logger)
├── middleware/          # Level 4: Auth etc. when present
├── errors/              # Custom error classes (AppError, statusCode)
└── ...
```

- **Routes** mount under `/api/*`; delegate to Managers only; use a central error sender (e.g. `sendError`).
- **Managers** contain all business logic; they use Repositories, Providers, and Services. No business logic in Routes or in Repositories/Providers.
- **Repositories** own config/file or future DB access; atomic operations only.
- **Providers** are external API clients (Traefik, UDM).

### Web UI

- **api/** — Only place that performs HTTP (e.g. `api/client.js`). Slices and components must not call `fetch`/axios directly for API access.
- **store/slices/** — Redux state; thunks call the API module and dispatch results.
- **components/** — Presentational; use `useSelector` / `useDispatch` (or app hooks) and selectors.

---

## Project Configuration Files

| File            | Commit? | Purpose |
|-----------------|--------|---------|
| `.gitignore`    | Yes    | Exclude node_modules, .env, build artifacts, logs, IDE/OS files. |
| `.dockerignore` | Yes    | Exclude git, node_modules, .env, docs, tests from build context. |
| `.env`          | Never  | Contains secrets; never commit. |

---

## Development Setup

- **API (port 3000):** `npm run start:api` or `node web-api/server.js`
- **UI dev server:** `npm run start:ui` or `npm run dev --prefix web-ui` (Vite with proxy to `/api` → `http://localhost:3000`)
- **Both:** `npm run dev` (concurrently)

UI uses `VITE_API_URL` when needed; with Vite proxy, `/api` can target the API server.

---

## Production: UI Served by API

**Enforced:** In production, the API **MUST** serve the built UI. There is a **single entry point**: the API server.

- Build the UI: `npm run build --prefix web-ui` (output e.g. `web-ui/dist` or `web-ui/build`).
- The API **MUST** serve static files from that directory and fall back to `index.html` for SPA routes, while reserving `/api` for API routes.
- Non-API GET requests **MUST** be served the SPA (e.g. `index.html`); API path prefixes **MUST** be handled by the API only.

---

## Docker

- Dockerfile at repo root (or under a `deployment/` folder if you introduce one).
- Prefer multi-stage build: build UI, then runtime stage with API + built UI.
- Use a healthcheck that hits an API endpoint (e.g. `/api/config` or a dedicated `/api/health`).
- Env (e.g. `PORT`, `TRAEFIK_API_URL`, `UDM_URL`, `UDM_API_KEY`, `TARGET_IP`, `LOG_LEVEL`) from environment, not baked in.

---

## CI/CD

- Workflow in `.github/workflows/` (e.g. `ci.yml`).
- On push/PR: install, lint, build API and UI.
- Optional: build Docker image and push on tags or main.

---

## Logging

- **Library:** Winston (web-api).
- **Level:** Controlled by `LOG_LEVEL` (e.g. `info` in production, `debug` when needed).
- **Practice:** Do not log secrets (API keys, tokens) or PII. Use structured metadata where helpful (e.g. `{ action, path }`). Prefer action-oriented messages.

---

## Error Handling

- **Backend:** Use a central `sendError(res, err)` (or equivalent) that:
  - Maps known errors to HTTP status (e.g. 400 for validation, 404 for not found, 500 for unexpected).
  - Returns JSON: `{ error: string }` (and optionally `details` for validation).
- **Errors:** Prefer explicit error types with a `statusCode` property when useful (e.g. ValidationError → 400, NotFoundError → 404). Do not expose internal details in client messages.

---

## API Response Format

- **Success:** Return the resource as JSON (object or array), or `{ data, message }` when metadata is needed.
- **Errors:** `{ error: string }`; optionally `{ error, details: [{ field, message }] }` for validation.
- **Status codes:** 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 500 (Internal Server Error).

---

## UI (MUI, Redux, API Layer)

- **Components:** MUI Material for UI; Redux for application and server state.
- **Data flow:** API → `api/client.js` (or single API module) → Redux thunks/slices → components. Components use selectors and dispatch; they do not perform HTTP.
- **Rule:** Only the API layer module(s) may use `fetch` or axios for backend calls. Pages, components, and slices must not import the HTTP client for API requests; they call thunks that use the API module.

---

## Environment Variables

Document all used variables (e.g. in README or here):

| Variable               | Required | Description |
|------------------------|----------|-------------|
| `PORT`                 | No       | API port (default 3000). |
| `TRAEFIK_API_URL`      | Config   | Traefik API base URL. |
| `UDM_URL`              | Config   | UniFi UDM base URL. |
| `UDM_API_KEY`          | Config   | UniFi API key. |
| `TARGET_IP`            | Config   | IP for DNS A records. |
| `LOG_LEVEL`            | No       | Winston level (e.g. info, debug). |
| `VITE_API_URL`         | No       | UI: API base URL (empty when using proxy). |

Config can also be stored in the config file; env can override or supply defaults. Never commit `.env`.

---

## Key Principles (Enforced)

These principles **MUST** be followed. Violations are not acceptable.

1. **One domain = one repository.** Domain Managers own one domain and one repository.
2. **No business logic in repositories.** Repositories perform only atomic data access.
3. **Processing Managers use Domain Managers for data.** They MUST NOT use Repositories directly.
4. **Formatting Managers receive config as parameters.** Data objects only; NOT manager instances.
5. **Orchestration Managers may use Repositories** only for cross-domain bulk cleanup when justified.
6. **Routers are thin.** They MUST delegate to Managers and send responses; no business logic in route handlers.
7. **Single API layer in UI.** All HTTP to the backend MUST go through the API layer module; Redux thunks call it; components MUST NOT.
8. **Single entry point in production.** The API MUST serve the built UI in production (see [Production: UI Served by API](#production-ui-served-by-api)).
9. **Environment and config.** Use environment variables and config for deployment; no hardcoded secrets or URLs.
10. **One naming convention.** camelCase for all properties and API bodies; kebab-case for route paths.

---

## Access Rules (Enforced)

- **Backend:** Routers MUST use only the public methods of Managers. MUST NOT access Repositories or Providers directly. MUST NOT access private properties (e.g. `_repository`) of any module; use only public methods.
- **Managers:** Formatting and Processing Managers MUST use only public methods of Domain Managers. If a needed public method does not exist, it MUST be added to the appropriate manager first.
- **UI:** Only the API layer module MAY perform HTTP to the backend. Pages, layout, and Redux slices MUST NOT import the HTTP client for API calls; they use thunks and selectors that rely on the API module.
