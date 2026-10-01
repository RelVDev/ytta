"use strict";

const { IMAGE_MIME_TYPES } = require("./constants");

const ALLOWED_HOST = /(^|\.)(googleusercontent\.com|ggpht\.com|gstatic\.com)$/i;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 6 * 1024 * 1024;

async function readLimitedBody(response, limit) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > limit) throw new Error("Image too large");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error("Image too large");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

function validImageUrl(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || !ALLOWED_HOST.test(url.hostname)) return null;
  return url;
}

async function fetchImage(urlValue, parentSignal) {
  let url = validImageUrl(urlValue);
  if (!url) throw new Error("Disallowed image URL");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const response = await fetch(url, { signal: controller.signal, redirect: "manual" });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new Error("Too many image redirects");
        url = validImageUrl(new URL(location, url).toString());
        if (!url) throw new Error("Disallowed image redirect");
        continue;
      }
      if (!response.ok) throw new Error("Image fetch failed");
      const mimeType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!IMAGE_MIME_TYPES.has(mimeType)) throw new Error("Unsupported image MIME type");
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > MAX_IMAGE_BYTES) throw new Error("Image too large");
      const bytes = await readLimitedBody(response, MAX_IMAGE_BYTES);
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Image too large");
      return { base64: bytes.toString("base64"), mimeType };
    }
    throw new Error("Image redirect limit");
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener("abort", onAbort);
  }
}

async function prepareImages(question, signal) {
  const entries = [];
  for (let index = 0; index < question.images.length; index += 1) {
    entries.push({ ...question.images[index], label: `[Gambar soal ${index + 1}]` });
  }
  for (const option of question.options) {
    if (option.image) entries.push({ ...option.image, label: `[Gambar opsi ${option.key}]` });
  }
  const prepared = [];
  let totalBytes = 0;
  let unavailable = false;
  const results = await Promise.all(entries.slice(0, 4).map(async (image) => {
    try {
      const material = image.base64
        ? { base64: image.base64, mimeType: image.mimeType }
        : await fetchImage(image.url, signal);
      const bytes = Math.floor(material.base64.length * 3 / 4);
      return { image, material, bytes };
    } catch {
      if (signal && signal.aborted) throw new Error("Request aborted");
      return null;
    }
  }));
  for (const result of results) {
    if (!result) { unavailable = true; continue; }
    if (totalBytes + result.bytes > MAX_TOTAL_IMAGE_BYTES) { unavailable = true; continue; }
    totalBytes += result.bytes;
    prepared.push({
      base64: result.material.base64,
      mimeType: result.material.mimeType || result.image.mimeType || "image/jpeg",
      label: result.image.label
    });
  }
  return { images: prepared, unavailable };
}

module.exports = { validImageUrl, fetchImage, prepareImages, readLimitedBody, MAX_IMAGE_BYTES };
