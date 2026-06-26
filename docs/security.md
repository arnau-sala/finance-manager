# Security

## Phase 2

The project now has the first private-data schema foundations, but no user-facing database endpoints yet.

Security decisions already in place:

- The backend is the only place where future sensitive logic should run.
- `CONTEXT.md` and `apps/api/.env` are ignored by Git.
- Real credentials, production database URLs, and secrets must not be committed.
- Financial data must not be added to the repository.
- User emails are unique in the `User` and `ApprovedEmail` tables.
- Admin review metadata is represented with nullable reviewer fields for future approval flows.

The current schema does not allow financial records yet. When financial models are added, every private financial table must include an owner field such as `userId`.

Future phases will add request validation, authentication, authorization, ownership checks, and tests around private resources.
