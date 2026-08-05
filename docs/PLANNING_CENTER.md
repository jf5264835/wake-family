# Planning Center integration

## Credentials

Set `PCO_APP_ID` and `PCO_SECRET` only in the server runtime. The browser never receives them. Without credentials, registrations still save locally and remain in a waiting-for-configuration state.

## Family registration flow

1. Validate and normalize the submitted family.
2. Save the complete local transaction.
3. Search Planning Center separately by primary-parent email and phone.
4. Collapse results that identify the same PCO person.
5. If possible duplicates exist, return only the masked match view needed by the kiosk.
6. If the registrant confirms an existing profile, mark the transaction for volunteer assistance and do not create new PCO records.
7. If no duplicate is accepted, create people and the household while persisting integration progress after each external step.

This progress state makes an interrupted sync retryable without blindly repeating every successful create call.

## Retry safety

Transactions already linked to a PCO person or household are locked against ordinary resubmission. Administrator override is explicit and logged. Editing a locally synced transaction does not silently update the previously created PCO record.

## Custom fields

Allergy and special-needs checkbox/detail destinations are explicit configuration. A blank mapping means no PCO custom-field write. Custom forms likewise store their selected mapping destinations with the form definition. Never guess PCO field definition IDs in source.

## API changes

Planning Center is an external dependency. Before changing API calls, verify current Planning Center People API documentation and test against a non-critical account or controlled records. Preserve raw external failure details only in admin-visible logs.
