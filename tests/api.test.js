"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const answerHandler = require("../api/answer");

function fakeResponse() {
  return {
    headers: {},
    statusCode: 200,
    writableEnded: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; this.writableEnded = true; return this; },
    end() { this.writableEnded = true; return this; },
    on(event, callback) { this.closeHandler = event === "close" ? callback : this.closeHandler; }
  };
}

function request() {
  return {
    method: "POST",
    headers: { "x-client-token": "test-client-token", "content-length": "250" },
    body: {
      lang: "id",
      models: { harbor: "qwen3.8-flash:free", gemini: "gemini-3.8-flash" },
      question: {
        type: "multiple_choice", text: "Asam asetat?", required: true,
        options: [{ key: "A", text: "HCl" }, { key: "D", text: "CH3COOH" }],
        images: []
      }
    }
  };
}

function providerResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

test("Harbor 5xx beralih ke Gemini dan mengembalikan jawaban normal", async () => {
  const previous = { fetch: global.fetch, token: process.env.CLIENT_TOKEN, harbor: process.env.TOKENHARBOR_API_KEY, gemini: process.env.GEMINI_API_KEY };
  const calls = [];
  const log = console.info;
  process.env.CLIENT_TOKEN = "test-client-token";
  process.env.TOKENHARBOR_API_KEY = "test-harbor-key";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  console.info = () => {};
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("tokenharbor.ai")) return providerResponse(503, { error: "unavailable" });
    return providerResponse(200, {
      steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ keys: ["D"], texts: ["CH3COOH"], rows: [], confidence: 0.94, explanation: "Asam asetat." }) }] }]
    });
  };
  try {
    const res = fakeResponse();
    await answerHandler(request(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.provider, "gemini");
    assert.equal(res.body.answer.display, "D. CH3COOH");
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = previous.fetch;
    console.info = log;
    if (previous.token === undefined) delete process.env.CLIENT_TOKEN; else process.env.CLIENT_TOKEN = previous.token;
    if (previous.harbor === undefined) delete process.env.TOKENHARBOR_API_KEY; else process.env.TOKENHARBOR_API_KEY = previous.harbor;
    if (previous.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.gemini;
  }
});

test("Harbor error autentikasi tidak memicu fallback Gemini", async () => {
  const previous = { fetch: global.fetch, token: process.env.CLIENT_TOKEN, harbor: process.env.TOKENHARBOR_API_KEY, gemini: process.env.GEMINI_API_KEY };
  const calls = [];
  const log = console.info;
  process.env.CLIENT_TOKEN = "test-client-token";
  process.env.TOKENHARBOR_API_KEY = "test-harbor-key";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  console.info = () => {};
  global.fetch = async (url) => { calls.push(String(url)); return providerResponse(401, { error: "unauthorized" }); };
  try {
    const res = fakeResponse();
    await answerHandler(request(), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error.code, "MODEL_ERROR");
    assert.equal(calls.length, 1);
  } finally {
    global.fetch = previous.fetch;
    console.info = log;
    if (previous.token === undefined) delete process.env.CLIENT_TOKEN; else process.env.CLIENT_TOKEN = previous.token;
    if (previous.harbor === undefined) delete process.env.TOKENHARBOR_API_KEY; else process.env.TOKENHARBOR_API_KEY = previous.harbor;
    if (previous.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.gemini;
  }
});

test("model Harbor yang tidak tersedia beralih ke Gemini", async () => {
  const previous = { fetch: global.fetch, token: process.env.CLIENT_TOKEN, harbor: process.env.TOKENHARBOR_API_KEY, gemini: process.env.GEMINI_API_KEY };
  const calls = [];
  const log = console.info;
  process.env.CLIENT_TOKEN = "test-client-token";
  process.env.TOKENHARBOR_API_KEY = "test-harbor-key";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  console.info = () => {};
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("tokenharbor.ai")) return providerResponse(404, { error: { message: "model was not found" } });
    return providerResponse(200, {
      steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ keys: ["D"], texts: ["CH3COOH"], rows: [], confidence: 0.94, explanation: "Asam asetat." }) }] }]
    });
  };
  try {
    const req = request();
    req.body.models.harbor = "glm-5.3-flashx";
    const res = fakeResponse();
    await answerHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.provider, "gemini");
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = previous.fetch;
    console.info = log;
    if (previous.token === undefined) delete process.env.CLIENT_TOKEN; else process.env.CLIENT_TOKEN = previous.token;
    if (previous.harbor === undefined) delete process.env.TOKENHARBOR_API_KEY; else process.env.TOKENHARBOR_API_KEY = previous.harbor;
    if (previous.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.gemini;
  }
});

