# Security

## Phase 1

The first phase does not handle private user data yet.

Security decisions already in place:

- The backend is the only place where future sensitive logic should run.
- Real environment files and secrets must not be committed.
- Financial data must not be added to the repository.

Future phases will add authentication, authorization, ownership checks, and input validation around private resources.

