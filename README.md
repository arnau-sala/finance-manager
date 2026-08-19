# Finance Manager

<div align="center">
  <img src="docs/assets/readme/readme-header-icon.png" alt="Finance Manager icon" width="132" height="132" style="display:block; margin:0 auto 4px auto;" />

  <h3 style="margin-top:0;">Money, made clear</h3>
  <p>
    A mobile-first personal finance app for tracking income, expenses, net worth,
    transaction history, and spending patterns from one focused interface
  </p>

  <p>
<img alt="Status" src="https://img.shields.io/badge/status-MVP%20in%20progress-22c55e?style=flat&logo=checkmarx&logoColor=white" />
    <img alt="Frontend" src="https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-0ea5e9?style=flat&logo=vercel&logoColor=ffffff" />
    <img alt="Backend" src="https://img.shields.io/badge/backend-Fastify%20%2B%20Prisma-f97316?style=flat&logo=icloud&logoColor=ffffff" />
    <img alt="Database" src="https://img.shields.io/badge/database-PostgreSQL-6366f1?style=flat&logo=databricks&logoColor=ffffff" />
    <img alt="License" src="https://img.shields.io/badge/license-All%20rights%20reserved-4b5563?style=flat&logo=bookstack&logoColor=ffffff" />
  </p>
</div>

---

## Overview

Finance Manager is a personal finance product built as a polished mobile web app.
It is designed around quick daily use: add transactions fast, review recent moves,
understand where money is going, and explore statistics without feeling like a spreadsheet.

The project started as a personal tool, but it is being developed with the standards of a real product:
secure authentication, owner-scoped financial data, production monitoring, automated tests, a documented API,
and a UI system designed for a consistent mobile experience.

## Product Preview

Finance Manager is designed as a mobile-first product, with a desktop landing page
that explains the app and guides users toward the PWA flow.

<div align="center">
  <img src="docs/assets/readme/00-desktop-hero.png" alt="Finance Manager desktop landing page with a mobile app preview" width="920" />
</div>

### Mobile App

<div align="center">
<table align="center" width="100%">
  <tr>
    <td align="center" width="50%">
      <img src="docs/assets/readme/01-home-overview.png" alt="Home screen with net worth, latest moves, and monthly activity" width="320" />
      <br />
      <strong>Home</strong>
      <br />
      A daily snapshot of net worth, latest moves, and monthly activity
    </td>
    <td align="center" width="50%">
      <img src="docs/assets/readme/02-transactions-list.png" alt="Transactions screen with search, grouped history, and transaction amounts" width="320" />
      <br />
      <strong>Transactions</strong>
      <br />
      Searchable history grouped by period, category, amount, and type
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="docs/assets/readme/04-transaction-detail.png" alt="Transaction detail ticket with balance before and after, ranking, and period impact" width="320" />
      <br />
      <strong>Transaction Detail</strong>
      <br />
      Ticket-style context for balance impact, ranking, and period share
    </td>
    <td align="center" width="50%">
      <img src="docs/assets/readme/05-statistics-overview.png" alt="Statistics overview with money totals and income categories" width="320" />
      <br />
      <strong>Statistics</strong>
      <br />
      Real period summaries for balance, income, expenses, and categories
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="docs/assets/readme/07-statistics-charts.png" alt="Statistics charts showing net worth evolution and cash flow" width="320" />
      <br />
      <strong>Charts</strong>
      <br />
      Net worth evolution, cash flow, and visual financial patterns
    </td>
    <td align="center" width="50%">
      <img src="docs/assets/readme/08-category-timeline.png" alt="Category timeline matrix and weekday spending chart" width="320" />
      <br />
      <strong>Patterns</strong>
      <br />
      Category timelines and weekday spending for behavioral insight
    </td>
  </tr>
</table>
</div>

### Focused Interfaces

