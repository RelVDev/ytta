"use strict";

const { AppError, MESSAGES } = require("./errors");

function parseModelJson(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new Error("Model returned no text");
  const text = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

function matchOptionText(text, options) {
  const normalized = String(text || "").trim().toLocaleLowerCase();
  return options.find((option) => option.text.trim().toLocaleLowerCase() === normalized);
}

function normalizeModelOutput(rawOutput, question) {
  let output;
  try { output = parseModelJson(rawOutput); } catch {
    throw new AppError("MODEL_ERROR", MESSAGES.MODEL_ERROR, 502);
  }
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new AppError("MODEL_ERROR", MESSAGES.MODEL_ERROR, 502);
  }
  const rawKeys = Array.isArray(output.keys) ? output.keys : [];
  const rawTexts = Array.isArray(output.texts) ? output.texts : [];
  const options = question.options || [];
  const keys = [];
  const texts = [];

  if (question.type === "linear_scale") {
    const candidates = [...rawTexts, ...rawKeys].filter((item) => typeof item === "string").map((item) => item.trim());
    const selected = candidates.map((candidate) => matchOptionText(candidate, options)).find(Boolean);
    if (!selected) throw new AppError("MODEL_ERROR", MESSAGES.MODEL_ERROR, 502);
    const label = selected.text || "";
    return {
      keys: [], texts: [label], display: label, rows: null,
      confidence: Number.isFinite(Number(output.confidence)) ? Math.max(0, Math.min(1, Number(output.confidence))) : 0.5,
      explanation: typeof output.explanation === "string" ? output.explanation.trim().slice(0, 500) : ""
    };
  }

  for (let index = 0; index < Math.max(rawKeys.length, rawTexts.length); index += 1) {
    const rawKey = typeof rawKeys[index] === "string" ? rawKeys[index].trim() : "";
    const rawText = typeof rawTexts[index] === "string" ? rawTexts[index].trim() : "";
    let option = options.find((item) => item.key.toLowerCase() === rawKey.toLowerCase());
    if (!option && rawText) option = matchOptionText(rawText.replace(/^[A-Z]{1,2}[.)]\s*/, ""), options);
    if (!option && rawText && /^[A-Z]{1,2}$/.test(rawText)) option = options.find((item) => item.key.toLowerCase() === rawText.toLowerCase());
    if (option && !keys.includes(option.key)) {
      keys.push(option.key);
      texts.push(option.text || "(gambar)");
    } else if (!options.length && rawText && !texts.includes(rawText)) {
      texts.push(rawText);
    }
  }

  let rows = null;
  if (["grid_mc", "grid_checkbox"].includes(question.type)) {
    keys.length = 0;
    texts.length = 0;
    const allowedRows = new Set(question.rows || []);
    const allowedColumns = new Set(question.columns || []);
    rows = (Array.isArray(output.rows) ? output.rows : [])
      .filter((entry) => entry && typeof entry.row === "string" && allowedRows.has(entry.row))
      .map((entry) => ({
        row: entry.row,
        picks: (Array.isArray(entry.picks) ? entry.picks : [])
          .filter((pick) => typeof pick === "string" && allowedColumns.has(pick))
          .slice(0, question.type === "grid_mc" ? 1 : question.columns.length)
      }))
      .filter((entry) => entry.picks.length);
    if (!rows.length) throw new AppError("MODEL_ERROR", MESSAGES.MODEL_ERROR, 502);
    texts.push(...rows.map((entry) => `${entry.row} → ${entry.picks.join(", ")}`));
  } else if (["short_answer", "paragraph", "date", "time"].includes(question.type)) {
    const answerTexts = rawTexts.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
    if (answerTexts.length) {
      texts.length = 0;
      texts.push(question.type === "paragraph" ? answerTexts[0].split(/(?<=[.!?])\s+/).slice(0, 3).join(" ") : answerTexts[0]);
    }
  }

  if (["multiple_choice", "dropdown"].includes(question.type) && keys.length > 1) {
    keys.splice(1);
    texts.splice(1);
  }
  if (question.type === "checkbox" && keys.length > 26) keys.splice(26);
  if (question.type === "checkbox" && texts.length > 26) texts.splice(26);
  if (!texts.length) throw new AppError("MODEL_ERROR", MESSAGES.MODEL_ERROR, 502);

  const display = ["grid_mc", "grid_checkbox"].includes(question.type)
    ? texts.join("\n")
    : keys.length
      ? keys.map((key, index) => `${key}. ${texts[index]}`).join("; ")
      : texts.join("; ");
  const confidence = Number(output.confidence);
  return {
    keys,
    texts,
    display,
    rows,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    explanation: typeof output.explanation === "string" ? output.explanation.trim().slice(0, 500) : ""
  };
}

module.exports = { parseModelJson, normalizeModelOutput };
