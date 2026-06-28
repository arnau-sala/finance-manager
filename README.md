# Finance Manager

Backend-first personal finance manager.

## Current Phase

Phase 4 starts the administrative access-request review flow.

Implemented:

- `GET /health`
- Prisma schema for `User`, `AccessRequest`, and `ApprovedEmail`
- Initial SQL migration
- Shared Prisma client module for the API
- `POST /access-requests` with input validation and neutral responses
- Permanent access-request event log
- `GET /admin/access-requests`
- `GET /admin/access-requests/:id`
- `GET /admin/access-request-events`
- `GET /admin/access-request-events/:id`
- `POST /admin/access-requests/:id/approve`
- `POST /admin/access-requests/:id/deny`

## Health Endpoint

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Run the API

Node.js and npm are required.

```bash
npm install
npm run dev:api
```

The API listens on `http://localhost:3001` by default.

## Request Access

```http
POST /access-requests
Content-Type: application/json
```

Example body:

```json
{
  "email": "person@example.com",
  "name": "Person",
  "message": "I would like to try the app."
}
```

A valid request returns HTTP `202 Accepted`:

```json
{
  "message": "Access request received."
}
```

All three fields are required. A syntactically valid submission always receives the same response, including when its email already has a request, is approved, or is registered.

## Review Pending Requests

List pending requests:

```http
GET /admin/access-requests
```

Get one pending request:

```http
GET /admin/access-requests/:id
```

List access-request events:

```http
GET /admin/access-request-events
```

Get one access-request event:

```http
GET /admin/access-request-events/:id
```

Creation, approval, and denial events keep the original `accessRequestId` as a permanent historical reference. Automatic `ACCESS_REQUEST_DISCARDED` events never receive a request ID.

Approve a pending request:

```http
POST /admin/access-requests/:id/approve
```

This endpoint must be called with the `POST` method; opening the URL in a browser sends `GET` and will not approve the request. In Postman, select `POST` and `Body -> none`.

Expected response:

```json
{
  "message": "Access request approved."
}
```

Approval creates or updates `ApprovedEmail`, records an `ACCESS_REQUEST_APPROVED` event, and removes the request from the pending queue. It does not require a body until administrator sessions exist. An unknown request ID returns `404 Not Found`.

Deny a pending request:

```http
POST /admin/access-requests/:id/deny
Content-Type: application/json
```

```json
{
  "reason": "Reason for denying this request."
}
```

The reason is required, trimmed, and limited to 1000 characters. Denial records an `ACCESS_REQUEST_DENIED` event and removes the request from the pending queue without creating an `ApprovedEmail`.

Expected response:

```json
{
  "message": "Access request denied."
}
```

Timestamps use ISO 8601, for example `2026-06-28T12:30:00.000Z`.

These `/admin` routes are currently available only as a local development foundation. They do not yet authenticate or authorize an administrator and must not be exposed publicly in this state.

## Database

The API reads development configuration from `apps/api/.env`.

Required values:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance_manager?schema=public"
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations after PostgreSQL is running:

```bash
npm run db:migrate
```

`CONTEXT.md` and `apps/api/.env` are local-only files and are ignored by Git.
