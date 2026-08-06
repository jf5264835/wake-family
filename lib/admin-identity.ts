import { headers } from "next/headers";
import { getRuntimeEnv } from "./runtime-env";

export type AdminIdentity = {
  displayName: string;
  email: string;
};

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const runtime = getRuntimeEnv();
  const emailHeader = configuredHeader(runtime.SELF_HOST_AUTH_EMAIL_HEADER);
  if (!emailHeader) return null;

  const requestHeaders = await headers();
  const email = requestHeaders.get(emailHeader)?.trim();
  if (!email) return null;

  const nameHeader = configuredHeader(runtime.SELF_HOST_AUTH_NAME_HEADER);
  const displayName = (nameHeader ? requestHeaders.get(nameHeader)?.trim() : null) || email;
  return { displayName, email };
}

function configuredHeader(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}