<div align="center">
<table align="center" width="100%">
  <tr>
    <td align="center" width="50%">
      <img src="docs/assets/readme/03-transactions-filters.png" alt="Expanded transaction filters with type, amount, date, and category options" width="320" />
      <br />
      <strong>Smart filters</strong>
    </td>
    <td align="center" width="50%">
      <img src="docs/assets/readme/06-statistics-insights.png" alt="Statistics insights and expense streaks for the selected year" width="320" />
      <br />
      <strong>Period insights</strong>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="docs/assets/readme/09-profile-account.png" alt="Profile screen with account details, account actions, security actions, and about section" width="320" />
      <br />
      <strong>Flexible account setup</strong>
    </td>
    <td align="center" width="50%">
      <img src="docs/assets/readme/10-sign-in.png" alt="Sign in screen with email or username, Google sign in, account creation, and privacy links" width="320" />
      <br />
      <strong>Sign in</strong>
    </td>
  </tr>
</table>
</div>

<div align="center">
  <img src="docs/assets/readme/11-desktop-guide.png" alt="Desktop guide explaining how to add Finance Manager to the phone home screen" width="920" />
</div>

### Product Scope

<div align="center">
<table align="center" width="100%">
  <tr>
    <td align="center" valign="top" width="50%">
      <img src="docs/assets/readme/12-what-you-can-do-now.jpeg" alt="Current Finance Manager capabilities: track transactions, find movements, understand statistics, use charts, and manage access" width="420" />
    </td>
    <td align="center" valign="top" width="50%">
      <img src="docs/assets/readme/13-coming-next.jpeg" alt="Upcoming Finance Manager features: multiple money places, custom categories, expense bundles, multiple currencies, and faster card expenses" width="420" />
    </td>
  </tr>
  <tr>
    <td align="center" valign="bottom" width="50%">
      <strong>What works today</strong>
    </td>
    <td align="center" valign="bottom" width="50%">
      <strong>Where the product is going</strong>
    </td>
  </tr>
</table>
</div>

## What Makes It Interesting

- It is not just a CRUD app: the main value is in the financial interpretation layer
- The stats screen uses real backend aggregations instead of frontend mock data
- Transaction details include contextual information such as before/after balance and category ranking
- The app supports multiple account types without forcing every user into the same sign-in method
- It combines product UI, backend architecture, authentication, testing, monitoring, and documentation

## Tech Stack

### Web App

<div align="center">
<table align="center" width="100%">
  <tr>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/react" alt="React" height="44" />
      <br />
      <sub>React</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/typescript" alt="TypeScript" height="44" />
      <br />
      <sub>TypeScript</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/vite" alt="Vite" height="44" />
      <br />
      <sub>Vite</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/reactquery" alt="TanStack Query" height="44" />
      <br />
      <sub>TanStack Query</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/apacheecharts" alt="Apache ECharts" height="44" />
      <br />
      <sub>ECharts</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/framer" alt="Framer Motion" height="44" />
      <br />
      <sub>Framer Motion</sub>
    </td>
  </tr>
</table>
</div>

### Backend & Data

<div align="center">
<table align="center" width="100%">
  <tr>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/nodedotjs" alt="Node.js" height="44" />
      <br />
      <sub>Node.js</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/fastify/9ca3af" alt="Fastify" height="44" />
      <br />
      <sub>Fastify</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/zod" alt="Zod" height="44" />
      <br />
      <sub>Zod</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/prisma" alt="Prisma" height="44" />
      <br />
      <sub>Prisma</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/postgresql" alt="PostgreSQL" height="44" />
      <br />
      <sub>PostgreSQL</sub>
    </td>
  </tr>
</table>
</div>

### Auth, Email & Quality

<div align="center">
<table align="center" width="100%">
  <tr>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/google" alt="Google OAuth" height="44" />
      <br />
      <sub>Google OAuth</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/brevo" alt="Brevo" height="44" />
      <br />
      <sub>Brevo</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/vitest" alt="Vitest" height="44" />
      <br />
      <sub>Vitest</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/playwright/playwright-original.svg" alt="Playwright" height="44" />
      <br />
      <sub>Playwright</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/storybook" alt="Storybook" height="44" />
      <br />
      <sub>Storybook</sub>
    </td>
    <td align="center" width="120">
      <img src="https://cdn.simpleicons.org/sentry" alt="Sentry" height="44" />
      <br />
      <sub>Sentry</sub>
    </td>
  </tr>
