"use strict";

const { applyCors } = require("../lib/cors");
const { authorize } = require("../lib/auth");
const { validatePayload, MAX_BODY_BYTES } = require("../lib/validate");
const { enforceRateLimit } = require("../lib/ratelimit");
const { prepareImages } = require("../lib/images");
const { normalizeModelOutput } = require("../lib/normalize");
const { callHarbor, callGemini, callGroqAnswer, callGroqImageToText, ProviderError, publicProviderError } = require("../lib/providers");
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
  let stage = "validate";
  let selectedModel = null;
  let imageInputCount = 0;
  let imageSentCount = 0;
  let imagesOcrProcessed = 0;
  let imagesUnavailable = false;
  let imageOcrFailed = false;
  let imageOcrApplied = false;
  let groqSkippedForImages = false;
  let groqUnavailable = false;
  let finalImageUnsupported = false;
  try {
    const declaredLength = Number(req.headers && req.headers["content-length"] || 0);
    if (declaredLength > MAX_BODY_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", MESSAGES.PAYLOAD_TOO_LARGE, 413);
    authorize(req);
    await enforceRateLimit(req);
    const payload = validatePayload(parseBody(req));
    questionType = payload.question.type;
    selectedModel = payload.answerProvider === "groq" ? payload.models.groqAnswer : payload.models.harbor;
    imageInputCount = payload.question.images.length + payload.question.options.filter((option) => option.image).length;
    stage = "prepare_images";
    const prepared = await prepareImages(payload.question, requestController.signal);
    imageSentCount = prepared.images.length;
    imagesUnavailable = prepared.unavailable;
    let answerQuestion = payload.question;
    let answerImages = prepared.images;
    if (payload.imageToText && prepared.images.length) {
      stage = "groq_ocr";
      try {
        const transcription = await callGroqImageToText({
          images: prepared.images,
          model: payload.models.groqOcr,
          signal: requestController.signal,
          budgetMs: Math.max(1000, Math.min(18_000, 56_000 - (Date.now() - started)))
        });
        if (!transcription) throw new ProviderError("groq", "Image transcription is empty", { retryable: true, reason: "EMPTY_RESPONSE" });
        answerQuestion = {
          ...payload.question,
          text: `${payload.question.text}\n\n<image-transcription>\n${transcription}\n</image-transcription>`.slice(0, 13_000)
        };
        answerImages = [];
        imageOcrApplied = true;
        imagesOcrProcessed = prepared.images.length;
      } catch (error) {
        if (requestController.signal.aborted) throw error;
        imageOcrFailed = true;
        stage = "answer_fallback_after_ocr";
      }
    }
    const args = {
      question: answerQuestion,
      lang: payload.lang,
      images: answerImages,
      signal: requestController.signal
    };

    const hasImagesForAnswer = answerImages.length > 0;
    const groqCanAnswer = !hasImagesForAnswer;
    const routes = [];
    if (payload.answerProvider === "groq") {
      if (groqCanAnswer) routes.push({ provider: "groq", model: payload.models.groqAnswer });
      else groqSkippedForImages = true;
      routes.push({ provider: "harbor", model: payload.models.harbor });
    } else {
      routes.push({ provider: "harbor", model: payload.models.harbor });
    }
    if (!payload.disableGemini) routes.push({ provider: "gemini", model: payload.models.gemini });

    let answer = null;
    let lastProviderError = null;
    for (const route of routes) {
      provider = route.provider;
      selectedModel = route.model;
      stage = route.provider;
      const timeoutBudgetMs = Math.max(1000, Math.min(56_000, 56_000 - (Date.now() - started)));
      try {
        let rawOutput;
        let routeImagesUnsupported = false;
        if (route.provider === "groq") {
          rawOutput = await callGroqAnswer({ ...args, model: route.model, timeoutMs: Math.min(30_000, timeoutBudgetMs) });
        } else if (route.provider === "harbor") {
          const imagesUnsupported = answerImages.length > 0 && !HARBOR_IMAGE_MODELS.has(route.model);
          routeImagesUnsupported = imagesUnsupported;
          rawOutput = await callHarbor({
            ...args,
            images: imagesUnsupported ? [] : answerImages,
            imagesUnsupported,
            model: route.model,
            timeoutMs: Math.min(40_000, timeoutBudgetMs)
          });
        } else {
          rawOutput = await callGemini({ ...args, model: route.model, timeoutBudgetMs });
        }
        stage = `normalize_${route.provider}`;
        answer = normalizeModelOutput(rawOutput, answerQuestion);
        finalImageUnsupported = routeImagesUnsupported;
        break;
      } catch (error) {
        lastProviderError = error;
        if (route.provider === "groq" && error instanceof ProviderError && error.reason === "NOT_CONFIGURED") groqUnavailable = true;
        const retryableFailure = (error instanceof ProviderError && error.retryable)
          || (error instanceof AppError && error.code === "MODEL_ERROR");
        if (!retryableFailure) throw error;
      }
    }
    if (!answer) throw lastProviderError || new AppError("MODEL_ERROR", MESSAGES.MODEL_ERROR, 502);

    const warning = prepared.unavailable || finalImageUnsupported
      ? "IMAGE_UNAVAILABLE"
      : imageOcrFailed
        ? "IMAGE_OCR_FALLBACK"
        : groqSkippedForImages
          ? "GPT_IMAGE_UNSUPPORTED"
          : groqUnavailable
            ? "GROQ_UNAVAILABLE"
          : undefined;

    const latencyMs = Date.now() - started;
    console.info(JSON.stringify({
      event: "answer",
      type: questionType,
      provider,
      model: selectedModel,
      latencyMs,
      status: "ok",
      imageInputCount,
      imageSentCount,
      imagesOcrProcessed,
      imageOcrApplied,
      imagesUnavailable,
      ...(finalImageUnsupported ? { imageUnsupportedByModel: true } : {})
    }));
    return res.status(200).json({
      ok: true,
      type: questionType,
      answer,
      confidence: answer.confidence,
      explanation: answer.explanation,
      latencyMs,
      provider,
      model: selectedModel,
      ...(warning ? { warning } : {})
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
      code: error instanceof AppError ? error.code : error instanceof ProviderError && error.timeout ? "TIMEOUT" : "MODEL_ERROR",
      stage,
      ...(selectedModel ? { model: selectedModel } : {}),
      ...(error instanceof ProviderError ? {
        providerStatus: error.status || undefined,
        providerRetryable: error.retryable,
        reason: error.reason || undefined
      } : error instanceof AppError && error.reason ? { reason: error.reason } : {}),
      imageInputCount,
      imageSentCount,
      imagesOcrProcessed,
      imageOcrApplied,
      imagesUnavailable
    }));
    return res.status(result.status).json(result.body);
  }
};
