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
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="margin-bottom:8px">Verify your email</h2>
        <p style="color:#555;margin-bottom:24px">Click the button below to activate your DAK Transcription account.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#111;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
          Verify email
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">Link expires in 24 hours. If you didn't sign up, ignore this email.</p>
      </div>`,
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
