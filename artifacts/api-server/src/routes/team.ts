import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";
import {
  InviteTeamMemberBody,
  RemoveTeamMemberParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatMember(m: typeof teamMembersTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    creditsUsed: Number(m.creditsUsed),
    joinedAt: m.joinedAt.toISOString(),
  };
}

router.get("/team", async (_req, res): Promise<void> => {
  const members = await db.select().from(teamMembersTable);
  res.json(members.map(formatMember));
});

router.post("/team", async (req, res): Promise<void> => {
  const parsed = InviteTeamMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, role } = parsed.data;

  // Check for duplicate email
  const existing = await db.select().from(teamMembersTable).where(eq(teamMembersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "A team member with this email already exists" });
    return;
  }

  const [member] = await db.insert(teamMembersTable).values({
    name,
    email,
    role,
    creditsUsed: "0",
  }).returning();

  res.status(201).json(formatMember(member));
});

router.delete("/team/:id", async (req, res): Promise<void> => {
  const params = RemoveTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [member] = await db.delete(teamMembersTable)
    .where(eq(teamMembersTable.id, params.data.id))
    .returning();

  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
