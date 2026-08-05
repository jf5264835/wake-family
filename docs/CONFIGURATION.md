# Branding and form configuration

## Central configuration

Branding, registration labels/mappings, and custom form definitions are stored server-side. A change in the admin portal therefore applies to every kiosk/browser the next time it loads current configuration. No kiosk-by-kiosk branding setup is required.

An unfinished browser draft may remain device-local so a page refresh does not necessarily destroy in-progress entry. That draft is not the authoritative saved registration.

## Branding defaults

Wake defaults live in `lib/defaults.ts` and are the source-code baseline for a fresh database. Saved branding in `site_settings` overrides those defaults. The current baseline uses the Wake cream/ink/charcoal/deep-green palette, square UI treatment, Wake logo assets, and the editorial typography hierarchy established during design review.

Keep logo files small and web-safe. PNG, JPEG, WebP, GIF, and SVG uploads are supported up to the server-side size limit. Uploaded assets live in object storage rather than Git; only the built-in default brand marks are checked into `public/`.

## Built-in family registration

The Registration Form admin tab owns user-visible built-in field labels plus Planning Center mappings for child allergy/special-needs values and their detail text. A blank mapping means the value remains in the local transaction but is not written to a PCO custom field.

Validation behavior lives in source because it is part of the data contract, not merely display configuration. DOB validation intentionally returns the generic user-facing message `Please verify date of birth.` rather than explaining age-rule internals.

## Custom forms

Custom forms store field order, field type, required state, validation settings, PCO destination mapping, publish state, owner, and edit-sharing policy. The form builder can load current PCO catalog values when credentials are configured.

Changing a form definition affects future loads/submissions. Treat field ID and mapping changes carefully when historical responses must remain interpretable.
