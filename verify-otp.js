import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      challengeId,
      method,
      identifier,
      otp,
      className = "",
      board = "",
      school = ""
    } = req.body || {};

    if (!challengeId || !identifier || !otp) {
      return res.status(400).json({
        error: "Challenge ID, email, and OTP are required."
      });
    }

    if (method !== "email") {
      return res.status(400).json({
        error: "SMS verification is not enabled yet."
      });
    }

    const email = String(identifier).trim().toLowerCase();
    const enteredOtp = String(otp).trim();

    if (!/^\d{6}$/.test(enteredOtp)) {
      return res.status(400).json({
        error: "OTP must be 6 digits."
      });
    }

    const otpSecret = process.env.OTP_SECRET;

    if (!otpSecret) {
      console.error("OTP_SECRET is missing.");

      return res.status(500).json({
        error: "OTP security is not configured."
      });
    }

    // Decode the challenge created by send-otp.js
    let challenge;

    try {
      const decoded = Buffer.from(
        challengeId,
        "base64url"
      ).toString("utf8");

      challenge = JSON.parse(decoded);
    } catch (error) {
      return res.status(400).json({
        error: "Invalid or corrupted OTP challenge."
      });
    }

    if (
      !challenge ||
      !challenge.payload ||
      !challenge.signature
    ) {
      return res.status(400).json({
        error: "Invalid
