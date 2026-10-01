"use strict";

const { QUESTION_TYPES, HARBOR_MODELS, GEMINI_MODELS, IMAGE_MIME_TYPES } = require("./constants");
const { AppError, MESSAGES } = require("./errors");
const { validImageUrl } = require("./images");

const MAX_BODY_BYTES = 3.5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 6000;
const MAX_OPTIONS = 26;
const MAX_IMAGES = 4;

function badRequest(message = MESSAGES.BAD_REQUEST) {
  return new AppError("BAD_REQUEST", message, 400);
}

function cleanString(value, name, max = MAX_TEXT_LENGTH, allowEmpty = false) {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim())) {
    throw badRequest(`Field ${name} tidak valid.`);
  }
  return value.trim();
}

function validateImage(image, name) {
  if (image == null) return null;
  if (!image || typeof image !== "object" || Array.isArray(image)) throw badRequest(`Gambar ${name} tidak valid.`);
  const mimeType = typeof image.mimeType === "string" ? image.mimeType.toLowerCase() : "";
  if (mimeType && !IMAGE_MIME_TYPES.has(mimeType)) throw badRequest(`Format gambar ${name} tidak didukung.`);
  const base64 = image.base64 == null ? null : image.base64;
  const url = image.url == null ? null : image.url;
  if (base64 !== null && (typeof base64 !== "string" || base64.length > 2 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))) {
    throw badRequest(`Data gambar ${name} tidak valid.`);
  }
  if (url !== null && typeof url !== "string") throw badRequest(`URL gambar ${name} tidak valid.`);
  if (url && !validImageUrl(url)) throw badRequest(`Host gambar ${name} tidak diizinkan.`);
  if (!base64 && !url) throw badRequest(`Gambar ${name} tidak memiliki data.`);
  return { base64, url, mimeType: mimeType || "image/jpeg" };
}

function validatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest();
  let encoded;
  try { encoded = JSON.stringify(body); } catch { throw badRequest(); }
  if (Buffer.byteLength(encoded, "utf8") > MAX_BODY_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", MESSAGES.PAYLOAD_TOO_LARGE, 413);
  }
  const question = body.question;
  if (!question || typeof question !== "object" || Array.isArray(question)) throw badRequest();
  if (typeof question.type !== "string" || !QUESTION_TYPES.has(question.type)) {
    throw new AppError("UNSUPPORTED_TYPE", MESSAGES.UNSUPPORTED_TYPE, 422);
  }
  const options = question.options == null ? [] : question.options;
  if (!Array.isArray(options) || options.length > MAX_OPTIONS) throw badRequest("Jumlah pilihan tidak valid.");
  const seenKeys = new Set();
  const normalizedOptions = options.map((option, index) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) throw badRequest("Pilihan jawaban tidak valid.");
    const key = cleanString(option.key, `options[${index}].key`, 1);
    if (!/^[A-Z]$/.test(key)) throw badRequest("Kode pilihan harus berupa huruf A sampai Z.");
    if (seenKeys.has(key)) throw badRequest("Kode pilihan harus unik.");
    seenKeys.add(key);
    return {
      key,
      text: cleanString(option.text == null ? "" : option.text, `options[${index}].text`, 1000, true),
      image: validateImage(option.image, `opsi ${key}`),
      isOther: option.isOther === true
    };
  });
  const images = question.images == null ? [] : question.images;
  if (!Array.isArray(images) || images.length > MAX_IMAGES) throw badRequest("Jumlah gambar tidak valid.");
  const normalizedImages = images.map((image, index) => validateImage(image, `soal ${index + 1}`));
  if (normalizedOptions.filter((option) => option.image).length + normalizedImages.length > MAX_IMAGES) {
    throw badRequest("Maksimal empat gambar per soal.");
  }
  if (["multiple_choice", "checkbox", "dropdown", "linear_scale"].includes(question.type) && !normalizedOptions.length) {
    throw badRequest("Soal pilihan harus menyertakan opsi.");
  }

  const lang = body.lang == null ? "auto" : cleanString(body.lang, "lang", 12);
  if (!new Set(["auto", "id", "en"]).has(lang)) throw badRequest("Bahasa jawaban tidak valid.");
  const models = body.models == null ? {} : body.models;
  if (!models || typeof models !== "object" || Array.isArray(models)) throw badRequest("Pilihan model tidak valid.");
  const harborModel = models.harbor == null ? (process.env.HARBOR_MODEL || "qwen3.8-flash:free") : models.harbor;
  const geminiModel = models.gemini == null ? (process.env.GEMINI_MODEL || "gemini-3.8-flash") : models.gemini;
  if (!HARBOR_MODELS.has(harborModel) || !GEMINI_MODELS.has(geminiModel)) throw badRequest("Model yang dipilih tidak tersedia.");

  const rows = question.rows == null ? null : question.rows;
  const columns = question.columns == null ? null : question.columns;
  for (const [name, value] of [["rows", rows], ["columns", columns]]) {
    if (value !== null && (!Array.isArray(value) || value.length > 50 || value.some((item) => typeof item !== "string" || item.length > 300))) {
      throw badRequest(`Field ${name} tidak valid.`);
    }
  }

  let scale = null;
  if (question.scale != null) {
    if (typeof question.scale !== "object" || Array.isArray(question.scale)) throw badRequest("Skala soal tidak valid.");
    const { min, max } = question.scale;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw badRequest("Rentang skala tidak valid.");
    scale = {
      min,
      max,
      minLabel: typeof question.scale.minLabel === "string" ? question.scale.minLabel.slice(0, 200) : "",
      maxLabel: typeof question.scale.maxLabel === "string" ? question.scale.maxLabel.slice(0, 200) : ""
    };
  }
  if (["grid_mc", "grid_checkbox"].includes(question.type) && (!rows || !rows.length || !columns || !columns.length)) {
    throw badRequest("Kisi soal harus memiliki baris dan kolom.");
  }
  if (question.type === "linear_scale" && !scale) throw badRequest("Skala linier tidak valid.");

  return {
    lang,
    models: { harbor: harborModel, gemini: geminiModel },
    question: {
      id: typeof question.id === "string" ? question.id.slice(0, 100) : "",
      type: question.type,
      text: cleanString(question.text, "question.text"),
      required: question.required === true,
      options: normalizedOptions,
      scale,
      rows,
      columns,
      images: normalizedImages
    }
  };
}

module.exports = { validatePayload, MAX_BODY_BYTES, MAX_TEXT_LENGTH, MAX_OPTIONS, MAX_IMAGES };
