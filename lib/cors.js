"use strict";

function applyCors(req, res) {
  const origin = req.headers && req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  res.setHeader("Vary", "Origin");
  if (origin && (allowed.includes("*") || allowed.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", allowed.includes("*") ? "*" : origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Client-Token");
  res.setHeader("Access-Control-Max-Age", "600");
}

module.exports = { applyCors };
