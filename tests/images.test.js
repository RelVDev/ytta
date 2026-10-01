"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validImageUrl } = require("../lib/images");

test("URL gambar HTTPS hanya mengizinkan host Google yang ditetapkan", () => {
  assert.ok(validImageUrl("https://lh3.googleusercontent.com/photo.png"));
  assert.ok(validImageUrl("https://fonts.gstatic.com/image.png"));
  assert.equal(validImageUrl("http://lh3.googleusercontent.com/photo.png"), null);
  assert.equal(validImageUrl("https://example.com/image.png"), null);
  assert.equal(validImageUrl("https://googleusercontent.com.evil.test/image.png"), null);
});
