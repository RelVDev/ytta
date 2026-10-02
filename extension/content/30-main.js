"use strict";

(function initMain(global) {
  const { api, getSettings, sendMessage, cleanText } = global.FormHelperUtils;
  const controls = new WeakMap();
  const activeControls = new Set();
  let observer = null;
  let scanTimer = null;
  let scanPromise = null;
  let scanQueued = false;

  function isRespondentPage() {
    return location.pathname.includes("/forms/")
      && /\/(?:viewform|formResponse)\/?$/.test(location.pathname)
      && !location.pathname.includes("/edit");
  }

  async function handleAsk(control) {
    if (control.loading && control.requestId) {
      const requestId = control.requestId;
      const shouldSendCancel = control.sentRequest === true;
      control.requestId = null;
      control.sentRequest = false;
      control.setState("idle");
      control.showMessage("Permintaan dibatalkan.", false);
      if (shouldSendCancel) sendMessage({ type: "CANCEL", requestId }).catch(() => {});
      return;
    }
    const requestId = global.crypto && global.crypto.randomUUID
      ? global.crypto.randomUUID()
      : `fh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    control.requestId = requestId;
    control.sentRequest = false;
    control.setState("loading");
    control.removePanel();
    const pendingNotice = setTimeout(() => {
      if (control.requestId === requestId && control.loading) {
        control.showMessage("Masih memproses… tekan × untuk membatalkan.", false, () => handleAsk(control));
      }
    }, 8000);
    try {
      const question = global.FormHelperParser.parseQuestion(control.block);
      if (!question) throw new Error("Soal ini belum dapat dibaca.");
      if (question.type === "unsupported_file_upload") throw new Error("Soal unggah file belum didukung.");
      if (question.type === "dropdown" && !question.options.length) throw new Error("Pilihan dropdown belum terbaca. Coba buka daftar pilihan lalu tanya lagi.");
      const settings = await getSettings();
      if (!settings.dataConsentAccepted) throw new Error("Buka pengaturan dan setujui pemrosesan data soal untuk menggunakan saran AI.");
      control.sentRequest = true;
      const response = await sendMessage({
        type: "ANSWER",
        requestId,
        payload: {
          lang: settings.lang,
          models: {
            harbor: settings.harborModel,
            gemini: settings.geminiModel,
            groqAnswer: "openai/gpt-oss-120b",
            groqOcr: "qwen/qwen3.8-27b"
          },
          answerProvider: settings.answerProvider === "groq" ? "groq" : "harbor",
          imageToText: settings.imageToText === true,
          disableGemini: settings.onlyHarbor === true,
          question
        }
      });
      if (control.requestId !== requestId) return;
      if (!response || !response.ok) {
        const error = new Error(response && response.error || "Koneksi gagal, coba lagi.");
        error.code = response && response.code;
        throw error;
      }
      control.showAnswer(response.result, question.type);
      control.setState("done");
    } catch (error) {
      if (control.requestId !== requestId) return;
      control.showMessage(friendlyError(error), true);
      control.setState("error");
    } finally {
      clearTimeout(pendingNotice);
      if (control.requestId === requestId) control.requestId = null;
      control.sentRequest = false;
    }
  }

  function friendlyError(error) {
    if (error.code === "RATE_LIMITED") return "Terlalu banyak permintaan, tunggu sebentar.";
    if (error.code === "UNSUPPORTED_TYPE") return "Tipe soal ini belum didukung.";
    if (error.code === "TIMEOUT") return "Model AI melewati batas waktu. Coba lagi.";
    return error.message || "Koneksi gagal, coba lagi.";
  }

  function removeControl(control) {
    if (control.requestId) {
      const requestId = control.requestId;
      const shouldSendCancel = control.sentRequest === true;
      control.requestId = null;
      control.sentRequest = false;
      if (shouldSendCancel) sendMessage({ type: "CANCEL", requestId }).catch(() => {});
    }
    control.host.remove();
    control.restorePosition();
    control.removePanel();
    activeControls.delete(control);
  }

  async function scan() {
    if (!isRespondentPage()) return { enabled: false, count: 0 };
    const settings = await getSettings();
    for (const control of activeControls) {
      if (!control.block.isConnected) removeControl(control);
    }
    const blocks = [...document.querySelectorAll(global.FormHelperParser.SELECTORS.questionBlocks)];
    let count = 0;
    for (const block of blocks) {
      let question = null;
      try {
        question = global.FormHelperParser.parseQuestion(block);
      } catch {
        const staleControl = controls.get(block);
        if (staleControl) {
          removeControl(staleControl);
          controls.delete(block);
        }
        continue;
      }
      const fingerprint = question ? JSON.stringify(question) : "";
      const existing = controls.get(block);
      if (existing) {
        if (!settings.enabled) {
          removeControl(existing);
          controls.delete(block);
          continue;
        }
        if (existing.host.isConnected && existing.questionFingerprint === fingerprint) {
          count += 1;
          continue;
        }
        removeControl(existing);
        controls.delete(block);
      }
      if (!settings.enabled || !question || block.closest(".fh-ui-host, .fh-question-host, .fh-answer-host")) continue;
      const control = global.FormHelperUI.questionControl(block, handleAsk);
      control.questionFingerprint = fingerprint;
      controls.set(block, control);
      activeControls.add(control);
      count += 1;
    }
    return { enabled: settings.enabled, count };
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { requestScan().catch(() => {}); }, 200);
  }

  function requestScan() {
    if (scanPromise) {
      scanQueued = true;
      return scanPromise;
    }
    scanPromise = (async () => {
      let result;
      do {
        scanQueued = false;
        result = await scan();
      } while (scanQueued);
      return result;
    })().finally(() => { scanPromise = null; });
    return scanPromise;
  }

  function startObserver() {
    const target = document.body;
    observer = new MutationObserver((records) => {
      global.FormHelperUI.syncHelpMenu();
      const external = records.some((record) => {
        if (record.type === "childList") {
          const changedNodes = [...record.addedNodes, ...record.removedNodes];
          return changedNodes.some((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return true;
            return !node.matches(".fh-ui-host, .fh-question-host, .fh-answer-host, [data-form-helper-menu-item]")
              && !node.closest(".fh-ui-host, .fh-question-host, .fh-answer-host, [data-form-helper-menu-item]");
          });
        }
        const targetNode = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        return !targetNode?.closest(".fh-ui-host, .fh-question-host, .fh-answer-host, [data-form-helper-menu-item]");
      });
      if (external) scheduleScan();
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-label", "class", "data-params", "role", "style"],
      characterData: true
    });
  }

  function refresh() { scheduleScan(); }
  function loadCurrentPage() {
    clearTimeout(scanTimer);
    return requestScan();
  }

  if (isRespondentPage()) {
    global.FormHelperUI.initSettingsPanel();
    global.FormHelperUI.syncHelpMenu();
    requestScan().catch(() => {}).finally(startObserver);
    api.storage.onChanged.addListener(refresh);
  }
  global.FormHelperMain = { refresh, loadCurrentPage };
})(globalThis);
