# FlowBridge decision log

Every decision made on this project and the reason for it. New decisions are added at the bottom of the matching section. If a decision changes, the old one stays and is marked as replaced, so the history is not lost.

Dates are in YYYY-MM-DD format.

## 1. Project scope

| # | Decision | Why |
|---|----------|-----|
| 1.1 | Build FlowBridge, a business process integration and automation platform. | This is the internship assignment from Adz4needz. |
| 1.2 | The workflow execution engine must really run. Integrations must be real. | The assignment says not to build only a static workflow designer or dashboard, and asks for real integrations. |
| 1.3 | Use only open-source software and free hosting, in development and in deployment (2026-11-09). | This is an internship project, not a commercial product, so nothing should cost money. |
| 1.4 | Nothing heavy runs on the development laptop (2026-11-09). | The laptop has 4 GB of RAM and already slows down. |

## 2. Product research and build order

| # | Decision | Why |
|---|----------|-----|
| 2.1 | Study the documentation of several automation products (n8n, Zapier, Make, Power Automate, Workato, Pipedream and Activepieces) before designing. | To understand how real platforms work, instead of copying one product. The findings are in the comparison report. |
| 2.2 | Build in this order: run engine, then triggers, then connections, then the visual builder, then pauses and recovery, then roles and monitoring. | A builder cannot be tested without an engine behind it. The engine is also the part the assignment says must work. |
| 2.3 | Keep a simple form or JSON page during the first three stages. | So there is always something to demonstrate before the builder exists. |
| 2.4 | Pin every run to an immutable workflow version. | Editing a workflow must not change a run that has already started, and old runs must stay explainable. |
| 2.5 | Store the workflow as a graph with stable step IDs, and edges that say when they are followed. | Renaming a step must not break references to it. Branching needs edges that carry a condition. |
| 2.6 | Keep one database row for every step of every run. | It lets a run continue after a crash without repeating finished steps, and it provides the data for the run history screen. |
| 2.7 | Each step has one output. Loops are explicit steps. | It is easier to follow than items flowing implicitly through every step. |
| 2.8 | Save an incoming event in the database before replying to the sender. | If the app crashes after replying, the event must not be lost. |
| 2.9 | Use one pause mechanism for delays, approvals and waiting on external events. | One mechanism is easier to build, test and explain than three. |
| 2.10 | Retry in two layers, for failed steps and for lost workers. Build idempotency keys from run ID and step ID. | A crash can make a step run twice, so external services need a way to recognise the repeat. |
| 2.11 | Use a restricted reference language such as `{{steps.a.output.id}}`, with no JavaScript evaluation for now. | Running user-written code safely is a large problem of its own. |
| 2.12 | Credentials are stored encrypted with AES-256-GCM and used by reference. Secrets are removed from logs. | The assignment requires secure credential handling. A workflow definition must never contain a secret. |

## 3. Users and permissions

| # | Decision | Why |
|---|----------|-----|
| 3.1 | Four roles: Administrator, Workflow Creator, Business User, Technical Operator. | These are the roles named in the assignment. |
| 3.2 | Create, edit and publish workflows: Administrator and Workflow Creator. | They are the people responsible for how a process is built. |
| 3.3 | Retry runs and see step data: Administrator, Workflow Creator and Technical Operator. | Operators need these to investigate failures. |
| 3.4 | Connect and manage integrations: Administrator and Workflow Creator. View and test them: those two and Technical Operator. | Connections hold access to outside systems, so changing them is limited. |
| 3.5 | Members and settings: Administrator only. | These affect the whole workspace. |
| 3.6 | Run available workflows: all four roles. | Running processes is the Business User's whole purpose. |
| 3.7 | Technical Operator sees the Builder read-only. Business User has no Builder, Templates or Integrations. | Each role only sees what it needs. |
| 3.8 | The permissions matrix lives in the documentation and report, not in the admin screen. | It is reference material, not something an administrator edits. |

## 4. Design

