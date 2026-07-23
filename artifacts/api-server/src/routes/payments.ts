import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import Razorpay from "razorpay";
import { db, walletTable, transactionsTable, processedPaymentsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Plan definitions (prices subject to update) ──────────────────────────────

export const SUBSCRIPTION_PLANS: Record<string, {
  label: string; priceInr: number; description: string;
}> = {
  solo:        { label: "Solo",        priceInr:  999, description: "For individual creators & freelancers" },
  partnership: { label: "Partnership", priceInr: 2999, description: "For studios and growing teams" },
  enterprise:  { label: "Enterprise",  priceInr: 7999, description: "Unlimited scale with enterprise rates" },
};

/** INR rate per minute for each operation and plan tier */
export const WALLET_RATES: Record<string, { standard: number; enterprise: number }> = {
  transcription: { standard: 5,  enterprise: 4  },
  subtitling:    { standard: 8,  enterprise: 6  },
  captioning:    { standard: 12, enterprise: 10 },
  dubbing:       { standard: 50, enterprise: 40 },
};

export const ACTIVE_PLANS = new Set(["solo", "partnership", "enterprise"]);

export function getRatePerMin(operation: string, planType: string): number {
  const rates = WALLET_RATES[operation] ?? { standard: 5, enterprise: 5 };
  return planType === "enterprise" ? rates.enterprise : rates.standard;
}

export function hasActivePlan(planType: string): boolean {
  return ACTIVE_PLANS.has((planType ?? "free").toLowerCase());
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

export async function getOrCreateWallet() {
  const rows = await db.select().from(walletTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [wallet] = await db.insert(walletTable).values({
    balance: "0", planType: "free", totalSpent: "0", totalJobsRun: 0, totalMinutesProcessed: "0",
  }).returning();
  return wallet;
}

/** Idempotent: returns "applied" | "duplicate" | "failed" */
async function applyPaymentOnce(
  paymentId: string,
  amountInr: number,
  plan: string,
): Promise<"applied" | "duplicate" | "failed"> {
  try {
    // Insert into dedup table — conflict = already processed
    const inserted = await db.insert(processedPaymentsTable).values({
      paymentId,
      amountInr: String(amountInr),
      plan,
    }).onConflictDoNothing().returning();

    if (inserted.length === 0) return "duplicate";

    const wallet = await getOrCreateWallet();
    const updates: Partial<typeof walletTable.$inferInsert> = {
      balance: String(Number(wallet.balance) + amountInr),
    };
    if (plan && ACTIVE_PLANS.has(plan.toLowerCase())) {
      updates.planType = plan.toLowerCase();
    }

    await db.update(walletTable).set(updates).where(eq(walletTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      type: "credit",
      amount: String(amountInr),
      description: plan
        ? `${SUBSCRIPTION_PLANS[plan.toLowerCase()]?.label ?? plan} Plan — ₹${amountInr} (Payment: ${paymentId})`
        : `Wallet top-up — ₹${amountInr} (Payment: ${paymentId})`,
      jobId: null,
    });

    return "applied";
  } catch (err) {
    console.error("[payments] applyPaymentOnce error:", err);
    return "failed";
  }
}

// ─── Lazy Razorpay plan ID resolution ────────────────────────────────────────

const planIdCache: Record<string, string> = {};

async function getOrCreateRazorpayPlan(tier: string): Promise<string> {
  // Prefer pre-created plan IDs from env vars (Render / Replit)
  const envKey = `RAZORPAY_PLAN_${tier.toUpperCase()}_ID`;
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;

  if (planIdCache[tier]) return planIdCache[tier];

  const cfg = SUBSCRIPTION_PLANS[tier];
  if (!cfg) throw new Error(`Unknown plan tier: ${tier}`);

  const rz = getRazorpay();
  const list = await rz.plans.all({ count: 100 }) as any;
  const existing = (list.items ?? []).find(
    (p: any) => p.item?.name === `DAK ${cfg.label} Plan` && p.item?.amount === cfg.priceInr * 100,
  );
  if (existing) { planIdCache[tier] = existing.id; return existing.id; }

  const plan = await rz.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `DAK ${cfg.label} Plan`,
      amount: cfg.priceInr * 100,
      currency: "INR",
      description: cfg.description,
    },
  }) as any;

  planIdCache[tier] = plan.id;
  return plan.id;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Publishable key ID — safe to expose to the frontend */
router.get("/payments/config", (_req, res): void => {
  res.json({ keyId: process.env.RAZORPAY_KEY_ID ?? "" });
});

/** Plan & rate metadata for the Billing UI */
router.get("/payments/plans", (_req, res): void => {
  res.json({ subscriptionPlans: SUBSCRIPTION_PLANS, walletRates: WALLET_RATES, topupMin: TOPUP_MIN });
});

// ── Subscription: create → redirect to Razorpay short_url ────────────────────

router.post("/payments/create-subscription", async (req, res): Promise<void> => {
  const { tier } = req.body as { tier: string };
  if (!SUBSCRIPTION_PLANS[tier]) { res.status(400).json({ error: "Unknown plan tier" }); return; }

  const planId = await getOrCreateRazorpayPlan(tier);
  const rz = getRazorpay();
  const totalCount = parseInt(process.env.RAZORPAY_SUB_TOTAL_COUNT ?? "120", 10);

  const subscription = await rz.subscriptions.create({
    plan_id:     planId,
    total_count: totalCount,
    quantity:    1,
    notes:       { tier, plan: tier },
  }) as any;

  // Return the short_url for the frontend to redirect to
  res.json({
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url ?? null,
    tier,
  });
});

// ── Wallet top-up: create payment link → redirect to short_url ───────────────

router.post("/payments/create-payment-link", async (req, res): Promise<void> => {
  const { amount } = req.body as { amount: number };
  const amountRupees = Math.floor(Number(amount));

  if (!amountRupees || amountRupees < TOPUP_MIN) {
    res.status(400).json({ error: `Minimum top-up is ₹${TOPUP_MIN}` });
    return;
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const callbackUrl = appBaseUrl ? `${appBaseUrl}/billing` : undefined;

  const rz = getRazorpay();
  const linkPayload: any = {
    amount:      amountRupees * 100,
    currency:    "INR",
    description: `DAK Transcription wallet top-up ₹${amountRupees}`,
    notes:       { topup: "true" },
  };
  if (callbackUrl) {
    linkPayload.callback_url    = callbackUrl;
    linkPayload.callback_method = "get";
  }

  const link = await rz.paymentLink.create(linkPayload) as any;

  res.json({ shortUrl: link.short_url, amount: amountRupees });
});

// ── Cancel active subscription ────────────────────────────────────────────────

router.delete("/payments/subscription", async (_req, res): Promise<void> => {
  const wallet = await getOrCreateWallet();
  if (!wallet.razorpaySubscriptionId) {
    res.status(400).json({ error: "No active subscription found" });
    return;
  }

  const rz = getRazorpay();
  await rz.subscriptions.cancel(wallet.razorpaySubscriptionId, false);

  await db.update(walletTable)
    .set({ planType: "free", razorpaySubscriptionId: null })
    .where(eq(walletTable.id, wallet.id));

  res.json({ success: true });
});

// ── Webhook: subscription.charged + payment_link.paid ────────────────────────

router.post("/payments/webhook", async (req, res): Promise<void> => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers["x-razorpay-signature"] as string;
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (expected !== signature) {
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }
  }

  const event   = req.body?.event as string;
  const payload = req.body?.payload ?? {};

  // Extract payment entity and notes
  const payment = payload?.payment?.entity ?? {};
  const plink   = payload?.payment_link?.entity ?? {};

  let notes: Record<string, string> = {};
  for (const src of [payment, plink]) {
    const n = src?.notes;
    if (n && typeof n === "object") { notes = n as Record<string, string>; break; }
  }

  if (event === "subscription.charged") {
    const amountInr = (payment?.amount ?? 0) / 100;
    const paymentId = payment?.id ?? "";
    const tier      = (payload?.subscription?.entity?.notes?.tier ?? notes?.tier ?? notes?.plan ?? "") as string;

    if (!amountInr || !paymentId) {
      res.status(500).json({ error: "Missing amount or payment ID" });
      return;
    }

    // Track subscription ID on wallet
    const subId = payload?.subscription?.entity?.id as string | undefined;
    if (subId) {
      const wallet = await getOrCreateWallet();
      await db.update(walletTable)
        .set({ razorpaySubscriptionId: subId })
        .where(eq(walletTable.id, wallet.id));
    }

    const status = await applyPaymentOnce(paymentId, amountInr, tier);
    if (status === "failed") { res.status(500).json({ error: "Payment apply failed — Razorpay will retry" }); return; }
  }

  if (event === "payment_link.paid") {
    const amountInr = (payment?.amount ?? 0) / 100;
    const paymentId = payment?.id ?? "";

    if (!amountInr || !paymentId) {
      res.status(500).json({ error: "Missing amount or payment ID" });
      return;
    }

    const status = await applyPaymentOnce(paymentId, amountInr, "");
    if (status === "failed") { res.status(500).json({ error: "Payment apply failed — Razorpay will retry" }); return; }
  }

  if (event === "subscription.cancelled" || event === "subscription.completed") {
    const subId = payload?.subscription?.entity?.id as string | undefined;
    const wallet = await getOrCreateWallet();
    if (subId && wallet.razorpaySubscriptionId === subId) {
      await db.update(walletTable)
        .set({ planType: "free", razorpaySubscriptionId: null })
        .where(eq(walletTable.id, wallet.id));
    }
  }

  res.json({ status: "ok" });
});

export default router;
