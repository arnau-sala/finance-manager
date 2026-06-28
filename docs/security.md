# Security

## Phase 4 Foundation

The project now persists public access requests and exposes local administrative read endpoints.

Security decisions already in place:

- The backend is the only place where future sensitive logic should run.
- `CONTEXT.md` and `apps/api/.env` are ignored by Git.
- Real credentials, production database URLs, and secrets must not be committed.
- Financial data must not be added to the repository.
- User emails are unique in the `User` and `ApprovedEmail` tables.
- Admin review metadata is represented with nullable reviewer fields for future approval flows.

The current schema does not allow financial records yet. When financial models are added, every private financial table must include an owner field such as `userId`.

The public access-request endpoint:

- Validates the entire request body and rejects unknown fields.
- Normalizes email addresses by trimming whitespace and converting them to lowercase.
- Limits names to 100 characters and messages to 1000 characters.
- Requires non-empty email, name, and message fields.
- Returns the same status and body for every syntactically valid submission.
- Uses a database constraint to prevent duplicate pending requests during concurrent calls.
- Stores every valid access-request outcome in a structured server-side event log without exposing the event or discard reason publicly.

A sender can always inspect their own HTTP request and submitted fields in browser developer tools. What remains private is the server-side decision and database destination: no second HTTP request is made, and the response does not identify whether the email is registered, approved, pending, or new.

The `/admin/*` read routes, including `/admin/access-request-events`, do not yet authenticate users. Their path name alone provides no security, so they are restricted to local development and must gain server-side authentication and role authorization before deployment.
