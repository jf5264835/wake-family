# Architecture

## System shape

The application is a React 19 / Next.js App Router application built with Vinext. HTTP route handlers and server-rendered pages share one application bundle. Durable relational state uses a SQLite-compatible D1 API through Drizzle ORM. Uploaded branding assets use an R2-compatible object bucket.

The same source is packaged for ChatGPT Sites and for the local Workers-compatible self-host runtime.

## Trust boundaries

1. Public clients can read public branding/form configuration and submit registrations.
2. Public submission handlers validate and normalize data again on the server. Client validation is convenience only.
3. A registration is written to the local database before any Planning Center request.
4. Planning Center and Google API credentials exist only in server runtime variables.
5. Admin routes require authenticated identity plus server-side authorization.
6. Branding uploads are written to object storage; only generated object keys are returned to clients.

## Primary modules

- `lib/normalize.ts`: canonicalization and family-specific validation.
- `lib/registration-service.ts`: transaction state machine and retry handling.
- `lib/pco.ts`: Planning Center API transport, duplicate search, and writes.
- `lib/admin-auth.ts`: admin identity-to-group authorization.
- `lib/form-access.ts`: custom-form ownership/sharing rules.
- `lib/admin-audit.ts`: administrative audit events.
- `lib/family-form-settings.ts`: built-in form labels and mapping configuration.
- `lib/defaults.ts`: Wake brand and form defaults.

## Deployment adapters

`worker/index.ts` captures runtime bindings and makes them request-local with `AsyncLocalStorage`. Application modules obtain bindings through `lib/runtime-env.ts`; they do not load secrets directly from the browser or public configuration.

The Sites manifest remains checked in because it is part of the hosted deployment. `wrangler.selfhost.jsonc` is separate and contains no credentials. It declares only local binding names and non-secret runtime shape.

## Configuration storage

Branding, built-in registration settings, custom forms, transactions, users, groups, and audit events are server-side. Kiosks fetch current configuration when they load. A kiosk therefore does not need per-device branding configuration. Device-local state should remain limited to an unfinished form draft or similarly transient UI state.
