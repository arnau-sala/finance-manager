# Finance Manager

Backend-first personal finance manager.

## Current Phase

The mobile-first authenticated experience now includes real Home, Moves, Profile,
and Statistics screens. Statistics Overview and Charts use owner-scoped
PostgreSQL aggregations rather than frontend fixtures.

Implemented:

Core:

- `GET /health`
- Initial Vite/React web app scaffold
- Login/sign-up preview screen
- API rate limiting for public, authenticated, financial, and administrative routes
- Origin checks for mutating browser requests
- Security headers through Helmet
- Pagination limits for growing list endpoints
- Prisma schema for `User`, `AccessRequest`, and `ApprovedEmail`
- Initial SQL migration
- Shared Prisma client module for the API

Access requests:

- `POST /access-requests` with input validation and neutral responses
- `POST /access-requests/google` for verified Google access-request submissions
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
- `GET /auth/google/start`
- `GET /auth/google/callback`
- `GET /auth/google/request-context`
- `POST /auth/logout`
- `GET /auth/me`
- `PATCH /account`
- `PATCH /account/password`
- `DELETE /account`
- `POST /account/google/delete/start`

Admin users:

- `GET /admin/users`
- `GET /admin/users/:id`

Categories:

- `GET /categories`

Home:

- `GET /home`

Transactions:

- `GET /transactions`
- `GET /transactions/categories/:category`
- `GET /transactions/:id`
- `POST /transactions`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`

Statistics:

- `GET /statistics/months`
- `GET /statistics/overview`
- `GET /statistics/charts`
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

Run the frontend:

```bash
npm run dev:web
```

The frontend listens on `http://localhost:5173` by default.

Mutating browser requests must come from an allowed origin. Local development allows common localhost origins by default. In production, configure `ALLOWED_ORIGINS` as a comma-separated list, for example `https://app.example.com,https://www.example.com`.

Frontend product, design, and architecture decisions are tracked in `docs/frontend.md`.

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

`email` and `name` are required. `message` is optional and is stored as an empty string when omitted. A syntactically valid submission always receives the same response, including when its email already has a request, is approved, or is registered.

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
  "name": "Alex Morgan",
  "password": "SecurePass1!",
  "passwordConfirmation": "SecurePass1!"
}
```

`name` is required, trimmed, and limited to 100 characters. The two passwords must match exactly. The password must contain between 9 and 128 characters, including at least one uppercase letter, one digit, and one special character. Successful registration returns `201 Created` with the new user's public fields. It consumes the approval by setting `ApprovedEmail.usedAt`.

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

## Continue With Google

Google sign-in starts from the browser:

```http
GET /auth/google/start
```

The backend redirects the user to Google using OAuth 2.0 / OpenID Connect. Google redirects back to:

```http
GET /auth/google/callback
```

The backend verifies the Google ID token with the configured client ID before trusting the email. If an approved Google account already exists, the callback creates the normal secure session and redirects back to the frontend.

If the Google email is approved but no user exists yet, the backend creates a `GOOGLE` user with Google's verified profile name and without a password, consumes the approval, starts a session, and redirects back to the frontend.

If the Google identity cannot be logged in directly, the callback stores the verified Google email and profile name in the encrypted session and redirects to a Google access-request form. The frontend reads that temporary context through:

```http
GET /auth/google/request-context
```

The Google access-request form keeps the verified email read-only, prefills an editable name, and accepts an optional message:

```http
POST /access-requests/google
Content-Type: application/json
```

```json
{
  "name": "Alex Morgan",
  "message": "Optional note for the administrator."
}
```

The backend reads the verified email from the session, validates the submitted name, appends `Requested access using Google sign-in.` to the stored message, and then applies the same neutral access-request persistence rules as `POST /access-requests`.

Local Google configuration requires these values in `apps/api/.env`:

```env
WEB_APP_URL=http://localhost:5173
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

