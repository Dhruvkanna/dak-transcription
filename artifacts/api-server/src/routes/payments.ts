import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import Razorpay from "razorpay";
import { db, walletTable, transactionsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Plan & Pack definitions ──────────────────────────────────────────────────

export const SUBSCRIPTION_PLANS: Record<string, {
  label: string; priceInPaise: number; credits: number; description: string;
}> = {
  starter:  { label: "Starter",  priceInPaise:  99900, credits:  2_000, description: "Perfect for individuals & freelancers" },
  pro:      { label: "Pro",      priceInPaise: 249900, credits:  6_000, description: "For growing studios & agencies" },
  business: { label: "Business", priceInPaise: 599900, credits: 18_000, description: "Unlimited scale for large teams" },
};

export const CREDIT_PACKS: Record<string, {
  label: string; priceInPaise: number; credits: number;
}> = {
  mini:     { label: "Mini",     priceInPaise:  49900, credits:    600 },
  standard: { label: "Standard", priceInPaise:  99900, credits:  1_400 },
  value:    { label: "Value",    priceInPaise: 249900, credits:  4_000 },
  pro_pack: { label: "Pro",      priceInPaise: 499900, credits:  9_000 },
};

// ─── Razorpay client ──────────────────────────────────────────────────────────

function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// ─── Wallet helper ────────────────────────────────────────────────────────────

async function getOrCreateWallet() {
  const rows = await db.select().from(walletTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [wallet] = await db.insert(walletTable).values({
    balance: "0", planType: "free", totalSpent: "0", totalJobsRun: 0, totalMinutesProcessed: "0",
  }).returning();
  return wallet;
}

// ─── Lazy Razorpay plan ID cache (one plan per tier, created on demand) ───────

const planIdCache: Record<string, string> = {};

async function getOrCreateRazorpayPlan(tier: string): Promise<string> {
  if (planIdCache[tier]) return planIdCache[tier];

  const cfg = SUBSCRIPTION_PLANS[tier];
  if (!cfg) throw new Error(`Unknown plan tier: ${tier}`);

  const rz = getRazorpay();
  // Search for existing plan by name (idempotent across restarts)
  const list = await rz.plans.all({ count: 100 }) as any;
  const existing = (list.items ?? []).find(
    (p: any) => p.item?.name === `DAK ${cfg.label} Plan` && p.item?.amount === cfg.priceInPaise,
  );

  if (existing) {
    planIdCache[tier] = existing.id;
    return existing.id;
  }

  const plan = await rz.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `DAK ${cfg.label} Plan`,
      amount: cfg.priceInPaise,
      currency: "INR",
      description: cfg.description,
    },
  }) as any;

  planIdCache[tier] = plan.id;
  return plan.id;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Expose publishable key ID to the frontend safely */
router.get("/payments/config", (_req, res): void => {
  res.json({ keyId: process.env.RAZORPAY_KEY_ID ?? "" });
});

/** Expose plan & pack metadata */
router.get("/payments/plans", (_req, res): void => {
  res.json({ subscriptionPlans: SUBSCRIPTION_PLANS, creditPacks: CREDIT_PACKS });
});

// ── Credit pack: create Razorpay order ───────────────────────────────────────

router.post("/payments/create-order", async (req, res): Promise<void> => {
  const { packId } = req.body as { packId: string };
  const pack = CREDIT_PACKS[packId];
  if (!pack) { res.status(400).json({ error: "Unknown pack" }); return; }

  const rz = getRazorpay();
  const order = await rz.orders.create({
    amount:   pack.priceInPaise,
    currency: "INR",
    notes:    { packId, credits: String(pack.credits) },
  }) as any;

  res.json({ orderId: order.id, amount: pack.priceInPaise, currency: "INR", pack });
});

// ── Credit pack: verify payment & credit wallet ───────────────────────────────

router.post("/payments/verify-payment", async (req, res): Promise<void> => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packId } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    packId: string;
  };

  const pack = CREDIT_PACKS[packId];
  if (!pack) { res.status(400).json({ error: "Unknown pack" }); return; }

  // Verify HMAC signature
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    res.status(400).json({ error: "Payment signature verification failed" });
    return;
  }

  // Credit the wallet
  const wallet = await getOrCreateWallet();
  const amountInRupees = pack.priceInPaise / 100;

  const [updated] = await db.update(walletTable)
    .set({ balance: String(Number(wallet.balance) + pack.credits) })
    .where(eq(walletTable.id, wallet.id))
    .returning();

  await db.insert(transactionsTable).values({
    type: "credit",
    amount: String(pack.credits),
    description: `${pack.label} Pack — ₹${amountInRupees} · ${pack.credits} credits (Payment ID: ${razorpay_payment_id})`,
    jobId: null,
  });

  res.json({ success: true, creditsAdded: pack.credits, newBalance: Number(updated.balance) });
});

