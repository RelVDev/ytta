"use strict";

const { AppError, MESSAGES } = require("./errors");
const { buildPrompt } = require("./prompt");

const HARBOR_URL = "https://tokenharbor.ai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    keys: { type: "array", items: { type: "string" } },
    texts: { type: "array", items: { type: "string" } },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: { row: { type: "string" }, picks: { type: "array", items: { type: "string" } } },
        required: ["row", "picks"]
      }
    },
    confidence: { type: "number" },
    explanation: { type: "string" }
  },
  required: ["keys", "texts", "rows", "confidence", "explanation"]
};

class ProviderError extends Error {
  constructor(provider, message, { status = 0, retryable = false, timeout = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
    this.timeout = timeout;
  }
}

function isTransientStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchJson(provider, url, options, timeoutMs, parentSignal) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    if (!response.ok) {
      throw new ProviderError(provider, "Provider request failed", {
        status: response.status,
        retryable: isTransientStatus(response.status)
      });
    }
    return body;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (parentSignal && parentSignal.aborted) {
      throw new ProviderError(provider, "Client disconnected", { retryable: false });
    }
    const timeout = error && (error.name === "AbortError" || error.name === "TimeoutError");
    throw new ProviderError(provider, timeout ? "Provider timed out" : "Provider network error", {
      retryable: true,
      timeout
    });
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener("abort", onAbort);
  }
}

function imageDataUrl(image) {
  return `data:${image.mimeType};base64,${image.base64}`;
}

function extractGeminiText(body) {
  if (typeof body.output_text === "string") return body.output_text;
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const text = [];
  for (const step of steps) {
    if (step && step.type === "model_output" && Array.isArray(step.content)) {
      for (const part of step.content) if (part && part.type === "text" && typeof part.text === "string") text.push(part.text);
    }
  }
  return text.join("\n");
}

async function callHarbor({ question, lang, model, images, signal, imagesUnsupported = false }) {
  const apiKey = process.env.TOKENHARBOR_API_KEY;
  if (!apiKey) throw new ProviderError("harbor", "Harbor API key is not configured", { retryable: false });
  const prompt = buildPrompt(question, lang, images);
  if (imagesUnsupported) prompt.userText += "\nCatatan: soal memiliki gambar, tetapi model ini tidak menerima gambar. Jawab hanya dari teks yang terlihat dan jangan menebak isi gambar.";
  const content = [{ type: "text", text: prompt.userText }];
  for (const image of images) {
    content.push({ type: "image_url", image_url: { url: imageDataUrl(image) } });
  }
  const response = await fetchJson("harbor", HARBOR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: prompt.system }, { role: "user", content }],
      temperature: 0.1,
      max_tokens: 400
    })
  }, 9000, signal);
  const output = response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content;
  if (typeof output !== "string") throw new ProviderError("harbor", "Harbor response has no answer", { retryable: false });
  return output;
}

async function callGeminiOnce({ question, lang, model, images, timeoutMs, signal }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderError("gemini", "Gemini API key is not configured", { retryable: false });
  const prompt = buildPrompt(question, lang, images);
  const input = [{ type: "text", text: `${prompt.system}\n\n${prompt.userText}` }];
  for (const image of images) input.push({ type: "image", mime_type: image.mimeType, data: image.base64 });
  const thinking = Number.parseInt(process.env.GEMINI_THINKING_BUDGET || "0", 10) > 0 ? "low" : "minimal";
  const body = await fetchJson("gemini", GEMINI_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input,
      store: false,
      generation_config: { temperature: 0.2, thinking_level: thinking, max_output_tokens: 400 },
      response_format: { type: "text", mime_type: "application/json", schema: ANSWER_SCHEMA }
    })
  }, timeoutMs, signal);
  const output = extractGeminiText(body);
  if (!output) throw new ProviderError("gemini", "Gemini response has no answer", { retryable: false });
  return output;
}

async function callGemini(args) {
  const started = Date.now();
  try {
    return await callGeminiOnce({ ...args, timeoutMs: 6500 });
  } catch (error) {
    if (args.signal && args.signal.aborted) throw error;
    if (!(error instanceof ProviderError) || !error.retryable || !isTransientStatus(error.status)) throw error;
    if (Date.now() - started > 8000) throw error;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return callGeminiOnce({ ...args, timeoutMs: Math.max(1000, 12_000 - (Date.now() - started)) });
  }
}

function publicProviderError(error) {
  if (error instanceof ProviderError && error.timeout) return new AppError("TIMEOUT", MESSAGES.TIMEOUT, 504);
  return new AppError("MODEL_ERROR", MESSAGES.MODEL_ERROR, 502);
}

module.exports = {
  ProviderError,
  callHarbor,
  callGemini,
  publicProviderError,
  isTransientStatus,
  extractGeminiText,
  ANSWER_SCHEMA
};
