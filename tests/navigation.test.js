"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

test("scanner Google Forms menambahkan kontrol setelah pengguna pindah section", async () => {
  const dom = new JSDOM('<form id="form"><div role="listitem" id="identity"><div role="heading">Nama lengkap</div><input type="text"></div></form>', {
    url: "https://docs.google.com/forms/d/e/test-form/viewform"
  });
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.Node = dom.window.Node;
  global.MutationObserver = dom.window.MutationObserver;
  global.FormHelperUtils = {
    api: { storage: { onChanged: { addListener() {} } } },
    getSettings: async () => ({ enabled: true }),
    sendMessage: async () => ({}),
    cleanText: (value) => String(value || "").replace(/\*/g, " ").replace(/\s+/g, " ").trim()
  };
  require("../extension/content/10-parser.js");
  global.FormHelperUI = {
    initSettingsPanel() {},
    initHebatSettingsShortcut() {},
    initHebatLauncher() {},
    syncHelpMenu() {},
    questionControl(block) {
      const host = document.createElement("div");
      host.className = "fh-question-host";
      block.insertBefore(host, block.firstChild);
      return { block, host, restorePosition() {}, removePanel() {} };
    }
  };
  require("../extension/content/30-main.js");

  try {
    const initial = await global.FormHelperMain.loadCurrentPage();
    assert.equal(initial.count, 1);
    assert.ok(document.querySelector("#identity .fh-question-host"));

    const nextBlock = document.createElement("div");
    nextBlock.id = "essay-question";
    nextBlock.setAttribute("role", "listitem");
    nextBlock.innerHTML = '<div role="heading">Jelaskan topik berikut</div><textarea></textarea>';
    document.querySelector("#identity").replaceWith(nextBlock);

    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.ok(nextBlock.querySelector(".fh-question-host"));
    assert.equal(document.querySelectorAll(".fh-question-host").length, 1);
  } finally {
    dom.window.close();
  }
});

