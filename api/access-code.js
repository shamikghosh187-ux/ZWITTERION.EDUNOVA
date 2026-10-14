import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

const ROTATION_AT = "2027-03-10T00:00:00+05:30";

function safeEqual(a, b) {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const databaseUrl = process.env.DATABASE_URL;
  const configuredCode = process.env.STUDENT_ACCESS_CODE;
  const accessSecret = process.env.ACCESS_SESSION_SECRET;

  if (!databaseUrl || !configuredCode || !accessSecret) {
    console.error("Access-code configuration is incomplete.");
    return res.status(503).json({ error: "Access service is not configured yet." });
  }

  try {
    const body = req.body || {};
    const action = body.action === "status" ? "status" : "unlock";
    const browserId = String(body.browserId || "");
    const enteredCode = String(body.code || "");

    if (!/^[a-f0-9-]{36}$/i.test(browserId)) {
      return res.status(400).json({ error: "A valid browser identity is required." });
    }

    const sql = neon(databaseUrl);
    await sql`
      CREATE TABLE IF NOT EXISTS student_access_grants (
        browser_id UUID PRIMARY KEY,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        grant_method TEXT NOT NULL DEFAULT 'access_code'
      )
    `;

    const existing = await sql`
      SELECT browser_id, granted_at
      FROM student_access_grants
      WHERE browser_id = ${browserId}::uuid
      LIMIT 1
    `;

    if (existing.length) {
      const token = crypto.createHmac("sha256", accessSecret)
        .update(`zwitterion-access:${browserId}:${new Date(existing[0].granted_at).toISOString()}`)
        .digest("hex");
      return res.status(200).json({
        ok: true,
        unlocked: true,
        returningStudent: true,
        token
      });
    }

    if (action === "status") {
      return res.status(200).json({ ok: true, unlocked: false });
    }

    if (!enteredCode || enteredCode.length > 200) {
      return res.status(400).json({ error: "Enter the access code provided by Sir." });
    }

    if (Date.now() >= new Date(ROTATION_AT).getTime()) {
      return res.status(403).json({
        error: "The previous access code has expired. Please ask Sir for the current code."
      });
    }

    if (!safeEqual(enteredCode, configuredCode)) {
      return res.status(401).json({ error: "That access code is incorrect. Please try again." });
    }

    const inserted = await sql`
      INSERT INTO student_access_grants (browser_id)
      VALUES (${browserId}::uuid)
      ON CONFLICT (browser_id) DO NOTHING
      RETURNING browser_id, granted_at
    `;

    const grant = inserted[0] || (await sql`
      SELECT browser_id, granted_at
      FROM student_access_grants
      WHERE browser_id = ${browserId}::uuid
      LIMIT 1
    `)[0];

    const token = crypto.createHmac("sha256", accessSecret)
      .update(`zwitterion-access:${browserId}:${new Date(grant.granted_at).toISOString()}`)
      .digest("hex");

    return res.status(200).json({
      ok: true,
      unlocked: true,
      returningStudent: false,
      token
    });
  } catch (error) {
    console.error("Access-code verification failed:", error);
    return res.status(500).json({ error: "Could not verify access right now. Please try again." });
  }
}
