"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validImageUrl, prepareImages } = require("../lib/images");

test("URL gambar HTTPS hanya mengizinkan host Google yang ditetapkan", () => {
  assert.ok(validImageUrl("https://lh3.googleusercontent.com/photo.png"));
  assert.ok(validImageUrl("https://fonts.gstatic.com/image.png"));
  assert.equal(validImageUrl("http://lh3.googleusercontent.com/photo.png"), null);
  assert.equal(validImageUrl("https://example.com/image.png"), null);
  assert.equal(validImageUrl("https://googleusercontent.com.evil.test/image.png"), null);
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
