# Testing, Observability, and Security Checks

This project has five complementary safety layers:

- Vitest checks deterministic web and API logic quickly
- Playwright checks real browser flows in Chromium and WebKit on desktop and mobile profiles
- Sentry captures unexpected frontend and API errors plus sampled performance traces
- Dependabot and `npm audit` monitor dependency vulnerabilities
- OWASP ZAP performs a passive baseline scan against a running URL

All external monitoring is disabled until its configuration is provided. No
secret is committed to the repository.

## Local commands

Run all unit tests:

```powershell
npm.cmd run test:unit
```

Run one workspace in watch mode while developing:

```powershell
npm.cmd run test:watch --workspace apps/web
npm.cmd run test:watch --workspace apps/api
```

Generate coverage in `coverage/web` and `coverage/api`:

```powershell
npm.cmd run test:coverage --workspace apps/web
npm.cmd run test:coverage --workspace apps/api
```

Install the browser binaries once on a new machine, then run the E2E suite:

```powershell
npx.cmd playwright install chromium webkit
npm.cmd run test:e2e
```

Playwright starts the local API and Vite server itself if they are not already
running. It reuses them during local development and never requires a real
database for the public smoke suite.

Open Playwright's interactive runner or the last HTML report:

```powershell
npm.cmd run test:e2e:ui
npm.cmd run test:e2e:report
```

Failed E2E tests retain a screenshot and video. On the first retry they also
record a trace with DOM snapshots, requests, console output, and timing. Reports
are ignored by Git and uploaded by CI only when a run fails.

## Authenticated browser smoke test

The authenticated test is skipped unless a dedicated test account is supplied.
Do not use a personal or production account.

```powershell
$env:E2E_USER_IDENTIFIER="test-account"
$env:E2E_USER_PASSWORD="test-password"
npm.cmd run test:e2e -- --project=desktop-chromium
```

This currently verifies login and the authenticated Home screen without
mutating account data. Transaction creation, account linking, email delivery,
and destructive flows should use a dedicated test database and mocked email or
Google providers before being added to CI.

To run the same browser suite against a future deployment:

```powershell
$env:E2E_BASE_URL="https://example.com"
$env:E2E_API_URL="https://api.example.com"
npm.cmd run test:e2e
```

If the API is exposed through the frontend origin at `/api`, `E2E_API_URL` can
be omitted.

## Sentry setup

Create one Sentry project for the React frontend and one for the Node API. This
keeps browser and server alerts, releases, and performance data understandable.

### Frontend local configuration

Create `apps/web/.env.local` from `apps/web/.env.example`:

```env
VITE_SENTRY_DSN=https://PUBLIC_DSN@sentry.io/PROJECT_ID
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_RELEASE=local
VITE_SENTRY_TRACES_SAMPLE_RATE=1
```

The browser DSN is intentionally public. `SENTRY_AUTH_TOKEN` is different: it
is a build secret and must never use the `VITE_` prefix.

### API local configuration

Add the API project values to the ignored `apps/api/.env`:

```env
SENTRY_DSN=https://PUBLIC_DSN@sentry.io/PROJECT_ID
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=local
SENTRY_TRACES_SAMPLE_RATE=1
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-api-project-slug
```

Restart both development servers after changing environment variables. Leaving
either DSN empty disables that SDK completely. The API build always creates
source maps, but uploads them only when all three build credentials exist.

### Source maps and deployment

Add these build-only secrets to the frontend hosting provider:

```env
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-web-project-slug
```

When all three exist, the Vite build creates hidden source maps, uploads them to
Sentry, then removes them from `dist`. Without all three, normal local and CI
builds do not create or upload source maps.

For production, also configure both runtimes with:

```env
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

Use the same release identifier for frontend and API, ideally the deployment's
Git commit SHA. A 10% trace sample is a sensible MVP starting point and can be
reduced if volume grows.

The integration intentionally disables default PII and session replay. Request
bodies, headers, cookies, query strings, email, username, and transaction data
are removed before events are sent. Sentry receives only technical error data,
the route, release, environment, and an internal user id when authenticated.

To verify Sentry after configuration, temporarily throw an error in a local
development-only path, confirm it appears in the correct Sentry project, and
remove the throw before committing.

## GitHub Actions and Dependabot

`.github/workflows/ci.yml` runs on every pull request and push to `main`:

1. Clean dependency install
2. Prisma Client generation
3. Web and API unit tests
4. API, web, and Storybook builds
5. High-severity dependency audit
6. Chromium and WebKit browser flows, including mobile profiles

No application API keys are required for this public smoke suite. Its database
URL and session keys are non-production placeholders, and the tested routes do
not connect to that database.

Dependabot checks npm weekly and GitHub Actions monthly. In the repository
settings, enable Dependabot alerts and security updates. Review its pull
requests normally and let CI validate them; do not enable blind auto-merge.

Run the dependency audit locally at any time:

```powershell
npm.cmd run security:audit
```

## OWASP ZAP

ZAP's baseline scan is passive and suitable for a staging or production URL. It
does not log in or submit financial forms with the current configuration.

For a local scan, install and start Docker Desktop, run the web and API, then:

```powershell
npm.cmd run security:zap -- http://localhost:5173
```

Local reports are written to `zap-report/`. The script translates localhost to
`host.docker.internal` so the container can reach the Windows host.

For the future deployment, add this GitHub repository variable under
Settings, Secrets and variables, Actions, Variables:

```text
ZAP_TARGET_URL=https://example.com
```

The workflow runs every Monday and can also be started manually with any URL.
It uploads an HTML, JSON, and Markdown report. Initially it does not fail CI on
alerts, which allows the first report to establish a baseline. After genuine
issues are fixed and false positives documented, change `fail_action` to `true`
in `.github/workflows/zap.yml`.

Never point active or authenticated security scans at production unless their
behavior and data impact have been reviewed first.

## Recommended routine

- While coding: Vitest watch mode for the affected workspace
- Before committing: `npm.cmd run test:unit` and the relevant Playwright project
- On every push: let CI run the full builds, audit, and public browser suite
- After deployment: verify Sentry release health and run Playwright against the deployed URL
- Weekly: review Dependabot and the ZAP report
