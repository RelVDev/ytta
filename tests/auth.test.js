"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { authorize } = require("../lib/auth");

test("auth menerima token benar dan menolak token salah atau env kosong", () => {
  const previous = process.env.CLIENT_TOKEN;
  try {
    process.env.CLIENT_TOKEN = "known-test-token";
    assert.doesNotThrow(() => authorize({ headers: { "x-client-token": "known-test-token" } }));
    assert.throws(() => authorize({ headers: { "x-client-token": "wrong-token" } }), { code: "UNAUTHORIZED", status: 401 });
    delete process.env.CLIENT_TOKEN;
    assert.throws(() => authorize({ headers: {} }), { code: "UNAUTHORIZED", status: 401 });
  } finally {
    if (previous === undefined) delete process.env.CLIENT_TOKEN;
    else process.env.CLIENT_TOKEN = previous;
  }
});
