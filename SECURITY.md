# Security

This application handles names, dates of birth, household addresses, phone numbers, email addresses, child allergy/special-needs information, and external-system identifiers. Treat its database, logs, and backups as sensitive.

## Production requirements

- HTTPS for all non-local traffic.
- Server-only PCO and Google API credentials.
- Authenticated and authorized `/admin` plus `/api/admin/*` routes.
- No direct public access to a self-hosted origin that trusts proxy identity headers.
- Restricted backup access and tested restore procedures.
- Current dependencies and prompt handling of security updates.

## Reporting and review

Before exposing a self-hosted instance publicly, review the reverse-proxy identity configuration, CORS/origin behavior, rate limits, upload restrictions, and secret management. The included trusted-header bridge assumes the proxy strips client-supplied identity headers and injects its own only after successful authentication.

## Known gap

Direct application-owned local-password authentication and direct SAML protocol handling are not implemented. The admin data model has placeholders/policy settings for them, but production must use the hosted identity boundary or a trusted self-hosted authentication proxy until those providers are implemented and reviewed.
