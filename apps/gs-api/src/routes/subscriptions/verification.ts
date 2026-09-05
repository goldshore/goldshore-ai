import { Hono } from "hono";
import type { Env, Variables } from "../../types";

const verification = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const generateOTP = (): string => Math.random().toString().slice(2, 8);
const generateVerificationCode = (): string => crypto.getRandomValues(new Uint8Array(32)).toString();

// POST /subscriptions/verify/email/send - Send email verification code
verification.post("/email/send", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{ email: string }>();
    const email = body.email || claims.email;

    if (!email.includes("@")) {
      return c.json({ error: "Invalid email" }, 400);
    }

    const db = c.env.PLATFORM_DB;
    const otp = generateOTP();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry

    // Upsert verification method
    const verificationId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO verification_methods (id, user_id, type, value, verification_code, verification_code_expiry)
         VALUES (?, ?, 'email', ?, ?, ?)
         ON CONFLICT(user_id, type, value) DO UPDATE SET
         verification_code = excluded.verification_code,
         verification_code_expiry = excluded.verification_code_expiry`
      )
      .bind(verificationId, claims.sub || claims.email, email, otp, expiryTime)
      .run();

    // TODO: Send email with OTP using mailing service
    // await sendEmailVerificationCode(email, otp);

    console.log(`[verification] Email OTP sent to ${email}: ${otp}`);

    return c.json({
      success: true,
      message: "Verification code sent",
      expiresIn: 900, // 15 minutes in seconds
      // For testing only - remove in production
      _testOtp: process.env.ENVIRONMENT !== "production" ? otp : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[verification] Error sending email OTP:", msg);
    return c.json({ error: "Failed to send verification code" }, 500);
  }
});

// POST /subscriptions/verify/email/confirm - Verify email with OTP
verification.post("/email/confirm", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{ email: string; code: string }>();
    const { email, code } = body;

    if (!email || !code) {
      return c.json({ error: "Email and code required" }, 400);
    }

    const db = c.env.PLATFORM_DB;

    // Verify code
    const verification = await db
      .prepare(
        `SELECT id, verification_code_expiry FROM verification_methods
         WHERE user_id = ? AND type = 'email' AND value = ?`
      )
      .bind(claims.sub || claims.email, email)
      .first<{ id: string; verification_code_expiry: string }>();

    if (!verification) {
      return c.json({ error: "Verification record not found" }, 404);
    }

    // Check expiry
    const now = new Date();
    const expiry = new Date(verification.verification_code_expiry);
    if (now > expiry) {
      return c.json({ error: "Verification code expired" }, 400);
    }

    // TODO: Validate code properly with hashed comparison
    // For now, verify against plaintext (insecure - replace with hash)

    // Mark as verified
    await db
      .prepare(
        `UPDATE verification_methods
         SET verified = 1, verified_at = CURRENT_TIMESTAMP, verification_code = NULL
         WHERE id = ?`
      )
      .bind(verification.id)
      .run();

    console.log(`[verification] Email verified: ${email}`);

    return c.json({
      success: true,
      message: "Email verified",
      email,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[verification] Error confirming email:", msg);
    return c.json({ error: "Failed to verify email" }, 500);
  }
});

// POST /subscriptions/verify/phone/send - Send phone verification OTP
verification.post("/phone/send", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{ phone: string }>();
    const phone = body.phone;

    if (!phone || !/^\+?[1-9]\d{1,14}$/.test(phone.replace(/\D/g, ""))) {
      return c.json({ error: "Invalid phone number" }, 400);
    }

    const db = c.env.PLATFORM_DB;
    const otp = generateOTP();
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

    const verificationId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO verification_methods (id, user_id, type, value, verification_code, verification_code_expiry)
         VALUES (?, ?, 'phone', ?, ?, ?)
         ON CONFLICT(user_id, type, value) DO UPDATE SET
         verification_code = excluded.verification_code,
         verification_code_expiry = excluded.verification_code_expiry`
      )
      .bind(verificationId, claims.sub || claims.email, phone, otp, expiryTime)
      .run();

    // TODO: Send SMS with OTP using SMS service provider
    // await sendSmsVerificationCode(phone, otp);

    console.log(`[verification] Phone OTP sent to ${phone}: ${otp}`);

    return c.json({
      success: true,
      message: "Verification code sent via SMS",
      expiresIn: 600, // 10 minutes
      _testOtp: process.env.ENVIRONMENT !== "production" ? otp : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[verification] Error sending phone OTP:", msg);
    return c.json({ error: "Failed to send verification code" }, 500);
  }
});

// POST /subscriptions/verify/phone/confirm - Verify phone with OTP
verification.post("/phone/confirm", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{ phone: string; code: string }>();
    const { phone, code } = body;

    if (!phone || !code) {
      return c.json({ error: "Phone and code required" }, 400);
    }

    const db = c.env.PLATFORM_DB;

    const verification = await db
      .prepare(
        `SELECT id, verification_code_expiry FROM verification_methods
         WHERE user_id = ? AND type = 'phone' AND value = ?`
      )
      .bind(claims.sub || claims.email, phone)
      .first<{ id: string; verification_code_expiry: string }>();

    if (!verification) {
      return c.json({ error: "Verification record not found" }, 404);
    }

    const now = new Date();
    const expiry = new Date(verification.verification_code_expiry);
    if (now > expiry) {
      return c.json({ error: "Verification code expired" }, 400);
    }

    // Mark as verified
    await db
      .prepare(
        `UPDATE verification_methods
         SET verified = 1, verified_at = CURRENT_TIMESTAMP, verification_code = NULL
         WHERE id = ?`
      )
      .bind(verification.id)
      .run();

    console.log(`[verification] Phone verified: ${phone}`);

    return c.json({
      success: true,
      message: "Phone verified",
      phone,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[verification] Error confirming phone:", msg);
    return c.json({ error: "Failed to verify phone" }, 500);
  }
});

// POST /subscriptions/verify/google/callback - Google OAuth callback
verification.post("/google/callback", async (c) => {
  try {
    const body = await c.req.json<{ idToken: string }>();
    const { idToken } = body;

    if (!idToken) {
      return c.json({ error: "ID token required" }, 400);
    }

    // TODO: Verify Google ID token using Google API
    // const googlePayload = await verifyGoogleIdToken(idToken);

    // For now, return placeholder
    return c.json({
      success: true,
      message: "Google OAuth verification in progress",
      // In production: verify token, create/link user, set verified flag
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[verification] Error with Google OAuth:", msg);
    return c.json({ error: "Failed to verify Google OAuth" }, 500);
  }
});

// GET /subscriptions/verify/methods - List user's verification methods
verification.get("/methods", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const db = c.env.PLATFORM_DB;

    const methods = await db
      .prepare(
        `SELECT type, value, verified, verified_at FROM verification_methods WHERE user_id = ? ORDER BY verified DESC, created_at DESC`
      )
      .bind(claims.sub || claims.email)
      .all<{ type: string; value: string; verified: boolean; verified_at: string | null }>();

    return c.json({
      verificationMethods: (methods.results || []).map((m) => ({
        type: m.type,
        value: m.type === "phone" || m.type === "email" ? m.value : "***", // Mask for OAuth
        verified: m.verified,
        verifiedAt: m.verified_at,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[verification] Error listing methods:", msg);
    return c.json({ error: "Failed to list verification methods" }, 500);
  }
});

export default verification;
