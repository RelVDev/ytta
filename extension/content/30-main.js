"use strict";

(function initMain(global) {
  const { api, getSettings, sendMessage, cleanText } = global.FormHelperUtils;
  const controls = new WeakMap();
  let observer = null;
  let scanTimer = null;

  function isRespondentPage() {
    return location.pathname.includes("/forms/") && /\/viewform\/?$/.test(location.pathname) && !location.pathname.includes("/edit");
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
        control.showMessage("Masih memproses… tekan × untuk membatalkan.", false);
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
          models: { harbor: settings.harborModel, gemini: settings.geminiModel },
          question
        }
      });
      if (control.requestId !== requestId) return;
      if (!response || !response.ok) {
        const error = new Error(response && response.error || "Koneksi gagal, coba lagi.");
        error.code = response && response.code;
        throw error;
      }
      control.showAnswer(response.result);
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
    control.removePanel();
  }

  function isVisibleBlock(block) {
    if (block.closest("[hidden], [aria-hidden='true']")) return false;
    let current = block;
    while (current) {
      const style = global.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
      current = current.parentElement;
    }
    return block.getClientRects().length > 0;
  }

  async function scan() {
    if (!isRespondentPage()) return { enabled: false, count: 0 };
    const settings = await getSettings();
    const blocks = [...document.querySelectorAll(global.FormHelperParser.SELECTORS.questionBlocks)].filter(isVisibleBlock);
    let count = 0;
    for (const block of blocks) {
      const question = global.FormHelperParser.parseQuestion(block);
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
      count += 1;
    }
    return { enabled: settings.enabled, count };
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 200);
  }

  function startObserver() {
    const target = document.body;
    observer = new MutationObserver((records) => {
      const external = records.some((record) => {
        if (record.type === "childList") {
          const changedNodes = [...record.addedNodes, ...record.removedNodes];
          return changedNodes.some((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return true;
            return !node.matches(".fh-ui-host, .fh-question-host, .fh-answer-host")
              && !node.closest(".fh-ui-host, .fh-question-host, .fh-answer-host");
          });
        }
        const targetNode = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        return !targetNode?.closest(".fh-ui-host, .fh-question-host, .fh-answer-host");
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
    return scan();
  }

  if (isRespondentPage()) {
    global.FormHelperUI.initSettingsPanel();
    scan().then(startObserver);
    api.storage.onChanged.addListener(refresh);
  }
  global.FormHelperMain = { refresh, loadCurrentPage };
})(globalThis);