// ── Subscription: create Razorpay subscription ───────────────────────────────

router.post("/payments/create-subscription", async (req, res): Promise<void> => {
  const { tier } = req.body as { tier: string };
  if (!SUBSCRIPTION_PLANS[tier]) { res.status(400).json({ error: "Unknown plan tier" }); return; }

  const planId = await getOrCreateRazorpayPlan(tier);
  const rz = getRazorpay();

  const subscription = await rz.subscriptions.create({
    plan_id:        planId,
    total_count:    120, // 10 years max; Razorpay requires this
    quantity:       1,
    notes:          { tier },
  }) as any;

  res.json({ subscriptionId: subscription.id, tier });
});

// ── Subscription: verify first payment & activate plan ───────────────────────

router.post("/payments/verify-subscription", async (req, res): Promise<void> => {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, tier } = req.body as {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
    tier: string;
  };

  const plan = SUBSCRIPTION_PLANS[tier];
  if (!plan) { res.status(400).json({ error: "Unknown plan tier" }); return; }

  // Verify HMAC signature (subscription variant)
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    res.status(400).json({ error: "Subscription signature verification failed" });
    return;
  }

  // Activate plan & add first month's credits
  const wallet = await getOrCreateWallet();

  const [updated] = await db.update(walletTable)
    .set({
      planType: tier,
      razorpaySubscriptionId: razorpay_subscription_id,
      balance: String(Number(wallet.balance) + plan.credits),
    })
    .where(eq(walletTable.id, wallet.id))
    .returning();

  await db.insert(transactionsTable).values({
    type: "credit",
    amount: String(plan.credits),
    description: `${plan.label} Plan activated — ${plan.credits} credits/month`,
    jobId: null,
  });

  res.json({ success: true, plan: tier, creditsAdded: plan.credits, newBalance: Number(updated.balance) });
});

// ── Subscription: cancel ──────────────────────────────────────────────────────

router.delete("/payments/subscription", async (_req, res): Promise<void> => {
  const wallet = await getOrCreateWallet();
  if (!wallet.razorpaySubscriptionId) {
    res.status(400).json({ error: "No active subscription" });
    return;
  }

  const rz = getRazorpay();
  await rz.subscriptions.cancel(wallet.razorpaySubscriptionId, false);

  await db.update(walletTable)
    .set({ planType: "free", razorpaySubscriptionId: null })
    .where(eq(walletTable.id, wallet.id));

  res.json({ success: true });
});

// ── Webhook: handle subscription renewals ─────────────────────────────────────

router.post("/payments/webhook", async (req, res): Promise<void> => {
  // Verify webhook signature if secret is configured
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers["x-razorpay-signature"] as string;
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (expected !== signature) {
      res.status(400).json({ error: "Invalid webhook signature" }); return;
    }
  }

  const event = req.body?.event as string;
  const payload = req.body?.payload;

  if (event === "subscription.charged") {
    const subscriptionId: string = payload?.subscription?.entity?.id;
    const tier: string = payload?.subscription?.entity?.notes?.tier;
    const plan = SUBSCRIPTION_PLANS[tier];

    if (plan && subscriptionId) {
      const wallet = await getOrCreateWallet();
      await db.update(walletTable)
        .set({ balance: String(Number(wallet.balance) + plan.credits) })
        .where(eq(walletTable.id, wallet.id));

      await db.insert(transactionsTable).values({
        type: "credit",
        amount: String(plan.credits),
        description: `${plan.label} Plan renewal — ${plan.credits} credits`,
        jobId: null,
      });
    }
  }

  if (event === "subscription.cancelled" || event === "subscription.completed") {
    const subscriptionId: string = payload?.subscription?.entity?.id;
    const wallet = await getOrCreateWallet();
    if (wallet.razorpaySubscriptionId === subscriptionId) {
      await db.update(walletTable)
        .set({ planType: "free", razorpaySubscriptionId: null })
        .where(eq(walletTable.id, wallet.id));
    }
  }

  res.json({ received: true });
});

export default router;
