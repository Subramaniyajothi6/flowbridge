# Technical research

Section 8 of the assignment lists the topics to investigate before building. This document takes each one in turn: what it is, what the research found, and what FlowBridge does as a result. Decision numbers refer to [DECISIONS.md](../DECISIONS.md). The product comparison behind several of these findings is in [competitor-analysis.md](competitor-analysis.md).

## 1. What workflow automation platforms do

An automation platform watches for something to happen in one application, then carries out a series of actions in others, without a person in between. All seven products studied (n8n, Zapier, Make, Power Automate, Workato, Pipedream and Activepieces) share the same core: a stored workflow definition, a way to detect events, a saved record of each run, a worker that executes one step at a time with mapped data and stored credentials, and a history that lets someone inspect and retry what happened.

They differ in four choices: the shape of a workflow (a straight list or a graph), what moves between steps (one record or many items), what is charged for, and how openly the engine is described.

**FlowBridge:** a graph of steps with stable IDs and conditional edges (2.5), one output per step with explicit loops (2.7), and a run engine built first because everything else depends on it (2.2).

## 2. How business process automation works

A business process is a repeatable sequence of activities with a clear start and outcome, such as "a customer registers, so save them, welcome them and tell sales". Automating it means three things:

- **A trigger** that recognises the start: a form submission, a new row, a time of day.
- **Steps** that each do one job and pass their results on: validate, store, notify, create a task.
- **A record** of every run, so people can see what happened, trust it, and recover when something goes wrong.

This differs from robotic process automation (RPA), which imitates a person clicking through screens. Integration platforms like FlowBridge call each application's API directly, which is faster and far less fragile.

**FlowBridge:** the assignment's registration scenario maps step for step onto the "Welcome new customers" template, and every run is recorded step by step (2.6). People who use processes, rather than build them, get their own simpler view (11.3).

## 3. How applications communicate using APIs

Most modern applications offer a **REST API**: they accept HTTP requests (`GET` to read, `POST` to create, `PUT`/`PATCH` to change, `DELETE` to remove) and reply with JSON and a status code. `2xx` means success, `4xx` means the request was wrong (bad data, missing permission, not found) and `5xx` means the service itself failed.

Calls must prove who is making them. The common methods are an **API key or token** sent in a header (Slack, Stripe, Jira), and **OAuth 2.0**, where a person approves access in the provider's own sign-in page and the platform receives short-lived access tokens plus a refresh token (Google). Services also apply **rate limits**, and the better ones accept an **idempotency key**, so a repeated request is recognised instead of acting twice.

**FlowBridge:**
- **Built-in apps:** Slack, Gmail, Google Sheets and Stripe connectors call these APIs directly (9.1).
- **Any other service:** an HTTP step calls any other REST API, and Administrators can describe a new app's API (such as Jira) without code.
- **Repeat protection:** Stripe calls send `runId:stepId` as the idempotency key, so a repeated step never charges twice (9.12).
- **Errors:** a failed call is retried with growing waits, up to the step's limit. A value missing from earlier steps is never retried, because it will still be missing (6.15). The engine does not yet treat a `4xx` reply differently from a `5xx`, so a request a service rejects as wrong is also retried. Telling them apart is a possible improvement.

## 4. The purpose and functioning of webhooks

A **webhook** is the reverse of an API call: instead of FlowBridge asking a service "anything new?", the service sends an HTTP request to FlowBridge the moment something happens. It is faster and cheaper than **polling**, which asks on a timer, but it needs care:

- **Anyone who learns the address can send to it**, so the address must be unguessable and the sender should sign each delivery. The standard is an HMAC-SHA256 signature over the exact bytes received.
- **Senders retry** when they get no quick reply, so the same event can arrive twice. Most send a delivery ID to recognise repeats.
- **The reply must be fast**, so the work happens after replying, but the event must be saved first, or a crash would lose it.

**FlowBridge:**
- **Addresses** are long random tokens (6.9), and deliveries can require an HMAC-SHA256 signature (8.10).
- **Repeats:** common delivery ID headers are recognised, so a resent event does not start a second run (8.12).
- **Saving first:** the event is saved as a run before replying (2.8, 8.9).
- **Limits:** 120 deliveries per workflow per minute, and 256 KB per delivery (8.11).
- **Polling** is offered for services without webhooks, remembering item IDs rather than timestamps (8.6).

