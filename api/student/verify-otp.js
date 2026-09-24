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
      challengeId,
      method,
      identifier,
      otp,
      className = "",
      board = "",
      school = ""
    } = req.body || {};

    // ---------------------------------------------------------
    // VALIDATE INPUT
    // ---------------------------------------------------------

    if (!challengeId || !identifier || !otp) {
      return res.status(400).json({
        error: "Challenge ID, email and OTP are required."
      });
    }

    if (method && method !== "email") {
      return res.status(400).json({
        error: "SMS OTP is not enabled yet. Please use email."
      });
    }

    const email = String(identifier)
      .trim()
      .toLowerCase();

    const enteredOtp = String(otp).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address."
      });
    }

    if (!/^\d{6}$/.test(enteredOtp)) {
      return res.status(400).json({
        error: "OTP must be a 6-digit number."
      });
    }

    // ---------------------------------------------------------
    // ENVIRONMENT
    // ---------------------------------------------------------

    const otpSecret = process.env.OTP_SECRET;
    const databaseUrl = process.env.DATABASE_URL;

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
    // FIND THE CHALLENGE
    // ---------------------------------------------------------

    const challenges = await sql`
      SELECT
        id,
        student_email,
        challenge_id,
        otp_hash,
        expires_at,
        consumed_at,
        invalidated_at
      FROM student_otp_challenges
      WHERE challenge_id = ${challengeId}
        AND LOWER(student_email) = ${email}
      LIMIT 1
    `;

    if (challenges.length === 0) {
      return res.status(400).json({
        error: "Invalid or expired OTP request."
      });
    }

    const challenge = challenges[0];

    // ---------------------------------------------------------
    // CHECK WHETHER OTP WAS ALREADY USED
    // ---------------------------------------------------------

    if (challenge.consumed_at) {
      return res.status(400).json({
        error: "This OTP has already been used."
      });
    }

    // ---------------------------------------------------------
    // CHECK WHETHER OTP WAS INVALIDATED BY RESEND
    // ---------------------------------------------------------

    if (challenge.invalidated_at) {
      return res.status(400).json({
        error: "This OTP is no longer valid. Please use the newest OTP."
      });
    }

    // ---------------------------------------------------------
    // CHECK EXPIRATION
    // ---------------------------------------------------------

    const expiresAt =
      new Date(challenge.expires_at).getTime();

    if (
      !Number.isFinite(expiresAt) ||
      Date.now() > expiresAt
    ) {
      return res.status(400).json({
        error: "OTP has expired. Please request a new OTP."
      });
    }

    // ---------------------------------------------------------
    // HASH ENTERED OTP
    // ---------------------------------------------------------

    const enteredOtpHash = crypto
      .createHmac("sha256", otpSecret)
      .update(
        `${challenge.challenge_id}:${email}:${enteredOtp}`
      )
      .digest("hex");

    if (
      enteredOtpHash.length !==
      challenge.otp_hash.length
    ) {
      return res.status(400).json({
        error: "Incorrect OTP."
      });
    }

    const otpMatches =
      crypto.timingSafeEqual(
        Buffer.from(enteredOtpHash, "utf8"),
        Buffer.from(challenge.otp_hash, "utf8")
      );

    if (!otpMatches) {
      return res.status(400).json({
        error: "Incorrect OTP."
      });
    }

    // ---------------------------------------------------------
    // CONSUME OTP
    // ---------------------------------------------------------
    //
    // The WHERE clause makes sure the same OTP cannot
    // successfully authenticate twice.
    // ---------------------------------------------------------

    const consumed =
      await sql`
        UPDATE student_otp_challenges
        SET consumed_at = NOW()
        WHERE challenge_id = ${challengeId}
          AND consumed_at IS NULL
          AND invalidated_at IS NULL
          AND expires_at > NOW()
        RETURNING id
      `;

    if (consumed.length === 0) {
      return res.status(400).json({
        error:
          "This OTP is no longer valid. Please request a new OTP."
      });
    }

    // ---------------------------------------------------------
    // FIND OR CREATE PERMANENT STUDENT ACCOUNT
    // ---------------------------------------------------------

    let students =
      await sql`
        SELECT
          id,
          student_id,
          email,
          class_name,
          board,
          school,
          verified_at,
          status
        FROM students
        WHERE LOWER(email) = ${email}
        LIMIT 1
      `;

    let student;

    if (students.length === 0) {
      // Generate a readable ZWITTERION student ID.
      const studentId =
        await generateStudentId(sql);

      const created =
        await sql`
          INSERT INTO students (
            student_id,
            email,
            class_name,
            board,
            school,
            verified_at,
            status
          )
          VALUES (
            ${studentId},
            ${email},
            ${className},
            ${board},
            ${school},
            NOW(),
            'active'
          )
          RETURNING
            id,
            student_id,
            email,
            class_name,
            board,
            school,
            verified_at,
            status
        `;

      student = created[0];

    } else {
      student = students[0];

      if (student.status !== "active") {
        return res.status(403).json({
          error: "This student account is not active."
        });
      }

      // Update latest profile information.
      const updated =
        await sql`
          UPDATE students
          SET
            class_name =
              CASE
                WHEN ${className} <> ''
                THEN ${className}
                ELSE class_name
              END,

            board =
              CASE
                WHEN ${board} <> ''
                THEN ${board}
                ELSE board
              END,

            school =
              CASE
                WHEN ${school} <> ''
                THEN ${school}
                ELSE school
              END,

            verified_at = NOW(),
            updated_at = NOW()

          WHERE id = ${student.id}

          RETURNING
            id,
            student_id,
            email,
            class_name,
            board,
            school,
            verified_at,
            status
        `;

      student = updated[0];
    }

    // ---------------------------------------------------------
    // CREATE SESSION
    // ---------------------------------------------------------

    const now = Date.now();

    const sessionPayload = {
      studentId: student.student_id,
      email: student.email,

      className:
        student.class_name || "",

      board:
        student.board || "",

      school:
        student.school || "",

      authenticatedAt: now,

      expiresAt:
        now + (24 * 60 * 60 * 1000)
    };

    const sessionString =
      JSON.stringify(sessionPayload);

    const sessionSignature =
      crypto
        .createHmac(
          "sha256",
          otpSecret
        )
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

    // ---------------------------------------------------------
    // SUCCESS
    // ---------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "OTP verified successfully.",

      token,

      student: {
        studentId: student.student_id,
        email: student.email,
        className: student.class_name || "",
        board: student.board || "",
        school: student.school || "",
        status: student.status
      }
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


// =============================================================
// GENERATE STUDENT ID
// =============================================================

async function generateStudentId(sql) {
  for (let attempt = 0; attempt < 10; attempt++) {

    const randomPart =
      crypto
        .randomInt(100000, 1000000)
        .toString();

    const studentId =
      `ZW-${randomPart}`;

    const existing =
      await sql`
        SELECT id
        FROM students
        WHERE student_id = ${studentId}
        LIMIT 1
      `;

    if (existing.length === 0) {
      return studentId;
    }
  }

  throw new Error(
    "Could not generate a unique student ID."
  );
}
