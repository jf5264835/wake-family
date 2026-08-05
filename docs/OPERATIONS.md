# Operations, backup, and recovery

## Backup priorities

1. Database/runtime state containing registrations, forms, settings, identities, audit logs, and PCO retry state.
2. Object storage containing uploaded branding assets.
3. Runtime secrets from the secret manager or deployment environment.

For the included Docker deployment, back up the complete `/data` volume while the app is stopped or using a storage-consistent snapshot. Keep at least one copy off-host.

## Restore test

Periodically restore a backup into an isolated instance, start the application, and verify:

- branding and custom forms load;
- recent transaction history is present;
- audit history is readable by an administrator;
- uploaded branding assets render;
- a deliberately non-production test transaction can progress through the expected workflow.

## Planning Center outage

Do not stop kiosk registration solely because PCO is unavailable. The intended behavior is local save first, followed by a retryable integration failure or waiting state. Confirm the local transaction exists before manually recreating anything in PCO.

## Logs and sensitive data

Registration and external-error logs can contain personal data. Restrict admin and backup access accordingly. Do not ship `.env`, database volumes, runtime logs, transaction exports, or PCO responses into Git.

## Upgrade checklist

- Back up persistent data.
- Review migrations.
- Run lint/tests on the target source revision.
- Deploy/restart.
- Confirm the public form loads and an authorized administrator can read transactions.
- Check the latest audit and transaction log entries for unexpected failures.
