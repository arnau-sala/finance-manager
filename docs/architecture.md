# Architecture

## Phase 4 Foundation

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
    auth
      authenticated-user.ts
      password.ts
      session.ts
    routes
      admin-users.ts
      admin-access-requests.ts
      access-requests.ts
      auth-google.ts
      auth.ts
      categories.ts
      auth-me.ts
      statistics.ts
      transactions.ts
    money
      cents.ts
    app.ts
    server.ts
```

`src/db/client.ts` exports one shared Prisma client for backend code. Future route modules should import that client instead of constructing their own `PrismaClient` instances.

Prisma dependencies and database scripts live in the root package so the generated client and migration commands are managed once for the monorepo.

The database models cover authentication, access-control foundations, and basic financial records:

- `User`
- `AccessRequest`
- `AccessRequestEvent`
- `ApprovedEmail`
- `Category`
- `Transaction`

Accounts remain deferred until their first behavior is implemented.

Public access requests are handled by a focused Fastify route module. The route validates and normalizes input before querying Prisma, while `app.ts` remains responsible only for assembling the API.

The public flow makes one internal database decision:

```text
valid input -> registered email -> discarded event
            -> existing/approved request -> discarded event
            -> new email -> pending access request + created event
```

Every branch performs its database write on the server and produces the same public `202` response. There is no internal HTTP request for a browser to observe.

`AccessRequest` represents current state, while `AccessRequestEvent` preserves the history of valid access-related activity. Approval and denial both append administrative events to this history.

Administrative decisions are atomic. Approval records the approved email and event before completing the transaction; denial records its mandatory reason and event. Both remove the pending request in the same transaction.

`AccessRequestEvent.accessRequestId` is an immutable historical reference rather than a foreign-key relation. Creation, approval, and denial events require it, allowing administrative decisions to retain the original request ID after the pending row is deleted. Automatic system discards always leave it null.

Administrative access-request routes and user-management routes share `auth/require-administrator.ts`. Each administrative module registers it as a plugin-scoped `preHandler`, so every route verifies an active approved user and the `ADMIN` role before executing its handler.

Registration lives in `routes/auth.ts`, requires the user's name, and keeps password hashing isolated in `auth/password.ts` so login can reuse the same Argon2id implementation. Creating the user and consuming the approved email happen atomically in one Prisma transaction.

Login reuses the password module to verify Argon2id hashes. Unknown emails are checked against a precomputed dummy hash so the endpoint follows the same expensive verification path without exposing whether a user exists.

Google sign-in lives in `routes/auth-google.ts`. The route starts a server-side OAuth 2.0 / OpenID Connect flow, validates the callback `state`, verifies the Google ID token, and then either starts a session for an existing Google user, creates a Google user with its verified profile name from an unused approved email, or stores the verified email/name in the encrypted session so the frontend can open a prefilled Google access-request form.

`POST /access-requests/google` lives beside the normal access-request endpoint. It accepts only the optional user message, reads the verified Google email/name from the session, appends the internal Google source marker to the stored message, and then reuses the same pending-request/event-log persistence path.

`auth/session.ts` configures an encrypted stateless cookie session through `@fastify/secure-session`. Login stores only `userId`; logout requires that value and deletes the session cookie. Sessions last up to seven days.

`auth/authenticated-user.ts` resolves the session user and verifies that the account still exists and remains approved. Transaction routes use this server-derived ID; clients cannot select the owner of financial data.

`routes/admin-users.ts` exposes administrative user list and detail endpoints. A plugin-scoped hook resolves the current user from the session and checks the `ADMIN` role for every user-management route. Both queries share an explicit Prisma selection so password hashes and unrelated fields cannot enter responses.

`routes/auth-me.ts` returns the public profile selected by the current secure session. It includes the required name, authentication provider, and `updatedAt` in addition to the fields shared with administrative user reads. The frontend uses the provider to offer Google linking only to password accounts.

`routes/account.ts` owns password-confirmed self-service deletion through `DELETE /account`. Google accounts start a separate reauthentication flow through `POST /account/google/delete/start`; the existing Google callback validates a one-time deletion-specific OAuth `state` and requires the verified Google email and stable `sub` to match the active session user. Both paths call `account/delete-account.ts`, which performs the same database cleanup atomically and never accepts a client-provided user ID.

Phase 6 currently supports transaction creation, partial editing, deletion, and a global predefined category catalog. `GET /categories` exposes stable category IDs, while transaction routes validate that referenced categories exist and match the transaction type. `Transaction` now has Prisma relations to `User` and `Category`; scalar `userId` remains internal for ownership filters, while `categoryId` is still returned because the client needs it for category-based views.

Transaction reads and mutations derive `userId` exclusively from the secure session. Listing, category-filtered listing, and detail retrieval therefore return only the caller's transactions, with no administrative bypass. ID-based operations combine the transaction ID with that `userId`, so a missing transaction and a transaction owned by another user are indistinguishable to the caller. Empty edits verify ownership and succeed without writing. Financial account containers remain deferred.

`routes/statistics.ts` owns the first read-only statistics endpoints. `GET /statistics/balance` groups all of the current user's transactions by type and returns total income, total spent, and income-minus-expense balance. `GET /statistics/balance/:month/:year` and `GET /statistics/balance/:month` apply the same calculation to a calendar month, with the short form defaulting to the current year. `GET /statistics/balance/year/:year` and `GET /statistics/balance/year` apply it to a full calendar year. They use the same session-derived ownership rule as transaction reads, so administrators do not receive cross-user financial totals.

`GET /statistics/categories` and `GET /statistics/categories/type/:type` aggregate the caller's transactions by category with a single database join between `Transaction` and `Category`. Monthly and yearly category-statistics endpoints reuse the same query with an occurrence-date range. Typed period routes such as `GET /statistics/categories/type/expense/6/2026`, `GET /statistics/categories/type/expense/6`, `GET /statistics/categories/type/income/year/2026`, and `GET /statistics/categories/type/income/year` combine the transaction-type and period filters. Routes without an explicit year default to the server's current year. Percentages are calculated separately for `EXPENSE` and `INCOME`, categories without transactions are omitted, and integer percentages are adjusted to total exactly 100 within each returned type.

`services/statistics-service.ts` contains reusable statistics queries so route modules can expose different statistics views without duplicating database aggregation logic.

`money/cents.ts` centralizes integer-cent formatting for API responses that expose money as decimal strings.