The Google Cloud OAuth client must include the exact `GOOGLE_REDIRECT_URI` as an authorized redirect URI.

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
      "name": "Alex Morgan",
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
    "name": "Alex Morgan",
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
    "name": "Alex Morgan",
    "authProvider": "PASSWORD",
    "role": "USER",
    "status": "APPROVED",
    "createdAt": "2026-07-05T18:30:00.000Z",
    "updatedAt": null
  }
}
```

`updatedAt` is `null` until the user is modified for the first time. A request without a valid session returns `401 Unauthorized` with `{"error":"Authentication required."}`.

## Update Current User

Only the user represented by the active session can update their profile. The endpoint does not accept a user ID or email:

```http
PATCH /account
Content-Type: application/json
```

```json
{
  "name": "Alex Morgan"
}
```

The name is trimmed and must contain between 1 and 100 characters, using the same validation as registration. Empty names, missing names, unknown fields, and attempts to include `email` return `400 Bad Request`. A successful update returns `200 OK` with `Profile updated successfully.` and the updated public user object.

## Change Password

Only an authenticated `PASSWORD` account can change its password:

```http
PATCH /account/password
Content-Type: application/json
```

```json
{
  "currentPassword": "Current-password1!",
  "newPassword": "New-password2!",
  "newPasswordConfirmation": "New-password2!"
}
```

The new password must contain 9 to 128 characters, at least one uppercase letter, one digit, and one special character. Both new-password fields must match, and the new password must differ from the current password.

An incorrect current password returns `401 Unauthorized` with `{"error":"Incorrect current password."}`. Google accounts receive `400 Bad Request` because their credentials are managed by Google. A successful change returns:

```json
{
  "message": "Password changed successfully."
}
```

Success rotates the current encrypted cookie and invalidates every other session for the account. The endpoint is limited to 5 attempts every 15 minutes per session or IP.

## Delete Account

Only the currently authenticated owner can delete their account. The endpoint does not accept a user ID:

```http
DELETE /account
Content-Type: application/json
```

```json
{
  "password": "SecurePass1!"
}
```

For `PASSWORD` accounts, an incorrect password returns `401 Unauthorized` with `{"error":"Incorrect password."}`. Google accounts instead require fresh Google reauthentication, started from the browser with:

```http
POST /account/google/delete/start
```

The backend preserves the active session while Google presents its account chooser. The shared Google callback deletes the account only when Google's verified email and stable `sub` identifier both match the currently authenticated user. Selecting another Google account returns to the profile without deleting data and allows the user to retry with the session email.

A successful deletion returns the password endpoint response below or redirects the Google flow to the public app screen:

```json
{
  "message": "Account deleted successfully."
}
```

Deletion is atomic and permanent. It removes the user, all owned transactions, pending access requests, access-request events, and approved-email records associated with the account email. If the deleted user performed administrative reviews, their ID is removed from other users' historical records without deleting those records. The current session is deleted after the database transaction succeeds.

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
      "date": "2026-07-05",
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
      "date": "2026-07-01",
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

The endpoint returns the requested transaction and the derived information used
by its detail sheet only when it belongs to the current session user:

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
    "date": "2026-07-05",
    "createdAt": "2026-07-05T16:31:00.000Z"
  },
  "trackedBalance": {
    "before": "1000.00",
    "after": "957.50"
  },
  "contexts": {
    "month": {
      "categoryRank": {
        "position": 2,
        "total": 5
      },
      "typeRank": {
        "position": 8,
        "total": 31
      },
      "periodImpactPercentage": 7
    },
    "year": {
      "categoryRank": {
        "position": 5,
        "total": 42
      },
      "typeRank": {
        "position": 24,
        "total": 214
      },
      "periodImpactPercentage": 0.8
    },
    "all": {
      "categoryRank": {
        "position": 14,
        "total": 126
      },
      "typeRank": {
        "position": 63,
        "total": 642
      },
      "periodImpactPercentage": 0.3
    }
  }
}
```

Month and year contexts are derived from the transaction's own calendar date.
Ranks order higher amounts first; equal amounts use transaction date, creation
timestamp, and ID as deterministic tie-breakers. Period impact is the
transaction amount divided by all income or all expenses, according to its
type, in that context. Positive impacts below `1%` are returned with one decimal
and never collapse to `0%`; impacts of at least `1%` are rounded to whole
percentages.

`trackedBalance` is calculated from registered transactions ordered by
transaction date, creation timestamp, and ID. Until opening net worth is
implemented, it starts at zero and must not be interpreted as the user's full
real-world wealth.

All derived values are produced in the same database statement, so switching
between Month, Year, and All in the interface requires no additional request. A
missing transaction and one owned by another user both return `404 Not Found`
with `{"error":"Transaction not found."}`. Administrators receive no ownership
bypass.

