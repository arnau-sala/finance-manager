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

## Phase 3: Public Access Requests

- Add `POST /access-requests`.
- Validate and normalize public input.
- Avoid duplicate pending requests.
- Keep responses neutral to avoid exposing account or approval state.

## Next Phase

- Phase 4: add authenticated admin review, approval, and denial of access requests.
