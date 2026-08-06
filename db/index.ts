import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getRuntimeEnv } from "../lib/runtime-env";

export function getDb() {
  const env = getRuntimeEnv();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the local runtime with a `DB` binding before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
