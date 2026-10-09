"use strict";

(function initUI(global) {
  const { api, getSettings, sendMessage, DEFAULTS } = global.FormHelperUtils;
  const HARBOR_MODELS = [
    ["qwen3.8-flash:free", "Qwen 3.8 Flash (gratis)"],
    ["deepseek-v4.1-flash:free", "DeepSeek V4.1 Flash (gratis)"],
    ["mimo-v2.6-flash:free", "MiMo V2.6 Flash (gratis, teks saja)"],
    ["glm-5.3-flash", "GLM 5.3 Flash"],
    ["glm-5.3-flashx", "GLM 5.3 FlashX"],
    ["gpt-6-luna", "GPT-6 Luna"],
    ["gpt-6-luna-fast", "GPT-6 Luna Fast (teks saja)"],
    ["qwen3.8-flash", "Qwen 3.8 Flash (berbayar)"],
    ["claude-haiku-5.5", "Claude Haiku 5.5 (teks, gambar, PDF/teks)"]
  ];
  const GEMINI_MODELS = [
    ["gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite"],
    ["gemini-3.6-flash", "Gemini 3.6 Flash"],
    ["gemini-3.8-flash", "Gemini 3.8 Flash"]
  ];
  const ANSWER_PROVIDERS = [
    ["harbor", "Harbor AI — model pilihan di atas"],
    ["groq", "Groq — OpenAI GPT-OSS 120B (teks saja)"]
  ];
  let settingsActions = null;
  let hebatShortcutInstalled = false;
  let modelShortcutInstalled = false;
  let modelPickerActions = null;

  function isEditingTarget(target) {
    return typeof target?.matches === "function"
      && (target.matches("input, textarea, select")
        || target.isContentEditable
        || Boolean(target.closest?.('[contenteditable]:not([contenteditable="false"])')));
  }

  function isGoogleHelpMenu(menu) {
    const text = `${menu.getAttribute("aria-label") || ""} ${menu.textContent || ""}`;
    return /bantuan dan masukan|help and feedback|hubungi pemilik formulir|contact form owner/i.test(text);
  }

  function addHelpMenuItem(menu, key, label, action) {
    if (menu.querySelector(`[data-form-helper-menu-item="${key}"]`)) return;
    const nativeItem = menu.querySelector('[role="menuitem"]');
    const item = document.createElement("li");
    item.className = nativeItem?.className || "";
    item.setAttribute("role", "menuitem");
    item.setAttribute("tabindex", "-1");
    item.dataset.formHelperMenuItem = key;
    item.style.cssText = "display:flex;align-items:center;min-height:48px;padding:0 16px;cursor:pointer;color:inherit;font:400 14px/20px Roboto,Arial,sans-serif;list-style:none;";
    const text = document.createElement("span");
    text.textContent = label;
    item.append(text);
    item.addEventListener("click", () => { void action(item); });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        item.click();
      }
    });
    item.addEventListener("mouseenter", () => { item.style.backgroundColor = "rgba(60,64,67,.08)"; });
    item.addEventListener("mouseleave", () => { item.style.backgroundColor = "transparent"; });
    menu.append(item);
  }

  function syncHelpMenu() {
    if (!settingsActions) return;
    for (const menu of document.querySelectorAll('[role="menu"]')) {
      if (!isGoogleHelpMenu(menu)) continue;
      addHelpMenuItem(menu, "load-page", "Muat soal halaman ini", settingsActions.loadPage);
      addHelpMenuItem(menu, "settings", "Pengaturan Form Helper", settingsActions.openSettings);
    }
    syncHebatFooterMenu();
  }

  function syncHebatFooterMenu() {
    if (location.hostname !== "hebat.elearning.unair.ac.id" || !/^\/mod\/quiz\//.test(location.pathname)) return;
    for (const region of document.querySelectorAll('[data-region="footer-container-popover"]')) {
      const body = region.querySelector(".popover.footer .popover-body");
      if (!body || body.querySelector('[data-form-helper-menu-item="hebat-settings"]')) continue;
      const section = document.createElement("div");
      section.className = "footer-section p-3 border-bottom";
      section.dataset.formHelperMenuItem = "hebat-section";
      const settings = document.createElement("button");
      settings.className = "btn btn-link p-0";
      settings.type = "button";
      settings.textContent = "Pengaturan Form Helper";
      settings.dataset.formHelperMenuItem = "hebat-settings";
      settings.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        settingsActions?.openSettings();
      });
      section.append(settings);

      if (/^\/mod\/quiz\/attempt\.php$/.test(location.pathname) && document.querySelector("#responseform")) {
        const load = document.createElement("button");
        load.className = "btn btn-link p-0 ms-3";
        load.type = "button";
        load.textContent = "Muat soal halaman ini";
        load.dataset.formHelperMenuItem = "hebat-load-page";
        load.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          settingsActions?.loadPage(load);
        });
        section.append(load);
      }
      body.append(section);
    }
  }

  function installHebatSettingsShortcut() {
    if (hebatShortcutInstalled) return;
    hebatShortcutInstalled = true;
    document.addEventListener("keydown", (event) => {
      if (event.repeat || event.isComposing
          || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey
          || event.code !== "KeyO") return;
      if (isEditingTarget(event.target) || document.activeElement?.id === "fh-settings-host") return;
      event.preventDefault();
      event.stopPropagation();
      void settingsActions?.openSettings();
    }, true);
  }

  function initHebatLauncher() {
    installHebatSettingsShortcut();
    if (document.getElementById("fh-hebat-launcher")) return;
    const host = document.createElement("div");
    host.id = "fh-hebat-launcher";
    host.className = "fh-ui-host";
    document.documentElement.append(host);
    const root = host.attachShadow({ mode: "closed" });
    addStyle(root, `
      :host { all: initial; display: block; }
      * { box-sizing: border-box; font-family: system-ui, sans-serif; }
      .launcher { position: fixed; left: max(12px, env(safe-area-inset-left)); bottom: max(12px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: flex-start; width: auto; margin: 0; padding: 0; z-index: 2147483647; }
      .toggle { border: 1px solid #777; border-radius: 999px; background: #ffffff; color: #202124; padding: 7px 11px; box-shadow: 0 2px 8px #0003; cursor: pointer; font-size: 13px; }
      .toggle:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
      .menu { position: absolute; left: 0; bottom: calc(100% + 5px); display: grid; gap: 4px; width: 190px; margin: 0; padding: 7px; border: 1px solid #888; border-radius: 10px; background: #fff; box-shadow: 0 3px 14px #0003; }
      .menu[hidden] { display: none; }
      .menu button { border: 0; border-radius: 6px; background: transparent; color: #202124; padding: 9px; text-align: left; cursor: pointer; }
      .menu button:hover { background: #f1f3f4; }
    `);
    const launcher = document.createElement("div"); launcher.className = "launcher";
    const toggle = document.createElement("button"); toggle.className = "toggle"; toggle.type = "button"; toggle.textContent = "✦ Form Helper"; toggle.setAttribute("aria-label", "Menu Form Helper"); toggle.title = "Pengaturan: Alt+Shift+O · Ganti model: Alt+Shift+M";
    const menu = document.createElement("div"); menu.className = "menu"; menu.hidden = true;
    const load = document.createElement("button"); load.type = "button"; load.textContent = "Muat soal halaman ini";
    const settings = document.createElement("button"); settings.type = "button"; settings.textContent = "Pengaturan"; settings.title = "Buka pengaturan · Alt+Shift+O · Ganti model: Alt+Shift+M";
    toggle.addEventListener("click", () => { menu.hidden = !menu.hidden; });
    load.addEventListener("click", async () => {
      load.disabled = true;
      load.textContent = "Memuat soal…";
      try {
        const result = await global.FormHelperMain?.loadCurrentPage();
        load.textContent = !result ? "Halaman kuis tidak ditemukan" : !result.enabled ? "Aktifkan saran di Pengaturan" : result.count ? `Soal siap (${result.count})` : "Soal belum terbaca";
      } catch { load.textContent = "Gagal memuat soal"; }
      setTimeout(() => { if (load.isConnected) { load.textContent = "Muat soal halaman ini"; load.disabled = false; } }, 1800);
    });
    settings.addEventListener("click", () => settingsActions?.openSettings());
    menu.append(load, settings); launcher.append(toggle, menu); root.append(launcher);
  }

  function installModelShortcut() {
    if (modelShortcutInstalled) return;
    modelShortcutInstalled = true;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modelPickerActions?.isOpen()) {
        event.preventDefault();
        modelPickerActions.close();
        return;
      }
      if (event.repeat || event.isComposing
          || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey
          || event.code !== "KeyM") return;
      if (isEditingTarget(event.target) || document.activeElement?.id === "fh-settings-host") return;
      event.preventDefault();
      event.stopPropagation();
      void modelPickerActions?.toggle();
    }, true);
    document.addEventListener("pointerdown", (event) => {
      const pickerHost = document.getElementById("fh-model-picker-host");
      if (modelPickerActions?.isOpen() && pickerHost && !pickerHost.contains(event.target)) {
        modelPickerActions.close();
      }
    }, true);
  }

  function addStyle(root, css) {
    const style = document.createElement("style");
    style.textContent = css;
    root.append(style);
  }

  function fillModelOptions(select, models, selected) {
    for (const [id, label] of models) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      option.selected = id === selected;
      select.append(option);
    }
  }

  function initSettingsPanel() {
    if (document.getElementById("fh-settings-host")) return;
    const host = document.createElement("div");
    host.id = "fh-settings-host";
    host.className = "fh-ui-host";
    const quizForm = document.querySelector("#responseform");
    if (quizForm?.parentElement) quizForm.parentElement.insertBefore(host, quizForm);
    else (document.body || document.documentElement).append(host);
    const root = host.attachShadow({ mode: "closed" });
    addStyle(root, `
      :host { all: initial; color-scheme: light dark; }
      * { box-sizing: border-box; font-family: system-ui, sans-serif; }
      .panel { position: fixed; right: 12px; bottom: 72px; z-index: 2147483647; width: min(370px, calc(100vw - 24px)); max-height: min(82vh, 700px); overflow: auto; padding: 17px; border: 1px solid #8993a5; border-radius: 14px; background: Canvas; color: CanvasText; box-shadow: 0 8px 30px #0005; }
      .panel[hidden] { display: none; }
      h2 { font-size: 18px; margin: 0 0 12px; }
      label { display: block; margin: 11px 0 5px; font-size: 13px; font-weight: 600; }
      input, select { display: block; width: 100%; padding: 9px; border: 1px solid #8892a5; border-radius: 8px; background: Canvas; color: CanvasText; font-size: 14px; }
      .toggle { display: flex; gap: 9px; align-items: center; }
      .toggle input { width: auto; }
      .consent { display: flex; gap: 8px; align-items: flex-start; font-weight: 400; line-height: 1.4; }
      .consent input { width: auto; margin-top: 2px; }
      .row { display: flex; gap: 8px; margin-top: 13px; }
      button.secondary, button.primary { border: 0; border-radius: 8px; padding: 9px 12px; cursor: pointer; font-size: 14px; }
      button.primary { flex: 1; background: #2857d9; color: white; }
      button.secondary { background: color-mix(in srgb, CanvasText 12%, Canvas); color: CanvasText; }
      .note, .status { font-size: 12px; line-height: 1.45; }
      .note { opacity: .78; }
      .status { min-height: 18px; margin-top: 9px; }
      .group { border-top: 1px solid #8885; margin-top: 13px; padding-top: 3px; }
    `);
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Pengaturan Form Helper");
    panel.innerHTML = `
      <h2>Pengaturan Form Helper</h2>
      <label class="toggle"><input id="enabled" type="checkbox"> Aktifkan tombol saran</label>
      <label for="apiBase">Base URL API Vercel</label><input id="apiBase" type="url" placeholder="https://nama-proyek.vercel.app">
      <label for="token">Token klien</label><input id="token" type="password" autocomplete="off">
      <label for="lang">Bahasa jawaban</label><select id="lang"><option value="auto">Otomatis</option><option value="id">Indonesia</option><option value="en">English</option></select>
      <div class="group"><label for="harborModel">Model utama — Harbor AI</label><select id="harborModel"></select></div>
      <label for="geminiModel">Model cadangan — Gemini AI</label><select id="geminiModel"></select>
      <label for="answerProvider">Model utama untuk jawaban</label><select id="answerProvider"></select>
      <p class="note">GPT-OSS hanya menerima teks. Claude Haiku menerima gambar dan dokumen PDF/teks yang dipilih dari perangkat ini.</p>
      <label class="toggle"><input id="imageToText" type="checkbox"> OCR gambar dengan Qwen 3.8 27B (Groq)</label>
      <p class="note">Jika aktif, Qwen menyalin rumus, angka, tabel, dan label gambar menjadi teks sebelum dikirim ke model jawaban.</p>
      <label class="toggle"><input id="onlyHarbor" type="checkbox"> Nonaktifkan fallback Gemini AI</label>
      <p class="note">Saat aktif, Gemini tidak dipanggil ketika model jawaban gagal.</p>
      <label class="consent"><input id="dataConsent" type="checkbox"> Saya memahami bahwa teks dan gambar soal, serta file lokal yang saya lampirkan, dikirim ke API Vercel. Tergantung pengaturan, data dapat diproses oleh Harbor, Gemini, atau Groq (Qwen untuk OCR dan GPT-OSS untuk jawaban teks).</label>
      <div class="row"><button class="primary" id="save">Simpan</button><button class="secondary" id="ping">Cek konfigurasi</button><button class="secondary" id="close">Tutup</button></div>
      <div class="status" id="status" role="status" aria-live="polite"></div>
      <p class="note">Gunakan sesuai aturan dosen/penyelenggara ujian. Ekstensi hanya menampilkan saran dan tidak mengisi jawaban. Isi pertanyaan tidak disimpan di ekstensi atau log server.</p>
    `;
    fillModelOptions(panel.querySelector("#harborModel"), HARBOR_MODELS, DEFAULTS.harborModel);
    fillModelOptions(panel.querySelector("#geminiModel"), GEMINI_MODELS, DEFAULTS.geminiModel);
    fillModelOptions(panel.querySelector("#answerProvider"), ANSWER_PROVIDERS, DEFAULTS.answerProvider);
    root.append(panel);

    const pickerHost = document.createElement("div");
    pickerHost.id = "fh-model-picker-host";
    pickerHost.className = "fh-ui-host";
    document.documentElement.append(pickerHost);
    const pickerRoot = pickerHost.attachShadow({ mode: "closed" });
    const isHebat = location.hostname === "hebat.elearning.unair.ac.id";
    const pickerTheme = isHebat
      ? `font-family:system-ui,sans-serif;--picker-text:#212529;--picker-surface:#fff;--picker-border:#ced4da;--picker-accent:#0f6cbf;--picker-hover:#e9f3fb;`
      : `font-family:Roboto,Arial,sans-serif;--picker-text:#202124;--picker-surface:#fff;--picker-border:#dadce0;--picker-accent:#673ab7;--picker-hover:#f1f3f4;`;
    addStyle(pickerRoot, `
      :host { all: initial; display: block; color-scheme: light; }
      * { box-sizing: border-box; }
      .picker { ${pickerTheme} position: fixed; right: 12px; bottom: 72px; z-index: 2147483647; width: min(310px, calc(100vw - 24px)); max-height: min(75vh, 460px); overflow: auto; padding: 13px; border: 1px solid var(--picker-border); border-radius: 12px; background: var(--picker-surface); color: var(--picker-text); box-shadow: 0 5px 20px #0003; }
      .picker[hidden] { display: none; }
      .heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
      h2 { margin: 0; font-family: inherit; font-size: 15px; line-height: 1.3; font-weight: 600; }
      label { display: block; margin-top: 9px; font-family: inherit; font-size: 11px; line-height: 1.3; font-weight: 600; }
      select { display: block; width: 100%; margin-top: 4px; padding: 7px 8px; border: 1px solid var(--picker-border); border-radius: 7px; background: var(--picker-surface); color: var(--picker-text); font-family: inherit; font-size: 12px; line-height: 1.3; }
      select:focus-visible, button:focus-visible { outline: 2px solid var(--picker-accent); outline-offset: 2px; }
      select:disabled { opacity: .55; }
      .hint, .status { margin: 7px 0 0; font-family: inherit; font-size: 11px; line-height: 1.35; opacity: .78; }
      .status { min-height: 14px; }
      .actions { display: flex; gap: 7px; margin-top: 10px; }
      button { border: 0; border-radius: 7px; padding: 7px 10px; cursor: pointer; font-family: inherit; font-size: 12px; line-height: 1.3; font-weight: 600; }
      .close { padding: 2px 6px; background: transparent; color: inherit; font-size: 19px; line-height: 1; }
      .close:hover { background: var(--picker-hover); }
      .save { flex: 1; background: var(--picker-accent); color: #fff; }
      .cancel { background: var(--picker-hover); color: inherit; }
    `);
    const picker = document.createElement("section");
    picker.className = "picker";
    picker.hidden = true;
    picker.setAttribute("role", "dialog");
    picker.setAttribute("aria-label", "Ganti model Form Helper");
    picker.innerHTML = `
      <div class="heading"><h2>Ganti model</h2><button class="close" id="pickerClose" type="button" aria-label="Tutup">×</button></div>
      <label for="pickerProvider">Provider jawaban</label><select id="pickerProvider"></select>
      <label for="pickerHarbor">Model Harbor</label><select id="pickerHarbor"></select>
      <label for="pickerGemini">Model Gemini cadangan</label><select id="pickerGemini"></select>
      <p class="hint" id="pickerHint"></p>
      <div class="actions"><button class="save" id="pickerSave" type="button">Simpan model</button><button class="cancel" id="pickerCancel" type="button">Batal</button></div>
      <p class="status" id="pickerStatus" role="status" aria-live="polite"></p>
    `;
    fillModelOptions(picker.querySelector("#pickerProvider"), ANSWER_PROVIDERS, DEFAULTS.answerProvider);
    fillModelOptions(picker.querySelector("#pickerHarbor"), HARBOR_MODELS, DEFAULTS.harborModel);
    fillModelOptions(picker.querySelector("#pickerGemini"), GEMINI_MODELS, DEFAULTS.geminiModel);
    pickerRoot.append(picker);

    const pickerStatus = picker.querySelector("#pickerStatus");
    const pickerHint = picker.querySelector("#pickerHint");
    const updatePickerHint = () => {
      pickerHint.textContent = picker.querySelector("#pickerProvider").value === "groq"
        ? "Groq GPT-OSS dipakai utama; Harbor menjadi cadangan."
        : "Harbor dipakai utama; Gemini menjadi cadangan jika diaktifkan.";
    };
    async function openModelPicker() {
      picker.hidden = false;
      pickerStatus.textContent = "";
      const settings = await getSettings();
      picker.querySelector("#pickerProvider").value = settings.answerProvider;
      picker.querySelector("#pickerHarbor").value = settings.harborModel;
      picker.querySelector("#pickerGemini").value = settings.geminiModel;
      picker.querySelector("#pickerGemini").disabled = settings.onlyHarbor === true;
      updatePickerHint();
    }
    const closeModelPicker = () => { picker.hidden = true; };
    modelPickerActions = {
      open: openModelPicker,
      close: closeModelPicker,
      toggle: () => picker.hidden ? openModelPicker() : closeModelPicker(),
      isOpen: () => !picker.hidden
    };
    picker.querySelector("#pickerProvider").addEventListener("change", updatePickerHint);
    picker.querySelector("#pickerClose").addEventListener("click", closeModelPicker);
    picker.querySelector("#pickerCancel").addEventListener("click", closeModelPicker);
    picker.querySelector("#pickerSave").addEventListener("click", async (event) => {
      const saveButton = event.currentTarget;
      saveButton.disabled = true;
      pickerStatus.textContent = "Menyimpan…";
      pickerStatus.style.color = "inherit";
      try {
        await api.storage.local.set({
          answerProvider: picker.querySelector("#pickerProvider").value,
          harborModel: picker.querySelector("#pickerHarbor").value,
          geminiModel: picker.querySelector("#pickerGemini").value
        });
        global.FormHelperMain?.refresh();
        pickerStatus.textContent = "Model tersimpan.";
        setTimeout(closeModelPicker, 450);
      } catch (error) {
        pickerStatus.textContent = error.message || "Model gagal disimpan.";
        pickerStatus.style.color = "#c62828";
      } finally {
        saveButton.disabled = false;
      }
    });
    installModelShortcut();

    const status = panel.querySelector("#status");
    const setStatus = (message, error = false) => {
      status.textContent = message;
      status.style.color = error ? "#c62828" : "inherit";
    };
    async function openSettingsPanel() {
      panel.hidden = false;
      const settings = await getSettings();
      panel.querySelector("#enabled").checked = settings.enabled;
      panel.querySelector("#apiBase").value = settings.apiBase;
      panel.querySelector("#token").value = settings.token;
      panel.querySelector("#lang").value = settings.lang;
      panel.querySelector("#harborModel").value = settings.harborModel;
      panel.querySelector("#geminiModel").value = settings.geminiModel;
      panel.querySelector("#answerProvider").value = settings.answerProvider;
      panel.querySelector("#imageToText").checked = settings.imageToText === true;
      panel.querySelector("#onlyHarbor").checked = settings.onlyHarbor === true;
      panel.querySelector("#geminiModel").disabled = settings.onlyHarbor === true;
      panel.querySelector("#dataConsent").checked = settings.dataConsentAccepted === true;
      setStatus("");
    }
    settingsActions = {
      openSettings: async () => openSettingsPanel(),
      loadPage: async (item) => {
        item.setAttribute("aria-disabled", "true");
        item.textContent = "Memuat soal…";
        try {
          const result = await global.FormHelperMain?.loadCurrentPage();
          if (!result) item.textContent = "Halaman soal tidak ditemukan";
          else if (!result.enabled) {
            await openSettingsPanel();
            setStatus("Aktifkan tombol saran di pengaturan terlebih dahulu.", true);
            item.textContent = "Aktifkan saran di Pengaturan";
          } else if (!result.count) item.textContent = "Belum ada soal yang terbaca";
          else item.textContent = "Soal siap ✓";
        } catch {
          item.textContent = "Gagal memuat soal";
        }
        setTimeout(() => {
          if (item.isConnected) item.textContent = "Muat soal halaman ini";
          item.removeAttribute("aria-disabled");
        }, 2000);
      }
    };
    async function saveSettings(quiet = false) {
      const values = {
        enabled: panel.querySelector("#enabled").checked,
        apiBase: panel.querySelector("#apiBase").value.trim().replace(/\/+$/, ""),
        token: panel.querySelector("#token").value.trim(),
        lang: panel.querySelector("#lang").value,
        harborModel: panel.querySelector("#harborModel").value,
        geminiModel: panel.querySelector("#geminiModel").value,
        answerProvider: panel.querySelector("#answerProvider").value,
        imageToText: panel.querySelector("#imageToText").checked,
        onlyHarbor: panel.querySelector("#onlyHarbor").checked,
        dataConsentAccepted: panel.querySelector("#dataConsent").checked
      };
      if (values.enabled && !values.dataConsentAccepted) {
        setStatus("Setujui pemrosesan teks, gambar, dan file yang dilampirkan sebelum mengaktifkan saran.", true);
        return false;
      }
      if (values.apiBase && !/^https:\/\//i.test(values.apiBase)) {
        setStatus("Base URL harus memakai HTTPS.", true);
        return false;
      }
      try {
        if (values.apiBase) {
          const permission = await sendMessage({ type: "REQUEST_API_PERMISSION", apiBase: values.apiBase });
          if (!permission || !permission.ok) throw new Error((permission && permission.message) || "Izin host API tidak diberikan.");
        }
        await api.storage.local.set(values);
        if (!quiet) setStatus("Pengaturan tersimpan.");
        global.FormHelperMain && global.FormHelperMain.refresh();
        return true;
      } catch (error) {
        setStatus(error.message || "Pengaturan gagal disimpan.", true);
        return false;
      }
    }
    panel.querySelector("#close").addEventListener("click", () => { panel.hidden = true; });
    panel.querySelector("#onlyHarbor").addEventListener("change", (event) => {
      panel.querySelector("#geminiModel").disabled = event.currentTarget.checked;
    });
    panel.querySelector("#save").addEventListener("click", () => saveSettings());
    panel.querySelector("#ping").addEventListener("click", async () => {
      if (!await saveSettings(true)) return;
      setStatus("Memeriksa konfigurasi API…");
      try {
        const response = await sendMessage({ type: "PING" });
        if (!response || !response.ok) throw new Error(response && response.error || "Pemeriksaan konfigurasi gagal.");
        const providers = response.result.providers || {};
        setStatus(`Konfigurasi ditemukan. Harbor: ${providers.harbor ? "key tersedia" : "belum diatur"}; Gemini: ${providers.gemini ? "key tersedia" : "belum diatur"}; Groq: ${providers.groq ? "key tersedia" : "belum diatur"}.`);
      } catch (error) {
        setStatus(error.message, true);
      }
    });
  }

  function questionControl(block, onAsk, onAttach = null, platform = "google") {
    const host = document.createElement("div");
    host.className = "fh-question-host";
    host.style.cssText = `position:absolute;top:2px;right:2px;z-index:5;width:${onAttach ? 78 : 34}px;height:34px;line-height:0;`;
    const needsPositionAnchor = getComputedStyle(block).position === "static";
    const originalPosition = block.style.getPropertyValue("position");
    const originalPositionPriority = block.style.getPropertyPriority("position");
    if (needsPositionAnchor) block.style.setProperty("position", "relative", "important");
    const root = host.attachShadow({ mode: "closed" });
    const starColor = platform === "hebat" ? "#cbe6e9" : "#ffffff";
    const hoverBackground = platform === "hebat" ? "#f1f3f4" : "transparent";
    addStyle(root, `
      * { box-sizing: border-box; font-family: system-ui, sans-serif; }
      .actions { display: flex; justify-content: flex-end; gap: 2px; padding: 0 4px; }
      button { display: inline-grid; place-items: center; width: 34px; min-width: 34px; height: 34px; min-height: 34px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: ${starColor}; opacity: 1; font-size: 14px; cursor: pointer; box-shadow: none; }
      button:hover { background: ${hoverBackground}; color: ${starColor}; }
      button:focus-visible { background: ${hoverBackground}; color: ${starColor}; outline: 2px solid #1a73e8; outline-offset: 1px; }
      button[disabled] { opacity: 1; }
      button[aria-busy="true"] { position: relative; }
      button[aria-busy="true"]::after { content: ""; position: absolute; width: 9px; height: 9px; right: -1px; top: -1px; border: 2px solid #80868b; border-right-color: transparent; border-radius: 50%; animation: fh-spin .7s linear infinite; }
      @keyframes fh-spin { to { transform: rotate(360deg); } }
    `);
    const row = document.createElement("div");
    row.className = "actions";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "✦";
    button.setAttribute("aria-label", "Tanya AI");
    button.title = "Tampilkan saran jawaban";
    for (const type of ["pointerdown", "mousedown", "mouseup", "touchstart", "touchend"]) {
      button.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onAsk(control);
    });
    let attachButton = null;
    if (onAttach) {
      attachButton = document.createElement("button");
      attachButton.type = "button";
      attachButton.textContent = "📎";
      attachButton.setAttribute("aria-label", "Lampirkan PDF atau file teks lokal");
      attachButton.title = "Lampirkan PDF/TXT/MD/CSV dari perangkat ini";
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".pdf,.txt,.md,.csv,application/pdf,text/plain,text/markdown,text/csv";
      input.hidden = true;
      for (const type of ["click", "change", "input"]) {
        input.addEventListener(type, (event) => event.stopPropagation());
      }
      input.addEventListener("change", () => {
        if (input.files?.length) onAttach(control, [...input.files]);
        input.value = "";
      });
      attachButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.click();
      });
      for (const type of ["pointerdown", "mousedown", "mouseup", "touchstart", "touchend"]) {
        attachButton.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
      }
      row.append(attachButton, input);
    }
    row.append(button);
    root.append(row);
    block.insertBefore(host, block.firstChild);

    const control = {
      host,
      block,
      button,
      restorePosition() {
        if (!needsPositionAnchor) return;
        if (originalPosition) block.style.setProperty("position", originalPosition, originalPositionPriority);
        else block.style.removeProperty("position");
      },
      panel: null,
      setFileState(message) {
        if (attachButton) {
          attachButton.title = message || "Lampirkan PDF/TXT/MD/CSV dari perangkat ini";
          attachButton.setAttribute("aria-label", message || "Lampirkan PDF atau file teks lokal");
        }
      },
      setState(state) {
        control.loading = state === "loading";
        button.disabled = false;
        button.textContent = "✦";
        button.setAttribute("aria-label", state === "loading" ? "Batalkan permintaan" : "Tanya AI");
        button.setAttribute("aria-busy", state === "loading" ? "true" : "false");
        button.title = state === "loading" ? "Batalkan permintaan" : state === "done" ? "Tanya ulang" : "Tampilkan saran jawaban";
      },
      removePanel() {
        if (control.panel) control.panel.remove();
        control.panel = null;
      },
      showMessage(message, isError, onClose) {
        control.removePanel();
        const panelHost = document.createElement("div");
        panelHost.className = "fh-answer-host";
        const panelRoot = panelHost.attachShadow({ mode: "closed" });
        addStyle(panelRoot, `*{box-sizing:border-box;font-family:system-ui,sans-serif}.card{margin:6px 0;padding:12px 14px;border:1px solid #8893a5;border-radius:11px;background:Canvas;color:CanvasText;font-size:14px;line-height:1.45}.error{color:#b42318}.close{float:right;border:0;background:transparent;color:inherit;font-size:18px;cursor:pointer}`);
        const card = document.createElement("div"); card.className = `card${isError ? " error" : ""}`;
        const close = document.createElement("button"); close.className = "close"; close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", onClose ? "Batalkan permintaan" : "Tutup"); close.addEventListener("click", () => { if (onClose) onClose(); else panelHost.remove(); });
        const text = document.createElement("span"); text.textContent = message;
        card.append(close, text); panelRoot.append(card);
        block.insertAdjacentElement("afterend", panelHost); control.panel = panelHost;
      },
      showAnswer(response, questionType) {
        control.removePanel();
        const panelHost = document.createElement("div");
        panelHost.className = "fh-answer-host";
        const panelRoot = panelHost.attachShadow({ mode: "closed" });
        addStyle(panelRoot, `*{box-sizing:border-box;font-family:system-ui,sans-serif}.card{margin:6px 0;padding:12px 14px;border:1px solid #8893a5;border-radius:11px;background:Canvas;color:CanvasText;font-size:14px;line-height:1.45}.answer{font-weight:700;font-size:16px;white-space:pre-wrap}.meta{margin-top:6px;font-size:12px;opacity:.76}.bar{display:flex;align-items:center;gap:10px;margin-top:8px}.bar button{border:0;background:transparent;color:inherit;padding:4px;cursor:pointer;font-size:12px}.warning{color:#a15c00;font-size:12px;margin-top:6px}`);
        const card = document.createElement("div"); card.className = "card";
        const title = document.createElement("div"); title.className = "answer"; title.textContent = response.answer.display;
        const detail = document.createElement("div"); detail.className = "meta"; detail.textContent = `Keyakinan ${Math.round((response.confidence || 0) * 100)}%${response.explanation ? ` · ${response.explanation}` : ""}`;
        const bar = document.createElement("div"); bar.className = "bar";
        const copy = document.createElement("button"); copy.type = "button"; copy.textContent = "Salin";
        copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(response.answer.display); copy.textContent = "Tersalin"; } catch { copy.textContent = "Tidak bisa menyalin"; } });
        const close = document.createElement("button"); close.type = "button"; close.textContent = "Tutup"; close.addEventListener("click", () => panelHost.remove());
        bar.append(copy, close);
        if (questionType === "paragraph") card.append(title, bar);
        else card.append(title, detail, bar);
        const warningMessages = {
          IMAGE_UNAVAILABLE: "Sebagian gambar tidak terkirim atau tidak terbaca, jawaban mungkin kurang akurat.",
          IMAGE_OCR_FALLBACK: "OCR Qwen gagal; sistem mencoba memproses gambar langsung dengan model jawaban.",
          GPT_IMAGE_UNSUPPORTED: "GPT-OSS tidak menerima gambar; jawaban dialihkan ke Harbor/Gemini. Aktifkan OCR Qwen untuk memakai GPT-OSS pada soal gambar.",
          GROQ_UNAVAILABLE: "API key Groq belum dikonfigurasi; jawaban dialihkan ke Harbor/Gemini.",
          FILE_UNAVAILABLE: "File hanya dikirim ke Claude Haiku; provider cadangan menjawab dari teks dan gambar soal."
        };
        const warningCodes = new Set([response.warning, ...(Array.isArray(response.warnings) ? response.warnings : [])]);
        for (const code of warningCodes) {
          if (!warningMessages[code]) continue;
          const warning = document.createElement("div"); warning.className = "warning"; warning.textContent = warningMessages[code]; card.append(warning);
        }
        panelRoot.append(card); block.insertAdjacentElement("afterend", panelHost); control.panel = panelHost;
      }
    };
    return control;
  }

  global.FormHelperUI = { initSettingsPanel, initHebatLauncher, initHebatSettingsShortcut: installHebatSettingsShortcut, syncHelpMenu, questionControl };
})(globalThis);
