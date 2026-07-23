import { Router, type IRouter } from "express";
import { desc, eq, count, sum } from "drizzle-orm";
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
  const allJobs = await db.select().from(jobsTable);

  const totalJobs = allJobs.length;
  const completedJobs = allJobs.filter(j => j.status === "completed").length;
  const failedJobs = allJobs.filter(j => j.status === "failed").length;
  const processingJobs = allJobs.filter(j => j.status === "processing" || j.status === "pending").length;

  const totalMinutesProcessed = allJobs
    .filter(j => j.status === "completed")
    .reduce((acc, j) => acc + Number(j.inputDurationMinutes), 0);

  const totalCreditsSpent = allJobs
    .filter(j => j.creditsUsed != null)
    .reduce((acc, j) => acc + Number(j.creditsUsed), 0);

  const jobsByType = {
    transcription: allJobs.filter(j => j.type === "transcription").length,
    subtitling: allJobs.filter(j => j.type === "subtitling").length,
    captioning: allJobs.filter(j => j.type === "captioning").length,
    dubbing: allJobs.filter(j => j.type === "dubbing").length,
  };

  const wallets = await db.select().from(walletTable).limit(1);
  const creditBalance = wallets.length > 0 ? Number(wallets[0].balance) : 0;

  res.json({
    totalJobs,
    completedJobs,
    failedJobs,
    processingJobs,
    totalMinutesProcessed,
    creditBalance,
    totalCreditsSpent,
    jobsByType,
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