## 5. Event-driven architecture and asynchronous processing

In an **event-driven** system, parts of the system react to events (a webhook arrived, a step finished, a timer fired) rather than calling each other directly and waiting. **Asynchronous processing** means the person or system that caused the event does not wait for all the work: the request is accepted, recorded, and handled in the background.

The research found three properties that matter for automation:

- **Durability:** an accepted event must survive a crash, so it is written to storage before anything else.
- **At-least-once delivery:** background work can be repeated after a failure, so every action needs to be safe to repeat (idempotent).
- **Decoupling:** the API that receives events and the worker that runs them can be scaled or restarted independently.

**FlowBridge:** the API saves a run and puts a job on a queue, then replies. A separate worker picks the job up (6.10). PostgreSQL notifications wake the worker at once, with a slower check as a backstop (6.11). The API and worker run in one process on the free host, but can run as two separate services by changing one setting (5.12).

## 6. Workflow execution engines and task queues

An **execution engine** decides, for each run, what to do next and records the result. The open-source engines studied (n8n, Activepieces) and dedicated systems such as Temporal show the same pattern: keep the run's state in a database, treat each step as a unit of work, and make it possible to resume after a crash. A **task queue** holds the work waiting to be done, so it can be shared between workers and is not lost if a worker stops.

The options considered were Redis with BullMQ, which n8n uses, and **pg-boss**, a queue stored in PostgreSQL. Redis adds a second service to host and pay for, and idle BullMQ workers keep using request-based free plans.

**FlowBridge:**
- **The queue:** pg-boss, so PostgreSQL is the only data store (5.5, 5.8).
- **Deciding the next step:** the next action is worked out from saved step rows by a function that only reads its inputs, so normal and recovered runs use the same code (6.2).
- **Workers:** a worker holds a time-limited lease on a run, so two workers never run it at once, and a dead worker's run is picked up when the lease ends (6.3, 6.4).
- **Each run is pinned** to an immutable workflow version (2.4).

## 7. Background jobs and scheduled operations

Scheduled workflows ("every Monday at 9:00") are usually written as **cron expressions** with a **time zone**, because business schedules follow local time. Two problems come up on real hosting:

- **A sleeping or restarted server misses its timers.** Timers kept only in memory are lost.
- **After a long outage, a naive scheduler fires every missed time at once.**

Long waits inside a run (a delay of two days, or waiting for an approval) have the same problem: a process cannot sit waiting for days.

**FlowBridge:**
- **Schedules and polls** are database rows checked every 20 seconds, so they survive restarts and the free host sleeping (8.1). Five-part cron with a time zone is supported (8.4).
- **After an outage**, a missed schedule runs once, not once per missed time (8.3).
- **Waits:** delays, approvals and retry waits are all a step saved as waiting with a time to resume, released from memory until then (2.9, 6.13).
- **Housekeeping:** old run data and activity are cleared daily in the background (10.25).

## 8. Data transformation and integration patterns

Data rarely leaves one application in the shape the next one needs. The established **enterprise integration patterns** describe the common moves, and every product studied implements them in some form:

| Pattern | Meaning | In FlowBridge |
|---|---|---|
| Message translator / mapping | Reshape data for the next system | References such as `{{trigger.body.email}}` and `{{steps.create_ticket.output.key}}` place earlier values into later steps (2.11) |
| Content-based router | Send data down different paths by its content | If / else, and approval approved or rejected paths |
| Splitter | Handle each item of a list separately | Loop, up to 100 items (6.18) |
| Enricher | Add data from another source | Any step's output can be used by every later step |
| Dead-letter / error channel | Send failures somewhere they are handled | Error paths on any step (6.14) |

The products differ most in how much **code** they allow in mappings. n8n and Pipedream allow JavaScript, while Zapier and Make use a restricted formula language. Running user-written code safely is a substantial security problem.

**FlowBridge:** a restricted reference language with no code evaluation (2.11), ready-made dates such as `{{dates.tomorrow}}`, and a data picker that offers real values from earlier runs (10.6). All incoming data is checked against schemas before use (5.6). **Limitation:** there is no step yet for reshaping values, such as changing case, combining fields or arithmetic. This is listed as a next step.

## 9. Failure handling, retries and execution monitoring

The research separated failures into two kinds:

