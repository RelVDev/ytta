"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../extension/db/fisika.json");
const { matchQuestionInDb, compareDbAndAi } = require("../extension/lib/db-match");

test("database fisika.json berisi ribuan soal terstruktur yang valid", () => {
  assert.equal(db.id, "fisika");
  assert.ok(db.entries.length >= 1700);
  const first = db.entries[0];
  assert.ok(first.q && first.a && first.t && first.o);
});

test("matchQuestionInDb mencocokkan soal dengan opsi acak Moodle dan menolak angka berbeda", () => {
  const sample = db.entries[0];
  const liveQuestion = {
    type: "multiple_choice",
    text: sample.q,
    options: [
      { key: "A", text: `a. ${sample.o.E}` },
      { key: "B", text: `b. ${sample.o.A}` },
      { key: "C", text: `c. ${sample.t}` },
      { key: "D", text: `d. ${sample.o.C}` }
    ]
  };
  const match = matchQuestionInDb(db, liveQuestion);
  assert.ok(match);
  assert.equal(match.matched, true);
  assert.equal(match.answerKey, "C");

  const same = compareDbAndAi(match, {
    keys: ["C"],
    texts: [`c. ${sample.t}`],
    display: `C. c. ${sample.t}`
  }, liveQuestion);
  assert.equal(same.status, "match");

  const diff = compareDbAndAi(match, {
    keys: ["A"],
    texts: [`a. ${sample.o.E}`],
    display: `A. a. ${sample.o.E}`
  }, liveQuestion);
  assert.equal(diff.status, "mismatch");
  assert.equal(diff.dbKey, "C");

  const differentNumbers = {
    ...liveQuestion,
    text: sample.q.replace(/\d+/, "98765")
  };
  assert.equal(matchQuestionInDb(db, differentNumbers), null);
});

test("compareDbAndAi menandai not_found bila soal tidak ada di DB", () => {
  const notFound = compareDbAndAi(null, { keys: ["A"], texts: ["Jawaban X"], display: "A. Jawaban X" }, { options: [] });
  assert.equal(notFound.status, "not_found");
});
