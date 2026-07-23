import { Router } from "express";
import nodemailer from "nodemailer";
import type { Request, Response } from "express";

const router = Router();

/* ─── In-memory throttle ───────────────────────────────────────
   Max 5 messages per 10 minutes per IP address.
   Uses a rolling window — timestamps older than 10 min are dropped.
────────────────────────────────────────────────────────────── */
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 5;
const throttleMap = new Map<string, number[]>();

function isThrottled(ip: string): boolean {
  const now = Date.now();
  const timestamps = (throttleMap.get(ip) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );
  throttleMap.set(ip, timestamps);
  if (timestamps.length >= MAX_PER_WINDOW) return true;
  timestamps.push(now);
  return false;
}

/* ─── SMTP transporter ─────────────────────────────────────── */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_SERVER ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // STARTTLS
    auth: {
      user: process.env.SENDER_EMAIL,
      pass: process.env.SENDER_PASSWORD,
    },
  });
}

const VALID_ISSUE_TYPES = [
  "Billing & Credits",
  "Transcription Error",
  "Subtitling Bug",
  "Captioning Bug",
  "Dubbing Bug",
  "Other",
] as const;

/* ─── POST /support/send ───────────────────────────────────── */
router.post("/support/send", async (req: Request, res: Response) => {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";

  if (isThrottled(ip)) {
    res.status(429).json({
      ok: false,
      message: "Too many messages. Please wait 10 minutes before sending again.",
    });
    return;
  }

  const { issue_type, message } = req.body as {
    issue_type?: string;
    message?: string;
  };

  if (!issue_type || !VALID_ISSUE_TYPES.includes(issue_type as any)) {
    res.status(400).json({ ok: false, message: "Please select a valid issue type." });
    return;
  }

  const trimmedMessage = (message ?? "").trim();
  if (!trimmedMessage || trimmedMessage.length < 10) {
    res.status(400).json({ ok: false, message: "Message is too short. Please describe your issue." });
    return;
  }
  if (trimmedMessage.length > 2000) {
    res.status(400).json({ ok: false, message: "Message is too long (max 2000 characters)." });
    return;
  }

  const to = process.env.SENDER_EMAIL;
  if (!to || !process.env.SENDER_PASSWORD) {
    // SMTP not yet configured — log and return success so the UI doesn't break during dev
    console.warn("[support] SMTP not configured — email not sent. Body:", { issue_type, message: trimmedMessage });
    res.json({ ok: true, message: "Message received. We'll get back to you shortly." });
    return;
  }

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #faf9f7; padding: 32px; border-radius: 12px;">
      <div style="background: #1a1a1a; color: #f5f0e8; padding: 20px 24px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin:0; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#a89880;">DAK Transcription · Platform Support</p>
        <h1 style="margin:8px 0 0; font-size:22px; font-weight:700;">${issue_type}</h1>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
        <tr>
          <td style="padding:8px 12px; background:#f0ede8; font-size:12px; color:#6b5c4e; text-transform:uppercase; letter-spacing:1px; width:120px; border-radius:4px 0 0 4px;">Issue Type</td>
          <td style="padding:8px 12px; background:#f7f4f0; font-size:14px; color:#1a1a1a; border-radius:0 4px 4px 0;">${issue_type}</td>
        </tr>
        <tr><td colspan="2" style="height:8px;"></td></tr>
        <tr>
          <td style="padding:8px 12px; background:#f0ede8; font-size:12px; color:#6b5c4e; text-transform:uppercase; letter-spacing:1px; vertical-align:top; border-radius:4px 0 0 4px;">Message</td>
          <td style="padding:8px 12px; background:#f7f4f0; font-size:14px; color:#1a1a1a; line-height:1.6; border-radius:0 4px 4px 0; white-space:pre-wrap;">${trimmedMessage}</td>
        </tr>
      </table>

      <p style="font-size:11px; color:#a89880; text-align:center; margin:0;">
        Sent from DAK Transcription platform · ${new Date().toUTCString()}
      </p>
    </div>
  `;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"DAK Transcription Support" <${process.env.SENDER_EMAIL}>`,
      to,
      subject: `PLATFORM SUPPORT: ${issue_type}`,
      html,
      text: `Issue Type: ${issue_type}\n\n${trimmedMessage}`,
    });
    res.json({ ok: true, message: "Message sent. We'll get back to you shortly." });
  } catch (err: any) {
    console.error("[support] SMTP error:", err?.message ?? err);
    res.status(500).json({ ok: false, message: "Failed to send. Please try again later." });
  }
});

export default router;
