import type { AdminAccessUser } from "./admin-auth";

type ShareableForm = { createdBy: string; editPolicy: string; sharedUserIds: string; sharedGroupIds: string };

function ids(value: string) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
}

export function canEditForm(user: AdminAccessUser, form: ShareableForm) {
  if (user.isAdmin) return true;
  if (!user.permissions.forms.write) return false;
  if (form.createdBy === user.id || form.createdBy.toLowerCase() === user.email.toLowerCase()) return true;
  if (form.editPolicy === "all") return true;
  if (form.editPolicy !== "shared") return false;
  return ids(form.sharedUserIds).includes(user.id) || ids(form.sharedGroupIds).some((id) => user.groupIds.includes(id));
}
