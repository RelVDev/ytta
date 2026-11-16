"use strict";

(function initDbMatch(global) {
  const STOP_WORDS = new Set([
    "yang", "dan", "di", "ke", "dari", "pada", "adalah", "merupakan", "sebuah",
    "suatu", "jika", "maka", "dengan", "untuk", "dalam", "berikut", "ini", "itu",
    "besar", "nilai", "tentukan", "hitunglah", "berapa", "berapakah", "apa", "apakah"
  ]);

  function stripThousandDots(text) {
    return String(text || "").replace(/\b(\d{1,3}(?:\.\d{3})+)(?!\.\d)\b/g, (match) => match.replace(/\./g, ""));
  }

  function normalizeText(value) {
    return stripThousandDots(
      String(value || "")
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\uFFFD/g, " ")
        .replace(/(\d),(\d)/g, "$1.$2")
    )
      .replace(/²/g, "2")
      .replace(/³/g, "3")
      .replace(/⁻¹/g, "-1")
      .replace(/⁻²/g, "-2")
      .replace(/⁻³/g, "-3")
      .replace(/[×·]/g, "x")
      .replace(/[…]+/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9.+-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripOptionPrefix(value) {
    return String(value || "").replace(/^\s*[a-z]\s*[.)]\s+/i, "").trim();
  }

  function extractNumbers(text) {
    const normalized = stripThousandDots(
      String(text || "")
        .normalize("NFKC")
        .replace(/(\d),(\d)/g, "$1.$2")
    );
    const matches = normalized.match(/\d+(?:\.\d+)?/g) || [];
    return matches.map((token) => String(Number(token))).sort();
  }

  function numbersCompatible(queryNums, entryNums) {
    if (!queryNums.length && !entryNums.length) return true;
    if (queryNums.length !== entryNums.length) return false;
    for (let i = 0; i < queryNums.length; i += 1) {
      if (queryNums[i] !== entryNums[i]) return false;
    }
    return true;
  }

  function tokenize(normalizedText) {
    return normalizedText.split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  }

  function jaccardSimilarity(tokensA, tokensB) {
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection += 1;
    }
    const union = setA.size + setB.size - intersection;
    return union ? intersection / union : 0;
  }

  function diceBigrams(strA, strB) {
    if (!strA || !strB) return 0;
    if (strA === strB) return 1;
    if (strA.length < 2 || strB.length < 2) return 0;
    const bigramsA = new Map();
    for (let i = 0; i < strA.length - 1; i += 1) {
      const bg = strA.slice(i, i + 2);
      bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
    }
    let overlap = 0;
    for (let i = 0; i < strB.length - 1; i += 1) {
      const bg = strB.slice(i, i + 2);
      const count = bigramsA.get(bg) || 0;
      if (count > 0) {
        overlap += 1;
        bigramsA.set(bg, count - 1);
      }
    }
    return (2 * overlap) / ((strA.length - 1) + (strB.length - 1));
  }

  function findBestOptionMatch(dbAnswerText, options) {
    if (!Array.isArray(options) || !options.length) return null;
    const target = normalizeText(stripOptionPrefix(dbAnswerText));
    if (!target) return null;

    let best = null;
    let bestScore = 0;
    for (const option of options) {
      const optNorm = normalizeText(stripOptionPrefix(option.text));
      if (!optNorm) continue;
      if (optNorm === target) return { option, score: 1 };
      const score = Math.max(
        diceBigrams(target, optNorm),
        jaccardSimilarity(target.split(" "), optNorm.split(" "))
      );
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    if (best && bestScore >= 0.78) {
      const targetNums = extractNumbers(dbAnswerText);
      const bestNums = extractNumbers(stripOptionPrefix(best.text));
      if (numbersCompatible(targetNums, bestNums)) return { option: best, score: bestScore };
    }
    return null;
  }

  function matchQuestionInDb(db, question) {
    if (!db || !Array.isArray(db.entries) || !question || !question.text) return null;
    const queryNorm = normalizeText(question.text);
    if (!queryNorm) return null;
    const queryNums = extractNumbers(question.text);
    const queryTokens = tokenize(queryNorm);

    let bestEntry = null;
    let bestScore = 0;
    let bestMatchedOpt = null;

    for (const entry of db.entries) {
      const entryNorm = normalizeText(entry.q);
      if (!entryNorm) continue;

      if (entryNorm === queryNorm) {
        const optMatch = findBestOptionMatch(entry.t, question.options);
        if (!question.options?.length || optMatch) {
          return {
            matched: true,
            similarity: 1,
            dbName: db.name || "Fisika Dasar",
            questionText: entry.q,
            answerKey: optMatch ? optMatch.option.key : entry.a,
            answerText: optMatch ? optMatch.option.text : entry.t,
            cleanAnswerText: stripOptionPrefix(optMatch ? optMatch.option.text : entry.t),
            display: optMatch ? `${optMatch.option.key}. ${optMatch.option.text}` : entry.t,
            mappedToLiveOption: Boolean(optMatch)
          };
        }
      }

      const entryNums = extractNumbers(entry.q);
      if (!numbersCompatible(queryNums, entryNums)) continue;

      const tokenScore = jaccardSimilarity(queryTokens, tokenize(entryNorm));
      if (tokenScore < 0.45) continue;
      const charScore = diceBigrams(queryNorm, entryNorm);
      const combined = (tokenScore * 0.55) + (charScore * 0.45);
      if (combined < 0.76) continue;

      const optMatch = findBestOptionMatch(entry.t, question.options);
      if (question.options?.length && !optMatch && combined < 0.9) continue;

      const boosted = optMatch ? combined + 0.05 : combined;
      if (boosted > bestScore) {
        bestScore = boosted;
        bestEntry = entry;
        bestMatchedOpt = optMatch;
      }
    }

    if (!bestEntry) return null;
    return {
      matched: true,
      similarity: Math.min(1, Number(bestScore.toFixed(2))),
      dbName: db.name || "Fisika Dasar",
      questionText: bestEntry.q,
      answerKey: bestMatchedOpt ? bestMatchedOpt.option.key : bestEntry.a,
      answerText: bestMatchedOpt ? bestMatchedOpt.option.text : bestEntry.t,
      cleanAnswerText: stripOptionPrefix(bestMatchedOpt ? bestMatchedOpt.option.text : bestEntry.t),
      display: bestMatchedOpt ? `${bestMatchedOpt.option.key}. ${bestMatchedOpt.option.text}` : bestEntry.t,
      mappedToLiveOption: Boolean(bestMatchedOpt)
    };
  }

  function compareDbAndAi(dbMatch, aiAnswer, question) {
    if (!dbMatch || !dbMatch.matched) {
      return {
        status: "not_found",
        dbDisplay: "",
        aiDisplay: aiAnswer?.display || ""
      };
    }

    let same = false;
    const aiKeys = Array.isArray(aiAnswer?.keys) ? aiAnswer.keys : [];
    const aiTexts = Array.isArray(aiAnswer?.texts) ? aiAnswer.texts : [];

    if (dbMatch.mappedToLiveOption && aiKeys.length) {
      same = aiKeys.some((key) => key.toUpperCase() === dbMatch.answerKey.toUpperCase());
    } else if (aiTexts.length) {
      const dbClean = normalizeText(dbMatch.cleanAnswerText || dbMatch.answerText);
      const aiClean = normalizeText(stripOptionPrefix(aiTexts[0]));
      same = Boolean(dbClean && aiClean && (dbClean === aiClean || diceBigrams(dbClean, aiClean) >= 0.88));
    }

    // If DB couldn't map directly to live option (e.g. text differs slightly), check if AI's picked option text matches DB text
    if (!same && aiTexts.length && !question?.options?.length) {
      const dbClean = normalizeText(dbMatch.cleanAnswerText || dbMatch.answerText);
      const aiClean = normalizeText(aiTexts[0]);
      same = dbClean === aiClean;
    }

    return {
      status: same ? "match" : "mismatch",
      similarity: dbMatch.similarity,
      dbName: dbMatch.dbName,
      dbDisplay: dbMatch.display,
      dbKey: dbMatch.answerKey,
      dbText: dbMatch.cleanAnswerText || dbMatch.answerText,
      aiDisplay: aiAnswer?.display || ""
    };
  }

  const exported = {
    normalizeText,
    stripOptionPrefix,
    matchQuestionInDb,
    compareDbAndAi
  };
  global.FormHelperDbMatch = exported;
  if (typeof module !== "undefined" && module.exports) module.exports = exported;
})(globalThis);
