"use strict";

const logger = require("../services/logger");

const log = logger.child({ className: "ApiRouter" });

/**
 * Log when an API request is received and when the response is sent (status).
 * Only runs for paths under /api.
 */
function requestLoggingMiddleware(req, res, next) {
  if (!req.path.startsWith("/api")) {
    return next();
  }
  const method = req.method;
  const path = req.path;
  log.debug(`Request: ${method} ${path}`);
  res.on("finish", () => {
    log.debug(`Response: ${res.statusCode} ${method} ${path}`);
  });
  next();
}

module.exports = { requestLoggingMiddleware };
