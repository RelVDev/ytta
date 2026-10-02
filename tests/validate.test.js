"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePayload } = require("../lib/validate");

const validPayload = () => ({
  lang: "id",
  models: { harbor: "qwen3.8-flash:free", gemini: "gemini-3.8-flash" },
  question: {
    id: "q1", type: "multiple_choice", text: "Rumus air?", required: true,
    options: [{ key: "A", text: "H2O" }, { key: "B", text: "CO2" }],
    images: [], scale: null, rows: null, columns: null
  }
});

test("payload dan pilihan model yang dikenal diterima", () => {
  assert.equal(validatePayload(validPayload()).question.options.length, 2);
});

test("model Harbor tambahan diterima", () => {
  for (const model of ["glm-5.3-flash", "glm-5.3-flashx", "gpt-6-luna", "gpt-6-luna-fast", "qwen3.8-flash"]) {
    const payload = validPayload();
    payload.models.harbor = model;
    assert.equal(validatePayload(payload).models.harbor, model);
  }
});

test("model di luar allowlist dan tipe tidak dikenal ditolak", () => {
  const payload = validPayload();
  payload.models.harbor = "arbitrary-model";
  assert.throws(() => validatePayload(payload), { code: "BAD_REQUEST" });
  payload.models.harbor = "qwen3.8-flash:free";
  payload.question.type = "unknown";
  assert.throws(() => validatePayload(payload), { code: "UNSUPPORTED_TYPE" });
});

test("opsi duplikat dan payload terlalu besar ditolak", () => {
  const duplicate = validPayload();
  duplicate.question.options[1].key = "A";
  assert.throws(() => validatePayload(duplicate), { code: "BAD_REQUEST" });
  const huge = validPayload();
  huge.question.text = "x".repeat(3.6 * 1024 * 1024);
  assert.throws(() => validatePayload(huge), { code: "PAYLOAD_TOO_LARGE" });
});

test("kode opsi harus huruf tunggal dan opsi gambar tetap diterima", () => {
  const invalid = validPayload();
  invalid.question.options[0].key = "AA";
  assert.throws(() => validatePayload(invalid), { code: "BAD_REQUEST" });
  const image = validPayload();
  image.question.options[0].image = { url: "https://cdn.example.org/option.png", mimeType: "image/png" };
  assert.equal(validatePayload(image).question.options[0].image.mimeType, "image/png");
  image.question.options[0].image.url = "http://cdn.example.org/private.png";
  assert.throws(() => validatePayload(image), { code: "BAD_REQUEST" });
});
