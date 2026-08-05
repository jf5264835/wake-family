import { requireAdminApi } from "../../../../lib/admin-auth";
import { getRuntimeEnv } from "../../../../lib/runtime-env";
import { logAdminAction } from "../../../../lib/admin-audit";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

export async function POST(request: Request) {
  const auth = await requireAdminApi(request, { tab: "branding", action: "write" });
  if (auth.response || !auth.user) return auth.response!;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Use a PNG, JPEG, WebP, GIF, or SVG image." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });
  const bucket = getRuntimeEnv().BUCKET;
  if (!bucket) return Response.json({ error: "Image storage is not configured." }, { status: 503 });
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "img";
  const key = `branding/${crypto.randomUUID()}.${extension}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
  await logAdminAction(auth.user, "branding.asset_upload", "asset", key, `Uploaded branding image ${file.name}.`, { type: file.type, size: file.size });
  return Response.json({ url: `/api/assets/${encodeURIComponent(key)}`, key });
}
