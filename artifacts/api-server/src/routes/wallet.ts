import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, walletTable, transactionsTable } from "@workspace/db";
import {
  TopUpWalletBody,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrCreateWallet() {
  const wallets = await db.select().from(walletTable).limit(1);
  if (wallets.length > 0) return wallets[0];

  const [wallet] = await db.insert(walletTable).values({
    balance: "500",
    planType: "pro",
    totalSpent: "0",
    totalJobsRun: 0,
    totalMinutesProcessed: "0",
  }).returning();
  return wallet;
}

function formatWallet(w: typeof walletTable.$inferSelect) {
  return {
    balance: Number(w.balance),
    planType: w.planType,
    totalSpent: Number(w.totalSpent),
    totalJobsRun: w.totalJobsRun,
    totalMinutesProcessed: Number(w.totalMinutesProcessed),
  };
}

function formatTransaction(t: typeof transactionsTable.$inferSelect) {
  return {
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    description: t.description,
    jobId: t.jobId ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/wallet", async (_req, res): Promise<void> => {
  const wallet = await getOrCreateWallet();
  res.json(formatWallet(wallet));
});

router.get("/wallet/transactions", async (req, res): Promise<void> => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit ?? 20;
  const txns = await db.select()
    .from(transactionsTable)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(Number(limit));

  res.json(txns.map(formatTransaction));
});

router.post("/wallet/topup", async (req, res): Promise<void> => {
  const parsed = TopUpWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount } = parsed.data;
  if (amount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
  }

  const wallet = await getOrCreateWallet();
  const { eq } = await import("drizzle-orm");

  const [updated] = await db.update(walletTable)
    .set({ balance: String(Number(wallet.balance) + amount) })
    .where(eq(walletTable.id, wallet.id))
    .returning();

  await db.insert(transactionsTable).values({
    type: "credit",
    amount: String(amount),
    description: `Wallet top-up — Rs. ${amount}`,
    jobId: null,
  });

  res.json(formatWallet(updated));
});

export default router;
