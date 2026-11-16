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
global.window = dom.window;
const mockStorageApi = {
  storage: {
    local: {
      _data: {
        enabled: true,
        harborModel: "deepseek-v4.1-flash-1017",
        geminiModel: "gemini-3.8-flash",
        answerProvider: "harbor",
        pembahasanMode: false,
        pembahasanShortcut: "Alt+Shift+P",
        dbModeEnabled: false,
        dbSelected: "fisika"
      },
      get: async (defaults) => ({ ...defaults, ...mockStorageApi.storage.local._data }),
      set: async (values) => { Object.assign(mockStorageApi.storage.local._data, values); }
    },
    onChanged: { addListener() {} }
  }
};
global.chrome = mockStorageApi;
global.FormHelperUtils = {
  cleanText: (value) => String(value || "").replace(/\*/g, " ").replace(/\s+/g, " ").trim(),
  api: mockStorageApi,
  getSettings: async () => ({ ...mockStorageApi.storage.local._data }),
  sendMessage: async () => ({}),
  DEFAULTS: {
    enabled: true, apiBase: "", token: "", lang: "auto", harborModel: "deepseek-v4.1-flash-1017",
    geminiModel: "gemini-3.8-flash", answerProvider: "harbor", imageToText: false,
    onlyHarbor: false, pembahasanMode: false, pembahasanShortcut: "Alt+Shift+P",
    dbModeEnabled: false, dbSelected: "fisika", dataConsentAccepted: false
  }
};
require("../extension/content/00-utils.js");
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
    const nextPageLink = capturedDom.window.document.querySelector('.qn_buttons a[data-quiz-page="1"]');
    assert.ok(nextPageLink);
    assert.match(nextPageLink.href, /\/mod\/quiz\/attempt\.php\?.*page=1/);

    const nextPageDom = new JSDOM('<form id="responseform"><div id="question-next" class="que multichoice"><div class="qtext">Soal dari halaman berikutnya</div><div class="answer"><div><input type="radio" id="next-answer" name="next"><label for="next-answer"><span data-region="answer-label">Pilihan berikutnya</span></label></div></div></div></form>', { url: nextPageLink.href });
    global.document = nextPageDom.window.document;
    global.location = nextPageDom.window.location;
    const nextPageBlocks = global.FormHelperParser.getQuestionBlocks("hebat");
    assert.equal(nextPageBlocks.length, 1);
    assert.equal(global.FormHelperParser.parseQuestion(nextPageBlocks[0]).text, "Soal dari halaman berikutnya");
    nextPageDom.window.close();
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
    const control = global.FormHelperUI.questionControl(block, () => { answerClicks += 1; }, null, "hebat");
    const shadow = control.host.shadowRoot;
    const buttons = shadow.querySelectorAll("button");
    assert.equal(buttons.length, 1, "tombol upload file tidak ditampilkan pada HEBAT");
    buttons[0].click();
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