The detail sheet can share a compact text summary through the device's native
share sheet. The message contains only the transaction type, description,
signed amount, category, and date. It is built locally from the already loaded
transaction and does not require another API request; browsers without Web
Share support copy the same text to the clipboard.

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
  "date": "2026-07-05"
}
```

`type` must be `INCOME` or `EXPENSE`. `categoryId` is required and must reference a category of the same type. `description` is required and limited to 50 characters. `amount` must be positive with at most two decimal places; sending it as a string is recommended for exact decimal input. `date` is an optional calendar date in `YYYY-MM-DD` format and defaults to the server's current calendar date. Times and timezone offsets are rejected.

The backend obtains `userId` exclusively from the session and stores the amount as integer cents. The transaction day is stored as PostgreSQL `DATE`, while `createdAt` independently records the exact creation timestamp. Transaction responses include the selected category's ID, name, and type.

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

The authenticated interface confirms this irreversible action in a compact
popover anchored below the transaction's Delete control. A successful deletion
closes the detail sheet, clears private financial caches, and refreshes Home,
Moves, and Stats.

## Update Transaction

An active login session is required, and the transaction must belong to that user:

```http
PATCH /transactions/:id
Content-Type: application/json
```

Send only the fields that must change. All fields are optional, and an empty object is accepted:

```json
{
  "categoryId": "expense-dining",
  "description": "Updated description",
  "amount": "35.20"
}
```

The available fields and validation rules are the same as for transaction creation. Required values cannot be cleared, so values such as an empty `description` are rejected. The resulting category must match the resulting transaction type; changing between `INCOME` and `EXPENSE` therefore requires a compatible `categoryId`. A successful edit returns `200 OK` with `{"message":"Transaction updated."}`. Missing and foreign-owned transaction IDs return the same `404` response used by deletion.

The authenticated interface opens the shared transaction composer from the
detail sheet, prefilled with the current values. It sends only changed fields,
then invalidates transaction and statistics caches and reloads the detail
aggregates before revealing the sheet again.

## Get Home Overview

An active login session is required:

```http
GET /home
```

The endpoint provides the authenticated user's Home data in one response: the all-time balance, up to three newest transactions, and activity for the server's current calendar month. It never accepts a user ID from the client.

```json
{
  "balance": {
    "totalIncome": "1500.00",
    "totalSpent": "420.50",
    "totalBalance": "1079.50"
  },
  "latestMoves": [
    {
      "id": "transaction-id",
      "type": "EXPENSE",
      "category": {
        "id": "expense-groceries",
        "name": "Groceries",
        "type": "EXPENSE"
      },
      "amount": "42.80",
      "description": "Weekly groceries",
      "date": "2026-07-17"
    }
  ],
  "activity": {
    "month": 7,
    "year": 2026,
    "transactionCount": 4,
    "topExpenseCategory": {
      "id": "expense-groceries",
      "name": "Groceries"
    },
    "topIncomeCategory": null
  }
}
```

Users without transactions receive zero balance values, an empty `latestMoves` array, a transaction count of `0`, and null top categories.

## Get My Available Statistics Months

An active login session is required:

```http
GET /statistics/months
```

The endpoint returns the distinct months that contain at least one transaction
owned by the current user. Future transactions are excluded, and neither
transactions nor `userId` values are exposed:

```json
{
  "availableMonths": ["2026-04", "2026-06", "2026-07"],
  "minimumMonth": "2026-04",
  "maximumMonth": "2026-07"
}
```

`minimumMonth` is `null` when the account has no transactions.
`maximumMonth` is always the current calendar month.

## Get My Statistics Overview

An active login session is required. The endpoint accepts one of three periods:

```http
GET /statistics/overview
GET /statistics/overview?period=month&month=2026-07
GET /statistics/overview?period=year&year=2026
GET /statistics/overview?period=all
```

Without query parameters it uses the current month. Future months and years are
rejected. The response is designed for the numeric Stats view and contains:

- income, expenses, balance, and saved percentage;
- category amount, percentage, transaction count, and average;
- largest movements and monthly/yearly insights where applicable;
- median expense, period average, and no-spend streaks. The current streak is
  returned only for the current month, current year, and All.

All calculations use only transactions owned by the authenticated user. Empty
periods return zero values and empty category collections. Money is calculated
in integer cents and exposed as decimal strings. Representative response
excerpt:

```json
{
  "overview": {
    "period": {
      "mode": "MONTH",
      "key": "2026-07",
      "startDate": "2026-07-01",
      "endDate": "2026-07-27"
    },
    "money": {
      "income": "1380.00",
      "expenses": "2534.50",
      "balance": "-1154.50",
      "savingsPercentage": -84
    }
  }
}
```

## Get My Statistics Charts

Charts use the same period query:

```http
GET /statistics/charts
GET /statistics/charts?period=month&month=2026-07
GET /statistics/charts?period=year&year=2026
GET /statistics/charts?period=all
```

The response returns chart-neutral financial series rather than ECharts
configuration. It includes shared income/expense/balance intervals, category
totals, category-by-interval cells, and seven weekday spending aggregates.
The combined Cash Flow chart renders income, expenses, and balance from that
single financial series, while Category Breakdown and Category Timeline use one
common category aggregation.

Net Worth Evolution currently returns
`status: "OPENING_BALANCE_REQUIRED"` and no points. A real net-worth series
cannot be calculated until an opening balance and effective date are stored;
the API never substitutes a fictitious zero balance.

Both aggregate endpoints derive ownership from the secure session, never accept
`userId`, exclude dates after today, and send `Cache-Control: private, no-store`.

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
      "category": "Transport",
      "type": "EXPENSE",
      "percentage": 33
    },
    {
      "category": "Housing",
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
WEB_APP_URL=http://localhost:5173
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
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
