# FlowBridge

A business process integration and automation platform. Workflows connect external services, react to webhooks, and run reliably in the background.

Every project decision and the reason for it is recorded in [docs/DECISIONS.md](docs/DECISIONS.md).

## Status

Working so far: versioned workflows, HTTP and If steps, crash recovery, and manual, webhook, schedule and polling triggers. The API has no sign-in yet, so do not deploy it publicly until authentication is added.

## Setup

Needs Node.js 22.12 or newer and a free PostgreSQL database from [Neon](https://neon.com).

```
npm install
cp .env.example .env     # then put your database connection string in .env
npm run db:migrate
npm run dev
```

The API is then available at `http://localhost:3000`.

## Project layout

```
apps/server/src/
  api/       HTTP routes for workflows, runs and webhooks
  db/        Table definitions and database connection
  engine/    Workflow rules, reference resolver, and the code that runs steps
  triggers/  Schedules and polling
  index.ts   Starts the API and the worker
```

`engine/advance-run.ts` is the best place to start reading.

## Try it

Create a workflow:

```
curl -X POST http://localhost:3000/api/workflows -H "content-type: application/json" -d '{
  "name": "Check a post",
  "definition": {
    "steps": [
      { "id": "get_post", "name": "Get post", "type": "http_request",
        "config": { "method": "GET", "url": "https://jsonplaceholder.typicode.com/posts/1" } },
      { "id": "is_first", "name": "Is first post", "type": "if",
        "config": { "left": "{{steps.get_post.output.body.id}}", "operator": "equals", "right": 1 } },
      { "id": "save", "name": "Send result", "type": "http_request",
        "config": { "method": "POST", "url": "https://jsonplaceholder.typicode.com/posts",
                    "body": { "title": "{{steps.get_post.output.body.title}}" } } }
    ],
    "edges": [
      { "from": "get_post", "to": "is_first" },
      { "from": "is_first", "to": "save", "when": "true" }
    ]
  }
}'
```

Start it with `POST /api/workflows/:id/runs`, or by sending a POST to `/hooks/:webhookToken`. Follow its progress with `GET /api/runs/:id`.

## Triggers

Add a schedule or a poll with `POST /api/workflows/:id/triggers`:

```
{ "type": "schedule", "config": { "cron": "0 9 * * 1", "timezone": "Asia/Kolkata" } }

{ "type": "poll", "config": { "url": "https://example.com/orders", "itemsPath": "data.orders",
                              "itemIdField": "id", "intervalSeconds": 300 } }
```

A polled item is available to steps as `{{trigger.item.id}}`. A webhook's data is available as `{{trigger.body.name}}`.

To require signed webhooks, call `POST /api/workflows/:id/webhook-secret`. Senders then add an `X-Flowbridge-Signature: sha256=<HMAC of the body>` header.

## Tests

```
npm test                                  # engine rules, no database needed
npm run crash-test --workspace apps/server   # kills a worker mid-run, needs a database
npm run typecheck
```
