"use strict";

const crypto = require("node:crypto");
const { AppError, MESSAGES } = require("./errors");

const memory = new Map();
const WINDOW_MS = 60_000;

function requestIdentity(req) {
  const forwarded = req.headers && req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "unknown";
  const token = req.headers && (req.headers["x-client-token"] || "unknown");
  return { ip, token: String(token).slice(0, 100) };
}

async function incrementRemote(key) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  const response = await fetch(`${base.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["INCR", key], ["EXPIRE", key, 60]])
  });
  if (!response.ok) throw new Error("Rate-limit store unavailable");
  const result = await response.json();
  return Number(result && result[0] && result[0].result);
}

async function incrementMemory(key, now) {
  const current = memory.get(key);
  if (!current || current.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (memory.size > 5000) {
      for (const [entry, value] of memory) if (value.resetAt <= now) memory.delete(entry);
    }
    return 1;
  }
  current.count += 1;
  return current.count;
}

async function enforceRateLimit(req) {
  const limit = Math.max(1, Number.parseInt(process.env.RATE_LIMIT_PER_MIN || "20", 10) || 20);
  const { ip, token } = requestIdentity(req);
  const now = Date.now();
  for (const [kind, id] of [["ip", ip], ["token", token]]) {
    const digest = crypto.createHash("sha256").update(id).digest("hex");
    const key = `fh:${kind}:${digest}`;
    let count;
    try { count = await incrementRemote(key); } catch { count = null; }
    if (count === null) count = await incrementMemory(key, now);
    if (count > limit) throw new AppError("RATE_LIMITED", MESSAGES.RATE_LIMITED, 429);
  }
}

module.exports = { enforceRateLimit, requestIdentity };
