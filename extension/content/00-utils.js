"use strict";

(function initUtils(global) {
  const api = global.browser || global.chrome;
  const VALID_HARBOR_MODELS = new Set([
    "deepseek-v4.1-flash-1017",
    "deepseek-v4.1-flash",
    "claude-haiku-5.5",
    "muse-ember",
    "gpt-6-luna",
    "minimax-m3.1-flash",
    "glm-5.3-flash",
    "qwen3.8-flash"
  ]);
  const DEFAULTS = {
    enabled: true,
    apiBase: "",
    token: "",
    lang: "auto",
    harborModel: "deepseek-v4.1-flash-1017",
    geminiModel: "gemini-3.8-flash",
    answerProvider: "harbor",
    imageToText: false,
    onlyHarbor: false,
    pembahasanMode: false,
    pembahasanShortcut: "Alt+Shift+P",
    dbModeEnabled: false,
    dbSelected: "fisika",
    dataConsentAccepted: false
  };

  function normalizeShortcutKey(rawKey) {
    if (!rawKey) return "";
    const trimmed = String(rawKey).trim();
    if (!trimmed) return "";
    if (/^Key[A-Z]$/.test(trimmed)) return trimmed.slice(3);
    if (/^Digit[0-9]$/.test(trimmed)) return trimmed.slice(5);
    if (trimmed === " ") return "Space";
    if (trimmed.length === 1) return trimmed.toUpperCase();
    return trimmed[0].toUpperCase() + trimmed.slice(1);
  }

  function normalizeShortcut(value) {
    if (typeof value !== "string") return DEFAULTS.pembahasanShortcut;
    const parts = value.split("+").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return DEFAULTS.pembahasanShortcut;
    const mods = new Set();
    let mainKey = "";
    for (const part of parts) {
      const low = part.toLowerCase();
      if (low === "ctrl" || low === "control") mods.add("Ctrl");
      else if (low === "alt" || low === "option") mods.add("Alt");
      else if (low === "shift") mods.add("Shift");
      else if (low === "meta" || low === "cmd" || low === "command" || low === "super") mods.add("Meta");
      else mainKey = normalizeShortcutKey(part);
    }
    if (!mainKey || (!mods.has("Ctrl") && !mods.has("Alt") && !mods.has("Meta"))) {
      return DEFAULTS.pembahasanShortcut;
    }
    const ordered = [];
    if (mods.has("Ctrl")) ordered.push("Ctrl");
    if (mods.has("Alt")) ordered.push("Alt");
    if (mods.has("Shift")) ordered.push("Shift");
    if (mods.has("Meta")) ordered.push("Meta");
    ordered.push(mainKey);
    return ordered.join("+");
  }

  function formatShortcutFromEvent(event) {
    if (!event) return "";
    const ignored = new Set(["Control", "Shift", "Alt", "Meta", "OS", "Dead", "Process"]);
    const keyName = ignored.has(event.key) ? "" : normalizeShortcutKey(
      /^Key[A-Z]$/.test(event.code || "") || /^Digit[0-9]$/.test(event.code || "")
        ? event.code
        : event.key
    );
    if (!keyName) return "";
    if (!event.ctrlKey && !event.altKey && !event.metaKey) return "";
    const parts = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (event.metaKey) parts.push("Meta");
    parts.push(keyName);
    return parts.join("+");
  }

  function eventMatchesShortcut(event, shortcutStr) {
    if (!event || event.repeat || event.isComposing) return false;
    const normalized = normalizeShortcut(shortcutStr);
    const parts = normalized.split("+");
    const expectedKey = parts.at(-1);
    const needCtrl = parts.includes("Ctrl");
    const needAlt = parts.includes("Alt");
    const needShift = parts.includes("Shift");
    const needMeta = parts.includes("Meta");
    if (Boolean(event.ctrlKey) !== needCtrl
        || Boolean(event.altKey) !== needAlt
        || Boolean(event.shiftKey) !== needShift
        || Boolean(event.metaKey) !== needMeta) {
      return false;
    }
    const eventCodeKey = normalizeShortcutKey(event.code);
    const eventKey = normalizeShortcutKey(event.key);
    return eventCodeKey === expectedKey || eventKey === expectedKey;
  }

  async function getSettings() {
    const settings = await api.storage.local.get(DEFAULTS);
    if (!VALID_HARBOR_MODELS.has(settings.harborModel)) {
      settings.harborModel = DEFAULTS.harborModel;
      await api.storage.local.set({ harborModel: settings.harborModel });
    }
    settings.pembahasanShortcut = normalizeShortcut(settings.pembahasanShortcut);
    return settings;
  }

  function cleanText(value) {
    return String(value || "").replace(/\*/g, " ").replace(/\s+/g, " ").trim();
  }

  function sendMessage(message) {
    if (global.browser && global.browser.runtime) return global.browser.runtime.sendMessage(message);
    return new Promise((resolve, reject) => api.runtime.sendMessage(message, (response) => {
      const error = api.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve(response);
    }));
  }

  global.FormHelperUtils = {
    api,
    DEFAULTS,
    VALID_HARBOR_MODELS,
    getSettings,
    cleanText,
    sendMessage,
    normalizeShortcut,
    formatShortcutFromEvent,
    eventMatchesShortcut
  };
})(globalThis);
