# Finance Manager

Backend-first personal finance manager.

## Current Phase

Phase 8 starts the basic statistics layer for authenticated financial data.

Implemented:

Core:

- `GET /health`
- API rate limiting for public, authenticated, financial, and administrative routes
- Prisma schema for `User`, `AccessRequest`, and `ApprovedEmail`
- Initial SQL migration
- Shared Prisma client module for the API

Access requests:

- `POST /access-requests` with input validation and neutral responses
- Permanent access-request event log

Admin access requests:

- `GET /admin/access-requests`
- `GET /admin/access-requests/:id`
- `GET /admin/access-request-events`
- `GET /admin/access-request-events/:id`
- `POST /admin/access-requests/:id/approve`
- `POST /admin/access-requests/:id/deny`

Authentication:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Admin users:

- `GET /admin/users`
- `GET /admin/users/:id`

Categories:

- `GET /categories`

Transactions:

- `GET /transactions`
- `GET /transactions/categories/:category`
- `GET /transactions/:id`
- `POST /transactions`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`

Statistics:

- `GET /statistics/balance`
- `GET /statistics/balance/:month/:year`
- `GET /statistics/balance/:month`
- `GET /statistics/balance/year/:year`
- `GET /statistics/balance/year`
- `GET /statistics/categories`
- `GET /statistics/categories/type/:type`
- `GET /statistics/categories/:month/:year`
- `GET /statistics/categories/:month`
- `GET /statistics/categories/year/:year`
- `GET /statistics/categories/year`
- `GET /statistics/categories/type/:type/:month/:year`
- `GET /statistics/categories/type/:type/:month`
- `GET /statistics/categories/type/:type/year/:year`
- `GET /statistics/categories/type/:type/year`

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

Every endpoint in this section requires an active session for a user with role `ADMIN`.

List pending requests:

```http
GET /admin/access-requests
```

Supports `limit` and `offset`. Default `limit` is `50`; maximum is `100`.

Get one pending request:

```http
GET /admin/access-requests/:id
```

List access-request events:

```http
GET /admin/access-request-events
```

Supports `limit` and `offset`. Default `limit` is `100`; maximum is `200`.

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

Approval creates or updates `ApprovedEmail` with the approving admin's session user ID in `approvedBy`, records an `ACCESS_REQUEST_APPROVED` event with the same admin ID in `adminId`, and removes the request from the pending queue. It does not require a body. An unknown request ID returns `404 Not Found`.

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

The reason is required, trimmed, and limited to 1000 characters. Denial records an `ACCESS_REQUEST_DENIED` event with the denying admin's session user ID in `adminId` and removes the request from the pending queue without creating an `ApprovedEmail`.

Expected response:

```json
{
  "message": "Access request denied."
}
```

Timestamps use ISO 8601, for example `2026-06-28T12:30:00.000Z`.

Requests without a valid session return `401 Unauthorized`. Authenticated users without role `ADMIN` receive `403 Forbidden`.

## Register

Only an unused email from `ApprovedEmail` can register:

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "email": "approved@example.com",
  "password": "SecurePass1!",
  "passwordConfirmation": "SecurePass1!"
}
```

The two passwords must match exactly. The password must contain between 9 and 128 characters, including at least one uppercase letter, one digit, and one special character. Successful registration returns `201 Created` with the new user's public fields. It consumes the approval by setting `ApprovedEmail.usedAt`.

Non-approved, already-used, and already-registered emails receive the same `403 Forbidden` response. Registration does not create a login session yet.

