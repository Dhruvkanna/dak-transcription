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
import { getRatePerMin, getOrCreateWallet } from "./payments.js";

const router: IRouter = Router();

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

// ─── Wallet helpers ────────────────────────────────────────────────────────────

/** Deduct INR from wallet atomically. Returns false if insufficient balance. */
async function deductWallet(amountInr: number, jobId: number, description: string): Promise<boolean> {
  const wallet = await getOrCreateWallet();
  const current = Number(wallet.balance);
  if (current < amountInr) return false;

  await db.update(walletTable)
    .set({
      balance:               String(current - amountInr),
      totalSpent:            String(Number(wallet.totalSpent) + amountInr),
      totalJobsRun:          wallet.totalJobsRun + 1,
      totalMinutesProcessed: String(Number(wallet.totalMinutesProcessed) + amountInr / 5), // rough minutes
    })
    .where(eq(walletTable.id, wallet.id));

  await db.insert(transactionsTable).values({
    type: "debit",
    amount: String(amountInr),
    description,
    jobId,
  });

  return true;
}

/** Refund INR back to wallet (called on job failure). */
async function refundWallet(amountInr: number, jobId: number, description: string): Promise<void> {
  if (amountInr <= 0) return;
  const wallet = await getOrCreateWallet();
  await db.update(walletTable)
    .set({ balance: String(Number(wallet.balance) + amountInr) })
    .where(eq(walletTable.id, wallet.id));
  await db.insert(transactionsTable).values({
    type: "refund",
    amount: String(amountInr),
    description,
    jobId,
  });
}

// ─── Real async job processor ──────────────────────────────────────────────────

async function processJob(
  jobId: number,
  type: string,
  filePath: string,
  uploadId: string | null,
  sourceLanguage: string,
  chargedInr: number,          // already deducted pre-flight
  originalFilename: string,
): Promise<void> {
  try {
    await db.update(jobsTable)
      .set({ status: "processing", progressPercent: 20 })
      .where(eq(jobsTable.id, jobId));

    const { output, durationMinutes } = await runTranscription(type, filePath, sourceLanguage);

    await db.update(jobsTable)
      .set({
        status: "completed",
        progressPercent: 100,
        creditsUsed: String(chargedInr),   // records the INR amount charged
        inputDurationMinutes: String(durationMinutes > 0 ? durationMinutes : 0),
        outputData: JSON.stringify(output),
        completedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

  } catch (err: any) {
    console.error(`[jobs] processJob ${jobId} failed:`, err?.message ?? err);

    await db.update(jobsTable)
      .set({ status: "failed", errorMessage: err?.message ?? "Processing failed", completedAt: new Date() })
      .where(eq(jobsTable.id, jobId))
      .catch(() => void 0);

    // Refund pre-deducted amount
    await refundWallet(
      chargedInr,
      jobId,
      `Refund — ${type} failed (${originalFilename})`,
    );
  } finally {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* best-effort */ }
    if (uploadId) uploadStore.delete(uploadId);
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────────

router.get("/jobs", async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { type, status, limit = 50, offset = 0 } = parsed.data;
  const conditions = [];
  if (type)   conditions.push(eq(jobsTable.type, type));
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
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const {
    type, jobName, inputFilename, inputDurationMinutes,
    domain, sourceLanguage, targetLanguage, translateTo, outputFormat,
  } = parsed.data;

  // ── Wallet pre-flight ──────────────────────────────────────────────────────
  const wallet = await getOrCreateWallet();

  // Check balance
  const ratePerMin = getRatePerMin(type);
  const estimatedCost = Math.round(Number(inputDurationMinutes) * ratePerMin * 100) / 100;

  if (Number(wallet.balance) < estimatedCost) {
    res.status(402).json({
      error: `Insufficient wallet balance (₹${Number(wallet.balance).toFixed(2)}). This job costs ₹${estimatedCost.toFixed(2)} (${Number(inputDurationMinutes).toFixed(1)} min × ₹${ratePerMin}/min). Please top up your wallet.`,
      code: "INSUFFICIENT_BALANCE",
      required: estimatedCost,
      available: Number(wallet.balance),
    });
    return;
  }

  // Resolve uploaded file
  const uploadId      = (req.body as any).uploadId as string | undefined;
  const uploadEntry   = uploadId ? uploadStore.get(uploadId) : undefined;
  const filePath      = uploadEntry?.filePath ?? null;
  const originalFilename = uploadEntry?.originalName ?? inputFilename;

  // Insert job
  const [job] = await db.insert(jobsTable).values({
    type,
    jobName:              jobName ?? null,
    inputFilename,
    inputFilePath:        filePath,
    inputDurationMinutes: String(inputDurationMinutes),
    domain:               domain ?? "general",
    sourceLanguage:       sourceLanguage ?? "auto",
    targetLanguage:       targetLanguage ?? null,
    translateTo:          translateTo ?? null,
    outputFormat:         outputFormat ?? null,
    status:               "pending",
    progressPercent:      0,
  }).returning();

  // Deduct wallet pre-flight (BEFORE AI runs)
  const deducted = await deductWallet(
    estimatedCost,
    job.id,
    `${type.charAt(0).toUpperCase() + type.slice(1)} — ${originalFilename}`,
  );

  if (!deducted) {
    // Race condition — another request drained the balance. Roll back job.
    await db.delete(jobsTable).where(eq(jobsTable.id, job.id)).catch(() => void 0);
    res.status(402).json({ error: "Wallet balance changed — please try again.", code: "RACE_CONDITION" });
    return;
  }

  res.status(201).json(formatJob(job));

  // Fire-and-forget
  if (filePath) {
    void processJob(job.id, type, filePath, uploadId ?? null, sourceLanguage ?? "auto", estimatedCost, originalFilename);
  } else {
    // Dev/demo fallback — no real file
    setTimeout(() => {
      void (async () => {
        try {
          await db.update(jobsTable)
            .set({ status: "processing", progressPercent: 30 })
            .where(eq(jobsTable.id, job.id));

          await new Promise(r => setTimeout(r, 6000));

          await db.update(jobsTable)
            .set({
              status: "completed",
              progressPercent: 100,
              creditsUsed: String(estimatedCost),
              completedAt: new Date(),
            })
            .where(eq(jobsTable.id, job.id));
        } catch (err: any) {
          console.error(`[jobs] simulation ${job.id} failed:`, err?.message ?? err);
          await db.update(jobsTable)
            .set({ status: "failed", errorMessage: "Simulation failed", completedAt: new Date() })
            .where(eq(jobsTable.id, job.id))
            .catch(() => void 0);
          await refundWallet(estimatedCost, job.id, `Refund — ${type} simulation failed`);
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

router.get("/jobs/:id/segments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "completed") { res.status(409).json({ error: "Job not completed yet" }); return; }
  if (!job.outputData) { res.status(404).json({ error: "No output data available" }); return; }
  try { res.json(JSON.parse(job.outputData)); }
  catch { res.status(500).json({ error: "Failed to parse output data" }); }
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
  if (body.data.outputUrl       != null) updates.outputUrl       = body.data.outputUrl;
  if (body.data.creditsUsed     != null) updates.creditsUsed     = String(body.data.creditsUsed);
  if (body.data.errorMessage    != null) updates.errorMessage    = body.data.errorMessage;
  if (body.data.status === "completed" || body.data.status === "failed") updates.completedAt = new Date();

  const [job] = await db.update(jobsTable).set(updates).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(formatJob(job));
});

export default router;
