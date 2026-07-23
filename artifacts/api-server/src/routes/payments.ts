import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import Razorpay from "razorpay";
import { db, walletTable, transactionsTable, processedPaymentsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Credit pack definitions ──────────────────────────────────────────────────
// walletCredit = what lands in the user's wallet (includes bonus for larger packs)

export const CREDIT_PACKS: Record<string, {
  label: string;
  priceInr: number;      // what the user pays
  walletCredit: number;  // what lands in their wallet
  bonus: number;         // bonus on top (walletCredit - priceInr)
  description: string;
  tag?: string;
}> = {
  starter: {
    label: "Starter",
    priceInr: 999,
    walletCredit: 999,
    bonus: 0,
    description: "Perfect for trying out all four tools",
  },
  growth: {
    label: "Growth",
    priceInr: 2999,
    walletCredit: 3299,
    bonus: 300,
    description: "For regular creators and freelancers",
    tag: "Most Popular",
  },
  pro: {
    label: "Pro",
    priceInr: 5999,
    walletCredit: 6999,
    bonus: 1000,
    description: "Best value — studios and high-volume teams",
    tag: "Best Value",
  },
};

/** INR rate per minute for each operation */
export const WALLET_RATES: Record<string, number> = {
  transcription: 5,
  subtitling:    8,
  captioning:    12,
  dubbing:       50,
};

export function getRatePerMin(operation: string): number {
  return WALLET_RATES[operation] ?? 5;
}

const TOPUP_MIN = 200;

// ─── Razorpay client ──────────────────────────────────────────────────────────

function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// ─── Wallet helpers ───────────────────────────────────────────────────────────

export async function getOrCreateWallet(userId: number) {
  const rows = await db.select().from(walletTable)
    .where(eq(walletTable.userId, userId)).limit(1);
  if (rows.length > 0) return rows[0];
  const [wallet] = await db.insert(walletTable).values({
    userId, balance: "0", planType: "free", totalSpent: "0", totalJobsRun: 0, totalMinutesProcessed: "0",
  }).returning();
  return wallet;
}

/** Idempotent payment apply — returns "applied" | "duplicate" | "failed" */
async function applyPaymentOnce(
  paymentId: string,
  userId: number,
  paidInr: number,
  walletCredit: number,
  description: string,
): Promise<"applied" | "duplicate" | "failed"> {
  try {
    const inserted = await db.insert(processedPaymentsTable).values({
      paymentId,
      amountInr: String(paidInr),
      plan: "",
    }).onConflictDoNothing().returning();

    if (inserted.length === 0) return "duplicate";

    const wallet = await getOrCreateWallet(userId);
    await db.update(walletTable)
      .set({ balance: String(Number(wallet.balance) + walletCredit) })
      .where(eq(walletTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      userId,
      type: "credit",
      amount: String(walletCredit),
      description,
      jobId: null,
    });

    return "applied";
  } catch (err) {
    console.error("[payments] applyPaymentOnce error:", err);
    return "failed";
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Publishable key ID — safe to expose */
router.get("/payments/config", (_req, res): void => {
  res.json({ keyId: process.env.RAZORPAY_KEY_ID ?? "" });
});

/** Pack metadata for Billing UI */
router.get("/payments/packs", (_req, res): void => {
  res.json({ packs: CREDIT_PACKS, walletRates: WALLET_RATES, topupMin: TOPUP_MIN });
});

// ── Buy a credit pack ─────────────────────────────────────────────────────────
// Creates a Razorpay payment link and returns the short_url for redirect.
// packId is stored in notes so the webhook knows to credit the right amount.

router.post("/payments/buy-pack", async (req, res): Promise<void> => {
  const { packId } = req.body as { packId: string };
  const pack = CREDIT_PACKS[packId];
  if (!pack) { res.status(400).json({ error: "Unknown pack" }); return; }

  const userId = req.auth!.userId;
  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const rz = getRazorpay();

  const linkPayload: any = {
    amount:      pack.priceInr * 100,
    currency:    "INR",
    description: `DAK Transcription — ${pack.label} Pack`,
    notes:       { packId, walletCredit: String(pack.walletCredit), userId: String(userId) },
  };
  if (appBaseUrl) {
    linkPayload.callback_url    = `${appBaseUrl}/billing`;
    linkPayload.callback_method = "get";
  }

  const link = await rz.paymentLink.create(linkPayload) as any;
  res.json({ shortUrl: link.short_url, pack });
});

// ── Custom top-up ─────────────────────────────────────────────────────────────

router.post("/payments/topup", async (req, res): Promise<void> => {
  const amount = Math.floor(Number(req.body?.amount ?? 0));
  if (amount < TOPUP_MIN) {
    res.status(400).json({ error: `Minimum top-up is ₹${TOPUP_MIN}` });
    return;
  }

  const userId = req.auth!.userId;
  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const rz = getRazorpay();

  const linkPayload: any = {
    amount:      amount * 100,
    currency:    "INR",
    description: `DAK Transcription — Wallet top-up ₹${amount}`,
    notes:       { topup: "true", userId: String(userId) },
  };
  if (appBaseUrl) {
    linkPayload.callback_url    = `${appBaseUrl}/billing`;
    linkPayload.callback_method = "get";
  }

  const link = await rz.paymentLink.create(linkPayload) as any;
  res.json({ shortUrl: link.short_url, amount });
});

// ── Webhook: payment_link.paid ────────────────────────────────────────────────

router.post("/payments/webhook", async (req, res): Promise<void> => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig      = req.headers["x-razorpay-signature"] as string;
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (expected !== sig) {
      res.status(400).json({ error: "Invalid webhook signature" }); return;
    }
  }

  const event   = req.body?.event as string;
  const payload = req.body?.payload ?? {};

  if (event === "payment_link.paid") {
    const payment   = payload?.payment?.entity ?? {};
    const plinkData = payload?.payment_link?.entity ?? {};
    const notes     = (plinkData?.notes ?? payment?.notes ?? {}) as Record<string, string>;

    const paymentId = payment?.id as string;
    const paidInr   = (payment?.amount ?? 0) / 100;

    if (!paymentId || !paidInr) {
      res.status(500).json({ error: "Missing payment ID or amount" }); return;
    }

    // If a packId is in notes, credit the wallet amount for that pack (includes bonus)
    const packId      = notes?.packId;
    const pack        = packId ? CREDIT_PACKS[packId] : null;
    const walletCredit = pack ? pack.walletCredit : paidInr;
    const userId      = notes?.userId ? Number(notes.userId) : null;

    if (!userId) {
      console.error("[payments] Webhook missing userId in notes — cannot credit wallet");
      res.json({ status: "ok" }); return;
    }

    const desc = pack
      ? `${pack.label} Pack — paid ₹${paidInr}${pack.bonus > 0 ? ` + ₹${pack.bonus} bonus` : ""} = ₹${walletCredit} added`
      : `Wallet top-up — ₹${paidInr} added`;

    const status = await applyPaymentOnce(paymentId, userId, paidInr, walletCredit, desc);
    if (status === "failed") {
      res.status(500).json({ error: "Payment apply failed — Razorpay will retry" }); return;
    }
  }

  res.json({ status: "ok" });
});

export default router;