## Login

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "SecurePass1!"
}
```

Valid credentials for an approved user return:

```json
{
  "message": "Login successful."
}
```

Unknown emails, incorrect passwords, and suspended users receive the same `401 Unauthorized` response. Successful login creates a secure cookie session.

## Logout

```http
POST /auth/logout
```

The request must include the session cookie created by login. A valid logout returns:

```json
{
  "message": "Logout successful."
}
```

Calling logout without an active session returns `401 Unauthorized`:

```json
{
  "error": "No active session."
}
```

## List Users

An active session for a user with role `ADMIN` is required:

```http
GET /admin/users
```

A successful request returns users ordered by creation date, newest first:

```json
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "role": "USER",
      "status": "APPROVED",
      "createdAt": "2026-07-05T18:30:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "nextOffset": null
  }
}
```

Supports `limit` and `offset`. Default `limit` is `50`; maximum is `100`. Use `nextOffset` as the next `offset` value; `null` means there are no more results.

Requests without a valid session return `401 Unauthorized`. Authenticated users without role `ADMIN` receive `403 Forbidden` with `{"error":"Administrator access required."}`.

## Get User

An active session for a user with role `ADMIN` and a valid user CUID are required:

```http
GET /admin/users/:id
```

A successful request returns the same public fields as the user list:

```json
{
  "user": {
    "id": "cmr81aoib0000kzsowdqjw84x",
    "email": "user@example.com",
    "role": "USER",
    "status": "APPROVED",
    "createdAt": "2026-07-05T18:30:00.000Z"
  }
}
```

An invalid ID format returns `400 Bad Request`. A valid CUID without a matching user returns `404 Not Found`.

## Get Current User

An active session is required:

```http
GET /auth/me
```

The endpoint returns the public information for the user represented by the current session:

```json
{
  "user": {
    "id": "cmr81aoib0000kzsowdqjw84x",
    "email": "user@example.com",
    "role": "USER",
    "status": "APPROVED",
    "createdAt": "2026-07-05T18:30:00.000Z",
    "updatedAt": null
  }
}
```

`updatedAt` is `null` until the user is modified for the first time. A request without a valid session returns `401 Unauthorized` with `{"error":"Authentication required."}`.

## List Categories

An active login session is required:

```http
GET /categories
```

Use `GET /categories?type=EXPENSE` or `GET /categories?type=INCOME` to filter the catalog. Each category contains the stable `id` required by transaction creation and editing:

```json
{
  "categories": [
    {
      "id": "expense-groceries",
      "name": "Groceries",
      "type": "EXPENSE"
    }
  ]
}
```

## List My Transactions

An active session is required:

```http
GET /transactions
```

The endpoint returns only transactions owned by the current session user, including when that user has role `ADMIN`. Results are ordered by transaction date, newest first:

```json
{
  "transactions": [
    {
      "id": "transaction-id",
      "type": "EXPENSE",
      "categoryId": "expense-groceries",
      "category": {
        "id": "expense-groceries",
        "name": "Groceries",
        "type": "EXPENSE"
      },
      "amount": "42.50",
      "description": "Weekly groceries",
      "date": "2026-07-05T16:30:00.000Z",
      "createdAt": "2026-07-05T16:31:00.000Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "nextOffset": null
  }
}
```

Supports `limit` and `offset`. Default `limit` is `100`; maximum is `200`. Use `nextOffset` as the next `offset` value; `null` means there are no more results. A user without transactions receives an empty `transactions` array. A request without a valid session returns `401 Unauthorized`.

## List My Transactions By Category

An active session is required:

```http
GET /transactions/categories/:category
```

`:category` is the category ID, for example `income-salary` or `expense-housing`. The endpoint returns only transactions owned by the current session user and assigned to that category:

```json
{
  "transactions": [
    {
      "id": "transaction-id",
      "type": "EXPENSE",
      "categoryId": "expense-housing",
      "category": {
        "id": "expense-housing",
        "name": "Housing",
        "type": "EXPENSE"
      },
      "amount": "850.00",
      "description": "Rent",
      "date": "2026-07-01T08:00:00.000Z",
      "createdAt": "2026-07-01T08:01:00.000Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "nextOffset": null
  }
}
```

Supports `limit` and `offset`. Default `limit` is `100`; maximum is `200`. A category without matching transactions returns an empty `transactions` array. Administrators receive no ownership bypass.

## Get My Transaction

An active session is required:

```http
GET /transactions/:id
```

The endpoint returns the requested transaction only when it belongs to the current session user:

```json
{
  "transaction": {
    "id": "transaction-id",
    "type": "EXPENSE",
    "categoryId": "expense-groceries",
    "category": {
      "id": "expense-groceries",
      "name": "Groceries",
      "type": "EXPENSE"
    },
    "amount": "42.50",
    "description": "Weekly groceries",
    "date": "2026-07-05T16:30:00.000Z",
    "createdAt": "2026-07-05T16:31:00.000Z"
  }
}
```

A missing transaction and one owned by another user both return `404 Not Found` with `{"error":"Transaction not found."}`. Administrators receive no ownership bypass.

## Create Transaction

An active login session is required:

```http
POST /transactions
Content-Type: application/json
```

```json
{
  "type": "EXPENSE",
  "categoryId": "expense-groceries",
  "description": "Weekly groceries",
  "amount": "42.50",
  "date": "2026-07-05T18:30:00+02:00"
}
```

`type` must be `INCOME` or `EXPENSE`. `categoryId` is required and must reference a category of the same type. `description` is required and limited to 100 characters. `amount` must be positive with at most two decimal places; sending it as a string is recommended for exact decimal input. `date` is optional and defaults to the request time. When provided, it must be an ISO 8601 timestamp with a timezone.

The backend obtains `userId` exclusively from the session and stores the amount as integer cents. Transaction responses include the selected category's ID, name, and type.

## Delete Transaction

An active login session is required, and the transaction must belong to that user:

```http
DELETE /transactions/:id
```

A successful deletion returns `200 OK`:

```json
{
  "message": "Transaction deleted."
}
```

An unknown transaction ID and a transaction owned by another user both return the same `404 Not Found` response:

```json
{
  "error": "Transaction not found."
}
```

## Update Transaction

An active login session is required, and the transaction must belong to that user:

```http
PATCH /transactions/:id
Content-Type: application/json
```

Send only the fields that must change. All fields are optional, and an empty object is accepted:

```json
{
  "categoryId": "expense-dining-out",
  "description": "Updated description",
  "amount": "35.20"
}
```

The available fields and validation rules are the same as for transaction creation. Required values cannot be cleared, so values such as an empty `description` are rejected. The resulting category must match the resulting transaction type; changing between `INCOME` and `EXPENSE` therefore requires a compatible `categoryId`. A successful edit returns `200 OK` with `{"message":"Transaction updated."}`. Missing and foreign-owned transaction IDs return the same `404` response used by deletion.

## Get My Balance

An active login session is required:

```http
GET /statistics/balance
```

The endpoint sums only the transactions owned by the current session user. Administrators receive their own balance, not a global balance:

```json
{
  "balance": {
    "totalIncome": "1500.00",
    "totalSpent": "420.50",
    "totalBalance": "1079.50"
  }
}
```

`totalBalance` is calculated as income minus expenses. A user without transactions receives zero values. A request without a valid session returns `401 Unauthorized`.

## Get My Monthly Balance

An active login session is required:

```http
GET /statistics/balance/:month/:year
```

`month` must be a number from `1` to `12`. `year` must be a number from `2000` to the current year. The year can be omitted, in which case the API uses the current year:

```http
GET /statistics/balance/6
```

Example:

```http
GET /statistics/balance/6/2026
```

Expected response:

```json
{
  "balance": {
    "totalIncome": "1000.00",
    "totalSpent": "250.00",
    "totalBalance": "750.00"
  }
}
```

The endpoint only sums transactions owned by the current session user and returns zero values when there are no transactions in that month.

## Get My Yearly Balance

An active login session is required:

```http
GET /statistics/balance/year/:year
```

`year` must be a number from `2000` to the current year. The year can be omitted, in which case the API uses the current year:

```http
GET /statistics/balance/year
```

Example:

```http
GET /statistics/balance/year/2026
```

Expected response:

```json
{
  "balance": {
    "totalIncome": "12000.00",
    "totalSpent": "3600.00",
    "totalBalance": "8400.00"
  }
}
```

The endpoint only sums transactions owned by the current session user and returns zero values when there are no transactions in that year.

## Get My Category Percentages

An active login session is required:

```http
GET /statistics/categories
```

Use a type path parameter to return only one transaction type:

```http
GET /statistics/categories/type/expense
GET /statistics/categories/type/income
```

Use a numeric month and year to calculate category percentages only for that month:

```http
GET /statistics/categories/:month/:year
```

The year can be omitted, in which case the API uses the current year:

```http
GET /statistics/categories/6
```

Use the yearly endpoints to calculate category percentages for a full calendar year:

```http
GET /statistics/categories/year/:year
GET /statistics/categories/year
```

Use `income` or `expense` after the fixed `type` segment to combine transaction type and period filters:

```http
GET /statistics/categories/type/expense/:month/:year
GET /statistics/categories/type/income/:month/:year
GET /statistics/categories/type/expense/:month
GET /statistics/categories/type/income/:month
GET /statistics/categories/type/expense/year/:year
GET /statistics/categories/type/income/year/:year
GET /statistics/categories/type/expense/year
GET /statistics/categories/type/income/year
```

The endpoint returns only categories that have at least one transaction for the current user. Percentages are calculated within each transaction type, so expense categories add up to `100` and income categories add up to `100` independently:

```json
{
  "categories": [
    {
      "category": "Groceries",
      "type": "EXPENSE",
      "percentage": 34
    },
    {
      "category": "Transportation",
      "type": "EXPENSE",
      "percentage": 33
    },
    {
      "category": "Travel",
      "type": "EXPENSE",
      "percentage": 33
    }
  ]
}
```

Percentages are whole numbers and are adjusted so each returned type totals exactly `100`. Empty types or periods return an empty list.

## Database

The API reads development configuration from `apps/api/.env`.

Required values:

```env
NODE_ENV=development
PORT=3001
SESSION_KEY=<64-character-hexadecimal-key>
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
