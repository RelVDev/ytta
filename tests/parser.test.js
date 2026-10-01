"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

global.FormHelperUtils = { cleanText: (value) => String(value || "").replace(/\*/g, " ").replace(/\s+/g, " ").trim() };
require("../extension/content/10-parser.js");

test("parser mengenali tipe soal dalam fixture", () => {
  const fixture = fs.readFileSync(path.join(__dirname, "fixtures/questions.html"), "utf8");
  const dom = new JSDOM(fixture);
  const expected = {
    mc: "multiple_choice",
    checkbox: "checkbox",
    dropdown: "dropdown",
    short: "short_answer",
    paragraph: "paragraph",
    linear: "linear_scale",
    gridmc: "grid_mc",
    gridcheckbox: "grid_checkbox",
    date: "date",
    time: "time",
    upload: "unsupported_file_upload"
  };
  for (const [id, type] of Object.entries(expected)) {
    const parsed = global.FormHelperParser.parseQuestion(dom.window.document.getElementById(id));
    assert.equal(parsed.type, type, `tipe soal ${id}`);
  }
  assert.equal(global.FormHelperParser.parseQuestion(dom.window.document.getElementById("description")), null);
});

test("parser mengambil teks dan opsi serta menghapus tanda wajib", () => {
  const fixture = fs.readFileSync(path.join(__dirname, "fixtures/questions.html"), "utf8");
  const dom = new JSDOM(fixture);
  const parsed = global.FormHelperParser.parseQuestion(dom.window.document.getElementById("mc"));
  assert.equal(parsed.text, "Rumus air adalah");
  assert.deepEqual(parsed.options.map((option) => [option.key, option.text]), [["A", "H2O"], ["B", "CO2"]]);
});

test("parser memisahkan gambar soal dan gambar opsi", () => {
  const fixture = fs.readFileSync(path.join(__dirname, "fixtures/questions.html"), "utf8");
  const dom = new JSDOM(fixture);
  const parsed = global.FormHelperParser.parseQuestion(dom.window.document.getElementById("imageq"));
  assert.equal(parsed.images.length, 1);
  assert.match(parsed.images[0].url, /question\.png$/);
  assert.match(parsed.options[0].image.url, /option\.png$/);
});
