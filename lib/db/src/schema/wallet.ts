import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletTable = pgTable("wallet", {
  id: serial("id").primaryKey(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  planType: text("plan_type").notNull().default("free"), // free | starter | pro | business
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  totalJobsRun: integer("total_jobs_run").notNull().default(0),
  totalMinutesProcessed: numeric("total_minutes_processed", { precision: 12, scale: 2 }).notNull().default("0"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),   // active Razorpay subscription ID
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // credit | debit
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  jobId: integer("job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