test("HEBAT tidak menampilkan launcher mengambang di kiri bawah dan kotak jawaban menyatu dengan #cce6ea", () => {
  const originalAttachShadow = dom.window.Element.prototype.attachShadow;
  dom.window.Element.prototype.attachShadow = function attachShadowForTest(options) {
    return originalAttachShadow.call(this, { ...options, mode: "open" });
  };
  try {
    global.FormHelperUI.initHebatLauncher();
    assert.equal(document.querySelector("#fh-hebat-launcher"), null);

    const block = document.querySelector("#sample-mc");
    const formulation = document.createElement("div");
    formulation.className = "formulation clearfix";
    while (block.firstChild) formulation.append(block.firstChild);
    block.append(formulation);

    const control = global.FormHelperUI.questionControl(block, () => {}, null, "hebat");
    let formClicks = 0;
    const form = document.querySelector("#responseform");
    const onFormClick = () => { formClicks += 1; };
    form.addEventListener("click", onFormClick);
    try {
      control.showAnswer({
        answer: { display: "A. a. Pilihan A" },
        confidence: 0.92,
        explanation: "Cocok.",
        discussion: "Diketahui:\nm = 2 kg\n\nDitanya:\nF?\n\nDijawab:\nF = m × a\nF = 10 N",
        dbComparison: {
          status: "mismatch",
          dbName: "Fisika Dasar",
          dbDisplay: "B. b. Pilihan B"
        }
      }, "multiple_choice");

      const answerHost = formulation.querySelector(".fh-answer-host");
      assert.ok(answerHost, "panel jawaban berada di dalam .formulation");
      const style = answerHost.shadowRoot.querySelector("style").textContent;
      assert.match(style, /#cce6ea/);
      const text = answerHost.shadowRoot.textContent;
      assert.match(text, /DB & AI Berbeda/);
      assert.match(text, /A\. Pilihan A/);
      assert.doesNotMatch(text, /A\. a\. Pilihan A/);
      assert.match(text, /Diketahui/);
      assert.match(text, /Dijawab/);
      assert.ok(answerHost.shadowRoot.querySelector(".disc-final"));
      const closeBtn = answerHost.shadowRoot.querySelector(".close-btn");
      assert.ok(closeBtn, "tombol tutup berada di bagian atas kotak jawaban");
      closeBtn.click();
      assert.equal(formulation.querySelector(".fh-answer-host"), null);
      assert.equal(control.panel, null);
      assert.ok(block.isConnected && formulation.isConnected, "div soal dan formulation HEBAT tetap utuh saat jawaban ditutup");
      assert.ok(formulation.querySelector(".qtext") && formulation.querySelector(".answer"), "konten soal dan pilihan HEBAT tidak ikut terhapus");
      assert.equal(formClicks, 0, "klik tombol tutup di kotak jawaban tidak membocorkan event ke #responseform");

      control.showAnswer({ answer: { display: "A. Pilihan A" }, confidence: 0.9, explanation: "Ulang." }, "multiple_choice");
      assert.ok(formulation.querySelector(".fh-answer-host"), "jawaban dapat dibuka kembali setelah ditutup");
      control.removePanel();
      assert.equal(formulation.querySelector(".fh-answer-host"), null);
      assert.ok(formulation.querySelector(".qtext") && formulation.querySelector(".answer"));
    } finally {
      form.removeEventListener("click", onFormClick);
    }
  } finally {
    dom.window.Element.prototype.attachShadow = originalAttachShadow;
  }
});

test("prepareHebatQuestionAsync fallback ke fetch ber-cookie saat canvas gagal", async () => {
  const block = document.createElement("div");
  block.className = "que multichoice";
  block.innerHTML = '<div class="qtext">Soal gambar <img src="https://hebat.elearning.unair.ac.id/pluginfile.php/123/soal.png" /></div><div class="answer"><div><input type="radio" id="r1" name="r"><label for="r1"><span data-region="answer-label">Opsi A</span></label></div></div>';
  const img = block.querySelector("img");
  Object.defineProperty(img, "complete", { configurable: true, value: true });
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: 0 });
  const previousFetch = global.fetch;
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  global.fetch = async () => ({
    ok: true,
    blob: async () => ({
      type: "image/png",
      arrayBuffer: async () => pngBytes.buffer
    })
  });
  try {
    const parsed = global.FormHelperParser.parseQuestion(block);
    const prepared = await global.FormHelperParser.prepareHebatQuestionAsync(block, parsed);
    assert.equal(prepared.images.length, 1);
    assert.equal(prepared.images[0].mimeType, "image/png");
    assert.ok(prepared.images[0].base64);
    assert.equal(prepared.imagesTruncated, false);
  } finally {
    global.fetch = previousFetch;
  }
});

test("shortcut dinamis Mode Pembahasan dan kontrol menu (?) HEBAT bekerja", async () => {
  const originalAttachShadow = dom.window.Element.prototype.attachShadow;
  dom.window.Element.prototype.attachShadow = function attachShadowForTest(options) {
    return originalAttachShadow.call(this, { ...options, mode: "open" });
  };
  const footer = document.createElement("div");
  footer.setAttribute("data-region", "footer-container-popover");
  footer.innerHTML = '<div class="popover footer"><div class="popover-body"></div></div>';
  document.body.append(footer);
  try {
    global.FormHelperUI.initSettingsPanel();
    global.FormHelperUI.initHebatSettingsShortcut();
    global.FormHelperUI.syncHelpMenu();

    const pembBtn = footer.querySelector('[data-form-helper-menu-item="hebat-pembahasan"]');
    const dbToggle = footer.querySelector('[data-form-helper-menu-item="hebat-db-toggle"]');
    const dbSelect = footer.querySelector('[data-form-helper-menu-item="hebat-db-select"]');
    assert.ok(pembBtn && dbToggle && dbSelect);
    assert.equal(dbSelect.disabled, true);

    const shortcut = new dom.window.KeyboardEvent("keydown", {
      key: "P", code: "KeyP", altKey: true, shiftKey: true, bubbles: true, cancelable: true
    });
    document.dispatchEvent(shortcut);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(shortcut.defaultPrevented, true);
    assert.match(pembBtn.textContent, /ON/);

    dbToggle.click();
    await new Promise((r) => setTimeout(r, 20));
    assert.match(dbToggle.textContent, /ON/);
    assert.equal(dbSelect.disabled, false);
  } finally {
    footer.remove();
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
