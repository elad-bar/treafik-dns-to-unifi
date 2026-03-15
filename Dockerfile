FROM node:20-alpine

WORKDIR /app

# Install dependencies (node_modules excluded by .dockerignore)
COPY package.json package-lock.json* ./
COPY web-api/package.json web-api/package-lock.json* ./web-api/
COPY web-ui/package.json web-ui/package-lock.json* ./web-ui/

RUN npm ci --omit=dev && npm cache clean --force
RUN cd web-api && npm ci --omit=dev && npm cache clean --force
RUN cd web-ui && npm ci && npm cache clean --force

# Application source (overwrites package dirs; reinstall to get node_modules back)
COPY . .
RUN npm ci --omit=dev && npm cache clean --force
RUN cd web-api && npm ci --omit=dev && npm cache clean --force
RUN cd web-ui && npm ci && npm cache clean --force

# Build UI, then prune web-ui to production deps only
RUN cd web-ui && npm run build
RUN cd web-ui && rm -rf node_modules && npm ci --omit=dev && npm cache clean --force

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "web-api/server.js"]
