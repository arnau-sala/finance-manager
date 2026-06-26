# Roadmap

## Phase 1: Backend Base

- Create the backend TypeScript app.
- Add a `GET /health` endpoint.
- Confirm the server can run locally.

## Phase 2: Database and Prisma

- Add Prisma.
- Configure PostgreSQL through `DATABASE_URL`.
- Create the initial schema for `User`, `AccessRequest`, and `ApprovedEmail`.
- Add the first migration.
- Add a shared database client module.

## Next Phase

- Phase 3: add public access requests.

Phase 3 should add `POST /access-requests` with validation, email normalization, duplicate-pending handling, and neutral public responses.
