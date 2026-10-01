"use strict";

const { AppError, MESSAGES } = require("./errors");

function invalidModelOutput(reason) {
  const error = new AppError("MODEL_ERROR", MESSAGES.MODEL_ERROR, 502);
  error.reason = reason;
  return error;
}

function parseModelJson(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new Error("Model returned no text");
  const text = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(text); } catch {}
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(text.slice(start, index + 1)); } catch { break; }
        }
      }
    }
  }
  throw new Error("Model response did not contain valid JSON");
}

function matchOptionText(text, options) {
  const normalized = String(text || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return options.find((option) => option.text.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase() === normalized);
}

function matchLinearScale(candidates, options) {
  for (const candidate of candidates) {
    const exact = matchOptionText(candidate, options);
    if (exact) return exact;
    const key = candidate.match(/^\s*(?:option\s+)?([a-z])(?:\s*[.)-]\s*|$)/i)?.[1];
    if (key) {
      const keyed = options.find((option) => option.key.toLowerCase() === key.toLowerCase());
      if (keyed) return keyed;
    }
  }
  for (const candidate of candidates) {
    const numbers = candidate.match(/(?:^|[^\w])([-+]?\d+(?:[.,]\d+)?)(?=$|[^\w])/g) || [];
    for (const token of numbers) {
      const number = token.trim().replace(/^[^\d+-]+/, "").replace(/[.,]$/, "").replace(",", ".");
      const selected = options.find((option) => {
        const optionNumbers = option.text.match(/[-+]?\d+(?:[.,]\d+)?/g) || [];
        return optionNumbers.some((value) => value.replace(",", ".") === number);
      });
      if (selected) return selected;
    }
  }
  return null;
}

function normalizeModelOutput(rawOutput, question) {
  let output;
  try { output = parseModelJson(rawOutput); } catch {
    throw invalidModelOutput("MALFORMED_JSON");
  }
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw invalidModelOutput("INVALID_OUTPUT");
  }
  const rawKeys = Array.isArray(output.keys) ? output.keys : [];
  const rawTexts = Array.isArray(output.texts) ? output.texts : [];
  const options = question.options || [];
  const keys = [];
  const texts = [];

  if (question.type === "linear_scale") {
    const candidates = [...rawTexts, ...rawKeys].filter((item) => typeof item === "string").map((item) => item.trim());
    const selected = matchLinearScale(candidates, options);
    if (!selected) throw invalidModelOutput("UNMATCHED_SCALE_VALUE");
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
    if (!rows.length) throw invalidModelOutput("EMPTY_GRID_ANSWER");
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
  if (!texts.length) throw invalidModelOutput("EMPTY_ANSWER");

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