| # | Decision | Why |
|---|----------|-----|
| 4.1 | Prototype the design in HTML before writing the product. | So the team could review real pages. |
| 4.2 | Ember design (option C): burnt orange, Manrope and DM Mono fonts, pill buttons, large corners (2026-11-07). | The team chose it from five hosted options. |
| 4.3 | Home page stays Ember, with warm browns and the current hero with two side glows (2026-11-08). | Tested alternatives had too much orange. The original distribution looked best. |
| 4.4 | All other pages use orange and graphite: zinc neutrals, orange `#C94C0A`, hover `#AB4109` (2026-11-08). | The warm palette felt off on working pages. |
| 4.5 | Orange is only for actions and the selected item. Running is blue `#2563EB`. Error `#BE123C`, warning `#A16207`, success text `#166534`. Chart bars and role chips are neutral. | Using orange for everything made it meaningless and tiring to look at. |
| 4.6 | Solid dark sidebar `#15110E` with an orange active item, no gradient. | A gradient sidebar was tried and rejected. |
| 4.7 | No gradients on buttons or the scroll progress line. The other approved gradients stay. | Gradients everywhere look generic, but removing all of them went too far. |
| 4.8 | Backgrounds: Horizon glow on Sign in, the Create workspace panel and the Home closing section. Fine grid on the Home failure section and the replay panel. Light grid at the top of Docs. Grain and spotlight on No access. Flow lines in empty states. | These pages have room for character. |
| 4.9 | Busy work pages (tables, Builder canvas, Settings, Integrations) stay plain. | People work on them all day and need calm screens. |
| 4.10 | Use Lucide icons, matched to the icons used by n8n for the same actions. | Users of automation tools already recognise them. |
| 4.11 | Builder offers a card and a tile view, with card as the default. | Different people prefer different densities. |
| 4.12 | Use real tool logos for integrations instead of letters in boxes. | It looks more trustworthy and is quicker to scan. |
| 4.13 | Fix the table header corners in the real table component, without clipping row menus (deferred). | The header background pokes out of the rounded card. It is easier to fix properly in code than in the prototype. |

## 5. Technology

| # | Decision | Why |
|---|----------|-----|
| 5.1 | TypeScript throughout (2026-11-09). | The assignment leaves the stack open. The developer knows JavaScript and has to explain the code to the team, and TypeScript is JavaScript with types. |
| 5.2 | Keep the code plain and well named, with no clever abstractions or advanced types. | Every part has to be explainable in a walkthrough. |
| 5.3 | React and Vite for the frontend, React Flow for the builder canvas. | Standard, free, and React Flow is built for node graphs. |
| 5.4 | Node.js and Fastify for the backend. | Same language as the frontend, small, and fast to start. |
| 5.5 | PostgreSQL as the only data store. | Workflows, runs and the job queue all sit in one reliable place. |
| 5.6 | Zod for validation. | Validation of incoming data is required by the assignment, and Zod also produces the TypeScript types. |
| 5.7 | ~~Redis and BullMQ for the queue.~~ Replaced by 5.8. | Agreed at first, then replaced on 2026-11-09. |
| 5.8 | pg-boss for background jobs, stored in PostgreSQL (2026-11-09). | It removes Redis entirely. Redis would have to be hosted online because of the 4 GB laptop, and idle BullMQ workers keep using up request-based free plans. pg-boss provides retries, delays and dead letter queues. |
| 5.9 | Free Neon PostgreSQL, with no local database (2026-11-09). | Nothing database-related runs on the laptop, and the free plan needs no credit card. |
| 5.9a | The Neon project is in Singapore (`aws-ap-southeast-1`), fixed at the smallest compute size, 0.25 units, using the direct connection (2026-11-09). | Singapore is close to the developer. The fixed size gives about 400 hours a month within the free 100 compute hours. The direct connection is the safe choice for a job queue that holds database connections open. |
| 5.10 | During development, the API and worker run as one Node process (2026-11-09). | Saves memory on the laptop. |
| 5.11 | ~~Host on Railway or Render.~~ Replaced by 5.12. | Railway only has a trial and a very small monthly credit, so it conflicts with 1.3. |
| 5.12 | Deploy on one free Render web service, with the API and worker in the same process (2026-11-09). | Render's free plan has no background worker type, needs no credit card and gives 750 hours a month. |
| 5.13 | Accept that the free service sleeps after 15 minutes idle. Store schedules in the database and run missed ones on wake. Keep it awake with a free ping during demonstrations. | It costs nothing, and only affects response time after a sleep. It also lets the database sleep, which keeps it within free compute hours. |
| 5.14 | Drizzle ORM with the `pg` driver (2026-11-09). | It is small, has no separate engine process, and reads close to SQL, which makes it easy to explain. |
| 5.15 | npm workspaces (2026-11-09). | npm is already installed. A monorepo tool would add something else to learn. |
| 5.16 | Tests use Node's built-in test runner (2026-11-09). | No extra test framework to install on a low-memory laptop. |
| 5.17 | Run TypeScript with `tsx` instead of a compile step (2026-11-09). | One less build step to run and to explain. |

