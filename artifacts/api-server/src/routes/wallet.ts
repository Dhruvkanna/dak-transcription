import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, walletTable, transactionsTable } from "@workspace/db";
import { ListTransactionsQueryParams } from "@workspace/api-zod";
import { getOrCreateWallet } from "./payments";

const router: IRouter = Router();

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

router.get("/wallet", async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const wallet = await getOrCreateWallet(userId);
  res.json(formatWallet(wallet));
});

router.get("/wallet/transactions", async (req, res): Promise<void> => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.auth!.userId;
  const limit = parsed.data.limit ?? 20;

  const txns = await db.select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(Number(limit));

  res.json(txns.map(formatTransaction));
});

export default router;
