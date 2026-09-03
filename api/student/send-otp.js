import crypto from "crypto";

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

    const email = String(identifier).trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address."
      });
    }

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

    // Generate a secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // OTP expires after 5 minutes
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Random challenge ID
    const challengeId = crypto.randomBytes(24).toString("hex");

    // Hash OTP so the plain OTP is never stored in the challenge
    const otpHash = crypto
      .createHmac("sha256", otpSecret)
      .update(`${challengeId}:${email}:${otp}`)
      .digest("hex");

    /*
      Store the challenge in an encrypted/signed token.

      Since Vercel serverless functions are stateless,
      we cannot depend on a normal in-memory variable.
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

    const payloadString = JSON.stringify(payload);

    const signature = crypto
      .createHmac("sha256", otpSecret)
      .update(payloadString)
      .digest("hex");

    const challengeToken = Buffer.from(
      JSON.stringify({
        payload,
        signature
      })
    ).toString("base64url");

    // Send email through Resend
    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "ZWITTERION <onboarding@resend.dev>",
          to: [email],
          subject: "Your ZWITTERION OTP",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;">
              <h2 style="margin-bottom:8px;">ZWITTERION</h2>
              <p>Your login OTP is:</p>

              <div style="
                font-size:34px;
                font-weight:bold;
                letter-spacing:8px;
                padding:18px;
                background:#f4f4f4;
                border-radius:12px;
                text-align:center;
                margin:20px 0;
              ">
                ${otp}
              </div>

              <p>This OTP will expire in <strong>5 minutes</strong>.</p>
              <p style="color:#777;font-size:13px;">
                If you did not request this OTP, you can safely ignore this email.
              </p>

              <hr style="border:none;border-top:1px solid #eee;margin:25px 0;">

              <p style="font-size:13px;color:#777;">
                ZWITTERION • EDUNOVA • V1
              </p>
            </div>
          `
        })
      }
    );

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);

      return res.status(500).json({
        error:
          resendData?.message ||
          resendData?.error ||
          "Could not send OTP."
      });
    }

    return res.status(200).json({
      success: true,
      challengeId: challengeToken,
      message: `A 6-digit OTP was sent to ${maskEmail(email)}.`,
      resendAfter: 60
    });

  } catch (error) {
    console.error("SEND OTP ERROR:", error);

    return res.status(500).json({
      error: "Something went wrong while sending the OTP."
    });
  }
}

function maskEmail(email) {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return email;
  }

  if (name.length <= 2) {
    return `${name[0] || "*"}*@${domain}`;
  }

  return `${name[0]}${"*".repeat(
    Math.min(name.length - 2, 4)
  )}${name[name.length - 1]}@${domain}`;
}
