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
    answerProvider: "harbor",
    imageToText: true,
    onlyHarbor: false,
    dataConsentAccepted: false
  };

  async function getSettings() {
    const settings = await api.storage.local.get(DEFAULTS);
    if (settings.harborModel === "claude-haiku-5.5:free") {
      settings.harborModel = "claude-haiku-5.5";
      await api.storage.local.set({ harborModel: settings.harborModel });
    }
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

  global.FormHelperUtils = { api, DEFAULTS, getSettings, cleanText, sendMessage };
})(globalThis);
