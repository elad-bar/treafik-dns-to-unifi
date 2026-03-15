"use strict";

const winston = require("winston");

const level = process.env.LOG_LEVEL || "info";

const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
    winston.format.printf((info) => {
      const { timestamp, level, message } = info;
      const className = info.className ? ` [${info.className}]` : "";
      return `${timestamp} [${level.toUpperCase()}]${className} ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