## 6. Run engine

| # | Decision | Why |
|---|----------|-----|
| 6.1 | ~~Each queue job does one piece of work on a run, then queues the next job.~~ Replaced by 6.10. | Measured at about 39 seconds for a 3-step run, because each step waited for the next queue check. |
| 6.2 | The next action is worked out from the saved step rows every time, by a function that only reads its inputs (2026-11-09). | The same code handles a normal run and a recovered one, and it can be unit tested without a database. |
| 6.3 | A worker takes a time-limited lease on a run before working on it. The lease is longer than the 30 second step limit (2026-11-09). | Two workers can never work on the same run at once, and a dead worker's lease simply runs out. |
| 6.4 | A periodic sweep queues unfinished runs that no worker owns (2026-11-09). | It covers an app stopping between saving a run and queueing it, and restarts work after a free host wakes up. |
| 6.5 | A step that was interrupted runs again, up to 3 attempts, and sends the same idempotency key `runId:stepId` (2026-11-09). | The worker cannot know whether an interrupted call reached the other service. The key lets that service ignore the repeat. |
| 6.6 | A failed step stops the run for now (2026-11-09). | Error paths and step retries belong to the recovery stage of the build order. |
| 6.7 | A step runs when every step before it has finished and at least one incoming edge was followed. Otherwise it is skipped (2026-11-09). | Branches from an If step can join again without the join waiting forever. |
| 6.8 | HTTP steps refuse private network addresses and redirects, allow 30 seconds and accept up to 1 MB (2026-11-09). | Workflow authors choose the URL, so without limits a workflow could reach the server's internal network or exhaust a small free server's memory. |
| 6.9 | Webhook addresses contain a long random token. An `Idempotency-Key` header stops repeated deliveries from starting a second run (2026-11-09). | Senders commonly retry deliveries, and the address must not be guessable. |
| 6.10 | A worker carries a run from step to step inside one job, for up to half of the job's time limit, then queues the rest (2026-11-09). | Removes the wait between steps. A crash still only loses the step in progress, because progress is saved after every step. |
| 6.11 | The database wakes workers through PostgreSQL notifications, with a slower check as a backstop (2026-11-09). | A new run starts straight away, and this also works if the API and worker are ever run separately. |
| 6.12 | A worker handles 3 runs at once. A lease must always be longer than the longest step (2026-11-09). | One slow workflow should not hold up the others. If a lease ran out during a step, another worker would correctly take the run over and repeat that step. |

## 7. Repository

| # | Decision | Why |
|---|----------|-----|
| 7.1 | Application code lives in its own repository, `flowbridge`, separate from the design samples repository (2026-11-09). | The design repository only holds comparison pages for the team. The assignment asks for source code with a clear structure. |
| 7.2 | The repository starts private (2026-11-09). | The owner can make it public when it is ready to submit. Render's free plan can deploy from it either way. |

## 8. Triggers

