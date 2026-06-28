# Architecture

## Phase 3

The repository starts as a small monorepo with a single implemented app:

```text
apps/api
```

The API owns all backend behavior. The frontend and shared packages can be added later when they are useful.

Current request flow:

```text
HTTP client -> Fastify API -> route handler -> Prisma Client -> PostgreSQL
```

The database layer is now represented by Prisma.

Current backend structure:

```text
apps/api
  prisma
    migrations
    schema.prisma
  src
    db
      client.ts
    routes
      access-requests.ts
    app.ts
    server.ts
```

`src/db/client.ts` exports one shared Prisma client for backend code. Future route modules should import that client instead of constructing their own `PrismaClient` instances.

Prisma dependencies and database scripts live in the root package so the generated client and migration commands are managed once for the monorepo.

The first database models are authentication and access-control foundations:

- `User`
- `AccessRequest`
- `ApprovedEmail`

Financial data models are intentionally not included yet.

Public access requests are handled by a focused Fastify route module. The route validates and normalizes input before querying Prisma, while `app.ts` remains responsible only for assembling the API.
