# Security

## Phase 3

The project now has the first private-data schema foundations, but no user-facing database endpoints yet.

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
- Returns the same neutral response for new, pending, denied, approved, and registered email addresses.
- Uses a database constraint to prevent duplicate pending requests during concurrent calls.

Authentication, authorization, ownership checks, and their security tests belong to later phases.
