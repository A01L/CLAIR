import { pool } from "../db.js";
import { decryptSecret, encryptSecret } from "../utils/cryptoKey.js";

export async function getUserGeminiKeyOrThrow(userId) {
  const r = await pool.query(
    `
    SELECT gemini_api_key_enc
    FROM clair_users
    WHERE id = $1
    `,
    [Number(userId)]
  );

  if (r.rowCount === 0) {
    throw new Error("User not found");
  }

  const enc = r.rows[0]?.gemini_api_key_enc;
  if (!enc) {
    throw new Error("Gemini API key not set");
  }

  const key = decryptSecret(enc);
  const cleanKey = typeof key === "string" ? key.trim() : "";

  if (!cleanKey) {
    throw new Error("Gemini key is empty after decrypt");
  }

  return cleanKey;
}

export async function updateUserGeminiKey(userId, plainKey) {
  const cleanKey = typeof plainKey === "string" ? plainKey.trim() : "";

  if (cleanKey.length < 20) {
    throw new Error("Invalid Gemini key");
  }

  const enc = encryptSecret(cleanKey);
  const last4 = cleanKey.slice(-4);

  const r = await pool.query(
    `
    UPDATE clair_users
    SET gemini_api_key_enc = $1,
        gemini_api_key_last4 = $2
    WHERE id = $3
    RETURNING id, gemini_api_key_last4
    `,
    [enc, last4, Number(userId)]
  );

  if (r.rowCount === 0) {
    throw new Error("User not found");
  }

  return r.rows[0];
}

export async function deleteUserGeminiKey(userId) {
  const r = await pool.query(
    `
    UPDATE clair_users
    SET gemini_api_key_enc = NULL,
        gemini_api_key_last4 = NULL
    WHERE id = $1
    RETURNING id
    `,
    [Number(userId)]
  );

  if (r.rowCount === 0) {
    throw new Error("User not found");
  }

  return r.rows[0];
}