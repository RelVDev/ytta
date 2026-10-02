"use strict";

const dns = require("node:dns");
const https = require("node:https");
const net = require("node:net");
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 6 * 1024 * 1024;

function detectImageMimeType(bytes) {
  if (bytes && bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes && bytes.length >= 6) {
    const signature = bytes.subarray(0, 6).toString("ascii");
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  if (bytes && bytes.length >= 12
      && bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

function isPublicIpv4(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && ((b === 0 && c === 0) || b === 168)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIp(address) {
  const normalized = String(address).replace(/^\[|\]$/g, "").toLowerCase();
  const family = net.isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family !== 6) return false;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7);
    if (net.isIP(mapped) === 4) return isPublicIpv4(mapped);
    const words = mapped.split(":");
    if (words.length === 2 && words.every((word) => /^[0-9a-f]{1,4}$/.test(word))) {
      const high = Number.parseInt(words[0], 16);
      const low = Number.parseInt(words[1], 16);
      return isPublicIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return false;
  }
  const firstGroup = Number.parseInt(normalized.split(":")[0] || "0", 16);
  if ((firstGroup & 0xe000) !== 0x2000) return false;
  if (/^2001:db8:/i.test(normalized) || /^2001:0:/i.test(normalized) || /^2002:/i.test(normalized)) return false;
  return true;
}

function isLocalHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (net.isIP(normalized)) return !isPublicIp(normalized);
  if (!normalized.includes(".")) return true;
  return [".localhost", ".local", ".internal", ".home.arpa", ".test", ".example", ".invalid", ".onion"]
    .some((suffix) => normalized === suffix.slice(1) || normalized.endsWith(suffix));
}

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
  if (url.protocol !== "https:" || url.username || url.password || isLocalHostname(url.hostname)) return null;
  return url;
}

async function resolvePublicAddress(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(normalized)) {
    if (!isPublicIp(normalized)) throw new Error("Private image host");
    return { address: normalized, family: net.isIP(normalized) };
  }
  const addresses = await dns.promises.lookup(normalized, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => !isPublicIp(entry.address))) throw new Error("Private image host");
  return addresses[0];
}

function requestHttpsImage(url, signal, address) {
  return new Promise((resolve, reject) => {
    const lookup = (_hostname, options, callback) => {
      if (typeof options === "function") callback = options;
      if (options && options.all) callback(null, [address]);
      else callback(null, address.address, address.family);
    };
    const request = https.request(url, { method: "GET", signal, lookup }, resolve);
    request.once("error", reject);
    request.end();
  });
}

async function readLimitedNodeBody(response, limit) {
  const chunks = [];
  let total = 0;
  for await (const chunk of response) {
    total += chunk.length;
    if (total > limit) {
      response.destroy();
      throw new Error("Image too large");
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, total);
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
      const address = await resolvePublicAddress(url.hostname);
      const response = await requestHttpsImage(url, controller.signal, address);
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        if (!location || redirects === 3) {
          response.destroy();
          throw new Error("Too many image redirects");
        }
        response.destroy();
        url = validImageUrl(new URL(location, url).toString());
        if (!url) throw new Error("Disallowed image redirect");
        continue;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        throw new Error("Image fetch failed");
      }
      const declared = Number(response.headers["content-length"] || 0);
      if (declared > MAX_IMAGE_BYTES) {
        response.destroy();
        throw new Error("Image too large");
      }
      const bytes = await readLimitedNodeBody(response, MAX_IMAGE_BYTES);
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Image too large");
      const mimeType = detectImageMimeType(bytes);
      if (!mimeType) throw new Error("Unsupported image MIME type");
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
  let unavailable = question.imagesTruncated === true;
  const results = await Promise.all(entries.slice(0, 4).map(async (image) => {
    try {
      let material;
      if (image.base64) {
        const bytes = Buffer.from(image.base64, "base64");
        const mimeType = detectImageMimeType(bytes);
        if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || !mimeType) throw new Error("Invalid inline image");
        material = { base64: bytes.toString("base64"), mimeType };
      } else {
        material = await fetchImage(image.url, signal);
      }
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

module.exports = { validImageUrl, fetchImage, prepareImages, readLimitedBody, detectImageMimeType, MAX_IMAGE_BYTES };
