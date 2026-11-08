# FlowBridge

A business process integration and automation platform. Workflows connect external services, react to webhooks, and run reliably in the background.

Every project decision and the reason for it is recorded in [docs/DECISIONS.md](docs/DECISIONS.md).

## Status

The run engine is working: versioned workflows, HTTP and If steps, manual and webhook triggers, and crash recovery. The API has no sign-in yet, so do not deploy it publicly until authentication is added.

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

## Tests

```
npm test                                  # engine rules, no database needed
npm run crash-test --workspace apps/server   # kills a worker mid-run, needs a database
npm run typecheck
```
