"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const fixture = fs.readFileSync(path.join(__dirname, "fixtures/hebat-sample.html"), "utf8");
const dom = new JSDOM(fixture, { url: "https://hebat.elearning.unair.ac.id/mod/quiz/attempt.php" });
global.document = dom.window.document;
global.location = dom.window.location;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.FormHelperUtils = {
  cleanText: (value) => String(value || "").replace(/\*/g, " ").replace(/\s+/g, " ").trim(),
  api: {},
  getSettings: async () => ({}),
  sendMessage: async () => ({}),
  DEFAULTS: {}
};
require("../extension/content/10-parser.js");
require("../extension/content/20-ui.js");

test("parser HEBAT membaca teks, pilihan, dan gambar soal", () => {
  const block = document.querySelector("#sample-mc");
  const parsed = global.FormHelperParser.parseQuestion(block);
  assert.equal(parsed.type, "multiple_choice");
  assert.equal(parsed.text, "Pilih jawaban yang sesuai");
  assert.deepEqual(parsed.options.map(({ key, text }) => [key, text]), [["A", "Pilihan A"], ["B", "Pilihan B"]]);
  assert.equal(parsed.images.length, 1);
  assert.equal(parsed.images[0].base64, null);
});

test("simulasi halaman HEBAT.md membaca seluruh soal yang tertangkap", () => {
  const capturedHtml = fs.readFileSync(path.join(__dirname, "../HEBAT.md"), "utf8");
  const capturedDom = new JSDOM(capturedHtml, { url: "https://hebat.elearning.unair.ac.id/mod/quiz/attempt.php" });
  const previousDocument = global.document;
  const previousLocation = global.location;
  global.document = capturedDom.window.document;
  global.location = capturedDom.window.location;
  try {
    const capturedBlocks = global.FormHelperParser.getQuestionBlocks("hebat");
    const parsed = capturedBlocks.map((block) => global.FormHelperParser.parseQuestion(block));
    assert.equal(capturedBlocks.length, 10);
    assert.ok(parsed.every((question) => question && question.type === "multiple_choice"));
    assert.equal(parsed[0].text, "Adanya pengakuan dan penghargaan terhadap seluruh aset budaya kehidupan sosial yang ada dalam berbagai kelompok suku, agama, ras, dan antargolongan (SARA) di Indonesia merupakan pengertian Pancasila sebagai");
  } finally {
    global.document = previousDocument;
    global.location = previousLocation;
    capturedDom.window.close();
  }
});

test("parser HEBAT mengenali essay Moodle dengan editor Atto", () => {
  const block = document.createElement("div");
  block.className = "que essay deferredfeedback";
  block.innerHTML = '<div class="qtext"><div class="clearfix">Jelaskan proses fotosintesis.</div></div><div class="answer"><div class="qtype_essay_response"><div class="editor_atto_content" contenteditable="true"></div></div></div>';
  const parsed = global.FormHelperParser.parseQuestion(block);
  assert.equal(parsed.type, "paragraph");
  assert.equal(parsed.text, "Jelaskan proses fotosintesis.");
  assert.deepEqual(parsed.options, []);
});

test("persiapan gambar HEBAT memakai gambar yang sudah dirender tanpa fetch", () => {
  const image = document.querySelector("#sample-mc .qtext img");
  Object.defineProperty(image, "complete", { configurable: true, value: true });
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: 640 });
  Object.defineProperty(image, "naturalHeight", { configurable: true, value: 360 });
  const canvas = dom.window.HTMLCanvasElement.prototype;
  canvas.getContext = () => ({ fillStyle: "", fillRect() {}, drawImage() {} });
  canvas.toDataURL = (mimeType) => `${mimeType === "image/png" ? "data:image/png" : "data:image/jpeg"};base64,${mimeType === "image/png" ? "iVBORw0KGgo=" : "/9j/2Q=="}`;
  const previousFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = () => { fetchCalls += 1; throw new Error("HEBAT image fetch was not expected"); };
  try {
    const block = document.querySelector("#sample-mc");
    const parsed = global.FormHelperParser.parseQuestion(block);
    const prepared = global.FormHelperParser.prepareHebatQuestion(block, parsed);
    assert.equal(prepared.images.length, 1);
    assert.equal(prepared.images[0].mimeType, "image/png");
    assert.equal(prepared.images[0].url, null);
    assert.ok(prepared.images[0].base64);
    assert.equal(prepared.imagesTruncated, false);
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = previousFetch;
  }
});

