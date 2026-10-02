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
    ["qwen3.8-flash", "Qwen 3.8 Flash (berbayar)"]
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
    document.documentElement.append(host);
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
      <p class="note">GPT-OSS hanya menerima teks. Untuk soal bergambar, aktifkan OCR Qwen atau jawaban akan dialihkan ke Harbor/Gemini.</p>
      <label class="toggle"><input id="imageToText" type="checkbox"> OCR gambar dengan Qwen 3.8 27B (Groq)</label>
      <p class="note">Jika aktif, Qwen menyalin rumus, angka, tabel, dan label gambar menjadi teks sebelum dikirim ke model jawaban.</p>
      <label class="toggle"><input id="onlyHarbor" type="checkbox"> Nonaktifkan fallback Gemini AI</label>
      <p class="note">Saat aktif, Gemini tidak dipanggil ketika model jawaban gagal.</p>
      <label class="consent"><input id="dataConsent" type="checkbox"> Saya memahami bahwa teks dan gambar soal dikirim ke API Vercel. Tergantung pengaturan, data dapat diproses oleh Harbor, Gemini, atau Groq (Qwen untuk OCR dan GPT-OSS untuk jawaban teks).</label>
      <div class="row"><button class="primary" id="save">Simpan</button><button class="secondary" id="ping">Cek konfigurasi</button><button class="secondary" id="close">Tutup</button></div>
      <div class="status" id="status" role="status" aria-live="polite"></div>
      <p class="note">Gunakan sesuai aturan dosen/penyelenggara ujian. Ekstensi hanya menampilkan saran dan tidak mengisi jawaban. Isi pertanyaan tidak disimpan di ekstensi atau log server.</p>
    `;
    fillModelOptions(panel.querySelector("#harborModel"), HARBOR_MODELS, DEFAULTS.harborModel);
    fillModelOptions(panel.querySelector("#geminiModel"), GEMINI_MODELS, DEFAULTS.geminiModel);
    fillModelOptions(panel.querySelector("#answerProvider"), ANSWER_PROVIDERS, DEFAULTS.answerProvider);
    root.append(panel);

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

  function questionControl(block, onAsk) {
    const host = document.createElement("div");
    host.className = "fh-question-host";
    host.style.cssText = "position:absolute;top:2px;right:2px;z-index:5;width:34px;height:34px;line-height:0;";
    const needsPositionAnchor = getComputedStyle(block).position === "static";
    const originalPosition = block.style.getPropertyValue("position");
    const originalPositionPriority = block.style.getPropertyPriority("position");
    if (needsPositionAnchor) block.style.setProperty("position", "relative", "important");
    const root = host.attachShadow({ mode: "closed" });
    addStyle(root, `
      * { box-sizing: border-box; font-family: system-ui, sans-serif; }
      .actions { display: flex; justify-content: flex-end; padding: 0 4px; }
      button { display: inline-grid; place-items: center; width: 34px; min-width: 34px; height: 34px; min-height: 34px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #ffffff; opacity: 1; font-size: 14px; cursor: pointer; box-shadow: none; }
      button:hover, button:focus-visible { background: transparent; color: #ffffff; outline: none; }
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
    button.addEventListener("click", () => onAsk(control));
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
          GROQ_UNAVAILABLE: "API key Groq belum dikonfigurasi; jawaban dialihkan ke Harbor/Gemini."
        };
        if (warningMessages[response.warning]) { const warning = document.createElement("div"); warning.className = "warning"; warning.textContent = warningMessages[response.warning]; card.append(warning); }
        panelRoot.append(card); block.insertAdjacentElement("afterend", panelHost); control.panel = panelHost;
      }
    };
    return control;
  }

  global.FormHelperUI = { initSettingsPanel, syncHelpMenu, questionControl };
})(globalThis);
