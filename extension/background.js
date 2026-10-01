"use strict";

const extensionApi = globalThis.browser || globalThis.chrome;
const IMAGE_HOST = /(^|\.)(googleusercontent\.com|ggpht\.com|gstatic\.com)$/i;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const activeRequests = new Map();
const cancelledRequests = new Set();
const pendingRequests = new Set();

function isAllowedImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && IMAGE_HOST.test(url.hostname);
  } catch {
    return false;
  }
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
  try {
    let currentUrl = image.url;
    let response;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      if (!isAllowedImageUrl(currentUrl)) return image;
      response = await fetch(currentUrl, { credentials: "include", redirect: "manual" });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirects === 3) return image;
      currentUrl = new URL(location, currentUrl).toString();
    }
    if (!response) return image;
    if (!response.ok) return image;
    const blob = await readImageBlob(response);
    if (!blob) return image;
    const mimeType = (blob.type || "").split(";")[0].toLowerCase();
    if (!new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]).has(mimeType) || blob.size > MAX_IMAGE_BYTES) return image;
    return { ...image, mimeType, base64: bytesToBase64(await blob.arrayBuffer()) };
  } catch {
    return image;
  }
}

async function prepareQuestionImages(question) {
  const prepared = { ...question };
  prepared.images = await Promise.all((question.images || []).map(convertImage));
  prepared.options = await Promise.all((question.options || []).map(async (option) => ({
    ...option,
    image: option.image ? await convertImage(option.image) : null
  })));
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
  const timeout = setTimeout(() => controller.abort(), 20_000);
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
    let response;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (cancelledRequests.delete(requestId) || (activeRequests.get(requestId) && activeRequests.get(requestId).signal.aborted)) {
        const error = new Error("Permintaan dibatalkan.");
        error.name = "AbortError";
        throw error;
      }
      try {
        response = await apiFetch("/api/answer", { method: "POST", body }, requestId);
        break;
      } catch (error) {
        if (error.name === "AbortError") throw new Error("Permintaan melewati batas waktu.");
        if (attempt === 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
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
