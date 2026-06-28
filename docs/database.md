# Database

## Provider

The API uses PostgreSQL through Prisma.

Prisma is managed from the repository root because the database schema belongs to the backend app, but the commands are run as monorepo-level maintenance tasks.

Schema location:

```text
apps/api/prisma/schema.prisma
```

Migration location:

```text
apps/api/prisma/migrations
```

## Local Configuration

Development configuration is stored in `apps/api/.env`.

The file is ignored by Git.

Expected values:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance_manager?schema=public"
```

Replace the PostgreSQL user, password, host, port, or database name with your local setup.

## Commands

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations in development:

```bash
npm run db:migrate
```

Open Prisma Studio:

```bash
npm run db:studio
```

Deploy existing migrations in a deployed environment:

```bash
npm run db:deploy
```

## Current Models

`User` stores registered users and their role/status.

`AccessRequest` is the current pending queue. Its email is unique, and its email, name, and message fields are required. A row will be removed when a later phase approves or denies it.

`AccessRequestEvent` is the permanent structured history. New pending requests create an `ACCESS_REQUEST_CREATED` event with actor `VISITOR`. Valid-looking submissions that are not added to the queue create an `ACCESS_REQUEST_DISCARDED` event with actor `SYSTEM` and one of these reasons:

- `EMAIL_ALREADY_REGISTERED`
- `ACCESS_REQUEST_ALREADY_EXISTS`

Created events reference their pending `AccessRequest`. The relation uses `onDelete: SetNull`, so the event remains after a future approval or denial removes the pending row.

The event enum also contains `ACCESS_REQUEST_APPROVED` and `ACCESS_REQUEST_DENIED`, and the actor enum contains `ADMIN`, for the next administrative actions. They are not used yet.

Malformed submissions are rejected before database access and do not create events.

`ApprovedEmail` stores emails approved by an admin before registration.

No financial tables exist yet.
