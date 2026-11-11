# FlowBridge

A business process integration and automation platform. Organisations connect their applications, build workflows on a visual canvas, react to webhooks and schedules, and monitor every run step by step.

- [docs/PRODUCT.md](docs/PRODUCT.md): what the product does, for whom, and an example workflow.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the system is put together.
- [docs/DECISIONS.md](docs/DECISIONS.md): every project decision and the reason for it.
- [docs/TESTING.md](docs/TESTING.md): the testing report, covering successful and failed executions.
- [docs/PROGRESS.md](docs/PROGRESS.md): current state and what comes next.

## Features

- Visual builder with branching, delays, approvals, loops, retries and error paths
- Drafts, test runs and numbered published versions
- Webhook, schedule, polling and manual triggers
- Encrypted connections to Slack, Google Sheets, Gmail and Stripe test mode
- Crash recovery, so a run continues without repeating finished steps
- Retry from the failed step, with successful steps kept
- Sign-in with four roles, enforced on the server
- Overview, Analytics, system health, usage limits and CSV export

## Setup

Needs Node.js 22.12 or newer and a free PostgreSQL database from [Neon](https://neon.com).

```
npm install
cp .env.example .env     # then fill in DATABASE_URL and ENCRYPTION_KEYS
npm run db:migrate
npm run build
npm start
```

Open `http://localhost:3000` and choose Get started. The first person to register creates the workspace and becomes its Administrator. Everyone else is added on the Team page.

To create one demonstration account for each role instead:

```
SEED_PASSWORD=choose-a-long-password npm run db:seed --workspace apps/server
```

The accounts are `jonah@` (Administrator), `priya@` and `rahul@` (Workflow Builder) and `lena@` (Business User), all at `meridianlogistics.example`. Running it again resets their passwords.

## Deployment

The repository includes `render.yaml` for one free Render web service, with the API and worker in the same process.

1. In Render, choose New, then Blueprint, and select this repository.
2. Enter `DATABASE_URL` and `ENCRYPTION_KEYS`, using the same values as `.env` so saved connections keep working.
3. Set `PUBLIC_URL` to the service's address, for example `https://flowbridge.onrender.com`.
4. For Gmail and Google Sheets, enter `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and add `<PUBLIC_URL>/api/connections/oauth/callback` to the Google client's redirect addresses.
5. Before sharing the address, run the seed command again with a new `SEED_PASSWORD`, because the public site uses the same database.

The free service sleeps after 15 minutes idle. Open it a few minutes before a demonstration.

## Project layout

```
apps/server/src/
  api/          HTTP routes
  auth/         Passwords, sessions and the permissions list
  db/           Table definitions and database connection
  engine/       Workflow rules, reference resolver, pauses, retries and the code that runs steps
  triggers/     Schedules and polling
  connections/  Encrypted credentials, sign-in and token refresh
  connectors/   One file per service: Slack, Google Sheets, Gmail, Stripe
  index.ts      Starts the API and the worker
apps/web/src/
  pages/        One file per screen
  builder/      The canvas, step settings and trigger settings
  components/   Shared pieces of the interface
apps/web/public/
  home.html     The approved public Home page, with its assets in home-assets/
```

`engine/next-action.ts` and `engine/advance-run.ts` are the best places to start reading.

## Connecting services

Open the Integrations screen.

| Service | What you need |
|---------|---------------|
| Slack | A bot token (`xoxb-`) from a Slack app with the `chat:write` and `chat:write.public` scopes |
| Stripe | A test secret key (`sk_test_`). Live keys are refused. |
| Gmail, Google Sheets | A Google OAuth web client, with its ID and secret in `.env`, the Gmail and Sheets APIs enabled, and the redirect address `http://localhost:3000/api/connections/oauth/callback` |

While a Google project's status is "Testing", its connections expire after 7 days and need connecting again.

## Triggers

A published workflow can be started by the Run button or by a POST to its webhook address. In the builder, select the Trigger node to add cron schedules, or checks that start one run for each new item in a list. Signed webhooks use an `X-Flowbridge-Signature: sha256=<HMAC of the body>` header.

## Tests

```
npm test                                     # engine rules, no database needed
npm run crash-test --workspace apps/server   # kills a worker mid-run. Stop the app first.
npm run typecheck
```
