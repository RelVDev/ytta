"use strict";

const extensionApi = globalThis.browser || globalThis.chrome;
const IMAGE_HOST = /(^|\.)(googleusercontent\.com|ggpht\.com|gstatic\.com)$/i;
const MAX_IMAGE_BYTES = 512 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 8000;
const activeRequests = new Map();
const cancelledRequests = new Set();
const pendingRequests = new Set();

function isAllowedImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (IMAGE_HOST.test(url.hostname)) return true;
    if (url.hostname === "drive.google.com") return /^\/(?:uc|thumbnail|file\/d)(?:\/|$)/.test(url.pathname);
    if (url.hostname === "drive.usercontent.google.com") return /^\/(?:download|uc)(?:\/|$)/.test(url.pathname);
    if (url.hostname === "docs.google.com") return /^\/(?:uc|document\/d|forms-images-rt)(?:\/|$)/.test(url.pathname);
    return false;
  } catch {
    return false;
  }
}

function isHebatImageUrl(value) {
  try { return new URL(value).hostname === "hebat.elearning.unair.ac.id"; } catch { return false; }
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function detectImageMimeType(bytes) {
  if (bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.subarray(0, 6));
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 12
      && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return "";
}

async function readImageBlob(response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_IMAGE_BYTES) return null;
  if (!response.body || typeof response.body.getReader !== "function") {
    const blob = await response.blob();
    return blob.size <= MAX_IMAGE_BYTES ? blob : null;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(chunks, { type: response.headers.get("content-type") || "" });
}

async function convertImage(image) {
  if (!image || image.base64 || !image.url || !isAllowedImageUrl(image.url)) return image;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(image.url, { credentials: "include", signal: controller.signal });
    if (!response.ok || !isAllowedImageUrl(response.url || image.url)) return image;
    const blob = await readImageBlob(response);
    if (!blob) return image;
    if (blob.size > MAX_IMAGE_BYTES) return image;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mimeType = detectImageMimeType(bytes);
    if (!mimeType) return image;
    return { ...image, mimeType, base64: bytesToBase64(bytes) };
  } catch {
    return image;
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareQuestionImages(question) {
  const prepared = { ...question };
  let hebatImageSkipped = false;
  const questionImages = (question.images || []).filter((image) => {
    if (!image?.base64 && isHebatImageUrl(image?.url)) { hebatImageSkipped = true; return false; }
    return true;
  });
  prepared.images = await Promise.all(questionImages.map(convertImage));
  prepared.options = await Promise.all((question.options || []).map(async (option) => {
    if (option.image && !option.image.base64 && isHebatImageUrl(option.image.url)) {
      hebatImageSkipped = true;
      return { ...option, image: null };
    }
    return { ...option, image: option.image ? await convertImage(option.image) : null };
  }));
  if (hebatImageSkipped) prepared.imagesTruncated = true;
  return prepared;
}

async function requestHostPermission(apiBase) {
  try {
    const url = new URL(apiBase);
    if (url.protocol !== "https:") return { ok: false, message: "URL API harus memakai HTTPS." };
    const pattern = `${url.origin}/*`;
    const granted = await extensionApi.permissions.request({ origins: [pattern] });
    return granted ? { ok: true } : { ok: false, message: "Izin koneksi API tidak diberikan." };
  } catch {
    return { ok: false, message: "Base URL API tidak valid." };
  }
}

async function getSettings() {
  return extensionApi.storage.local.get({ apiBase: "", token: "" });
}

async function apiFetch(path, options = {}, requestId = "") {
  const settings = await getSettings();
  if (!settings.apiBase || !settings.token) throw new Error("Atur URL API dan token klien terlebih dahulu.");
  const base = settings.apiBase.replace(/\/+$/, "");
  const controller = new AbortController();
  if (requestId) activeRequests.set(requestId, controller);
  const timeout = setTimeout(() => controller.abort(), 65_000);
  try {
    return await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-Client-Token": settings.token, ...(options.headers || {}) }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendAnswer(payload, requestId) {
  try {
    const question = await prepareQuestionImages(payload.question);
    if (cancelledRequests.delete(requestId) || (activeRequests.get(requestId) && activeRequests.get(requestId).signal.aborted)) {
      const error = new Error("Permintaan dibatalkan.");
      error.name = "AbortError";
      throw error;
    }
    const body = JSON.stringify({ ...payload, question });
    const response = await apiFetch("/api/answer", {
      method: "POST",
      body,
    }, requestId).catch((error) => {
      if (error.name === "AbortError") throw new Error("Permintaan melewati batas waktu.");
      throw error;
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const message = result.error && result.error.message;
      const error = new Error(message || "Koneksi gagal, coba lagi.");
      error.code = result.error && result.error.code;
      throw error;
    }
    return result;
  } finally {
    activeRequests.delete(requestId);
    cancelledRequests.delete(requestId);
  }
}

async function ping() {
  const response = await apiFetch("/api/health", { method: "GET" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error((result.error && result.error.message) || "Tes koneksi gagal.");
  return result;
}

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return undefined;
  const handle = async () => {
    if (message.type === "ANSWER") {
      pendingRequests.add(message.requestId);
      try { return { ok: true, result: await sendAnswer(message.payload, message.requestId) }; }
      finally { pendingRequests.delete(message.requestId); cancelledRequests.delete(message.requestId); }
    }
    if (message.type === "PING") return { ok: true, result: await ping() };
    if (message.type === "REQUEST_API_PERMISSION") return await requestHostPermission(message.apiBase);
    if (message.type === "CANCEL") {
      const controller = activeRequests.get(message.requestId);
      if (controller) controller.abort();
      else if (pendingRequests.has(message.requestId)) cancelledRequests.add(message.requestId);
      return { ok: true };
    }
    return { ok: false, error: "Pesan tidak dikenal." };
  };
  handle().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message, code: error.code }));
  return true;
});
