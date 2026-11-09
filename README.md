# FlowBridge

A business process integration and automation platform. Workflows connect external services, react to webhooks and schedules, and run reliably in the background.

- [docs/PROGRESS.md](docs/PROGRESS.md): current state and what comes next.
- [docs/DECISIONS.md](docs/DECISIONS.md): every project decision and the reason for it.

## Status

Working so far: a visual workflow builder, execution history, versioned workflows, HTTP, If and integration steps, crash recovery, manual, webhook, schedule and polling triggers, and encrypted connections to Slack, Google Sheets, Gmail and Stripe test mode.

There is no sign-in yet, so do not deploy it publicly until authentication is added.

## Setup

Needs Node.js 22.12 or newer and a free PostgreSQL database from [Neon](https://neon.com).

```
npm install
cp .env.example .env     # then fill in DATABASE_URL and ENCRYPTION_KEYS
npm run db:migrate
npm run build
npm start
```

Open `http://localhost:3000`.

## Project layout

```
apps/server/src/
  api/          HTTP routes
  db/           Table definitions and database connection
  engine/       Workflow rules, reference resolver, and the code that runs steps
  triggers/     Schedules and polling
  connections/  Encrypted credentials, sign-in and token refresh
  connectors/   One file per service: Slack, Google Sheets, Gmail, Stripe
  index.ts      Starts the API and the worker
apps/web/src/
  pages/        Workflows, Executions, Integrations
  builder/      The canvas, step settings and trigger settings
  components/   Shared pieces of the interface
```

`engine/advance-run.ts` and `builder/flow.ts` are the best places to start reading.

## Connecting services

Open the Integrations screen.

| Service | What you need |
|---------|---------------|
| Slack | A bot token (`xoxb-`) from a Slack app with the `chat:write` and `chat:write.public` scopes |
| Stripe | A test secret key (`sk_test_`). Live keys are refused. |
| Gmail, Google Sheets | A Google OAuth web client, with its ID and secret in `.env`, the Gmail and Sheets APIs enabled, and the redirect address `http://localhost:3000/api/connections/oauth/callback` |

While a Google project's status is "Testing", its connections expire after 7 days and need connecting again.

## Triggers

Every workflow can be started by the Run button or by a POST to its webhook address. In the builder, select the Trigger node to add cron schedules, or checks that start one run for each new item in a list. Signed webhooks use an `X-Flowbridge-Signature: sha256=<HMAC of the body>` header.

## Tests

```
npm test                                     # engine rules, no database needed
npm run crash-test --workspace apps/server   # kills a worker mid-run, needs a database
npm run typecheck
```
