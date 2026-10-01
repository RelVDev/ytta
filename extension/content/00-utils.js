"use strict";

(function initUtils(global) {
  const api = global.browser || global.chrome;
  const DEFAULTS = {
    enabled: true,
    apiBase: "",
    token: "",
    lang: "auto",
    harborModel: "qwen3.8-flash:free",
    geminiModel: "gemini-3.8-flash",
    dataConsentAccepted: false
  };

  async function getSettings() {
    return api.storage.local.get(DEFAULTS);
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

  global.FormHelperUtils = { api, DEFAULTS, getSettings, cleanText, sendMessage };
})(globalThis);
