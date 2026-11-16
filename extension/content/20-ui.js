"use strict";

(function initUI(global) {
  const utils = global.FormHelperUtils;
  const { api, getSettings, sendMessage, DEFAULTS } = utils;
  const HARBOR_MODELS = [
    ["deepseek-v4.1-flash-1017", "DeepSeek V4.1 Flash 1017"],
    ["deepseek-v4.1-flash", "DeepSeek V4.1 Flash"],
    ["claude-haiku-5.5", "Claude Haiku 5.5"],
    ["muse-ember", "Muse Ember"],
    ["gpt-6-luna", "GPT-6 Luna"],
    ["minimax-m3.1-flash", "MiniMax M3.1 Flash"],
    ["glm-5.3-flash", "GLM 5.3 Flash"],
    ["qwen3.8-flash", "Qwen 3.8 Flash"]
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
  const DB_OPTIONS = [
    ["fisika", "Fisika Dasar"]
  ];

  let settingsActions = null;
  let hebatShortcutInstalled = false;
  let modelShortcutInstalled = false;
  let modelPickerActions = null;
  let cachedShortcut = DEFAULTS.pembahasanShortcut || "Alt+Shift+P";
  let cachedPembahasanMode = false;
  let cachedDbModeEnabled = false;
  let cachedDbSelected = DEFAULTS.dbSelected || "fisika";
  let cacheEpoch = 0;
  let toastTimer = null;

  function isHebatHost() {
    return location.hostname === "hebat.elearning.unair.ac.id" && /^\/mod\/quiz\//.test(location.pathname);
  }

  function isEditingTarget(target) {
    return typeof target?.matches === "function"
      && (target.matches("input, textarea, select")
        || target.isContentEditable
        || Boolean(target.closest?.('[contenteditable]:not([contenteditable="false"])')));
  }

  function showToast(message) {
    let host = document.getElementById("fh-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "fh-toast-host";
      host.className = "fh-ui-host";
      document.documentElement.append(host);
      const root = host.attachShadow({ mode: "closed" });
      const toastCss = isHebatHost()
        ? "border:1px solid #8bbcc4;background:#cce6ea;color:#163036;"
        : "border:1px solid #dadce0;border-left:4px solid #673ab7;background:#ffffff;color:#202124;";
      addStyle(root, `
        :host { all: initial; }
        .toast { position: fixed; right: 16px; bottom: 72px; z-index: 2147483647; padding: 9px 14px; border-radius: 10px; ${toastCss} font: 600 13px/1.35 system-ui, sans-serif; box-shadow: 0 4px 16px #0003; transition: opacity .2s ease; }
        .toast[hidden] { display: none; }
      `);
      const box = document.createElement("div");
      box.className = "toast";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      root.append(box);
      host._box = box;
    }
    const box = host._box;
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 1900);
  }

  function syncSettingsCacheFromStorage() {
    if (!api?.storage?.local?.get) return;
    const epoch = cacheEpoch;
    Promise.resolve(getSettings()).then((settings) => {
      if (epoch !== cacheEpoch) return;
      cachedShortcut = settings.pembahasanShortcut || "Alt+Shift+P";
      cachedPembahasanMode = settings.pembahasanMode === true;
      cachedDbModeEnabled = settings.dbModeEnabled === true;
      cachedDbSelected = settings.dbSelected || "fisika";
      refreshFooterModeControls();
    }).catch(() => {});
  }

  if (api?.storage?.onChanged?.addListener) {
    api.storage.onChanged.addListener((changes) => {
      cacheEpoch += 1;
      if (changes.pembahasanShortcut) cachedShortcut = utils.normalizeShortcut ? utils.normalizeShortcut(changes.pembahasanShortcut.newValue) : (changes.pembahasanShortcut.newValue || "Alt+Shift+P");
      if (changes.pembahasanMode) cachedPembahasanMode = changes.pembahasanMode.newValue === true;
      if (changes.dbModeEnabled) cachedDbModeEnabled = changes.dbModeEnabled.newValue === true;
      if (changes.dbSelected) cachedDbSelected = changes.dbSelected.newValue || "fisika";
      refreshFooterModeControls();
    });
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

  function addGoogleDbMenuItem(menu) {
    if (menu.querySelector('[data-form-helper-menu-item="google-db"]')) return;
    const nativeItem = menu.querySelector('[role="menuitem"]');
    const item = document.createElement("li");
    item.className = nativeItem?.className || "";
    item.setAttribute("role", "menuitem");
    item.setAttribute("tabindex", "-1");
    item.dataset.formHelperMenuItem = "google-db";
    item.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:48px;padding:0 16px;cursor:pointer;color:inherit;font:400 14px/20px Roboto,Arial,sans-serif;list-style:none;";
    const label = document.createElement("span");
    label.dataset.formHelperMenuItem = "google-db-label";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Pilih database soal");
    select.dataset.formHelperMenuItem = "google-db-select";
    select.style.cssText = "padding:3px 6px;font-size:12px;border:1px solid #dadce0;border-radius:6px;background:#fff;color:#202124;";
    fillModelOptions(select, DB_OPTIONS, cachedDbSelected);
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", async (event) => {
      event.stopPropagation();
      cacheEpoch += 1;
      cachedDbSelected = select.value;
      await api.storage.local.set({ dbSelected: cachedDbSelected });
    });
    item.addEventListener("click", async (event) => {
      if (event.target === select) return;
      cacheEpoch += 1;
      const next = !cachedDbModeEnabled;
      cachedDbModeEnabled = next;
      refreshFooterModeControls();
      await api.storage.local.set({ dbModeEnabled: next });
      showToast(`Mode DB: ${next ? "Aktif" : "Nonaktif"}`);
    });
    item.addEventListener("mouseenter", () => { item.style.backgroundColor = "rgba(60,64,67,.08)"; });
    item.addEventListener("mouseleave", () => { item.style.backgroundColor = "transparent"; });
    item.append(label, select);
    menu.append(item);
  }

  function syncHelpMenu() {
    if (!settingsActions) return;
    for (const menu of document.querySelectorAll('[role="menu"]')) {
      if (!isGoogleHelpMenu(menu)) continue;
      addHelpMenuItem(menu, "load-page", "Muat soal halaman ini", settingsActions.loadPage);
      addHelpMenuItem(menu, "model-picker", "Ganti model", () => modelPickerActions?.open());
      addHelpMenuItem(menu, "google-pembahasan", `Pembahasan: ${cachedPembahasanMode ? "ON" : "OFF"}`, () => togglePembahasanMode(true));
      addGoogleDbMenuItem(menu);
      addHelpMenuItem(menu, "settings", "Pengaturan Form Helper", settingsActions.openSettings);
    }
    syncHebatFooterMenu();
    refreshFooterModeControls();
  }

  function refreshFooterModeControls() {
    for (const btn of document.querySelectorAll('[data-form-helper-menu-item="hebat-pembahasan"]')) {
      btn.textContent = `Pembahasan: ${cachedPembahasanMode ? "ON" : "OFF"}`;
      btn.title = `Toggle Mode Pembahasan · ${cachedShortcut}`;
      btn.setAttribute("aria-pressed", cachedPembahasanMode ? "true" : "false");
    }
    for (const item of document.querySelectorAll('[data-form-helper-menu-item="google-pembahasan"] span')) {
      item.textContent = `Pembahasan: ${cachedPembahasanMode ? "ON" : "OFF"}`;
    }
    for (const btn of document.querySelectorAll('[data-form-helper-menu-item="hebat-db-toggle"]')) {
      btn.textContent = `Mode DB: ${cachedDbModeEnabled ? "ON" : "OFF"}`;
      btn.setAttribute("aria-pressed", cachedDbModeEnabled ? "true" : "false");
    }
    for (const label of document.querySelectorAll('[data-form-helper-menu-item="google-db-label"]')) {
      label.textContent = `Mode DB: ${cachedDbModeEnabled ? "ON" : "OFF"}`;
    }
    for (const select of document.querySelectorAll('[data-form-helper-menu-item="hebat-db-select"], [data-form-helper-menu-item="google-db-select"]')) {
      select.value = cachedDbSelected;
      select.disabled = !cachedDbModeEnabled;
    }
  }

  async function togglePembahasanMode(announce = true) {
    cacheEpoch += 1;
    const next = !cachedPembahasanMode;
    cachedPembahasanMode = next;
    refreshFooterModeControls();
    await api.storage.local.set({ pembahasanMode: next });
    const settingsHost = document.getElementById("fh-settings-host");
    const panelCheckbox = settingsHost?.shadowRoot?.querySelector("#pembahasanMode");
    if (panelCheckbox) panelCheckbox.checked = next;
    if (announce) showToast(`Mode Pembahasan: ${next ? "Aktif" : "Nonaktif"}`);
  }

  function syncHebatFooterMenu() {
    if (!isHebatHost()) return;
    for (const region of document.querySelectorAll('[data-region="footer-container-popover"]')) {
      const body = region.querySelector(".popover.footer .popover-body");
      if (!body) continue;
      let section = body.querySelector('[data-form-helper-menu-item="hebat-section"]');
      if (!section) {
        section = document.createElement("div");
        section.className = "footer-section p-3 border-bottom";
        section.dataset.formHelperMenuItem = "hebat-section";
        body.append(section);
      }

      if (!section.querySelector('[data-form-helper-menu-item="hebat-settings"]')) {
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
      }

      if (!section.querySelector('[data-form-helper-menu-item="hebat-model-picker"]')) {
        const modelPicker = document.createElement("button");
        modelPicker.className = "btn btn-link p-0 ms-3";
        modelPicker.type = "button";
        modelPicker.textContent = "Ganti model";
        modelPicker.title = "Ganti model · Alt+Shift+M";
        modelPicker.dataset.formHelperMenuItem = "hebat-model-picker";
        modelPicker.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void modelPickerActions?.open();
        });
        section.append(modelPicker);
      }

      if (/^\/mod\/quiz\/attempt\.php$/.test(location.pathname)
          && document.querySelector("#responseform")
          && !section.querySelector('[data-form-helper-menu-item="hebat-load-page"]')) {
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

      if (!section.querySelector('[data-form-helper-menu-item="hebat-modes-row"]')) {
        const modesRow = document.createElement("div");
        modesRow.dataset.formHelperMenuItem = "hebat-modes-row";
        modesRow.className = "mt-2 d-flex flex-wrap align-items-center gap-2";
        modesRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:8px;";

        const pembBtn = document.createElement("button");
        pembBtn.className = "btn btn-link p-0";
        pembBtn.type = "button";
        pembBtn.dataset.formHelperMenuItem = "hebat-pembahasan";
        pembBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void togglePembahasanMode(true);
        });

        const dbBtn = document.createElement("button");
        dbBtn.className = "btn btn-link p-0";
        dbBtn.type = "button";
        dbBtn.dataset.formHelperMenuItem = "hebat-db-toggle";
        dbBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          cacheEpoch += 1;
          const next = !cachedDbModeEnabled;
          cachedDbModeEnabled = next;
          refreshFooterModeControls();
          await api.storage.local.set({ dbModeEnabled: next });
          showToast(`Mode DB: ${next ? "Aktif" : "Nonaktif"}`);
        });

        const dbSelect = document.createElement("select");
        dbSelect.className = "form-select form-select-sm";
        dbSelect.style.cssText = "width:auto;min-width:130px;padding:2px 8px;font-size:12px;border-radius:6px;border:1px solid #ced4da;";
        dbSelect.setAttribute("aria-label", "Pilih database soal");
        dbSelect.dataset.formHelperMenuItem = "hebat-db-select";
        fillModelOptions(dbSelect, DB_OPTIONS, cachedDbSelected);
        dbSelect.addEventListener("click", (event) => event.stopPropagation());
        dbSelect.addEventListener("change", async (event) => {
          event.stopPropagation();
          cacheEpoch += 1;
          cachedDbSelected = dbSelect.value;
          await api.storage.local.set({ dbSelected: cachedDbSelected });
        });

        modesRow.append(pembBtn, dbBtn, dbSelect);
        section.append(modesRow);
      }

      if (!section.isConnected) body.append(section);
    }
    refreshFooterModeControls();
  }

  function installHebatSettingsShortcut() {
    syncSettingsCacheFromStorage();
    if (hebatShortcutInstalled) return;
    hebatShortcutInstalled = true;
    document.addEventListener("keydown", (event) => {
      if (utils.eventMatchesShortcut && utils.eventMatchesShortcut(event, cachedShortcut)) {
        const activeHost = document.activeElement?.id === "fh-settings-host";
        if (!activeHost) {
          event.preventDefault();
          event.stopPropagation();
          void togglePembahasanMode(true);
          return;
        }
      }
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
          || (event.code !== "KeyM" && event.key?.toLowerCase() !== "m" && event.keyCode !== 77)) return;
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
    syncSettingsCacheFromStorage();
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
      .panel { position: fixed; right: 12px; bottom: 72px; z-index: 2147483647; width: min(380px, calc(100vw - 24px)); max-height: min(84vh, 740px); overflow: auto; padding: 17px; border: 1px solid #8993a5; border-radius: 14px; background: Canvas; color: CanvasText; box-shadow: 0 8px 30px #0005; }
      .panel[hidden] { display: none; }
      h2 { font-size: 18px; margin: 0 0 12px; }
      label { display: block; margin: 11px 0 5px; font-size: 13px; font-weight: 600; }
      input, select { display: block; width: 100%; padding: 9px; border: 1px solid #8892a5; border-radius: 8px; background: Canvas; color: CanvasText; font-size: 14px; }
      select:disabled, input:disabled { opacity: .55; }
      .toggle { display: flex; gap: 9px; align-items: center; }
      .toggle input { width: auto; }
      .consent { display: flex; gap: 8px; align-items: flex-start; font-weight: 400; line-height: 1.4; }
      .consent input { width: auto; margin-top: 2px; }
      .row { display: flex; gap: 8px; margin-top: 13px; }
      .shortcut-row { display: flex; gap: 8px; align-items: center; }
      .shortcut-row input { flex: 1; cursor: pointer; text-align: center; font-weight: 600; }
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
      <p class="note">GPT-OSS hanya menerima teks. Semua model Harbor di atas mendukung gambar langsung.</p>
      <label class="toggle"><input id="imageToText" type="checkbox"> OCR gambar dengan Qwen 3.8 27B (Groq)</label>
      <p class="note">Opsional: jika aktif, gambar diubah jadi teks OCR oleh Qwen terlebih dahulu sebelum dikirim ke model jawaban.</p>
      <label class="toggle"><input id="onlyHarbor" type="checkbox"> Nonaktifkan fallback Gemini AI</label>
      <p class="note">Saat aktif, Gemini tidak dipanggil ketika model jawaban gagal.</p>
      <div class="group">
        <label class="toggle"><input id="pembahasanMode" type="checkbox"> Aktifkan Mode Pembahasan</label>
        <label for="pembahasanShortcut">Shortcut Mode Pembahasan</label>
        <div class="shortcut-row">
          <input id="pembahasanShortcut" type="text" readonly title="Klik lalu tekan kombinasi tombol (mis. Alt+Shift+P)">
          <button class="secondary" id="resetShortcut" type="button">Reset</button>
        </div>
        <p class="note">Klik kotak shortcut lalu tekan kombinasi tombol (wajib memakai Alt, Ctrl, atau Meta) untuk toggle dinamis.</p>
      </div>
      <div class="group">
        <label class="toggle"><input id="dbModeEnabled" type="checkbox"> Aktifkan Mode DB</label>
        <label for="dbSelected">Pilih Database Soal</label><select id="dbSelected"></select>
        <p class="note">Mencocokkan soal ke database lokal lalu membandingkan hasilnya dengan jawaban AI.</p>
      </div>
      <label class="consent"><input id="dataConsent" type="checkbox"> Saya memahami bahwa teks dan gambar soal dikirim ke API Vercel. Tergantung pengaturan, data dapat diproses oleh Harbor, Gemini, atau Groq.</label>
      <div class="row"><button class="primary" id="save">Simpan</button><button class="secondary" id="ping">Cek konfigurasi</button><button class="secondary" id="close">Tutup</button></div>
      <div class="status" id="status" role="status" aria-live="polite"></div>
      <p class="note">Gunakan sesuai aturan dosen/penyelenggara ujian. Ekstensi hanya menampilkan saran dan tidak mengisi jawaban. Isi pertanyaan tidak disimpan di ekstensi atau log server.</p>
    `;
    fillModelOptions(panel.querySelector("#harborModel"), HARBOR_MODELS, DEFAULTS.harborModel);
    fillModelOptions(panel.querySelector("#geminiModel"), GEMINI_MODELS, DEFAULTS.geminiModel);
    fillModelOptions(panel.querySelector("#answerProvider"), ANSWER_PROVIDERS, DEFAULTS.answerProvider);
    fillModelOptions(panel.querySelector("#dbSelected"), DB_OPTIONS, DEFAULTS.dbSelected);
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
    const shortcutInput = panel.querySelector("#pembahasanShortcut");
    shortcutInput.addEventListener("keydown", (event) => {
      if (event.key === "Tab" || event.key === "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      const formatted = utils.formatShortcutFromEvent ? utils.formatShortcutFromEvent(event) : "";
      if (formatted === "Alt+Shift+O" || formatted === "Alt+Shift+M") {
        setStatus(`Shortcut ${formatted} sudah dipakai untuk menu/model. Pilih kombinasi lain.`, true);
      } else if (formatted) {
        shortcutInput.value = formatted;
        setStatus(`Shortcut diatur ke ${formatted}. Klik Simpan untuk menerapkan.`);
      } else {
        setStatus("Gunakan kombinasi dengan Alt, Ctrl, atau Meta (mis. Alt+Shift+P).", true);
      }
    });
    panel.querySelector("#resetShortcut").addEventListener("click", () => {
      shortcutInput.value = DEFAULTS.pembahasanShortcut || "Alt+Shift+P";
      setStatus("Shortcut dikembalikan ke default (Alt+Shift+P).");
    });

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
      panel.querySelector("#pembahasanMode").checked = settings.pembahasanMode === true;
      panel.querySelector("#pembahasanShortcut").value = settings.pembahasanShortcut || "Alt+Shift+P";
      panel.querySelector("#dbModeEnabled").checked = settings.dbModeEnabled === true;
      panel.querySelector("#dbSelected").value = settings.dbSelected || "fisika";
      panel.querySelector("#dbSelected").disabled = settings.dbModeEnabled !== true;
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
      const normalizedShortcut = utils.normalizeShortcut
        ? utils.normalizeShortcut(panel.querySelector("#pembahasanShortcut").value)
        : (panel.querySelector("#pembahasanShortcut").value || "Alt+Shift+P");
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
        pembahasanMode: panel.querySelector("#pembahasanMode").checked,
        pembahasanShortcut: normalizedShortcut,
        dbModeEnabled: panel.querySelector("#dbModeEnabled").checked,
        dbSelected: panel.querySelector("#dbSelected").value,
        dataConsentAccepted: panel.querySelector("#dataConsent").checked
      };
      if (values.enabled && !values.dataConsentAccepted) {
        setStatus("Setujui pemrosesan teks dan gambar soal sebelum mengaktifkan saran.", true);
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
        cacheEpoch += 1;
        cachedShortcut = values.pembahasanShortcut;
        cachedPembahasanMode = values.pembahasanMode;
        cachedDbModeEnabled = values.dbModeEnabled;
        cachedDbSelected = values.dbSelected;
        refreshFooterModeControls();
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
    panel.querySelector("#dbModeEnabled").addEventListener("change", (event) => {
      panel.querySelector("#dbSelected").disabled = !event.currentTarget.checked;
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

  function mountAnswerHost(block, panelHost, platform) {
    panelHost.style.cssText = "display:block;clear:both;width:100%;";
    if (platform === "hebat" || block.matches?.(".que")) {
      const container = block.querySelector(".formulation") || block.querySelector(".content") || block;
      container.append(panelHost);
      return;
    }
    const gformCard = block.querySelector(".geS5n") || block;
    gformCard.append(panelHost);
  }

  function isolatePanelHost(panelHost) {
    for (const type of ["click", "pointerdown", "mousedown", "mouseup", "touchstart", "touchend", "keydown", "input", "change"]) {
      panelHost.addEventListener(type, (event) => event.stopPropagation());
    }
  }

  function formatDisplayAnswer(text) {
    return String(text || "")
      .replace(/^([A-Z])\.\s+\1\s*[.)]\s+/i, "$1. ")
      .trim();
  }

  function renderDiscussionContent(container, text) {
    const normalized = String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/([^\n])\s*(?=(?:Diketahui|Ditanya|Dijawab)\s*:)/gi, "$1\n")
      .trim();
    const sections = normalized.split(/\n(?=(?:Diketahui|Ditanya|Dijawab)\s*:)/i);
    for (const part of sections) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const lineMatch = trimmed.match(/^(Diketahui|Ditanya|Dijawab)\s*:\s*([\s\S]*)$/i);
      const item = document.createElement("div");
      item.className = "disc-block";
      if (lineMatch) {
        const labelText = lineMatch[1][0].toUpperCase() + lineMatch[1].slice(1).toLowerCase();
        const heading = document.createElement("div");
        heading.className = "disc-label";
        heading.textContent = labelText;
        const body = document.createElement("div");
        body.className = "disc-body";
        const lines = lineMatch[2].split("\n").map((l) => l.trim()).filter(Boolean);
        if (labelText === "Dijawab" && lines.length > 1) {
          const steps = document.createElement("div");
          steps.textContent = lines.slice(0, -1).join("\n");
          const resultLine = document.createElement("div");
          resultLine.className = "disc-final";
          resultLine.textContent = lines.at(-1);
          body.append(steps, resultLine);
        } else {
          body.textContent = lines.join("\n");
        }
        item.append(heading, body);
      } else {
        item.textContent = trimmed;
      }
      container.append(item);
    }
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
    const isHebat = platform === "hebat";
    const starColor = isHebat ? "#cbe6e9" : "#ffffff";
    const hoverBackground = isHebat ? "#f1f3f4" : "transparent";
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
        isolatePanelHost(panelHost);
        const panelRoot = panelHost.attachShadow({ mode: "closed" });
        const cardStyle = isHebat
          ? `margin:12px 0 0;padding:10px 12px;border:1px solid #96c3ca;border-top:2px solid #75aeb8;border-radius:8px;background:#cce6ea;color:#163036;font-size:14px;line-height:1.45`
          : `margin:12px 0 0;padding:10px 12px;border:1px solid #dadce0;border-top:2px solid #673ab7;border-radius:8px;background:#ffffff;color:#202124;font-size:14px;line-height:1.45`;
        addStyle(panelRoot, `*{box-sizing:border-box;font-family:system-ui,sans-serif}.card{${cardStyle};display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.error{color:#b42318}.close{flex:0 0 auto;width:28px;height:28px;border:0;border-radius:6px;background:rgba(0,0,0,.07);color:inherit;font-size:18px;line-height:1;cursor:pointer;display:inline-grid;place-items:center}.close:hover{background:rgba(0,0,0,.14)}`);
        const card = document.createElement("div"); card.className = `card${isError ? " error" : ""}`;
        const text = document.createElement("span"); text.textContent = message;
        const close = document.createElement("button"); close.className = "close"; close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", onClose ? "Batalkan permintaan" : "Tutup");
        close.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); if (onClose) onClose(); else { panelHost.remove(); control.panel = null; } });
        card.append(text, close); panelRoot.append(card);
        mountAnswerHost(block, panelHost, platform);
        control.panel = panelHost;
      },
      showAnswer(response, questionType) {
        control.removePanel();
        const panelHost = document.createElement("div");
        panelHost.className = "fh-answer-host";
        isolatePanelHost(panelHost);
        const panelRoot = panelHost.attachShadow({ mode: "closed" });
        const cardCss = isHebat
          ? `.card{margin:12px 0 0;padding:12px 14px;border:1px solid #96c3ca;border-top:2px solid #75aeb8;border-radius:8px;background:#cce6ea;color:#163036;font-size:14px;line-height:1.45;overflow-wrap:anywhere}.top-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.top-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}.top-actions button{border:0;border-radius:6px;background:rgba(22,48,54,.09);color:#163036;padding:4px 9px;cursor:pointer;font-size:12px;font-weight:600}.top-actions button:hover{background:rgba(22,48,54,.17)}.top-actions .close-btn{width:28px;height:28px;padding:0;font-size:18px;line-height:1;display:inline-grid;place-items:center}.disc-block{border-left:3px solid #63a4af;padding:4px 0 4px 10px;background:rgba(255,255,255,.26);border-radius:0 6px 6px 0}`
          : `.card{margin:12px 0 0;padding:12px 14px;border:1px solid #dadce0;border-top:2px solid #673ab7;border-radius:8px;background:#ffffff;color:#202124;font-family:Roboto,Arial,sans-serif;font-size:14px;line-height:1.45;overflow-wrap:anywhere}.top-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.top-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}.top-actions button{border:0;border-radius:6px;background:#f1f3f4;color:#202124;padding:4px 9px;cursor:pointer;font-size:12px;font-weight:600}.top-actions button:hover{background:#e2e5e8}.top-actions .close-btn{width:28px;height:28px;padding:0;font-size:18px;line-height:1;display:inline-grid;place-items:center}.disc-block{border-left:3px solid #673ab7;padding:4px 0 4px 10px;background:#f8f5fc;border-radius:0 6px 6px 0}`;
        addStyle(panelRoot, `
          *{box-sizing:border-box;font-family:system-ui,sans-serif}
          ${cardCss}
          .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(22,48,54,.1);color:inherit}
          .badge.match{background:#c5e8d1;color:#115329}
          .badge.mismatch{background:#fde6bf;color:#7a4300}
          .badge.notfound{background:rgba(22,48,54,.08);color:inherit}
          .answer{font-weight:700;font-size:15.5px;line-height:1.4;white-space:pre-wrap}
          .compare-grid{display:grid;gap:7px;margin-top:4px}
          .compare-item{padding:8px 10px;border-radius:7px;border:1px solid rgba(22,48,54,.16);background:rgba(255,255,255,.38)}
          .compare-label{font-size:11px;font-weight:700;opacity:.8;margin-bottom:2px}
          .meta{margin-top:6px;font-size:12px;opacity:.82;line-height:1.45}
          .discussion{margin-top:10px;padding-top:10px;border-top:1px solid rgba(22,48,54,.2);font-size:13px;line-height:1.55;display:grid;gap:7px}
          .discussion-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;opacity:.75}
          .disc-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;opacity:.78;margin-bottom:2px}
          .disc-body{white-space:pre-wrap}
          .disc-final{margin-top:3px;font-weight:700}
          .warning{color:#9a4d00;font-size:12px;margin-top:6px;font-weight:500}
        `);
        const card = document.createElement("div"); card.className = "card";
        const topBar = document.createElement("div"); topBar.className = "top-bar";
        const badge = document.createElement("span"); badge.className = "badge";
        const dbComp = response.dbComparison;
        if (dbComp?.status === "match") {
          badge.classList.add("match");
          badge.textContent = `✓ DB & AI Sama (${dbComp.dbName || "DB"})`;
        } else if (dbComp?.status === "mismatch") {
          badge.classList.add("mismatch");
          badge.textContent = `⚠ DB & AI Berbeda (${dbComp.dbName || "DB"})`;
        } else if (dbComp?.status === "not_found") {
          badge.classList.add("notfound");
          badge.textContent = "DB: Tidak cocok · Saran AI";
        } else {
          badge.textContent = "✦ Saran AI";
        }

        const displayAi = formatDisplayAnswer(response.answer.display);
        const displayDb = dbComp?.dbDisplay ? formatDisplayAnswer(dbComp.dbDisplay) : "";

        const topActions = document.createElement("div"); topActions.className = "top-actions";
        const copy = document.createElement("button"); copy.type = "button"; copy.textContent = "Salin";
        const copyPayload = response.discussion
          ? `${displayAi}\n\n${response.discussion}`
          : displayAi;
        copy.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          try { await navigator.clipboard.writeText(copyPayload); copy.textContent = "Tersalin"; }
          catch { copy.textContent = "Gagal salin"; }
        });
        const close = document.createElement("button"); close.type = "button"; close.className = "close-btn"; close.textContent = "×"; close.setAttribute("aria-label", "Tutup"); close.title = "Tutup";
        close.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          panelHost.remove();
          control.panel = null;
        });
        topActions.append(copy, close);
        topBar.append(badge, topActions);
        card.append(topBar);

        if (dbComp?.status === "mismatch") {
          const grid = document.createElement("div"); grid.className = "compare-grid";
          const dbBox = document.createElement("div"); dbBox.className = "compare-item";
          const dbLabel = document.createElement("div"); dbLabel.className = "compare-label"; dbLabel.textContent = `Jawaban DB (${dbComp.dbName || "Database"})`;
          const dbVal = document.createElement("div"); dbVal.className = "answer"; dbVal.textContent = displayDb;
          dbBox.append(dbLabel, dbVal);

          const aiBox = document.createElement("div"); aiBox.className = "compare-item";
          const aiLabel = document.createElement("div"); aiLabel.className = "compare-label"; aiLabel.textContent = `Jawaban AI (${response.model || response.provider || "AI"})`;
          const aiVal = document.createElement("div"); aiVal.className = "answer"; aiVal.textContent = displayAi;
          aiBox.append(aiLabel, aiVal);

          grid.append(dbBox, aiBox);
          card.append(grid);
        } else {
          const title = document.createElement("div"); title.className = "answer"; title.textContent = displayAi;
          card.append(title);
        }

        if (questionType !== "paragraph") {
          const detail = document.createElement("div"); detail.className = "meta";
          detail.textContent = `Keyakinan ${Math.round((response.confidence || 0) * 100)}%${response.explanation ? ` · ${response.explanation}` : ""}`;
          card.append(detail);
        }

        if (response.discussion) {
          const discWrap = document.createElement("div"); discWrap.className = "discussion";
          const discTitle = document.createElement("div"); discTitle.className = "discussion-title"; discTitle.textContent = "Pembahasan";
          discWrap.append(discTitle);
          renderDiscussionContent(discWrap, response.discussion);
          card.append(discWrap);
        }

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
        panelRoot.append(card);
        mountAnswerHost(block, panelHost, platform);
        control.panel = panelHost;
      }
    };
    return control;
  }

  global.FormHelperUI = {
    initSettingsPanel,
    initHebatLauncher,
    initHebatSettingsShortcut: installHebatSettingsShortcut,
    syncHelpMenu,
    questionControl
  };
})(globalThis);
