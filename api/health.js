"use strict";

const { applyCors } = require("../lib/cors");
const { authorize } = require("../lib/auth");
const { errorResponse } = require("../lib/errors");

module.exports = function health(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: { code: "BAD_REQUEST", message: "Gunakan GET." } });
  try {
    authorize(req);
    return res.status(200).json({
      ok: true,
      time: new Date().toISOString(),
      providers: {
        harbor: Boolean(process.env.TOKENHARBOR_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY)
      }
    });
  } catch (error) {
    const result = errorResponse(error);
    return res.status(result.status).json(result.body);
  }
};
