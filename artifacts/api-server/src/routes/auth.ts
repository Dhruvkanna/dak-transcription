import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { Response } from "express";

const router: IRouter = Router();

const COOKIE_NAME = "dak_token";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// ── Email verification sender ─────────────────────────────────────────────────

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const smtpServer   = process.env.SMTP_SERVER;
  const smtpPort     = Number(process.env.SMTP_PORT ?? 587);
  const senderEmail  = process.env.SENDER_EMAIL;
  const senderPass   = process.env.SENDER_PASSWORD;
  const appBaseUrl   = process.env.APP_BASE_URL ?? "http://localhost:3000";

  if (!smtpServer || !senderEmail || !senderPass) {
    console.warn("[auth] SMTP not configured — skipping verification email. Token:", token);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpServer,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: senderEmail, pass: senderPass },
  });

  // Format OTP with a space in the middle for readability: "123 456"
  const displayOtp = `${token.slice(0, 3)} ${token.slice(3)}`;

  await transporter.sendMail({
    from: `"DAK Transcription" <${senderEmail}>`,
    to: email,
    subject: `${token} is your DAK Transcription verification code`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your verification code</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f4f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f4f0;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Dark header -->
          <tr>
            <td style="background:#111111;padding:36px 48px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:40px;height:40px;background:#E4C980;border-radius:10px;font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#111111;text-align:center;line-height:40px;">D</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <div style="font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:-0.3px;line-height:1.1;">DAK Transcription</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">Audio &amp; Video Intelligence</div>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background:rgba(255,255,255,0.08);margin-top:28px;"></div>

              <div style="margin-top:28px;">
                <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#E4C980;font-weight:600;margin-bottom:10px;">Verification Code</div>
                <div style="font-family:Georgia,serif;font-size:26px;font-weight:bold;color:#ffffff;line-height:1.25;letter-spacing:-0.5px;">Confirm your<br/>email address</div>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 16px;">
              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#444444;">
                Use the code below to verify your email and activate your DAK Transcription account.
              </p>

              <!-- OTP display -->
              <div style="background:#f8f7f4;border:2px solid #111111;border-radius:14px;padding:28px 24px;text-align:center;margin-bottom:28px;">
                <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888888;font-weight:600;margin-bottom:14px;">Your one-time code</div>
                <div style="font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:bold;color:#111111;letter-spacing:12px;line-height:1;">${displayOtp}</div>
              </div>

              <!-- Expiry warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;">
                    <span style="font-size:13px;color:#92400e;line-height:1.6;">
                      ⏱&nbsp; This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 0;font-size:13px;line-height:1.7;color:#999999;">
                If you didn't create a DAK Transcription account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f7f4;border-top:1px solid #eeece8;padding:24px 48px;text-align:center;margin-top:28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#aaaaaa;line-height:1.6;">DAK Transcription · Made for Indian creators</p>
              <p style="margin:0;font-size:11px;color:#c0bdb7;">© ${new Date().getFullYear()} DAK Transcription. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`,
  });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" }); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address" }); return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" }); return;
  }

  const existing = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" }); return;
  }

  const passwordHash        = await bcrypt.hash(password, 12);
  const verificationToken   = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit OTP
  const expiresAt           = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    verificationToken,
    verificationTokenExpiresAt: expiresAt,
  });

  try {
    await sendVerificationEmail(email.toLowerCase(), verificationToken);
  } catch (err) {
    console.error("[auth] Failed to send verification email:", err);
  }

  res.status(201).json({ message: "Account created. Check your email to verify your account." });
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { email, otp } = req.body as { email?: string; otp?: string };
  if (!email || !otp) { res.status(400).json({ error: "Email and OTP are required" }); return; }

  const [user] = await db.select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user || user.verificationToken !== otp) {
    res.status(400).json({ error: "Invalid OTP. Please check and try again." }); return;
  }
  if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
    res.status(400).json({ error: "OTP has expired. Please request a new one." }); return;
  }

  await db.update(usersTable)
    .set({ emailVerified: true, verificationToken: null, verificationTokenExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  const jwtToken = signToken(user.id, user.email);
  setAuthCookie(res, jwtToken);
  res.json({ message: "Email verified. You are now logged in." });
});

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────────

router.post("/auth/resend-otp", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  const [user] = await db.select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user || user.emailVerified) {
    // Return 200 either way — don't leak account existence
    res.json({ message: "If that email exists and is unverified, a new OTP has been sent." }); return;
  }

  const newOtp    = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.update(usersTable)
    .set({ verificationToken: newOtp, verificationTokenExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));

  try {
    await sendVerificationEmail(email.toLowerCase(), newOtp);
  } catch (err) {
    console.error("[auth] Failed to resend OTP:", err);
  }

  res.json({ message: "A new OTP has been sent to your email." });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" }); return;
  }

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase())).limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Incorrect email or password" }); return;
  }
  if (!user.emailVerified) {
    res.status(403).json({ error: "Please verify your email before logging in.", code: "EMAIL_NOT_VERIFIED" }); return;
  }

  const token = signToken(user.id, user.email);
  setAuthCookie(res, token);
  res.json({ user: { id: user.id, email: user.email } });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

router.post("/auth/logout", (_req, res): void => {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get("/auth/me", async (req, res): Promise<void> => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; email: string };
    res.json({ user: { id: payload.userId, email: payload.email } });
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
});

export default router;
