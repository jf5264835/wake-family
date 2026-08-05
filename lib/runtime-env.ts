import { AsyncLocalStorage } from "node:async_hooks";

export type RuntimeEnv = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  PCO_APP_ID?: string;
  PCO_SECRET?: string;
  GOOGLE_MAPS_API_KEY?: string;
  ADMIN_EMAILS?: string;
  SELF_HOST_AUTH_EMAIL_HEADER?: string;
  SELF_HOST_AUTH_NAME_HEADER?: string;
  [key: string]: unknown;
};

const storage = new AsyncLocalStorage<RuntimeEnv>();

export function runWithRuntimeEnv<T>(env: RuntimeEnv, callback: () => T): T {
  return storage.run(env, callback);
}

export function getRuntimeEnv(): RuntimeEnv {
  return storage.getStore() ?? {};
}
