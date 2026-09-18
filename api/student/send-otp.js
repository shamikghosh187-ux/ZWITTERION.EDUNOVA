import crypto from "crypto";

export default async function handler(req, res) {
  // Only allow POST requests
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

    // Check required fields
    if (!method || !identifier) {
      return res.status(400).json({
        error: "Email or mobile number is required."
      });
    }

    // SMS is not enabled yet
    if (method !== "email") {
      return res.status(400).json({
        error: "SMS OTP is not enabled yet. Please use email."
      });
    }

    // Normalize email
    const email = String(identifier)
      .trim()
      .toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address."
      });
    }

    // =========================================================
    // ENVIRONMENT VARIABLES
    // =========================================================

    const resendApiKey = process.env.RESEND_API_KEY;
    const otpSecret = process.env.OTP_SECRET;

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

    // =========================================================
    // GENERATE SECURE OTP
    // =========================================================

    // Generate a secure 6-digit OTP
    const otp = crypto
      .randomInt(100000, 1000000)
      .toString();

    // OTP expires after 5 minutes
    const expiresAt =
      Date.now() + 5 * 60 * 1000;

    // Random challenge ID
    const challengeId =
      crypto.randomBytes(24).toString("hex");

    // =========================================================
    // HASH OTP
    // =========================================================

    // The plain OTP is never stored in the challenge
    const otpHash = crypto
      .createHmac("sha256", otpSecret)
      .update(
        `${challengeId}:${email}:${otp}`
      )
      .digest("hex");

    // =========================================================
    // CREATE CHALLENGE PAYLOAD
    // =========================================================

    /*
      Vercel serverless functions are stateless,
      so we don't depend on normal in-memory storage.
    */

    const payload = {
      challengeId,
      email,
      otpHash,
      expiresAt,
      className,
      board,
      school
    };

    const payloadString =
      JSON.stringify(payload);

    // =========================================================
    // SIGN CHALLENGE
    // =========================================================

    const signature = crypto
      .createHmac("sha256", otpSecret)
      .update(payloadString)
      .digest("hex");

    // =========================================================
    // CREATE CHALLENGE TOKEN
    // =========================================================

    const challengeToken = Buffer
      .from(
        JSON.stringify({
          payload,
          signature
        })
      )
      .toString("base64url");

    // =========================================================
    // SEND OTP THROUGH RESEND
    // =========================================================

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${resendApiKey}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          // VERIFIED ZWITTERION DOMAIN
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

    // =========================================================
    // READ RESEND RESPONSE
    // =========================================================

    const resendData =
      await resendResponse.json();

    // =========================================================
    // HANDLE RESEND ERROR
    // =========================================================

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

    // =========================================================
    // SUCCESS
    // =========================================================

    return res.status(200).json({
      success: true,

      challengeId:
        challengeToken,

      message:
        `A 6-digit OTP was sent to ${maskEmail(email)}.`,

      resendAfter: 60
    });

  } catch (error) {
    // =========================================================
    // UNEXPECTED ERROR
    // =========================================================

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

// =========================================================
// MASK EMAIL
// =========================================================

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
