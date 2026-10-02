"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const dns = require("node:dns");
const https = require("node:https");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const { validImageUrl, fetchImage, prepareImages } = require("../lib/images");

test("URL gambar HTTPS menerima host publik dan menolak koneksi lokal", () => {
  assert.ok(validImageUrl("https://lh3.googleusercontent.com/photo.png"));
  assert.ok(validImageUrl("https://fonts.gstatic.com/image.png"));
  assert.ok(validImageUrl("https://images.example.org/photo.png"));
  assert.ok(validImageUrl("https://googleusercontent.com.evil.com/image.png"));
  assert.equal(validImageUrl("http://images.example.org/photo.png"), null);
  assert.equal(validImageUrl("https://localhost/image.png"), null);
  assert.equal(validImageUrl("https://10.0.0.8/image.png"), null);
  assert.equal(validImageUrl("https://[fd00::1]/image.png"), null);
  assert.ok(validImageUrl("https://[2606:4700:4700::1111]/image.png"));
  assert.equal(validImageUrl("https://user:pass@images.example.org/photo.png"), null);
});

test("fetch URL host eksternal memakai alamat publik hasil resolusi DNS", async () => {
  const originalLookup = dns.promises.lookup;
  const originalRequest = https.request;
  let lookupOptions;
  dns.promises.lookup = async () => [{ address: "93.184.216.34", family: 4 }];
  https.request = (_url, options, onResponse) => {
    lookupOptions = options;
    const request = new EventEmitter();
    request.end = () => {
      const response = Readable.from([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]);
      response.statusCode = 200;
      response.headers = { "content-length": "8" };
      onResponse(response);
    };
    return request;
  };
  try {
    const image = await fetchImage("https://images.example.org/photo.png");
    assert.equal(image.mimeType, "image/png");
    assert.equal(typeof lookupOptions.lookup, "function");
    const pinned = await new Promise((resolve, reject) => {
      lookupOptions.lookup("images.example.org", {}, (error, address, family) => {
        if (error) reject(error);
        else resolve({ address, family });
      });
    });
    assert.deepEqual(pinned, { address: "93.184.216.34", family: 4 });
  } finally {
    dns.promises.lookup = originalLookup;
    https.request = originalRequest;
  }
});

test("host eksternal yang resolve ke IP privat tidak di-fetch", async () => {
  const originalLookup = dns.promises.lookup;
  const originalRequest = https.request;
  dns.promises.lookup = async () => [{ address: "10.0.0.8", family: 4 }];
  https.request = () => { throw new Error("Permintaan HTTPS tidak seharusnya berjalan"); };
  try {
    await assert.rejects(fetchImage("https://images.example.org/photo.png"), /Private image host/);
  } finally {
    dns.promises.lookup = originalLookup;
    https.request = originalRequest;
  }
});

test("gambar inline harus memiliki signature gambar yang valid", async () => {
  const result = await prepareImages({
    images: [{ mimeType: "image/png", base64: "aGVsbG8=" }],
    options: [],
    imagesTruncated: false
  });
  assert.equal(result.images.length, 0);
  assert.equal(result.unavailable, true);
});
