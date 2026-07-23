import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id:                        serial("id").primaryKey(),
  email:                     text("email").notNull().unique(),
  passwordHash:              text("password_hash").notNull(),
  emailVerified:             boolean("email_verified").notNull().default(false),
  verificationToken:         text("verification_token").unique(),
  verificationTokenExpiresAt: timestamp("verification_token_expires_at", { withTimezone: true }),
  createdAt:                 timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true, createdAt: true, passwordHash: true, emailVerified: true,
  verificationToken: true, verificationTokenExpiresAt: true,
}).extend({ password: z.string().min(8) });

export type User = typeof usersTable.$inferSelect;
