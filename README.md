# Wake Church Family Registration

Wake Church's family registration and configurable form application. The public flow is designed for Sunday kiosks as well as phones, tablets, and desktop browsers. Administrative tools manage transactions, retry Planning Center submissions, configure branding and built-in registration fields, create custom forms, manage access groups, and inspect audit history.

The repository supports two deployment paths from the same source:

- ChatGPT Sites, using the checked-in `.openai/hosting.json` D1/R2 bindings.
- Self-hosted Linux/Docker, using the local Workers-compatible runtime and a persistent `/data` volume.

## What is implemented

- Parent, child, guardian, household, DOB, contact, allergy, and special-needs registration data.
- Client and server normalization/validation, including loose street-address validation.
- Save-first transaction semantics: data is persisted before duplicate lookup or Planning Center writes.
- Planning Center duplicate search, household/person creation, retry state, and guarded resubmission.
- Explicit PCO mapping for child allergy/special-needs values and custom form fields.
- Google Places address suggestions when configured.
- Central server-side branding, form definitions, field labels, mappings, users/groups, and transactions.
- Admin audit log and group-based tab permissions.
- Central branding assets through object storage.

## Quick start for development

Requirements: Node.js 22.13+ and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

The project uses Cloudflare-compatible D1 and R2 bindings. Local development state is disposable unless a persistent runtime path is configured. Never commit `.env` or local runtime state.

## Self-host with Docker

1. Copy `.env.example` to `.env` and set the values you use.
2. Put the app behind an HTTPS reverse proxy that authenticates `/admin` and `/api/admin/*` and injects the configured trusted identity header. Do not expose the origin port to untrusted networks when trusted-header auth is enabled.
3. Start the application:

```bash
docker compose up -d --build
```

The compose file binds the application only to `127.0.0.1:3000` by default and keeps database/object data in the `wake-family-data` Docker volume. Database migrations run automatically before the application starts.

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for the production checklist, reverse-proxy boundary, backups, upgrades, and recovery.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `PCO_APP_ID` | For PCO sync | Planning Center Personal Access Token application ID. |
| `PCO_SECRET` | For PCO sync | Planning Center Personal Access Token secret. |
| `GOOGLE_MAPS_API_KEY` | No | Google Places address autocomplete. Manual addresses remain available without it. |
| `ADMIN_EMAILS` | Bootstrap access | Comma-separated identities that bypass group permissions as server administrators. |
| `SELF_HOST_AUTH_EMAIL_HEADER` | Self-hosted admin | Header name supplied by a trusted authenticating reverse proxy. |
| `SELF_HOST_AUTH_NAME_HEADER` | No | Optional trusted display-name header. |
| `SELFHOST_DATA_DIR` | Self-hosted | Persistent local runtime directory. Defaults to `/data`. |
| `PORT` | No | Self-hosted listen port. Defaults to `3000`. |

Secrets belong in the runtime environment, not in Git.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/` | Public registration UI, admin UI, custom forms, and route handlers. |
| `lib/` | Validation, normalization, authorization, audit, PCO, and registration workflow logic. |
| `db/` | Drizzle schema and database binding. |
| `drizzle/` | Ordered SQL migrations. Commit every migration. |
| `public/` | Git-safe static assets, including Wake brand marks. |
| `worker/` | Workers/Sites runtime entry. |
| `tests/` | Automated tests. |
| `docs/` | Architecture, operations, security, PCO, and contributor documentation. |

## Before a production change

```bash
npm run lint
npm test
```

When the data model changes, update `db/schema.ts`, generate a migration with `npm run db:generate`, inspect the SQL, and commit both the schema change and migration.

## Important authentication status

The hosted deployment authenticates administrators at the hosting boundary. The self-hosted build can consume identity from a trusted reverse proxy through `SELF_HOST_AUTH_EMAIL_HEADER`. The database already models local and SAML account sources and group mappings, but application-owned password login and direct SAML protocol handling are not implemented yet. Do not treat those two admin toggles as an authentication provider by themselves. See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Self-hosting](docs/SELF_HOSTING.md)
- [Authentication and authorization](docs/AUTHENTICATION.md)
- [Planning Center integration](docs/PLANNING_CENTER.md)
- [Data and transaction lifecycle](docs/DATA_MODEL.md)
- [Operations and backups](docs/OPERATIONS.md)
- [Development and contribution](docs/DEVELOPMENT.md)
- [Branding and form configuration](docs/CONFIGURATION.md)
- [Security notes](SECURITY.md)
