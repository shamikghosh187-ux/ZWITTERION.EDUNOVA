const crypto = require("crypto");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const body = req.body || {};

        const challengeId = body.challengeId;
        const method = body.method;
        const identifier = body.identifier;
        const otp = body.otp;

        const className = body.className || "";
        const board = body.board || "";
        const school = body.school || "";

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

        const email = String(identifier)
            .trim()
            .toLowerCase();

        const enteredOtp = String(otp).trim();

        const otpSecret = process.env.OTP_SECRET;

        if (!otpSecret) {
            console.error("OTP_SECRET is missing.");

            return res.status(500).json({
                error: "OTP security is not configured."
            });
        }

        if (!/^\d{6}$/.test(enteredOtp)) {
            return res.status(400).json({
                error: "OTP must be 6 digits."
            });
        }

        let challenge;

        try {
            const decoded = Buffer
                .from(String(challengeId), "base64url")
                .toString("utf8");

            challenge = JSON.parse(decoded);

        } catch (error) {
            console.error(
                "Challenge decode error:",
                error
            );

            return res.status(400).json({
                error: "Invalid OTP challenge."
            });
        }

        if (
            !challenge ||
            typeof challenge !== "object" ||
            !challenge.payload ||
            !challenge.signature
        ) {
            return res.status(400).json({
                error: "Invalid OTP challenge."
            });
        }

        const payload = challenge.payload;
        const signature = challenge.signature;

        const expectedSignature = crypto
            .createHmac("sha256", otpSecret)
            .update(JSON.stringify(payload))
            .digest("hex");

        if (
            typeof signature !== "string" ||
            signature.length !== expectedSignature.length
        ) {
            return res.status(400).json({
                error: "Invalid OTP challenge."
            });
        }

        const signatureMatches =
            crypto.timingSafeEqual(
                Buffer.from(signature, "utf8"),
                Buffer.from(expectedSignature, "utf8")
            );

        if (!signatureMatches) {
            return res.status(400).json({
                error: "Invalid OTP challenge."
            });
        }

        if (
            !payload.email ||
            String(payload.email).toLowerCase() !== email
        ) {
            return res.status(400).json({
                error:
                    "This OTP was not requested for this email."
            });
        }

        const expiresAt =
            Number(payload.expiresAt);

        if (
            !Number.isFinite(expiresAt) ||
            Date.now() > expiresAt
        ) {
            return res.status(400).json({
                error:
                    "OTP has expired. Please request a new OTP."
            });
        }

        if (
            !payload.challengeId ||
            typeof payload.otpHash !== "string"
        ) {
            return res.status(400).json({
                error: "Invalid OTP challenge."
            });
        }

        const enteredOtpHash = crypto
            .createHmac("sha256", otpSecret)
            .update(
                `${payload.challengeId}:${email}:${enteredOtp}`
            )
            .digest("hex");

        if (
            enteredOtpHash.length !==
            payload.otpHash.length
        ) {
            return res.status(400).json({
                error: "Incorrect OTP."
            });
        }

        const otpMatches =
            crypto.timingSafeEqual(
                Buffer.from(enteredOtpHash, "utf8"),
                Buffer.from(payload.otpHash, "utf8")
            );

        if (!otpMatches) {
            return res.status(400).json({
                error: "Incorrect OTP."
            });
        }

        const now = Date.now();

        const sessionPayload = {
            email: email,
            className:
                className ||
                payload.className ||
                "",
            board:
                board ||
                payload.board ||
                "",
            school:
                school ||
                payload.school ||
                "",
            authenticatedAt: now,
            expiresAt:
                now + (24 * 60 * 60 * 1000)
        };

        const sessionString =
            JSON.stringify(sessionPayload);

        const sessionSignature =
            crypto
                .createHmac("sha256", otpSecret)
                .update(sessionString)
                .digest("hex");

        const token =
            Buffer
                .from(
                    JSON.stringify({
                        payload: sessionPayload,
                        signature: sessionSignature
                    })
                )
                .toString("base64url");

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully.",
            token: token,
            email: email
        });

    } catch (error) {
        console.error(
            "VERIFY OTP ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error && error.message
                    ? String(error.message)
                    : "Something went wrong while verifying the OTP."
        });
    }
};
