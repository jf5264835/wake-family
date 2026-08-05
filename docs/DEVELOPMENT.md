# Development

## Toolchain

- Node.js 22.13+
- npm using the committed `package-lock.json`
- React 19 / Next.js App Router source compiled by Vinext
- Drizzle ORM with SQLite/D1 schema

## Common commands

```bash
npm ci
npm run dev
npm run lint
npm test
npm run db:generate
```

## Source ownership

- UI behavior belongs in `app/`.
- Business/integration rules belong in `lib/` so route handlers stay thin.
- Schema is defined once in `db/schema.ts`.
- Wake defaults live in `lib/defaults.ts`; saved server settings can override them.
- Do not hard-code PCO object IDs, API credentials, admin emails, kiosk addresses, or deployment secrets.

## Change discipline

For registration changes, test both client feedback and server rejection. Server-side rules are authoritative. Preserve the generic DOB message shown to registrants; detailed age logic should not leak through kiosk validation text.

For PCO changes, preserve save-first semantics and idempotent progress tracking. A retry must not casually create a second household/person after a partial external success.

For admin changes, enforce permissions in the route handler even if the UI hides a control. UI permissions are not a security boundary.

## Git hygiene

Commit source, migrations, small static brand assets, docs, and lockfiles. Do not commit `node_modules`, `dist`, `.env`, local database/runtime state, logs, coverage, or generated deployment caches. GitHub accepts the checked-in PNG/SVG brand assets; they are small runtime source assets, not build products.