test("Google Forms mendukung menu Mode Pembahasan, Mode DB, shortcut dinamis, dan kotak jawaban terintegrasi", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <ul role="menu" aria-label="Bantuan dan masukan"><li role="menuitem">Bantuan dan masukan</li></ul>
    <form id="form">
      <div role="listitem" id="q1">
        <div class="geS5n">
          <div role="heading">Tekanan hidrostatis pada kedalaman 5 m?</div>
          <div role="radio" aria-label="50.000 Pa"></div>
          <div role="radio" aria-label="100.000 Pa"></div>
        </div>
      </div>
    </form>
  </body></html>`, { url: "https://docs.google.com/forms/d/e/test-form/viewform" });

  const previous = {
    document: global.document,
    location: global.location,
    window: global.window,
    chrome: global.chrome,
    getComputedStyle: global.getComputedStyle,
    FormHelperUtils: global.FormHelperUtils,
    FormHelperUI: global.FormHelperUI
  };
  const attachShadow = dom.window.Element.prototype.attachShadow;
  dom.window.Element.prototype.attachShadow = function attachOpenShadow() {
    const root = attachShadow.call(this, { mode: "open" });
    this.testShadowRoot = root;
    return root;
  };
  const store = {
    enabled: true, apiBase: "", token: "", lang: "auto",
    harborModel: "deepseek-v4.1-flash-1017", geminiModel: "gemini-3.8-flash",
    answerProvider: "harbor", imageToText: false, onlyHarbor: false,
    pembahasanMode: false, pembahasanShortcut: "Alt+Shift+P",
    dbModeEnabled: false, dbSelected: "fisika", dataConsentAccepted: true
  };
  const mockApi = {
    storage: {
      local: {
        get: async (d) => ({ ...d, ...store }),
        set: async (v) => { Object.assign(store, v); }
      },
      onChanged: { addListener() {} }
    }
  };
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.window = dom.window;
  global.chrome = mockApi;
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

  delete require.cache[require.resolve("../extension/content/00-utils.js")];
  delete require.cache[require.resolve("../extension/content/20-ui.js")];
  require("../extension/content/00-utils.js");
  require("../extension/content/20-ui.js");

  try {
    global.FormHelperUI.initSettingsPanel();
    global.FormHelperUI.initHebatSettingsShortcut();
    global.FormHelperUI.syncHelpMenu();

    const menu = dom.window.document.querySelector('[role="menu"]');
    assert.ok(menu.querySelector('[data-form-helper-menu-item="model-picker"]'));
    assert.ok(menu.querySelector('[data-form-helper-menu-item="google-pembahasan"]'));

    let repeatedMutations = 0;
    const loopGuardObserver = new dom.window.MutationObserver((records) => {
      repeatedMutations += records.length;
    });
    loopGuardObserver.observe(menu, { childList: true, subtree: true, characterData: true, attributes: true });
    global.FormHelperUI.syncHelpMenu();
    global.FormHelperUI.syncHelpMenu();
    await new Promise((r) => setTimeout(r, 20));
    loopGuardObserver.disconnect();
    assert.equal(repeatedMutations, 0, "syncHelpMenu tidak boleh memicu mutasi DOM berulang saat state tidak berubah");
    const dbSelect = menu.querySelector('[data-form-helper-menu-item="google-db-select"]');
    const dbItem = menu.querySelector('[data-form-helper-menu-item="google-db"]');
    assert.ok(dbSelect && dbSelect.disabled === true);
    dbSelect.querySelector("option").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(store.dbModeEnabled, false, "klik option di dalam select tidak boleh men-toggle Mode DB");
    dbItem.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(store.dbModeEnabled, true, "Enter pada item menu Mode DB men-toggle Mode DB");

    const shortcut = new dom.window.KeyboardEvent("keydown", {
      key: "P", code: "KeyP", altKey: true, shiftKey: true, bubbles: true, cancelable: true
    });
    dom.window.document.dispatchEvent(shortcut);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(shortcut.defaultPrevented, true);
    assert.match(menu.querySelector('[data-form-helper-menu-item="google-pembahasan"]').textContent, /ON/);

    const block = dom.window.document.querySelector("#q1");
    const gformCard = block.querySelector(".geS5n");
    const control = global.FormHelperUI.questionControl(block, () => {}, null, "google");
    let formClicks = 0;
    dom.window.document.querySelector("#form").addEventListener("click", () => { formClicks += 1; });

    control.showAnswer({
      answer: { display: "A. 50.000 Pa" },
      confidence: 0.96,
      explanation: "P = ρ × g × h.",
      discussion: "Diketahui:\nh = 5 m\n\nDitanya:\nP?\n\nDijawab:\nP = 1000 × 10 × 5\nP = 50.000 Pa",
      dbComparison: { status: "match", dbName: "Fisika Dasar", dbDisplay: "A. 50.000 Pa" }
    }, "multiple_choice");

    const answerHost = gformCard.querySelector(".fh-answer-host");
    assert.ok(answerHost, "kotak jawaban Google Forms terpasang di dalam .geS5n");
    assert.match(answerHost.testShadowRoot.querySelector("style").textContent, /#673ab7/);
    assert.match(answerHost.testShadowRoot.textContent, /DB & AI Sama/);
    assert.match(answerHost.testShadowRoot.textContent, /Diketahui/);

    answerHost.testShadowRoot.querySelector(".close-btn").click();
    assert.equal(gformCard.querySelector(".fh-answer-host"), null);
    assert.ok(gformCard.querySelector('[role="heading"]'), "elemen soal Google Forms tetap utuh saat jawaban ditutup");
    assert.equal(formClicks, 0, "klik tutup tidak membocorkan event ke form Google Forms");
  } finally {
    dom.window.Element.prototype.attachShadow = attachShadow;
    dom.window.close();
    global.document = previous.document;
    global.location = previous.location;
    global.window = previous.window;
    global.chrome = previous.chrome;
    global.getComputedStyle = previous.getComputedStyle;
    global.FormHelperUtils = previous.FormHelperUtils;
    global.FormHelperUI = previous.FormHelperUI;
  }
});