test("route MiMo teks saja melewati gambar dan menandai respons", async () => {
  const previous = { fetch: global.fetch, token: process.env.CLIENT_TOKEN, harbor: process.env.TOKENHARBOR_API_KEY, gemini: process.env.GEMINI_API_KEY };
  const log = console.info;
  process.env.CLIENT_TOKEN = "test-client-token";
  process.env.TOKENHARBOR_API_KEY = "test-harbor-key";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  console.info = () => {};
  let harborBody;
  global.fetch = async (_url, options) => {
    harborBody = JSON.parse(options.body);
    return providerResponse(200, {
      choices: [{ message: { content: JSON.stringify({ keys: ["D"], texts: ["CH3COOH"], rows: [], confidence: 0.8, explanation: "Dari teks soal." }) } }]
    });
  };
  try {
    const req = request();
    req.body.models.harbor = "mimo-v2.6-flash:free";
    req.body.question.images = [{ mimeType: "image/png", base64: "iVBORw0KGgo=" }];
    const res = fakeResponse();
    await answerHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.warning, "IMAGE_UNAVAILABLE");
    assert.equal(harborBody.messages[1].content.filter((part) => part.type === "image_url").length, 0);
    assert.match(harborBody.messages[1].content[0].text, /model ini tidak menerima gambar/);
  } finally {
    global.fetch = previous.fetch;
    console.info = log;
    if (previous.token === undefined) delete process.env.CLIENT_TOKEN; else process.env.CLIENT_TOKEN = previous.token;
    if (previous.harbor === undefined) delete process.env.TOKENHARBOR_API_KEY; else process.env.TOKENHARBOR_API_KEY = previous.harbor;
    if (previous.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.gemini;
  }
});

test("jawaban essay melewati API secara utuh dan memakai batas output lebih besar", async () => {
  const previous = { fetch: global.fetch, token: process.env.CLIENT_TOKEN, harbor: process.env.TOKENHARBOR_API_KEY, gemini: process.env.GEMINI_API_KEY };
  const log = console.info;
  const essay = "Paragraf pertama menjelaskan konsep utama. Kalimat berikutnya menguraikan alasan dan konteksnya.\n\nParagraf kedua menjabarkan dampak terhadap masyarakat. Kalimat penutup merangkum hubungan sebab dan akibat.";
  process.env.CLIENT_TOKEN = "test-client-token";
  process.env.TOKENHARBOR_API_KEY = "test-harbor-key";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  console.info = () => {};
  global.fetch = async (_url, options) => {
    const providerBody = JSON.parse(options.body);
    assert.equal(providerBody.max_tokens, 1400);
    assert.match(providerBody.messages[1].content[0].text, /Mode jawaban: esai/);
    return providerResponse(200, {
      choices: [{ message: { content: JSON.stringify({ keys: [], texts: [essay], rows: [], confidence: 0.86, explanation: "Penjelasan sesuai soal." }) } }]
    });
  };
  try {
    const req = request();
    req.body.question.type = "paragraph";
    req.body.question.text = "Jelaskan konsep dan dampaknya.";
    req.body.question.options = [];
    const res = fakeResponse();
    await answerHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.answer.display, essay);
  } finally {
    global.fetch = previous.fetch;
    console.info = log;
    if (previous.token === undefined) delete process.env.CLIENT_TOKEN; else process.env.CLIENT_TOKEN = previous.token;
    if (previous.harbor === undefined) delete process.env.TOKENHARBOR_API_KEY; else process.env.TOKENHARBOR_API_KEY = previous.harbor;
    if (previous.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.gemini;
  }
});
