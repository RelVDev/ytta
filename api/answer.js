"use strict";

const { applyCors } = require("../lib/cors");
const { authorize } = require("../lib/auth");
const { validatePayload, MAX_BODY_BYTES } = require("../lib/validate");
const { enforceRateLimit } = require("../lib/ratelimit");
const { prepareImages } = require("../lib/images");
const { normalizeModelOutput } = require("../lib/normalize");
const { callHarbor, callGemini, ProviderError, publicProviderError } = require("../lib/providers");
const { HARBOR_IMAGE_MODELS } = require("../lib/constants");
const { AppError, errorResponse, MESSAGES } = require("../lib/errors");

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST, 400); }
  }
  return {};
}

module.exports = async function answer(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: { code: "BAD_REQUEST", message: "Gunakan POST." } });

  const started = Date.now();
  const requestController = new AbortController();
  if (typeof res.on === "function") {
    res.on("close", () => {
      if (!res.writableEnded) requestController.abort();
    });
  }
  let questionType = "unknown";
  let provider = "none";
  try {
    const declaredLength = Number(req.headers && req.headers["content-length"] || 0);
    if (declaredLength > MAX_BODY_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", MESSAGES.PAYLOAD_TOO_LARGE, 413);
    authorize(req);
    await enforceRateLimit(req);
    const payload = validatePayload(parseBody(req));
    questionType = payload.question.type;
    const prepared = await prepareImages(payload.question, requestController.signal);
    const args = {
      question: payload.question,
      lang: payload.lang,
      images: prepared.images,
      signal: requestController.signal
    };

    let rawOutput;
    let usedModel = payload.models.harbor;
    const harborImageUnsupported = prepared.images.length > 0 && !HARBOR_IMAGE_MODELS.has(payload.models.harbor);
    try {
      provider = "harbor";
      rawOutput = await callHarbor({
        ...args,
        images: harborImageUnsupported ? [] : prepared.images,
        imagesUnsupported: harborImageUnsupported,
        model: payload.models.harbor
      });
    } catch (error) {
      if (!(error instanceof ProviderError) || !error.retryable) throw error;
      if (payload.onlyHarbor) throw error;
      provider = "gemini";
      usedModel = payload.models.gemini;
      rawOutput = await callGemini({ ...args, model: payload.models.gemini });
    }

    const answer = normalizeModelOutput(rawOutput, payload.question);
    const latencyMs = Date.now() - started;
    console.info(JSON.stringify({ event: "answer", type: questionType, provider, latencyMs, status: "ok" }));
    return res.status(200).json({
      ok: true,
      type: questionType,
      answer,
      confidence: answer.confidence,
      explanation: answer.explanation,
      latencyMs,
      provider,
      model: usedModel,
      ...(prepared.unavailable || harborImageUnsupported ? { warning: "IMAGE_UNAVAILABLE" } : {})
    });
  } catch (error) {
    if (requestController.signal.aborted) return;
    const result = errorResponse(error instanceof ProviderError ? publicProviderError(error) : error);
    console.info(JSON.stringify({
      event: "answer",
      type: questionType,
      provider,
      latencyMs: Date.now() - started,
      status: "error",
      code: error instanceof AppError ? error.code : error instanceof ProviderError && error.timeout ? "TIMEOUT" : "MODEL_ERROR"
    }));
    return res.status(result.status).json(result.body);
  }
};
