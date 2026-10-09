"use strict";

(function initMain(global) {
  const { api, getSettings, sendMessage, cleanText } = global.FormHelperUtils;
  const controls = new WeakMap();
  const activeControls = new Set();
  let observer = null;
  let scanTimer = null;
  let scanPromise = null;
  let scanQueued = false;

  function isHebatQuizRoute() {
    return location.hostname === "hebat.elearning.unair.ac.id"
      && /^\/mod\/quiz\//.test(location.pathname);
  }

  function isHebatQuizPage() {
    return isHebatQuizRoute()
      && /^\/mod\/quiz\/attempt\.php$/.test(location.pathname)
      && Boolean(document.querySelector("#responseform"));
  }

  function isRespondentPage() {
    return location.pathname.includes("/forms/")
      && /\/(?:viewform|formResponse)\/?$/.test(location.pathname)
      && !location.pathname.includes("/edit");
  }

  function isSupportedPage() { return isRespondentPage() || isHebatQuizPage(); }

  function fileToBase64(file) {
    return file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return btoa(binary);
    });
  }

  async function addLocalFiles(control, fileList) {
    try {
      const settings = await getSettings();
      if (settings.answerProvider !== "harbor" || settings.harborModel !== "claude-haiku-5.5") {
        throw new Error("Pilih model Harbor Claude Haiku 5.5 sebelum melampirkan file.");
      }
      if (fileList.length > 2) throw new Error("Maksimal dua file dapat dilampirkan.");
      const files = [];
      for (const file of fileList) {
        const extension = file.name.split(".").at(-1).toLowerCase();
        const isPdf = extension === "pdf" || file.type === "application/pdf";
        const isText = ["txt", "md", "csv"].includes(extension) || /^text\//i.test(file.type);
        if (!isPdf && !isText) throw new Error("Format yang didukung: PDF, TXT, MD, atau CSV.");
        if (file.size > 500_000) throw new Error(`Ukuran ${file.name} melebihi batas 500 KB.`);
        files.push({
          name: cleanText(file.name).slice(0, 120),
          mimeType: isPdf ? "application/pdf" : "text/plain",
          base64: await fileToBase64(file)
        });
      }
      control.files = files;
      control.setFileState(files.length ? `${files.length} file lokal siap dilampirkan` : "Lampirkan PDF/TXT/MD/CSV dari perangkat ini");
    } catch (error) {
      control.files = [];
      control.setFileState(error.message || "File tidak dapat dibaca");
      control.showMessage(error.message || "File tidak dapat dibaca.", true);
    }
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
      let question = global.FormHelperParser.parseQuestion(control.block);
      if (!question) throw new Error("Soal ini belum dapat dibaca.");
      if (question.type === "unsupported_file_upload") throw new Error("Soal unggah file belum didukung.");
      if (question.type === "dropdown" && !question.options.length) throw new Error("Pilihan dropdown belum terbaca. Coba buka daftar pilihan lalu tanya lagi.");
      const settings = await getSettings();
      if (isHebatQuizPage()) question = global.FormHelperParser.prepareHebatQuestion(control.block, question);
      if (control.files?.length) {
        if (settings.answerProvider !== "harbor" || settings.harborModel !== "claude-haiku-5.5") {
          throw new Error("Lampiran file hanya didukung saat model Harbor Claude Haiku 5.5 dipilih.");
        }
        question.files = control.files;
      }
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
    if (!isSupportedPage()) return { enabled: false, count: 0 };
    const settings = await getSettings();
    for (const control of activeControls) {
      if (!control.block.isConnected) removeControl(control);
    }
    const platform = isHebatQuizPage() ? "hebat" : "google";
    const blocks = global.FormHelperParser.getQuestionBlocks(platform);
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
      const control = global.FormHelperUI.questionControl(block, handleAsk, platform === "hebat" ? addLocalFiles : null, platform);
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

  function startObserver(scanSupportedPage = true) {
    const target = document.documentElement || document.body;
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
      if (external && scanSupportedPage) scheduleScan();
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

  const supportedPage = isSupportedPage();
  const hebatQuizRoute = isHebatQuizRoute();
  if (supportedPage || hebatQuizRoute) {
    global.FormHelperUI.initSettingsPanel();
    if (hebatQuizRoute) global.FormHelperUI.initHebatSettingsShortcut();
    if (isHebatQuizPage()) global.FormHelperUI.initHebatLauncher();
    global.FormHelperUI.syncHelpMenu();
    if (supportedPage) {
      startObserver();
      requestScan().catch(() => {});
      api.storage.onChanged.addListener(refresh);
    } else if (hebatQuizRoute) {
      startObserver(false);
    }
  }
  global.FormHelperMain = { refresh, loadCurrentPage };
})(globalThis);
