#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "db-soal-fisika", "Soal [.txt]");
const OUT_FILE = path.join(ROOT, "extension", "db", "fisika.json");

function cleanText(value) {
  return String(value || "")
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeyText(value) {
  return cleanText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseDbText(raw) {
  const text = String(raw || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = text.split("\n");

  const kunciIdx = lines.findIndex((line) => /^\s*KUNCI\s+JAWABAN\b/i.test(line));
  const kunciMap = new Map();
  let bodyLines = lines;
  if (kunciIdx !== -1) {
    bodyLines = lines.slice(0, kunciIdx);
    for (const line of lines.slice(kunciIdx + 1)) {
      const match = line.match(/^\s*(\d+)\s*[.)\-:]\s*([A-Ea-e])\b/);
      if (match) kunciMap.set(match[1], match[2].toUpperCase());
    }
  }

  const questions = [];
  let current = null;
  let currentOpt = null;

  function flush() {
    if (!current) return;
    if (!current.answerKey && current.num && kunciMap.has(current.num)) {
      current.answerKey = kunciMap.get(current.num);
    }
    const q = cleanText(current.question);
    const ansKey = current.answerKey;
    const ansText = cleanText(current.options[ansKey] || "");
    if (q && Object.keys(current.options).length >= 2 && ansKey && ansText) {
      const cleanedOptions = {};
      for (const [k, v] of Object.entries(current.options)) {
        cleanedOptions[k] = cleanText(v);
      }
      questions.push({
        q,
        o: cleanedOptions,
        a: ansKey,
        t: ansText
      });
    }
    current = null;
    currentOpt = null;
  }

  for (const rawLine of bodyLines) {
    const line = rawLine.trim().replace(/^[\*\-•]\s+/, "");
    if (!line) continue;

    const ansMatch = line.match(/^(?:ANSWER|Jawaban|Jawab|Kunci(?:\s+Jawaban)?)\s*[:=]\s*([A-Ea-e])(?:\s*[.)]\s*(.*))?$/i);
    if (ansMatch && current) {
      current.answerKey = ansMatch[1].toUpperCase();
      currentOpt = null;
      continue;
    }

    const optMatch = line.match(/^([A-Ea-e])\s*[.)]\s*(.+)$/);
    if (optMatch && current) {
      const key = optMatch[1].toUpperCase();
      current.options[key] = optMatch[2].trim();
      currentOpt = key;
      continue;
    }

    const numMatch = line.match(/^(\d{1,3})\s*[.)]\s*(.+)$/);
    if (numMatch) {
      const numVal = Number(numMatch[1]);
      if (current && current.hasNumberedOpts && numVal === Object.keys(current.options).length + 1 && numVal <= 5) {
        const key = String.fromCharCode(64 + numVal);
        current.options[key] = numMatch[2].trim();
        currentOpt = key;
        continue;
      }
      if (current && !current.answerKey && Object.keys(current.options).length === 0 && numVal === 1) {
        current.hasNumberedOpts = true;
        current.options.A = numMatch[2].trim();
        currentOpt = "A";
        continue;
      }
      const isParenSub = current && Object.keys(current.options).length === 0 && /^[1-5]\)\s/.test(line);
      if (!isParenSub) {
        flush();
        current = { num: numMatch[1], question: numMatch[2], options: {}, answerKey: "", hasNumberedOpts: false };
        currentOpt = null;
        continue;
      }
    }

    if (current) {
      if (currentOpt) current.options[currentOpt] += " " + line;
      else current.question += " " + line;
    }
  }
  flush();
  return questions;
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(SOURCE_DIR).filter((name) => name.toLowerCase().endsWith(".txt")).sort();
  const dedup = new Map();
  let totalParsed = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(SOURCE_DIR, file), "utf8");
    const parsed = parseDbText(raw);
    totalParsed += parsed.length;
    for (const item of parsed) {
      const key = normalizeKeyText(item.q);
      if (!key || dedup.has(key)) continue;
      dedup.set(key, item);
    }
  }

  const entries = [...dedup.values()];
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({
    id: "fisika",
    name: "Fisika Dasar",
    count: entries.length,
    entries
  }));
  console.log(`Built ${OUT_FILE}: ${entries.length} unique questions (from ${totalParsed} parsed across ${files.length} files).`);
}

if (require.main === module) main();
module.exports = { parseDbText };
