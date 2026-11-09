# FlowBridge architecture

The reasons behind each choice are in [DECISIONS.md](DECISIONS.md).

## Overview

```
Browser (React)  --cookie session-->  Fastify API  -->  PostgreSQL (Neon)
Other apps       --webhooks------->       |                  ^
                                      pg-boss queue          |
                                          |                  |
                                       Worker  --> Slack, Gmail, Sheets, Stripe, any HTTP API
```

One Node.js process runs the API and the worker, because a free host runs one service. PostgreSQL is the only data store, and it also holds the job queue.

## How a run works

1. A trigger saves a run, pinned to an immutable workflow version, and then queues it. If the app stops between the two, a periodic sweep queues it.
2. A worker takes a time-limited lease on the run.
3. `findNextAction` reads the saved step rows and decides the single next thing to do. It only reads its inputs, so a normal run and a recovered run use the same code.
4. The step runs and its result is saved. The worker repeats from step 3.
5. If the worker dies, its lease runs out and another worker continues. Only the step in progress repeats, with the same idempotency key.

## Pauses

Delays, approvals and retry waits share one mechanism. The step is saved as `waiting` with a `resume_at` time, and the run is released. A check every 20 seconds wakes whatever is due, and an approval decision wakes its step straight away. Because a wait is a database row, it survives restarts and the host sleeping.

## Failures

| Situation | What happens |
|-----------|--------------|
| A step has retries left | It waits, doubling each time, and every attempt is recorded |
| A step has an error path | The path runs and the run can still succeed |
| A step has neither | The run fails and the failed step is shown |
| A person retries from the failed step | A new run copies the successful steps and continues with the published version |
| A worker crashes | Another worker continues after the lease ends |

## Security

- Passwords are hashed with scrypt, using a separate salt for each.
- Sessions are random tokens in an HttpOnly, SameSite cookie, and only a hash of each token is stored.
- Every `/api` route needs a session, and permissions are checked on the server. The interface only hides what a person cannot use.
- Credentials are encrypted with AES-256-GCM. Workflows refer to them by ID, and connector code never sees them.
- HTTP steps refuse private network addresses, so a workflow cannot reach internal systems.
- Sign-in is rate limited, and webhooks are rate limited and can require a signature.

## Data

| Table | Holds |
|-------|-------|
| `workspace`, `users`, `sessions` | The workspace, its members and their sign-ins |
| `workflows` | Each workflow, its unpublished draft and its published version |
| `workflow_versions` | Immutable copies of a workflow |
| `triggers` | Schedules and polls |
| `runs`, `step_runs` | Every run, and one row per step |
| `connections`, `oauth_states` | Encrypted credentials and sign-ins in progress |
| `activity` | Who did what, shown on the Overview page |
