import crypto from "node:crypto";

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue).trim().toLowerCase(), "utf8");
  const right = Buffer.from(String(rightValue).trim().toLowerCase(), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const allowedEmail = process.env.ADMIN_ALLOWED_EMAIL;
  if (!allowedEmail || !allowedEmail.includes("@")) {
    console.error("Admin email allowlist is not configured.");
    return res.status(503).json({ error: "Admin email check is not configured yet." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  // This endpoint is a UI convenience check only. It issues no session/token
  // and MUST NOT be used to authorize content, uploads, publishing, or deletion.
  return res.status(200).json({ allowed: safeEqual(email, allowedEmail) });
}
