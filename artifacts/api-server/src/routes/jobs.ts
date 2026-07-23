import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import fs from "fs";
import { db, jobsTable, walletTable, transactionsTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  CreateJobBody,
  GetJobParams,
  DeleteJobParams,
  UpdateJobStatusParams,
  UpdateJobStatusBody,
} from "@workspace/api-zod";
import { uploadStore } from "../lib/uploadStore.js";
import { runTranscription } from "../services/transcribe.js";

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
    jobName: job.jobName ?? null,
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

// ─── Helpers ───────────────────────────────────────────────────────────────

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

async function deductCredits(creditsUsed: number, jobId: number, description: string) {
  const wallet = await getOrCreateWallet();
  await db.update(walletTable)
    .set({
      balance: String(Math.max(0, Number(wallet.balance) - creditsUsed)),
      totalSpent: String(Number(wallet.totalSpent) + creditsUsed),
      totalJobsRun: wallet.totalJobsRun + 1,
      totalMinutesProcessed: String(Number(wallet.totalMinutesProcessed) + creditsUsed / (RATES["transcription"] ?? 5)),
    })
    .where(eq(walletTable.id, wallet.id));
  await db.insert(transactionsTable).values({
    type: "debit",
    amount: String(creditsUsed),
    description,
    jobId,
  });
}

// ─── Real async job processor ──────────────────────────────────────────────

async function processJob(
  jobId: number,
  type: string,
  filePath: string,
  uploadId: string | null,
  sourceLanguage: string,
  inputDurationMinutes: number,
  originalFilename: string,
): Promise<void> {
  try {
    await db.update(jobsTable)
      .set({ status: "processing", progressPercent: 20 })
      .where(eq(jobsTable.id, jobId));

    const { output, durationMinutes } = await runTranscription(type, filePath, sourceLanguage);

    const actualDuration = durationMinutes > 0 ? durationMinutes : inputDurationMinutes;
    const rate = RATES[type] ?? 5;
    const creditsUsed = actualDuration * rate;

    await db.update(jobsTable)
      .set({
        status: "completed",
        progressPercent: 100,
        creditsUsed: String(creditsUsed),
        inputDurationMinutes: String(actualDuration),
        outputData: JSON.stringify(output),
        completedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await deductCredits(
      creditsUsed,
      jobId,
      `${type.charAt(0).toUpperCase() + type.slice(1)} — ${originalFilename}`,
    );
  } catch (err: any) {
    console.error(`[jobs] processJob ${jobId} failed:`, err?.message ?? err);
    await db.update(jobsTable)
      .set({
        status: "failed",
        errorMessage: err?.message ?? "Processing failed",
        completedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId))
      .catch(() => void 0);
  } finally {
    // Clean up uploaded file from disk and in-memory store
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* best-effort */ }
    if (uploadId) uploadStore.delete(uploadId);
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────

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
    ? await db.select().from(jobsTable).where(and(...conditions))
        .orderBy(desc(jobsTable.createdAt)).limit(Number(limit)).offset(Number(offset))
    : await db.select().from(jobsTable)
        .orderBy(desc(jobsTable.createdAt)).limit(Number(limit)).offset(Number(offset));

  res.json(jobs.map(formatJob));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    type, jobName, inputFilename, inputDurationMinutes,
    domain, sourceLanguage, targetLanguage, translateTo, outputFormat,
  } = parsed.data;

  // ── Credit pre-flight check ──────────────────────────────────────────────
  const rate = RATES[type] ?? 5;
  const estimatedCredits = Number(inputDurationMinutes) * rate;
  const wallet = await getOrCreateWallet();
  if (Number(wallet.balance) < estimatedCredits) {
    res.status(402).json({
      error: "Insufficient credits",
      required: estimatedCredits,
      available: Number(wallet.balance),
    });
    return;
  }

  // Resolve uploaded file from uploadId
  const uploadId = (req.body as any).uploadId as string | undefined;
  const uploadEntry = uploadId ? uploadStore.get(uploadId) : undefined;
  const filePath = uploadEntry?.filePath ?? null;
  const originalFilename = uploadEntry?.originalName ?? inputFilename;

  const [job] = await db.insert(jobsTable).values({
    type,
    jobName: jobName ?? null,
    inputFilename,
    inputFilePath: filePath,
    inputDurationMinutes: String(inputDurationMinutes),
    domain: domain ?? "general",
    sourceLanguage: sourceLanguage ?? "auto",
    targetLanguage: targetLanguage ?? null,
    translateTo: translateTo ?? null,
    outputFormat: outputFormat ?? null,
    status: "pending",
    progressPercent: 0,
  }).returning();

  res.status(201).json(formatJob(job));

  // Fire-and-forget processing
  if (filePath) {
    void processJob(
      job.id, type, filePath, uploadId ?? null,
      sourceLanguage ?? "auto", Number(inputDurationMinutes), originalFilename,
    );
  } else {
    // Fallback simulation (no file uploaded — dev/demo mode only)
    setTimeout(() => {
      void (async () => {
        try {
          await db.update(jobsTable)
            .set({ status: "processing", progressPercent: 30 })
            .where(eq(jobsTable.id, job.id));

          await new Promise(r => setTimeout(r, 6000));

          const creditsUsed = Number(inputDurationMinutes) * rate;
          await db.update(jobsTable)
            .set({ status: "completed", progressPercent: 100, creditsUsed: String(creditsUsed), completedAt: new Date() })
            .where(eq(jobsTable.id, job.id));

          await deductCredits(creditsUsed, job.id, `${type} — ${inputFilename} (simulated)`);
        } catch (err: any) {
          console.error(`[jobs] simulation ${job.id} failed:`, err?.message ?? err);
          await db.update(jobsTable)
            .set({ status: "failed", errorMessage: "Simulation failed", completedAt: new Date() })
            .where(eq(jobsTable.id, job.id))
            .catch(() => void 0);
        }
      })();
    }, 1500);
  }
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(formatJob(job));
});

// ─── Segments endpoint ─────────────────────────────────────────────────────

router.get("/jobs/:id/segments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid job id" }); return; }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "completed") { res.status(409).json({ error: "Job not completed yet" }); return; }
  if (!job.outputData) { res.status(404).json({ error: "No output data available" }); return; }

  try {
    res.json(JSON.parse(job.outputData));
  } catch {
    res.status(500).json({ error: "Failed to parse output data" });
  }
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [job] = await db.delete(jobsTable).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.sendStatus(204);
});

router.patch("/jobs/:id/status", async (req, res): Promise<void> => {
  const params = UpdateJobStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = UpdateJobStatusBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updates: Partial<typeof jobsTable.$inferInsert> = { status: body.data.status };
  if (body.data.progressPercent != null) updates.progressPercent = body.data.progressPercent;
  if (body.data.outputUrl != null) updates.outputUrl = body.data.outputUrl;
  if (body.data.creditsUsed != null) updates.creditsUsed = String(body.data.creditsUsed);
  if (body.data.errorMessage != null) updates.errorMessage = body.data.errorMessage;
  if (body.data.status === "completed" || body.data.status === "failed") updates.completedAt = new Date();

  const [job] = await db.update(jobsTable).set(updates).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(formatJob(job));
});

export default router;
