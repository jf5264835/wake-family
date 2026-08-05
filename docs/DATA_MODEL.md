# Data model and transaction lifecycle

## Core tables

| Table | Purpose |
| --- | --- |
| `registrations` | Raw and normalized submissions, status, PCO linkage, retry/integration state, and last error. |
| `registration_logs` | Detailed per-registration workflow/debug history. |
| `site_settings` | Server-side branding, form, and auth policy configuration. |
| `forms` | Custom form definitions, publish state, ownership, and edit-sharing policy. |
| `admin_users` | Administrative identities and auth-source metadata. |
| `admin_groups` | Group permissions, admin flag, and SAML group mapping key. |
| `admin_group_members` | User-to-group membership. |
| `admin_audit_logs` | Attributed administrative actions. |
| `rate_limits` | Short-lived public request counters. |

## Registration status lifecycle

Important statuses include `saved`, `pending_configuration`, `checking_duplicates`, `awaiting_duplicate_confirmation`, `assistance_required`, `syncing`, `synced`, `failed`, `review_required`, and `edited`.

The durable local record is authoritative for whether the kiosk may show a success outcome. A Planning Center failure does not discard the family submission. The admin portal exposes repair/retry state separately.

## Raw versus normalized payload

Both are retained. `raw_payload` preserves submitted values for diagnostic/history purposes. `normalized_payload` is the canonical value set used by downstream integration. Name/address/contact normalization and validation live in `lib/normalize.ts` and must run server-side.

## Schema changes

Change `db/schema.ts`, run `npm run db:generate`, inspect generated SQL, then commit both schema and migration. Never edit a migration that has already been applied in production; add a new migration instead.
