import crypto from "crypto";

function getKey() {
  const raw = process.env.PAPER_ENCRYPTION_KEY;
  if (!raw) throw new Error("PAPER_ENCRYPTION_KEY is not configured.");

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PAPER_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

export function encryptPaper(plainText: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    encryptedContent: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: tag.toString("base64"),
  };
}

export function decryptPaper(
  encryptedContent: string,
  ivBase64: string,
  authTagBase64: string
) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivBase64, "base64")
  );

  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedContent, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}