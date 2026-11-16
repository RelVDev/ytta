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
      models: { harbor: "deepseek-v4.1-flash-1017", gemini: "gemini-3.8-flash" },
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
    req.body.models.harbor = "glm-5.3-flash";
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

test("gambar dikirim langsung ke model Harbor baru tanpa dipotong", async () => {
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
      choices: [{ message: { content: JSON.stringify({ keys: ["D"], texts: ["CH3COOH"], rows: [], confidence: 0.9, explanation: "Dari gambar soal.", discussion: "" }) } }]
    });
  };
  try {
    const req = request();
    req.body.models.harbor = "muse-ember";
    req.body.question.images = [{ mimeType: "image/png", base64: "iVBORw0KGgo=" }];
    const res = fakeResponse();
    await answerHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.warning, undefined);
    assert.equal(harborBody.messages[1].content.filter((part) => part.type === "image_url").length, 1);
  } finally {
    global.fetch = previous.fetch;
    console.info = log;
    if (previous.token === undefined) delete process.env.CLIENT_TOKEN; else process.env.CLIENT_TOKEN = previous.token;
    if (previous.harbor === undefined) delete process.env.TOKENHARBOR_API_KEY; else process.env.TOKENHARBOR_API_KEY = previous.harbor;
    if (previous.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.gemini;
  }
});

test("mode pembahasan mengirim instruksi Diketahui/Ditanya/Dijawab dan mengembalikan discussion rapi", async () => {
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
      choices: [{
        message: {
          content: JSON.stringify({
            keys: ["D"],
            texts: ["CH3COOH"],
            rows: [],
            confidence: 0.95,
            explanation: "Asam asetat.",
            discussion: "Diketahui:\n$\\rho = 1000\\text{ kg/m}^3$, $h = 5\\text{ m}$\n\nDitanya:\n$P_h$?\n\nDijawab:\n$P_h = \\rho \\cdot g \\cdot h = \\frac{1000 \\times 10 \\times 5}{1} = 50000\\text{ Pa}$"
          })
        }
      }]
    });
  };
  try {
    const req = request();
    req.body.pembahasanMode = true;
    const res = fakeResponse();
    await answerHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(harborBody.max_tokens >= 1400);
    assert.match(harborBody.messages[1].content[0].text, /Diketahui:/);
    assert.match(res.body.discussion, /ρ = 1000 kg\/m³/);
    assert.match(res.body.discussion, /ρ · g · h/);
    assert.doesNotMatch(res.body.discussion, /\$|\\frac|\\cdot/);
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
    assert.ok(providerBody.max_tokens >= 1400);
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
