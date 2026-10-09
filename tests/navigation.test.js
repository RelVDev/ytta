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
