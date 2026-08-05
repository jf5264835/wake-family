import { getRuntimeEnv } from "../../../../lib/runtime-env";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const objectKey = key.join("/");
  if (!objectKey.startsWith("branding/")) return new Response("Not found", { status: 404 });
  const bucket = getRuntimeEnv().BUCKET;
  if (!bucket) return new Response("Not found", { status: 404 });
  const object = await bucket.get(objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