</table>
</div>

Authentication also uses secure sessions, email verification, recovery codes, and Argon2id password hashing

## Documentation

The original technical README has been moved out of the GitHub landing page and kept as project documentation:

<div align="center">
<table align="center" width="100%">
  <tr>
    <td align="center" width="25%">
      <a href="docs/api-reference.md">
        <img src="https://api.iconify.design/lucide:terminal.svg?color=%230f766e" alt="API and setup reference" height="46" />
        <br />
        <strong>API & Setup</strong>
      </a>
      <br />
      <sub>Endpoints, local setup, environment variables, and backend usage</sub>
    </td>
    <td align="center" width="25%">
      <a href="docs/architecture.md">
        <img src="https://api.iconify.design/lucide:blocks.svg?color=%230f766e" alt="Architecture" height="46" />
        <br />
        <strong>Architecture</strong>
      </a>
      <br />
      <sub>Project structure, app flow, and main technical decisions</sub>
    </td>
    <td align="center" width="25%">
      <a href="docs/database.md">
        <img src="https://api.iconify.design/lucide:database.svg?color=%230f766e" alt="Database" height="46" />
        <br />
        <strong>Database</strong>
      </a>
      <br />
      <sub>Prisma models, persisted data, relations, and migrations</sub>
    </td>
    <td align="center" width="25%">
      <a href="docs/frontend.md">
        <img src="https://api.iconify.design/lucide:panels-top-left.svg?color=%230f766e" alt="Frontend" height="46" />
        <br />
        <strong>Frontend</strong>
      </a>
      <br />
      <sub>Mobile UI, screens, state, gestures, and design conventions</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <a href="docs/security.md">
        <img src="https://api.iconify.design/lucide:shield-check.svg?color=%230f766e" alt="Security" height="46" />
        <br />
        <strong>Security</strong>
      </a>
      <br />
      <sub>Authentication, sessions, rate limits, privacy, and account safety</sub>
    </td>
    <td align="center" width="25%">
      <a href="docs/testing-and-observability.md">
        <img src="https://api.iconify.design/lucide:test-tube.svg?color=%230f766e" alt="Testing and observability" height="46" />
        <br />
        <strong>Testing & Monitoring</strong>
      </a>
      <br />
      <sub>Vitest, Playwright, Storybook, Sentry, coverage, and checks</sub>
    </td>
    <td align="center" width="25%">
      <a href="docs/roadmap.md">
        <img src="https://api.iconify.design/lucide:map.svg?color=%230f766e" alt="Roadmap" height="46" />
        <br />
        <strong>Roadmap</strong>
      </a>
      <br />
      <sub>Current MVP scope, planned features, and product direction</sub>
    </td>
    <td align="center" width="25%">
      <a href="docs/email-verification.md">
        <img src="https://api.iconify.design/lucide:mail-check.svg?color=%230f766e" alt="Email verification" height="46" />
        <br />
        <strong>Email Verification</strong>
      </a>
      <br />
      <sub>Brevo setup, verification codes, delivery flow, and local testing</sub>
    </td>
  </tr>
</table>
</div>

## Local Development

```bash
npm install
npm run dev:api
npm run dev:web
```

The API runs on `http://localhost:3001` and the web app runs on `http://localhost:5173` by default.

Production:

- Web: [https://financemanager-mobile.vercel.app](https://financemanager-mobile.vercel.app)
- API: [https://financemanager-api.vercel.app](https://financemanager-api.vercel.app)

Useful commands:

```bash
npm run build:web
npm run build:api
npm run test:unit
npm run test:e2e
npm run storybook:web
```

## Project Status

Finance Manager is a personal MVP under active development.
It is shared publicly as a featured portfolio project, but it is not currently open source software.

## License

All rights reserved. See [LICENSE](LICENSE).

Copyright © Arnau Sala Araujo
