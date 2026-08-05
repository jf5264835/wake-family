# Self-hosting

## Supported shape

The included Docker path runs the built Worker locally and persists the D1/R2-compatible state under `/data`. It does not require a Cloudflare account for runtime state. Keep `/data` on durable storage.

The public kiosk routes can be internet- or LAN-facing. Admin routes must sit behind an authentication boundary.

## First deployment

```bash
cp .env.example .env
docker compose up -d --build
```

The compose file exposes the origin only on `127.0.0.1:3000`. Put Caddy, nginx, Traefik, or another reverse proxy in front of it for HTTPS.

Before using the admin portal, configure the proxy so requests to `/admin` and `/api/admin/` require authentication and inject a stable identity, for example `x-wake-auth-email`. Then set:

```dotenv
SELF_HOST_AUTH_EMAIL_HEADER=x-wake-auth-email
SELF_HOST_AUTH_NAME_HEADER=x-wake-auth-name
ADMIN_EMAILS=admin@example.org
```

The proxy-provided identity and an `ADMIN_EMAILS` bootstrap identity must match. Never accept the trusted identity header directly from the public internet. Strip any incoming copy and set it only after successful proxy authentication.

## Data

The single `/data` volume contains local structured database state, object storage state, and runtime metadata. The exact internal file layout is an implementation detail of the local Workers runtime. Back up the whole volume consistently rather than selecting individual internal files.

## Upgrades

1. Back up `/data`.
2. Pull/build the new source version.
3. Review new files under `drizzle/`.
4. Rebuild and restart the container.

The entrypoint applies unapplied migrations before starting the HTTP listener. A migration failure stops startup instead of running new application code against an old schema.

## Reverse proxy requirements

- TLS for any non-local deployment.
- Preserve `Host`, scheme, and client IP forwarding headers.
- Do not cache `/api/*` responses.
- Set a practical body limit at least 6 MB because branding uploads allow files up to 5 MB.
- Rate-limit the public registration endpoints at the edge in addition to the application limiter when the site is internet-facing.
- Protect `/admin` and `/api/admin/*` consistently. Protecting only the page is insufficient.

## Known auth boundary

The current self-host path delegates the actual authentication challenge to the reverse proxy and consumes a trusted identity header. Direct application-owned password login and direct Google/SAML protocol handling are intentionally not claimed as implemented. The Users & Groups model is already structured around local/SAML sources so those providers can be added without changing transaction or form ownership data.
