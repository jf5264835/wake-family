import { desc, like, or } from "drizzle-orm";
import { getDb } from "../db";
import { adminAuditLogs } from "../db/schema";

export type AuditActor = { email: string; displayName?: string; name?: string };

export async function logAdminAction(actor: AuditActor, action: string, targetType: string, targetId: string | null, summary: string, details?: unknown) {
  await getDb().insert(adminAuditLogs).values({
    actorEmail: actor.email,
    actorName: actor.displayName || actor.name || actor.email,
    action,
    targetType,
    targetId,
    summary,
    details: details === undefined ? null : JSON.stringify(details),
  });
}

export async function listAdminAudit(search = "") {
  const query = search.trim();
  return getDb().select().from(adminAuditLogs)
    .where(query ? or(like(adminAuditLogs.actorEmail, `%${query}%`), like(adminAuditLogs.summary, `%${query}%`), like(adminAuditLogs.targetId, `%${query}%`)) : undefined)
    .orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id)).limit(300);
}
