const crypto = require("crypto");

module.exports = async function handler(req, res) {
    try {
        // --------------------------------
        // METHOD CHECK
        // --------------------------------

        if (req.method !== "POST") {
            return res.status(405).json({
                error: "Method not allowed"
            });
        }

        // --------------------------------
        // READ REQUEST
        // --------------------------------

        const body = req.body || {};

        const challengeId =
            typeof body.challengeId === "string"
                ? body.challengeId
                : "";

        const method =
            typeof body.method === "string"
                ? body.method
                : "";

        const identifier =
            typeof body.identifier === "string"
                ? body.identifier
                : "";

        const otp =
            typeof body.otp === "string"
                ? body.otp.trim()
                : "";

        const className =
            typeof body.className === "string"
                ? body.className
                : "";

        const board =
            typeof body.board === "string"
                ? body.board
                : "";

        const school =
            typeof body.school === "string"
                ? body.school
                : "";

        // --------------------------------
        // BASIC VALIDATION
        // --------------------------------

        if (!challengeId) {
            return res.status(400).json({
                error: "OTP challenge is missing."
            });
        }

        if (!identifier) {
            return res.status(400).json({
                error: "Email address is missing."
            });
        }

        if (!otp) {
            return res.status(400).json({
                error: "OTP is missing."
            });
        }

        if (method !== "email") {
            return res.status(400).json({
                error: "Only email OTP verification is enabled."
            });
        }

        const email =
            identifier.trim().toLowerCase();

        // --------------------------------
        // OTP FORMAT
        // --------------------------------

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                error: "OTP must contain exactly 6 digits."
            });
        }

        // --------------------------------
        // SECRET
        // --------------------------------

        const otpSecret =
            process.env.OTP_SECRET;

        if (
            !otpSecret ||
            typeof otpSecret !== "string"
        ) {
            console.error(
                "OTP_SECRET is missing."
            );

            return res.status(500).json({
                error:
                    "OTP security is not configured."
            });
        }

        // --------------------------------
        // DECODE CHALLENGE
        // --------------------------------

        let challenge;

        try {
            const decoded =
                Buffer
                    .from(
                        challengeId,
                        "base64url"
                    )
                    .toString("utf8");

            challenge =
                JSON.parse(decoded);

        } catch (decodeError) {
            console.error(
                "Challenge decode error:",
                decodeError
            );

            return res.status(400).json({
                error:
                    "The OTP challenge is invalid or corrupted."
            });
        }

        // --------------------------------
        // CHECK CHALLENGE STRUCTURE
        // --------------------------------

        if (
            !challenge ||
            typeof challenge !== "object" ||
            !challenge.payload ||
            typeof challenge.payload !== "object" ||
            typeof challenge.signature !== "string"
        ) {
            return res.status(400).json({
                error:
                    "Invalid OTP challenge."
            });
        }

        const payload =
            challenge.payload;

        const signature =
            challenge.signature;

        // --------------------------------
        // CHECK REQUIRED PAYLOAD
        // --------------------------------

        if (
            typeof payload.challengeId !== "string" ||
            typeof payload.email !== "string" ||
            typeof payload.otpHash !== "string" ||
            !payload.expiresAt
        ) {
            return res.status(400).json({
                error:
                    "Incomplete OTP challenge."
            });
        }

        // --------------------------------
        // VERIFY CHALLENGE SIGNATURE
        // --------------------------------

        const expectedSignature =
            crypto
                .createHmac(
                    "sha256",
                    otpSecret
                )
                .update(
                    JSON.stringify(payload)
                )
                .digest("hex");

        if (
            signature.length !==
            expectedSignature.length
        ) {
            return res.status(400).json({
                error:
                    "OTP challenge signature is invalid."
            });
        }

        let signatureValid = false;

        try {
            signatureValid =
                crypto.timingSafeEqual(
                    Buffer.from(
                        signature,
                        "utf8"
                    ),
                    Buffer.from(
                        expectedSignature,
                        "utf8"
                    )
                );
        } catch (signatureError) {
            console.error(
                "Signature comparison error:",
                signatureError
            );

            return res.status(400).json({
                error:
                    "OTP challenge signature is invalid."
            });
        }

        if (!signatureValid) {
            return res.status(400).json({
                error:
                    "OTP challenge signature is invalid."
            });
        }

        // --------------------------------
        // VERIFY EMAIL
        // --------------------------------

        const storedEmail =
            String(payload.email)
                .trim()
                .toLowerCase();

        if (storedEmail !== email) {
            return res.status(400).json({
                error:
                    "This OTP does not belong to this email address."
            });
        }

        // --------------------------------
        // VERIFY EXPIRATION
        // --------------------------------

        const expiresAt =
            Number(payload.expiresAt);

        if (!Number.isFinite(expiresAt)) {
            return res.status(400).json({
                error:
                    "OTP expiration information is invalid."
            });
        }

        if (Date.now() > expiresAt) {
            return res.status(400).json({
                error:
                    "OTP has expired. Please request a new OTP."
            });
        }

        // --------------------------------
        // VERIFY OTP HASH
        // --------------------------------

        const enteredOtpHash =
            crypto
                .createHmac(
                    "sha256",
                    otpSecret
                )
                .update(
                    `${payload.challengeId}:${email}:${otp}`
                )
                .digest("hex");

        if (
            typeof payload.otpHash !== "string"
        ) {
            return res.status(400).json({
                error:
                    "OTP hash is invalid."
            });
        }

        if (
            enteredOtpHash.length !==
            payload.otpHash.length
        ) {
            return res.status(400).json({
                error:
                    "Incorrect OTP."
            });
        }

        let otpValid = false;

        try {
            otpValid =
                crypto.timingSafeEqual(
                    Buffer.from(
                        enteredOtpHash,
                        "utf8"
                    ),
                    Buffer.from(
                        payload.otpHash,
                        "utf8"
                    )
                );
        } catch (otpCompareError) {
            console.error(
                "OTP comparison error:",
                otpCompareError
            );

            return res.status(400).json({
                error:
                    "Unable to verify OTP."
            });
        }

        if (!otpValid) {
            return res.status(400).json({
                error:
                    "Incorrect OTP."
            });
        }

        // --------------------------------
        // CREATE SESSION
        // --------------------------------

        const now =
            Date.now();

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

            authenticatedAt:
                now,

            expiresAt:
                now +
                (24 * 60 * 60 * 1000)
        };

        // --------------------------------
        // SIGN SESSION
        // --------------------------------

        const sessionString =
            JSON.stringify(
                sessionPayload
            );

        const sessionSignature =
            crypto
                .createHmac(
                    "sha256",
                    otpSecret
                )
                .update(
                    sessionString
                )
                .digest("hex");

        // --------------------------------
        // CREATE TOKEN
        // --------------------------------

        const tokenPayload = {
            payload:
                sessionPayload,

            signature:
                sessionSignature
        };

        const token =
            Buffer
                .from(
                    JSON.stringify(
                        tokenPayload
                    )
                )
                .toString("base64url");

        // --------------------------------
        // SUCCESS
        // --------------------------------

        return res.status(200).json({
            success: true,

            message:
                "OTP verified successfully.",

            token: token,

            email: email,

            studentName: email,

            className:
                sessionPayload.className,

            board:
                sessionPayload.board,

            school:
                sessionPayload.school
        });

    } catch (error) {
        console.error(
            "VERIFY OTP FATAL ERROR:",
            error
        );

        let message =
            "Something went wrong while verifying the OTP.";

        if (
            error &&
            typeof error.message === "string" &&
            error.message.trim()
        ) {
            message =
                error.message;
        }

        return res.status(500).json({
            error: message
        });
    }
};
