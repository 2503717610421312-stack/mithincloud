import crypto from "crypto";

export function createWatermarkId() {
  const random = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `WP-${Date.now().toString(36).toUpperCase()}-${random}`;
}