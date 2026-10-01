"use strict";

const crypto = require("node:crypto");
const { AppError, MESSAGES } = require("./errors");

function authorize(req) {
  const expected = process.env.CLIENT_TOKEN || "";
  const supplied = req.headers && (req.headers["x-client-token"] || req.headers["X-Client-Token"]);
  if (!expected || typeof supplied !== "string") {
    throw new AppError("UNAUTHORIZED", MESSAGES.UNAUTHORIZED, 401);
  }
  const expectedDigest = crypto.createHash("sha256").update(expected).digest();
  const suppliedDigest = crypto.createHash("sha256").update(supplied).digest();
  if (!crypto.timingSafeEqual(expectedDigest, suppliedDigest)) {
    throw new AppError("UNAUTHORIZED", MESSAGES.UNAUTHORIZED, 401);
  }
}

module.exports = { authorize };
