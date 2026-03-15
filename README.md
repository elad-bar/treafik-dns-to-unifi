# traefik-dns-to-unifi

Syncs Traefik HTTP router hostnames to UniFi UDM DNS A records. Runs on a configurable interval (default 15 minutes), fetches routes from the Traefik API, and creates internal DNS records on your UniFi controller so local resolution points to a chosen IP (e.g. your reverse proxy).

## Prerequisites

- **Traefik** with its API reachable (the app reads HTTP router hostnames from the Traefik API).
- **UniFi controller** (UDM or other) with **API access enabled and an API key**. The app creates and manages internal DNS A records via the UniFi API.
- **Node.js** 20+ if running locally, or **Docker** to run the image.

## Configuration

All configuration is done from the **web UI** after the app is running. Open the app in a browser, then set Traefik URL, UniFi UDM URL and API key, target IP, sync interval, DNS overrides, and options. Values are saved to `config/config.json` (under `web-api/config/` when running from repo root). That file may contain secrets; do not commit it.

Optional **environment variables** (override defaults only): `PORT` (default `3000`), `LOG_LEVEL` (`error`, `warn`, `info`, `debug`; default `info`).

## Run locally

```bash
npm run install:all
npm run start:api
```

Then open http://localhost:3000 and configure Traefik, UniFi, and overrides in the UI.

## Run with Docker

```bash
docker build -t traefik-dns-unifi .
docker run -p 3000:3000 -v ./config:/app/web-api/config traefik-dns-unifi
```

Open http://localhost:3000 and configure via the UI. The config file is persisted in the mounted `./config` volume.

## Docker Compose example

Configuration is read from `config/config.json`. Mount it so the app can read and persist it. Optionally set `PORT` or `LOG_LEVEL` via env.

```yaml
services:
  traefik-dns-unifi:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/web-api/config
    environment:
      - NODE_ENV=production
      # Optional: PORT (default 3000), LOG_LEVEL (default info)
    restart: unless-stopped
```

Ensure the container can reach both the Traefik API and the UDM (e.g. shared network with Traefik). Config is written to the mounted volume when you save from the UI; you can start with an empty `./config/` directory. Do not commit the config file.