test("kontrol HEBAT tidak mengirim event ke form atau mengubah jawaban", () => {
  const originalAttachShadow = dom.window.Element.prototype.attachShadow;
  dom.window.Element.prototype.attachShadow = function attachShadowForTest(options) {
    return originalAttachShadow.call(this, { ...options, mode: "open" });
  };
  const form = document.querySelector("#responseform");
  const block = document.querySelector("#sample-mc");
  const radio = block.querySelector('input[type="radio"]');
  radio.checked = true;
  const initialFormControlCount = form.elements.length;
  let answerClicks = 0;
  let bubbledClicks = 0;
  let submits = 0;
  form.addEventListener("click", () => { bubbledClicks += 1; });
  form.addEventListener("submit", (event) => { event.preventDefault(); submits += 1; });
  try {
    const control = global.FormHelperUI.questionControl(block, () => { answerClicks += 1; }, () => {}, "hebat");
    const shadow = control.host.shadowRoot;
    const buttons = shadow.querySelectorAll("button");
    buttons[0].click();
    buttons[1].click();
    assert.equal(buttons[0].type, "button");
    assert.match(shadow.querySelector("style").textContent, /#cbe6e9/);
    assert.equal(answerClicks, 1);
    assert.equal(bubbledClicks, 0);
    assert.equal(submits, 0);
    assert.equal(radio.checked, true);
    assert.equal(form.elements.length, initialFormControlCount);
  } finally {
    dom.window.Element.prototype.attachShadow = originalAttachShadow;
  }
});

test("launcher HEBAT putih dan tetap berada di pojok kiri bawah", () => {
  const originalAttachShadow = dom.window.Element.prototype.attachShadow;
  dom.window.Element.prototype.attachShadow = function attachShadowForTest(options) {
    return originalAttachShadow.call(this, { ...options, mode: "open" });
  };
  try {
    global.FormHelperUI.initHebatLauncher();
    const host = document.querySelector("#fh-hebat-launcher");
    const style = host.shadowRoot.querySelector("style").textContent;
    assert.match(style, /position:\s*fixed/);
    assert.match(style, /left:\s*max\(12px, env\(safe-area-inset-left\)\)/);
    assert.match(style, /bottom:\s*max\(12px, env\(safe-area-inset-bottom\)\)/);
    assert.match(style, /background:\s*#ffffff/);
    assert.equal(host.shadowRoot.querySelector(".toggle").type, "button");
    assert.match(host.shadowRoot.querySelector(".toggle").title, /Alt\+Shift\+O/);
  } finally {
    dom.window.Element.prototype.attachShadow = originalAttachShadow;
  }
});

test("Alt+Shift+O membuka pengaturan HEBAT dan tidak mengambil alih input", () => {
  const originalAttachShadow = dom.window.Element.prototype.attachShadow;
  dom.window.Element.prototype.attachShadow = function attachShadowForTest(options) {
    return originalAttachShadow.call(this, { ...options, mode: "open" });
  };
  try {
    global.FormHelperUI.initSettingsPanel();
    global.FormHelperUI.initHebatLauncher();
    const settingsHost = document.querySelector("#fh-settings-host");
    const panel = settingsHost.shadowRoot.querySelector(".panel");
    panel.hidden = true;
    const shortcut = new dom.window.KeyboardEvent("keydown", {
      key: "o", code: "KeyO", altKey: true, shiftKey: true,
      bubbles: true, cancelable: true, composed: true
    });
    document.dispatchEvent(shortcut);
    assert.equal(shortcut.defaultPrevented, true);
    assert.equal(panel.hidden, false);

    const input = settingsHost.shadowRoot.querySelector("#apiBase");
    input.focus();
    const whileEditing = new dom.window.KeyboardEvent("keydown", {
      key: "o", code: "KeyO", altKey: true, shiftKey: true,
      bubbles: true, cancelable: true, composed: true
    });
    input.dispatchEvent(whileEditing);
    assert.equal(whileEditing.defaultPrevented, false);
  } finally {
    dom.window.Element.prototype.attachShadow = originalAttachShadow;
  }
});
