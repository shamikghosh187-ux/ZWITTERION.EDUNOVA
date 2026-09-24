import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      method,
      identifier,
      className = "",
      board = "",
      school = ""
    } = req.body || {};

    if (!method || !identifier) {
      return res.status(400).json({
        error: "Email or mobile number is required."
      });
    }

    if (method !== "email") {
      return res.status(400).json({
        error: "SMS OTP is not enabled yet. Please use email."
      });
    }

    const email = String(identifier)
      .trim()
      .toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address."
      });
    }

    // ---------------------------------------------------------
    // ENVIRONMENT VARIABLES
    // ---------------------------------------------------------

    const resendApiKey = process.env.RESEND_API_KEY;
    const otpSecret = process.env.OTP_SECRET;
    const databaseUrl = process.env.DATABASE_URL;

    if (!resendApiKey) {
      console.error("RESEND_API_KEY is missing.");

      return res.status(500).json({
        error: "Email service is not configured."
      });
    }

    if (!otpSecret) {
      console.error("OTP_SECRET is missing.");

      return res.status(500).json({
        error: "OTP security is not configured."
      });
    }

    if (!databaseUrl) {
      console.error("DATABASE_URL is missing.");

      return res.status(500).json({
        error: "Database is not configured."
      });
    }

    const sql = neon(databaseUrl);

    // ---------------------------------------------------------
    // GENERATE OTP
    // ---------------------------------------------------------

    const otp = crypto
      .randomInt(100000, 1000000)
      .toString();

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    const challengeId = crypto
      .randomBytes(24)
      .toString("hex");

    // ---------------------------------------------------------
    // HASH OTP
    // ---------------------------------------------------------

    const otpHash = crypto
      .createHmac("sha256", otpSecret)
      .update(`${challengeId}:${email}:${otp}`)
      .digest("hex");

    // ---------------------------------------------------------
    // STORE NEWEST OTP
    // ---------------------------------------------------------
    //
    // First invalidate every previous unconsumed challenge
    // for this email.
    //
    // Then insert the new challenge.
    //
    // This is done in ONE SQL statement so the transition
    // happens atomically.
    // ---------------------------------------------------------

    await sql`
      WITH invalidated AS (
        UPDATE student_otp_challenges
        SET invalidated_at = NOW()
        WHERE LOWER(student_email) = ${email}
          AND consumed_at IS NULL
          AND invalidated_at IS NULL
      )
      INSERT INTO student_otp_challenges (
        student_email,
        challenge_id,
        otp_hash,
        expires_at
      )
      VALUES (
        ${email},
        ${challengeId},
        ${otpHash},
        ${expiresAt}
      )
    `;

    // ---------------------------------------------------------
    // SEND EMAIL
    // ---------------------------------------------------------

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          from:
            "Zwitterion Classes <noreply@zwitterionclasses.co.in>",

          to: [email],

          subject:
            "Your ZWITTERION Verification Code",

          html: `
            <div style="
              font-family: Arial, sans-serif;
              max-width: 560px;
              margin: 0 auto;
              padding: 30px;
              background: #ffffff;
              color: #111827;
            ">

              <h2 style="
                margin-bottom: 8px;
                font-size: 26px;
              ">
                ZWITTERION
              </h2>

              <p style="
                font-size: 16px;
                color: #374151;
              ">
                Your Zwitterion Classes verification code is:
              </p>

              <div style="
                font-size: 34px;
                font-weight: bold;
                letter-spacing: 8px;
                padding: 18px;
                background: #f4f4f4;
                border-radius: 12px;
                text-align: center;
                margin: 20px 0;
              ">
                ${otp}
              </div>

              <p style="
                font-size: 15px;
                color: #374151;
              ">
                This OTP will expire in
                <strong>5 minutes</strong>.
              </p>

              <p style="
                color: #777777;
                font-size: 13px;
                line-height: 1.6;
              ">
                If you did not request this verification code,
                you can safely ignore this email.
              </p>

              <hr style="
                border: none;
                border-top: 1px solid #eeeeee;
                margin: 25px 0;
              ">

              <p style="
                font-size: 13px;
                color: #777777;
              ">
                ZWITTERION • EDUNOVA • V1
              </p>

            </div>
          `
        })
      }
    );

    const resendData =
      await resendResponse.json();

    if (!resendResponse.ok) {
      console.error(
        "Resend error:",
        resendData
      );

      return res.status(500).json({
        error:
          resendData?.message ||
          resendData?.error ||
          "Could not send OTP."
      });
    }

    // ---------------------------------------------------------
    // SUCCESS
    // ---------------------------------------------------------

    return res.status(200).json({
      success: true,

      // This is now the DATABASE challenge ID,
      // not a self-contained OTP token.
      challengeId,

      message:
        `A 6-digit OTP was sent to ${maskEmail(email)}.`,

      resendAfter: 60
    });

  } catch (error) {
    console.error(
      "SEND OTP ERROR:",
      error
    );

    return res.status(500).json({
      error:
        "Something went wrong while sending the OTP."
    });
  }
}


// =============================================================
// MASK EMAIL
// =============================================================

function maskEmail(email) {
  const [name, domain] =
    email.split("@");

  if (!name || !domain) {
    return email;
  }

  if (name.length <= 2) {
    return `${name[0] || "*"}*@${domain}`;
  }

  return (
    `${name[0]}` +
    `${"*".repeat(
      Math.min(name.length - 2, 4)
    )}` +
    `${name[name.length - 1]}` +
    `@${domain}`
  );
}
