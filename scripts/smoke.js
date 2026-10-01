"use strict";

const baseUrl = (process.env.API_BASE || "").replace(/\/+$/, "");
const token = process.env.CLIENT_TOKEN || "";
if (!baseUrl || !token) {
  console.error("Set API_BASE dan CLIENT_TOKEN sebelum menjalankan smoke test.");
  process.exitCode = 2;
} else {
  const started = Date.now();
  fetch(`${baseUrl}/api/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client-Token": token },
    body: JSON.stringify({
      lang: "id",
      question: {
        type: "multiple_choice",
        text: "Senyawa yang merupakan asam asetat adalah ...",
        required: true,
        options: [
          { key: "A", text: "HCl" }, { key: "B", text: "H2SO4" },
          { key: "C", text: "NaOH" }, { key: "D", text: "CH3COOH" }
        ],
        images: []
      }
    })
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error((result.error && result.error.message) || `HTTP ${response.status}`);
    console.log(JSON.stringify({ display: result.answer.display, provider: result.provider, model: result.model, latencyMs: result.latencyMs || Date.now() - started }));
  }).catch((error) => {
    console.error(`Smoke test gagal: ${error.message}`);
    process.exitCode = 1;
  });
}
