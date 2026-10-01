"use strict";

class AppError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

const MESSAGES = {
  BAD_REQUEST: "Data soal tidak valid.",
  UNAUTHORIZED: "Token klien tidak valid.",
  PAYLOAD_TOO_LARGE: "Data soal terlalu besar.",
  UNSUPPORTED_TYPE: "Tipe soal ini belum didukung.",
  RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi sebentar.",
  MODEL_ERROR: "Model AI tidak memberikan jawaban yang valid. Coba lagi atau pilih model lain.",
  TIMEOUT: "Permintaan AI melewati batas waktu.",
  INTERNAL: "Terjadi kesalahan pada server."
};

function errorResponse(error) {
  const known = error instanceof AppError ? error : new AppError("INTERNAL", MESSAGES.INTERNAL, 500);
  return {
    status: known.status,
    body: { ok: false, error: { code: known.code, message: known.message || MESSAGES[known.code] } }
  };
}

module.exports = { AppError, MESSAGES, errorResponse };
