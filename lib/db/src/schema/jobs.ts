import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // transcription | subtitling | captioning | dubbing
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  inputFilename: text("input_filename").notNull(),
  inputDurationMinutes: numeric("input_duration_minutes", { precision: 10, scale: 2 }).notNull(),
  domain: text("domain").notNull().default("general"), // general | legal | medical | business
  targetLanguage: text("target_language"),
  outputFormat: text("output_format"),
  outputUrl: text("output_url"),
  creditsUsed: numeric("credits_used", { precision: 10, scale: 2 }),
  progressPercent: integer("progress_percent"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
