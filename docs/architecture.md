# Architecture

This document describes the **4-level architecture** for **traefik-dns-to-unifi**. The layering and dependency rules are **enforced** (see [development-standards.md](development-standards.md)).

---

## Backend: 4-Level Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Level 1: Entry                                                              │
│  Routes, Jobs                                                                │
│  - Depend on Managers and Middleware only                                    │
│  - MUST NOT depend on Repositories or Providers                              │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ depends on
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Level 2: Business Logic (Managers)                                          │
│  Domain (BaseDomainManager) | Formatting (BaseFormattingManager)             │
│  Processing (BaseProcessingManager) | Orchestration (BaseManager)          │
│  - Depend on Level 3 and Level 4 only                                       │
│  - Type rules: see development-standards.md                                  │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────────┐
│  Level 3: Data Access             │   │  Level 4: Infrastructure               │
│  Repositories (BaseRepository)    │   │  Services (e.g. logger)                │
│  Providers (BaseProvider)         │   │  Middleware (auth when present)       │
│  - Atomic data / external API    │   │  - MUST NOT depend on L1–L3           │
│  - MUST NOT depend on Managers   │   └───────────────────────────────────────┘
└───────────────────────────────────┘
```

- **Level 1** → Level 2 only (and Level 4 middleware).
- **Level 2** → Level 3 and Level 4 only.
- **Level 3** → no dependency on L1/L2/L4 (except infrastructure used inside providers, e.g. logger).
- **Level 4** → no dependency on L1, L2, L3.

---

## Base Class Hierarchy

```
BaseManager
├── BaseDomainManager   (domain managers: one repository, domain operations)
├── BaseFormattingManager
├── BaseProcessingManager
└── (Orchestration managers extend BaseManager)

BaseRepository   (repositories)
BaseProvider     (providers, e.g. Traefik, UDM)
```

Managers **MUST** extend the appropriate base; Repositories extend `BaseRepository`; Providers extend `BaseProvider`.

---

## Data and Config

- Configuration is file-based (e.g. `config/config.json`). A **Repository** (Level 3) owns read/write; no business logic in the repository.
- **Providers** (Level 3) wrap Traefik and UDM APIs. No business logic in providers.

---

## Production: Single Entry Point

In production, the API **MUST** serve the built UI. One process, one port: API handles `/api/*` and serves the SPA for all other GET requests.

---

## Frontend (Web UI)

```
Pages / Components
       │ useSelector, useDispatch, thunks
       ▼
Redux store (slices)
       │ thunks call
       ▼
api/client.js  ──────►  Backend API (/api/...)
```

- **Only** the API layer (`api/client.js`) **MAY** perform HTTP to the backend.
- Slices and components **MUST NOT** use `fetch` or axios for API access; they use thunks that call the API module.

---

## Dependency Rules (Enforced)

1. **Downward only:** Dependencies point only toward lower levels.
2. **No circular dependencies:** Especially between managers.
3. **Explicit:** All dependencies via constructors (no lazy injection, no optional deps).
4. **No instance parameters:** Pass data objects, not manager instances.
5. **Access by public API only:** Never access private properties of another module.