| # | Decision | Why |
|---|----------|-----|
| 8.1 | Schedules and polls are rows in a `triggers` table, checked every 20 seconds (2026-11-09). | They survive restarts and the free host sleeping. Whatever is overdue is still in the table on wake-up. |
| 8.2 | A trigger creates its run first and saves its next time second, with an idempotency key from the trigger and its scheduled time or item ID (2026-11-09). | If the app stops between the two, the same firing repeats and becomes the existing run. No locks are needed. |
| 8.3 | If several scheduled times were missed, the schedule runs once and moves on (2026-11-09). | Waking up after a long sleep should not start a pile of identical runs. |
| 8.4 | Schedules use five-part cron expressions with a timezone (2026-11-09). | Cron is the widely understood format, and business schedules follow local time. The shortest gap is one minute. |
| 8.5 | The first check of a poll only records existing items and starts no runs (2026-11-09). | Otherwise turning on a poll would start a run for everything already in the list. |
| 8.6 | Polls remember the IDs they have seen, at least the latest 1000, rather than a timestamp (2026-11-09). | Not every API offers a reliable "updated since" field, but list items nearly always have an ID. |
| 8.7 | A poll starts at most 50 runs per check and checks at most once a minute (2026-11-09). | Protects the free database's compute hours. Items over the limit are picked up by the next check. |
| 8.8 | A failing trigger keeps its normal timing and shows the error (2026-11-09). | A broken feed should be visible, and should not be retried non-stop. |
| 8.9 | The saved run is the durable record of a webhook delivery, with no separate events table (2026-11-09). | The run is saved before replying, so a second table would hold the same data. |
| 8.10 | Webhooks can require an HMAC-SHA256 signature, calculated on the exact bytes received (2026-11-09). | Anyone who learns a webhook address could otherwise send fake events. |
| 8.11 | Webhooks accept JSON, form and plain text up to 256 KB, and at most 120 deliveries per workflow per minute. Headers holding secrets are not saved (2026-11-09). | Real services send different formats, a small free server needs limits, and run details are shown to users. |
| 8.12 | Common delivery ID headers are recognised, including `Idempotency-Key`, `webhook-id` and `X-GitHub-Delivery` (2026-11-09). | Repeated deliveries are ignored without any setup for those senders. |
| 8.13 | ~~Webhook secrets and poll headers are stored as plain values for now.~~ Replaced by 9.3 and 9.4. | It was a temporary step until encrypted storage existed. |
| 8.14 | Use `cron-parser` and `@fastify/rate-limit` (2026-11-09). | Both are small, free and widely used, and correct cron and timezone handling is easy to get wrong by hand. |

## 9. Connections and integrations

| # | Decision | Why |
|---|----------|-----|
| 9.1 | First integrations: Slack, Google Sheets, Gmail and Stripe in test mode (2026-11-09). | They are free to use, and together cover messaging, data, email and payments. |
| 9.2 | Credentials are encrypted with AES-256-GCM, and each stored value records its key ID (2026-11-09). | GCM also detects tampering, and the key ID lets keys be changed without losing existing connections. |
| 9.3 | Webhook secrets are encrypted the same way (2026-11-09). | They need the same protection as other credentials. |
| 9.4 | Poll triggers refuse credential headers, and use a saved connection instead (2026-11-09). | Secrets should live in one encrypted place. |
| 9.5 | A workflow refers to a connection by ID only (2026-11-09). | Workflow definitions, versions and exports never contain a secret. |
| 9.6 | Connector code receives a request function, and never the credential (2026-11-09). | Connector code cannot leak what it never sees. |
| 9.7 | Each connector lists the hosts its credentials may be sent to (2026-11-09). | A mistake or a crafted address cannot send a credential to another site. |
| 9.8 | Token refresh locks the connection row, then reads it again before refreshing (2026-11-09). | Several steps can notice an expired token at once. Only one should refresh, and the rest use its result. |
| 9.9 | When Google withdraws access, the connection is marked as needing reconnection (2026-11-09). | The person gets a clear instruction, and repeated failing calls are avoided. |
| 9.10 | Google uses OAuth 2.0. Slack uses a bot token (2026-11-09). | Slack requires an HTTPS redirect address, which a local machine does not have. A bot token also needs far less setup. |
| 9.11 | Only Stripe test keys are accepted (2026-11-09). | A demonstration workflow can then never move real money. |
| 9.12 | Stripe steps send the run and step ID as Stripe's idempotency key (2026-11-09). | A step repeated after a crash returns the original result instead of creating a second payment. |
| 9.13 | Slack, Gmail and Sheets have no repeat protection, so a crash during those steps can repeat them (2026-11-09). | The services offer no idempotency key. It is rare, and the alternative is losing the action. |
| 9.14 | Google's "Testing" status is accepted, and its connections are reconnected after 7 days (2026-11-09). | Publishing would need Google's verification for Gmail access, which does not suit an internship project. |
| 9.15 | Values in fields named like secrets are replaced with `[hidden]` before step data is saved (2026-11-09). | Run details are shown to users. A later step cannot read a field hidden this way, which is an accepted limit. |
| 9.16 | Server logs leave out query strings and webhook tokens (2026-11-09). | Addresses can carry sign-in codes and secret tokens. |
| 9.17 | Credentials are tested when they are added, and are not kept if they fail (2026-11-09). | Mistakes appear immediately rather than during a run. |
| 9.18 | A simple `/connect` page is used to add connections for now (2026-11-09). | Secrets need somewhere to be entered before the real interface exists, as planned in 2.3. It must not be public until sign-in is built. |
