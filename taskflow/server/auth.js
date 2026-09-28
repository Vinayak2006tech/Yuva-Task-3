// Password hashing (scrypt + random salt) and signed, expiring tokens (HMAC-SHA256).
const crypto = require("crypto");
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const sig = (body) => crypto.createHmac("sha256", SECRET).update(body).digest("base64url");

exports.hash = (pw) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(pw, salt, 32).toString("hex");
};
exports.verify = (pw, stored) => {
  const [salt, h] = stored.split(":");
  return crypto.timingSafeEqual(crypto.scryptSync(pw, salt, 32), Buffer.from(h, "hex"));
};
exports.sign = (payload) => {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 8 * 36e5 })).toString("base64url");
  return body + "." + sig(body);
};
exports.check = (token) => {
  if (!token) return null;
  const [body, s] = token.split(".");
  const expected = sig(body || "");
  if (!s || s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url"));
  return payload.exp > Date.now() ? payload : null;
};
