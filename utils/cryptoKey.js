// utils/cryptoKey.js
import crypto from "crypto";

const ALGO = "aes-256-gcm"; // ключ 32 байта
const IV_LEN = 12;          // для GCM обычно 12 байт
const KEY_LEN = 32;

function getKey() {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("KEY_ENCRYPTION_SECRET is not set");

  // salt можно зафиксировать (важно: одинаковый всегда), например из env или константа
  const salt = process.env.KEY_ENCRYPTION_SALT || "clair-salt-v1";
  return crypto.scryptSync(secret, salt, KEY_LEN); // <- всегда 32 байта
}

export function encryptSecret(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);

  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc1 = cipher.update(String(plain), "utf8");
  const enc2 = cipher.final();

  const tag = cipher.getAuthTag();

  // хранить удобно как base64: iv.tag.ciphertext
  const packed = Buffer.concat([iv, tag, enc1, enc2]).toString("base64");
  return packed;
}

export function decryptSecret(packed) {
  const key = getKey();
  const buf = Buffer.from(packed, "base64");

  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const dec1 = decipher.update(data);
  const dec2 = decipher.final();
  return Buffer.concat([dec1, dec2]).toString("utf8");
}
