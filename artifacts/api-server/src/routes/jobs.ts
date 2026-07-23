import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, jobsTable, walletTable, transactionsTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  CreateJobBody,
  GetJobParams,
  DeleteJobParams,
  UpdateJobStatusParams,
  UpdateJobStatusBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Credit rates per minute
const RATES: Record<string, number> = {
  transcription: 5,
  subtitling: 8,
  captioning: 12,
  dubbing: 50,
};

function formatJob(job: typeof jobsTable.$inferSelect) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    inputFilename: job.inputFilename,
    inputDurationMinutes: Number(job.inputDurationMinutes),
    domain: job.domain,
    sourceLanguage: job.sourceLanguage ?? null,
    targetLanguage: job.targetLanguage ?? null,
    translateTo: job.translateTo ?? null,
    outputFormat: job.outputFormat ?? null,
    outputUrl: job.outputUrl ?? null,
    creditsUsed: job.creditsUsed != null ? Number(job.creditsUsed) : null,
    progressPercent: job.progressPercent ?? null,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
  };
}

router.get("/jobs", async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, status, limit = 50, offset = 0 } = parsed.data;

  const conditions = [];
  if (type) conditions.push(eq(jobsTable.type, type));
  if (status) conditions.push(eq(jobsTable.status, status));

  const jobs = conditions.length > 0
    ? await db.select().from(jobsTable)
        .where(and(...conditions))
        .orderBy(desc(jobsTable.createdAt))
        .limit(Number(limit))
        .offset(Number(offset))
    : await db.select().from(jobsTable)
        .orderBy(desc(jobsTable.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));

  res.json(jobs.map(formatJob));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, inputFilename, inputDurationMinutes, domain, sourceLanguage, targetLanguage, translateTo, outputFormat } = parsed.data;

  const [job] = await db.insert(jobsTable).values({
    type,
    inputFilename,
    inputDurationMinutes: String(inputDurationMinutes),
    domain: domain ?? "general",
    sourceLanguage: sourceLanguage ?? "auto",
    targetLanguage: targetLanguage ?? null,
    translateTo: translateTo ?? null,
    outputFormat: outputFormat ?? null,
    status: "pending",
    progressPercent: 0,
  }).returning();

  // Simulate async job processing
  setTimeout(() => {
    void (async () => {
      try {
        await db.update(jobsTable)
          .set({ status: "processing", progressPercent: 30 })
          .where(eq(jobsTable.id, job.id));

        // Simulate completion after ~6 seconds
        setTimeout(() => {
          void (async () => {
            try {
              const rate = RATES[type] ?? 5;
              const creditsUsed = Number(inputDurationMinutes) * rate;
              const outputUrlMap: Record<string, string> = {
                transcription: `/api/outputs/${job.id}/transcript.txt`,
                subtitling: `/api/outputs/${job.id}/subtitles.srt`,
                captioning: `/api/outputs/${job.id}/captioned.mp4`,
                dubbing: `/api/outputs/${job.id}/dubbed.mp4`,
              };

              await db.update(jobsTable)
                .set({
                  status: "completed",
                  progressPercent: 100,
                  creditsUsed: String(creditsUsed),
                  outputUrl: outputUrlMap[type] ?? null,
                  completedAt: new Date(),
                })
                .where(eq(jobsTable.id, job.id));

              // Update wallet balance
              const wallets = await db.select().from(walletTable).limit(1);
              if (wallets.length > 0) {
                const wallet = wallets[0];
                await db.update(walletTable)
                  .set({
                    balance: String(Math.max(0, Number(wallet.balance) - creditsUsed)),
                    totalSpent: String(Number(wallet.totalSpent) + creditsUsed),
                    totalJobsRun: wallet.totalJobsRun + 1,
                    totalMinutesProcessed: String(Number(wallet.totalMinutesProcessed) + Number(inputDurationMinutes)),
                  })
                  .where(eq(walletTable.id, wallet.id));
              }

              await db.insert(transactionsTable).values({
                type: "debit",
                amount: String(creditsUsed),
                description: `${type.charAt(0).toUpperCase() + type.slice(1)} — ${inputFilename}`,
                jobId: job.id,
              });
            } catch (_e) { /* silent */ }
          })();
        }, 6000);
      } catch (_e) { /* silent */ }
    })();
  }, 1500);

  res.status(201).json(formatJob(job));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(formatJob(job));
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.delete(jobsTable).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/jobs/:id/status", async (req, res): Promise<void> => {
  const params = UpdateJobStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateJobStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<typeof jobsTable.$inferInsert> = { status: body.data.status };
  if (body.data.progressPercent != null) updates.progressPercent = body.data.progressPercent;
  if (body.data.outputUrl != null) updates.outputUrl = body.data.outputUrl;
  if (body.data.creditsUsed != null) updates.creditsUsed = String(body.data.creditsUsed);
  if (body.data.errorMessage != null) updates.errorMessage = body.data.errorMessage;
  if (body.data.status === "completed" || body.data.status === "failed") {
    updates.completedAt = new Date();
  }

  const [job] = await db.update(jobsTable)
    .set(updates)
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(formatJob(job));
});

export default router;
