import { getRuntimeEnv } from "./runtime-env";

export async function checkRateLimit(request: Request, namespace: string, limit: number, windowSeconds: number) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const hash = Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, "0")).join("");
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const key = `${namespace}:${hash}:${bucket}`;
  const db = getRuntimeEnv().DB;
  if (!db) return true;
  await db.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now).run();
  await db.prepare(
    "INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1",
  ).bind(key, (bucket + 1) * windowSeconds).run();
  const row = await db.prepare("SELECT count FROM rate_limits WHERE key = ?").bind(key).first<{ count: number }>();
  return (row?.count ?? 0) <= limit;
}

export function checkRegistrationRateLimit(request: Request) {
  return checkRateLimit(request, "registration", 15, 10 * 60);
}
