import { Router, type IRouter } from "express";
import { desc, count, sum, sql } from "drizzle-orm";
import { db, jobsTable, walletTable } from "@workspace/db";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function formatJob(job: typeof jobsTable.$inferSelect) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    inputFilename: job.inputFilename,
    inputDurationMinutes: Number(job.inputDurationMinutes),
    domain: job.domain,
    targetLanguage: job.targetLanguage ?? null,
    outputFormat: job.outputFormat ?? null,
    outputUrl: job.outputUrl ?? null,
    creditsUsed: job.creditsUsed != null ? Number(job.creditsUsed) : null,
    progressPercent: job.progressPercent ?? null,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
  };
}

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  // Single aggregate query — no full table scan
  const [agg] = await db.select({
    totalJobs:             count(),
    completedJobs:         count(sql`CASE WHEN status = 'completed'                               THEN 1 END`),
    failedJobs:            count(sql`CASE WHEN status = 'failed'                                  THEN 1 END`),
    processingJobs:        count(sql`CASE WHEN status IN ('processing', 'pending')                THEN 1 END`),
    totalMinutesProcessed: sum(sql`CASE WHEN status = 'completed' THEN input_duration_minutes::numeric ELSE 0 END`),
    totalCreditsSpent:     sum(sql`CASE WHEN credits_used IS NOT NULL THEN credits_used::numeric  ELSE 0 END`),
    transcriptionCount:    count(sql`CASE WHEN type = 'transcription' THEN 1 END`),
    subtitlingCount:       count(sql`CASE WHEN type = 'subtitling'    THEN 1 END`),
    captioningCount:       count(sql`CASE WHEN type = 'captioning'    THEN 1 END`),
    dubbingCount:          count(sql`CASE WHEN type = 'dubbing'       THEN 1 END`),
  }).from(jobsTable);

  const [walletRow] = await db.select({ balance: walletTable.balance }).from(walletTable).limit(1);
  const creditBalance = walletRow ? Number(walletRow.balance) : 0;

  res.json({
    totalJobs:             Number(agg.totalJobs),
    completedJobs:         Number(agg.completedJobs),
    failedJobs:            Number(agg.failedJobs),
    processingJobs:        Number(agg.processingJobs),
    totalMinutesProcessed: Number(agg.totalMinutesProcessed ?? 0),
    creditBalance,
    totalCreditsSpent:     Number(agg.totalCreditsSpent ?? 0),
    jobsByType: {
      transcription: Number(agg.transcriptionCount),
      subtitling:    Number(agg.subtitlingCount),
      captioning:    Number(agg.captioningCount),
      dubbing:       Number(agg.dubbingCount),
    },
  });
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const parsed = GetRecentActivityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit ?? 10;
  const jobs = await db.select()
    .from(jobsTable)
    .orderBy(desc(jobsTable.createdAt))
    .limit(Number(limit));

  res.json(jobs.map(formatJob));
});

export default router;
