"use strict";

const QUESTION_TYPES = new Set([
  "multiple_choice", "checkbox", "dropdown", "short_answer", "paragraph",
  "linear_scale", "grid_mc", "grid_checkbox", "date", "time"
]);

const HARBOR_MODELS = new Set([
  "qwen3.8-flash:free",
  "deepseek-v4.1-flash:free",
  "mimo-v2.6-flash:free"
]);

const GEMINI_MODELS = new Set([
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash"
]);

const GROQ_ANSWER_MODELS = new Set([
  "openai/gpt-oss-120b"
]);

const GROQ_OCR_MODELS = new Set([
  "qwen/qwen3.8-27b"
]);

const HARBOR_IMAGE_MODELS = new Set([
  "qwen3.8-flash:free",
  "deepseek-v4.1-flash:free"
]);

const IMAGE_MIME_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif"
]);

module.exports = { QUESTION_TYPES, HARBOR_MODELS, GEMINI_MODELS, GROQ_ANSWER_MODELS, GROQ_OCR_MODELS, HARBOR_IMAGE_MODELS, IMAGE_MIME_TYPES };
