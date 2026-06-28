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

## Phase 4: Administrative Review Foundation

- Make access-request fields mandatory.
- Separate the pending queue from the permanent structured event log.
- Add pending-request list and detail endpoints.
- Add event list and detail endpoints for local administrative review.
- Keep the public result independent from the internal database decision.

## Remaining Phase 4 Work

- Authenticate administrative requests.
- Require the `ADMIN` role on every `/admin/*` endpoint.
- Add approve and deny actions.
- Remove a request from the pending queue after either action.