- **Transient:** a timeout, a rate limit, a service briefly down. Trying again later usually works, and the wait should grow each time (exponential backoff), so a struggling service is not overwhelmed.
- **Permanent:** bad data, a missing record, revoked access. Retrying only repeats the failure. A person has to fix something, and then the run should continue from where it stopped, not from the start.

Error handling in the products studied comes in four layers: retry the step, take an error path, retry the run, and alert someone. Monitoring always starts with a run list and a step-by-step run page. **Alerting was the weakest area**, as it is mostly a paid add-on.

**FlowBridge:**
- **Retries:** up to 5 attempts, with doubling waits, and every attempt recorded. A missing value is treated as permanent and not retried (6.15).
- **Telling failures apart for people:** the engine retries any other failure the same way, but "Why runs failed" and the Business User's Overview sort failures into plain reasons and say whether trying again is likely to help.
- **Error paths:** any step can have one, so a handled failure still lets the run succeed (6.14).
- **Retry from the failed step:** a new run that skips the steps that already worked, so nothing is done twice (6.16).
- **Monitoring:** the Executions list, run pages, Analytics with "Why runs failed" grouped into plain reasons, Activity, system health, and failure notifications by email and in the app for free (10.26).

## 10. Secure storage and management of API credentials

Credentials (API tokens, OAuth tokens) give access to a company's real accounts, so leaking one is serious. The practices found:

- **Encrypt at rest** with authenticated encryption such as AES-256-GCM, which also detects tampering, and record which key encrypted each value so keys can be changed.
- **Never put a secret in a workflow definition**, an export, a log or an API response. Refer to it by ID.
- **Ask for the narrowest access** (OAuth scopes) the integration needs.
- **Refresh tokens carefully**, because several steps may notice an expired token at the same time.
- **Stop credentials being sent elsewhere**: an attacker who controls a URL could otherwise receive them (server-side request forgery).

**FlowBridge:**
- **Encryption:** credentials are encrypted with AES-256-GCM and a key ID (9.2), and workflows refer to them by ID only (9.5).
- **Connector code** never receives the credential (9.6), and each connector lists the only hosts its credential may be sent to (9.7).
- **Token refresh** locks the connection row, so only one step refreshes at a time (9.8).
- **Hiding secrets:** they are hidden from saved step data and logs (9.15, 9.16), and HTTP steps refuse private network addresses (6.8).
- **Stripe** accepts test keys only (9.11).

## 11. Existing platforms such as n8n and Zapier

**n8n** is open source and self-hostable. It has a node graph, JavaScript in expressions, Postgres for storage and Redis for its queue. It is the most transparent about its engine, which made it the main reference for the run design.

**Zapier** is the most widely known. A trigger plus ordered steps, with paths that never rejoin, charged per successful action. It shows how far a simple, friendly model can go, and its limits are visible in complex branching.

**Make, Power Automate, Workato, Pipedream and Activepieces** filled in the picture:
- **Make:** visual scenarios with routers and iterators.
- **Power Automate:** enterprise approvals and governance.
- **Workato:** a role model of Admin, Analyst and Operator, which shaped FlowBridge's three roles (3.16).
- **Pipedream and Activepieces:** developer-friendly code steps.

The full comparison is in [competitor-analysis.md](competitor-analysis.md).

## 12. Limitations and opportunities in existing products

| Limitation found | Opportunity taken in FlowBridge |
|---|---|
| Failure alerts are mostly a paid extra | Email and in-app notifications for failures, expiring connections and a daily summary, included for everyone (10.26) |
| Failures are shown as raw error messages that only builders understand | Plain-language reasons, and whether retrying will help, for Business Users (11.3) |
| Several products have no separate draft: editing changes what is live | Private drafts, test runs kept out of statistics, and numbered published versions (10.14, 10.15) |
| Testing usually touches real systems with no clear warning | Single-step and whole-workflow tests are marked as tests everywhere and kept out of usage figures |
| Starting a workflow by hand means writing JSON | A Run now form built from the details the workflow uses (11.4) |
| Role separation is often an enterprise-plan feature | Three roles enforced on every API route in the free product (3.16) |
| Reconnecting an account can break workflows that use it | Reconnecting the same account refreshes the existing connection, so workflows keep working (10.31) |

Limitations FlowBridge shares, and which are documented in [PRODUCT.md](../PRODUCT.md): no code steps, no database connector, one workspace per installation, and a free host that sleeps when idle.
