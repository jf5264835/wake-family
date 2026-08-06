# Authentication and authorization

Authentication answers who the administrator is. Authorization answers what that identity may do. They are separate in this application.

## SAML identity

The application can trust an identity header only when `SELF_HOST_AUTH_EMAIL_HEADER` is explicitly configured. This is designed for an authenticating reverse proxy. Do not expose the application origin directly while using this mode because a client that can reach the origin could forge the header.

## Authorization model

- Users hold identity, status, auth-source metadata, and group membership.
- Groups hold read/write permissions by admin tab.
- Administrator groups bypass tab permissions and form editing restrictions.
- Custom forms can be owner-only, shared to selected users/groups, or editable by anyone with Forms write permission.
- Administrator actions are recorded in the audit log with actor identity, target, timestamp, action, and detail.

## Local/SAML settings

The schema and UI model local, SAML, and dual-source accounts plus SAML group keys. Those settings are policy metadata today. They do not implement password verification, SAML requests, assertions, ACS endpoints, session issuance, or IdP metadata handling.

Use standards-based SAML middleware at the server boundary and map immutable IdP identifiers/groups into the existing user/group model. When direct local auth is implemented, use a memory-hard password hash, secure session cookies, CSRF protection, login rate limiting, session revocation, and password reset/rotation flows.
