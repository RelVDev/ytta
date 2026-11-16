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

const SUPERSCRIPTS = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺" };
const SUBSCRIPTS = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "-": "₋", "+": "₊" };

function mapScript(str, table) {
  return [...str].map((ch) => table[ch] || ch).join("");
}

function sanitizeMathText(value) {
  if (typeof value !== "string") return "";
  let text = value.trim();
  if (!text) return "";
  text = text
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^$\n]+?)\$/g, "$1")
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "");
  for (let pass = 0; pass < 3; pass += 1) {
    text = text.replace(/\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
      const simpleNum = /^[A-Za-z0-9.]+$/.test(num.trim()) ? num.trim() : `(${num.trim()})`;
      const simpleDen = /^[A-Za-z0-9.]+$/.test(den.trim()) ? den.trim() : `(${den.trim()})`;
      return `${simpleNum}/${simpleDen}`;
    });
  }
  text = text
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]+)\}/g, "$1")
    .replace(/\\times\b/g, "×")
    .replace(/\\cdot\b/g, "·")
    .replace(/\\div\b/g, "÷")
    .replace(/\\pm\b/g, "±")
    .replace(/\\approx\b/g, "≈")
    .replace(/\\equiv\b/g, "≡")
    .replace(/\\sim\b/g, "~")
    .replace(/\\propto\b/g, "∝")
    .replace(/\\infty\b/g, "∞")
    .replace(/\\neq\b/g, "≠")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\(?:rightarrow|to)\b/g, "→")
    .replace(/\\Delta\b\s*/g, "Δ")
    .replace(/\\delta\b\s*/g, "δ")
    .replace(/\\rho\b/g, "ρ")
    .replace(/\\pi\b/g, "π")
    .replace(/\\theta\b/g, "θ")
    .replace(/\\alpha\b/g, "α")
    .replace(/\\beta\b/g, "β")
    .replace(/\\gamma\b/g, "γ")
    .replace(/\\lambda\b/g, "λ")
    .replace(/\\omega\b/g, "ω")
    .replace(/\\Omega\b/g, "Ω")
    .replace(/\\mu\b/g, "μ")
    .replace(/\\sigma\b/g, "σ")
    .replace(/\\eta\b/g, "η")
    .replace(/\\tau\b/g, "τ")
    .replace(/\\phi\b/g, "φ")
    .replace(/\\psi\b/g, "ψ")
    .replace(/\\varepsilon\b/g, "ε")
    .replace(/\^\\circ\b/g, "°")
    .replace(/\\(?:degree|circ)\b/g, "°")
    .replace(/\^\{([0-9+-]+)\}/g, (_, exp) => mapScript(exp, SUPERSCRIPTS))
    .replace(/\^(-?[0-9]+)/g, (_, exp) => mapScript(exp, SUPERSCRIPTS))
    .replace(/_\{([0-9+-]+)\}/g, (_, sub) => mapScript(sub, SUBSCRIPTS))
    .replace(/_([0-9]+)/g, (_, sub) => mapScript(sub, SUBSCRIPTS))
    .replace(/\*\*/g, "")
    .replace(/^[#*\-\s]*(Diketahui|Ditanya|Dijawab)\s*:/gim, "$1:")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

function normalizeModelOutput(rawOutput, question, optionsArg = {}) {
  const pembahasanMode = Boolean(optionsArg && optionsArg.pembahasanMode);
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
      texts.push(answerTexts[0]);
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
function extractRawDiscussion(output) {
  const candidate = output.discussion ?? output.pembahasan ?? output.solution ?? "";
  if (typeof candidate === "string") return candidate;
  if (Array.isArray(candidate)) {
    return candidate.filter((item) => typeof item === "string").join("\n");
  }
  if (candidate && typeof candidate === "object") {
    const parts = [];
    for (const [key, val] of Object.entries(candidate)) {
      if (val == null || String(val).trim() === "") continue;
      const label = key.trim();
      const text = Array.isArray(val) ? val.join("\n") : String(val).trim();
      parts.push(`${label[0].toUpperCase()}${label.slice(1)}:\n${text}`);
    }
    return parts.join("\n\n");
  }
  return "";
}

function normalizeDiscussionText(raw, question, fallbackText) {
  let cleaned = sanitizeMathText(raw);
  if (!cleaned && fallbackText) {
    const qShort = String(question?.text || "").replace(/\s+/g, " ").trim().slice(0, 220);
    cleaned = qShort
      ? `Diketahui:\n${qShort}\n\nDitanya:\nJawaban yang tepat sesuai soal.\n\nDijawab:\n${fallbackText}`
      : fallbackText;
  }
  if (!cleaned) return "";
  return cleaned
    .replace(/\r\n?/g, "\n")
    .replace(/([^\n])\s*(?=(?:Diketahui|Ditanya|Dijawab)\s*:)/gi, "$1\n\n")
    .replace(/^(Diketahui|Ditanya|Dijawab)\s*:\s*/gim, "$1:\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
}

  const confidence = Number(output.confidence);
  const explanation = typeof output.explanation === "string" ? sanitizeMathText(output.explanation).slice(0, 500) : "";
  const rawDiscussion = extractRawDiscussion(output);
  const discussion = normalizeDiscussionText(
    rawDiscussion,
    question,
    pembahasanMode ? (explanation || display) : ""
  );
  return {
    keys,
    texts,
    display,
    rows,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    explanation,
    ...(discussion ? { discussion } : {})
  };
}

module.exports = { parseModelJson, normalizeModelOutput, sanitizeMathText };
