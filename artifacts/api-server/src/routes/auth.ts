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

  const verifyUrl = `${appBaseUrl}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"DAK Transcription" <${senderEmail}>`,
    to: email,
    subject: "Verify your email — DAK Transcription",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f4f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f4f0;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header band -->
          <tr>
            <td style="background:#111111;padding:36px 48px 32px;">
              <!-- Logo row -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:40px;height:40px;background:#E4C980;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#111111;text-align:center;line-height:40px;">D</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <div style="font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:-0.3px;line-height:1.1;">DAK Transcription</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;letter-spacing:0.2px;">Audio &amp; Video Intelligence</div>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:rgba(255,255,255,0.08);margin-top:28px;"></div>

              <!-- Hero text -->
              <div style="margin-top:28px;">
                <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#E4C980;font-weight:600;margin-bottom:10px;">Account Verification</div>
                <div style="font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#ffffff;line-height:1.25;letter-spacing:-0.5px;">Confirm your<br/>email address</div>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 36px;">
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#444444;">
                Welcome aboard. You're one step away from accessing AI-powered transcription, subtitling, captioning, and dubbing — all billed in INR.
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#444444;">
                Click the button below to verify your email and activate your account.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                <tr>
                  <td style="border-radius:10px;background:#111111;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:15px 40px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.1px;">
                      Verify my email &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link box -->
              <div style="background:#f8f7f4;border:1px solid #e8e6e0;border-radius:10px;padding:18px 20px;margin-bottom:32px;">
                <div style="font-size:12px;color:#888888;margin-bottom:8px;font-weight:500;letter-spacing:0.3px;text-transform:uppercase;">Or copy this link into your browser</div>
                <div style="font-size:12px;color:#555555;word-break:break-all;line-height:1.6;">${verifyUrl}</div>
              </div>

              <!-- Expiry note -->
              <div style="display:flex;align-items:flex-start;gap:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;">
                <div style="font-size:13px;color:#92400e;line-height:1.6;">
                  ⏱ &nbsp;This link expires in <strong>24 hours</strong>. If you didn't create a DAK Transcription account, you can safely ignore this email.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f7f4;border-top:1px solid #eeece8;padding:24px 48px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#aaaaaa;line-height:1.6;">
                DAK Transcription · Made for Indian creators
              </p>
              <p style="margin:0;font-size:11px;color:#c0bdb7;">
                © ${new Date().getFullYear()} DAK Transcription. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

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
  const verificationToken   = crypto.randomBytes(32).toString("hex");
  const expiresAt           = new Date(Date.now() + 24 * 60 * 60 * 1000);

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

// ── GET /api/auth/verify-email ────────────────────────────────────────────────

router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const token = req.query.token as string | undefined;
  if (!token) { res.status(400).json({ error: "Missing token" }); return; }

  const [user] = await db.select()
    .from(usersTable)
    .where(eq(usersTable.verificationToken, token))
    .limit(1);

  if (!user) { res.status(400).json({ error: "Invalid or already used verification link" }); return; }
  if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
    res.status(400).json({ error: "Verification link has expired. Please register again." }); return;
  }

  await db.update(usersTable)
    .set({ emailVerified: true, verificationToken: null, verificationTokenExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  // Auto-login after verification
  const jwtToken = signToken(user.id, user.email);
  setAuthCookie(res, jwtToken);
  res.json({ message: "Email verified. You are now logged in." });
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
