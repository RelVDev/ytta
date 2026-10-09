"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

test("HEBAT footer opens model picker and Alt+Shift+M works from an answer field", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div data-region="footer-container-popover">
      <button data-action="footer-popover" aria-label="Show footer"></button>
      <div class="popover footer"><div class="popover-body"><div class="footer-section p-3">Moodle footer</div></div></div>
    </div>
    <form id="responseform"><textarea aria-label="Jawaban essay"></textarea></form>
  </body></html>`, { url: "https://hebat.elearning.unair.ac.id/mod/quiz/attempt.php" });
  const previous = {
    document: global.document,
    location: global.location,
    FormHelperUtils: global.FormHelperUtils,
    FormHelperMain: global.FormHelperMain
  };
  const attachShadow = dom.window.Element.prototype.attachShadow;
  dom.window.Element.prototype.attachShadow = function attachOpenShadow() {
    const root = attachShadow.call(this, { mode: "open" });
    this.testShadowRoot = root;
    return root;
  };
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.FormHelperUtils = {
    DEFAULTS: {
      enabled: true, apiBase: "", token: "", lang: "auto", harborModel: "qwen3.8-flash:free",
      geminiModel: "gemini-3.8-flash", answerProvider: "harbor", imageToText: true,
      onlyHarbor: false, dataConsentAccepted: false
    },
    api: { storage: { local: { set: async () => {} } } },
    getSettings: async () => ({
      enabled: true, apiBase: "", token: "", lang: "auto", harborModel: "qwen3.8-flash:free",
      geminiModel: "gemini-3.8-flash", answerProvider: "harbor", imageToText: true,
      onlyHarbor: false, dataConsentAccepted: false
    }),
    sendMessage: async () => ({ ok: true })
  };
  global.FormHelperMain = { refresh() {} };
  delete require.cache[require.resolve("../extension/content/20-ui.js")];
  require("../extension/content/20-ui.js");

  try {
    global.FormHelperUI.initSettingsPanel();
    global.FormHelperUI.syncHelpMenu();

    const modelMenuButton = document.querySelector('[data-form-helper-menu-item="hebat-model-picker"]');
    assert.ok(modelMenuButton, "model switch item should be added inside the HEBAT footer popover");
    assert.equal(modelMenuButton.closest("[data-region='footer-container-popover']") !== null, true);

    const pickerHost = document.getElementById("fh-model-picker-host");
    const picker = pickerHost.testShadowRoot.querySelector(".picker");
    modelMenuButton.click();
    await Promise.resolve();
    assert.equal(picker.hidden, false, "footer menu should open the compact model picker");

    picker.hidden = true;
    const answerField = document.querySelector("textarea");
    answerField.focus();
    const shortcut = new dom.window.KeyboardEvent("keydown", {
      key: "M", code: "KeyM", altKey: true, shiftKey: true, bubbles: true, cancelable: true
    });
    answerField.dispatchEvent(shortcut);
    await Promise.resolve();
    assert.equal(shortcut.defaultPrevented, true, "shortcut should be consumed even while an answer field has focus");
    assert.equal(picker.hidden, false, "Alt+Shift+M should open the model picker");
  } finally {
    dom.window.Element.prototype.attachShadow = attachShadow;
    dom.window.close();
    global.document = previous.document;
    global.location = previous.location;
    global.FormHelperUtils = previous.FormHelperUtils;
    global.FormHelperMain = previous.FormHelperMain;
    delete global.FormHelperUI;
  }
});
