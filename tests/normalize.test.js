"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeModelOutput, sanitizeMathText } = require("../lib/normalize");

const question = {
  type: "multiple_choice",
  options: [{ key: "A", text: "HCl" }, { key: "B", text: "CH3COOH" }]
};

test("normalizer menerima key dan membuat display di server", () => {
  const answer = normalizeModelOutput(JSON.stringify({ keys: ["B"], texts: ["CH3COOH"], confidence: 0.91, explanation: "Asam asetat." }), question);
  assert.equal(answer.display, "B. CH3COOH");
});

test("normalizer memetakan teks pilihan tanpa key dan membuang key asing", () => {
  const fromText = normalizeModelOutput({ keys: [], texts: ["CH3COOH"] }, question);
  assert.equal(fromText.display, "B. CH3COOH");
  assert.throws(() => normalizeModelOutput({ keys: ["Z"], texts: ["jawaban asing"] }, question), { code: "MODEL_ERROR" });
});

test("jawaban bebas dan grid dinormalisasi", () => {
  const short = normalizeModelOutput({ keys: [], texts: ["Tokyo"] }, { type: "short_answer", options: [] });
  assert.equal(short.display, "Tokyo");
  const grid = normalizeModelOutput({ rows: [{ row: "Apel", picks: ["Merah"] }] }, {
    type: "grid_mc", options: [], rows: ["Apel"], columns: ["Merah", "Hijau"]
  });
  assert.equal(grid.display, "Apel → Merah");
});

test("normalizer mempertahankan seluruh jawaban essay dan pemisah paragraf", () => {
  const essay = "Paragraf pertama berisi penjelasan awal. Kalimat kedua menjelaskan sebabnya.\n\nParagraf kedua menguraikan dampak dengan lebih lengkap. Kalimat terakhir menyimpulkan jawaban.";
  const answer = normalizeModelOutput({ keys: [], texts: [essay] }, { type: "paragraph", options: [] });
  assert.equal(answer.display, essay);
  assert.deepEqual(answer.texts, [essay]);
});

test("skala linear menampilkan nilai tanpa label opsi buatan", () => {
  const answer = normalizeModelOutput({ keys: ["B"], texts: ["2"], confidence: 0.8 }, {
    type: "linear_scale", options: [{ key: "A", text: "1" }, { key: "B", text: "2" }, { key: "C", text: "3" }]
  });
  assert.equal(answer.keys.length, 0);
  assert.equal(answer.display, "2");
});

test("sanitizeMathText mengubah LaTeX menjadi Unicode rapi untuk HEBAT", () => {
  const cleaned = sanitizeMathText("Diketahui:\n$v = \\sqrt{2 \\cdot g \\cdot h}$\n$\\Delta P = \\frac{F}{A} = 10^-23\\text{ Pa}, \\theta = 90^\\circ$");
  assert.match(cleaned, /√\(2 · g · h\)/);
  assert.match(cleaned, /ΔP = F\/A = 10⁻²³ Pa, θ = 90°/);
  assert.doesNotMatch(cleaned, /\$|\\frac|\\cdot|\\sqrt|\\circ/);
});

test("normalizeModelOutput menjamin discussion terisi saat pembahasanMode aktif", () => {
  const fromObject = normalizeModelOutput({
    keys: ["B"],
    texts: ["CH3COOH"],
    explanation: "Asam asetat.",
    discussion: { diketahui: "Rumus CH3COOH", ditanya: "Nama senyawa", dijawab: "Asam asetat" }
  }, question, { pembahasanMode: true });
  assert.match(fromObject.discussion, /Diketahui:\nRumus CH3COOH/);
  assert.match(fromObject.discussion, /Dijawab:\nAsam asetat/);

  const fallbackFromEmpty = normalizeModelOutput({
    keys: ["B"],
    texts: ["CH3COOH"],
    explanation: "CH3COOH adalah asam asetat.",
    discussion: ""
  }, { ...question, text: "Senyawa CH3COOH adalah?" }, { pembahasanMode: true });
  assert.match(fallbackFromEmpty.discussion, /Diketahui:\nSenyawa CH3COOH adalah\?/);
  assert.match(fallbackFromEmpty.discussion, /Dijawab:\nCH3COOH adalah asam asetat\./);
});
