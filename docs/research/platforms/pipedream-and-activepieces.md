# Pipedream and Activepieces: How They Work End to End

Retrieved 7 November 2026. Sources are the official docs (read through each site's `llms-full.txt` export), official pricing pages, and the Activepieces and Pipedream GitHub repositories. Claims marked "(code)" come from reading Activepieces source on `main`, not from its docs. Code behaviour can change without notice.

**Three findings that change how to use this reference**

1. **Pipedream Workflows is being shut down.** Workflows and String shut down on 31 March 2027, are in maintenance mode, and no longer accept signups or subscriptions. Pipedream is refocusing on Connect, its integration layer for AI ([shutdown notice](https://pipedream.com/docs/workflows)). Treat the Pipedream workflow engine as a design reference, not a live competitor.
2. **Workday owns Pipedream.** Workday's fiscal Q4 2026 results list the acquisition as closed ([Workday 8-K](https://www.sec.gov/Archives/edgar/data/1327811/000132781126000010/wday-01312026x991.htm)). The exact closing date was not found.
3. **"Open source" fits only one of the two.** Activepieces is MIT outside its enterprise directories ([LICENSE](https://github.com/activepieces/activepieces/blob/main/LICENSE)). Pipedream's public repo is under the "Pipedream Source Available License Version 1.0", which is not an open source licence label ([LICENSE](https://github.com/PipedreamHQ/pipedream/blob/master/LICENSE)). Its docs describe that repo as the home of the component registry ([components](https://pipedream.com/docs/components)).

---

## Pipedream

### 1. Workflow model and terminology

#### Takeaway
A workflow is a linear or block-structured sequence of steps run on each trigger event. Pipedream separates the event producer (a source) from the logic that consumes it (a workflow).

#### Cited Findings
- A workflow is a sequence of steps triggered by an event. Steps are triggers, pre-built actions, or code in Node.js, Python, Go, or Bash, and they run in order — [Workflows overview](https://pipedream.com/docs/workflows/overview)
- Saving a workflow deploys it to Pipedream's servers, and it runs on each event whether or not the browser is open — [Workflows overview](https://pipedream.com/docs/workflows/overview)
- An event source runs code that collects events and emits them. One source can trigger any number of workflows, which separates data production from processing logic — [Triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)
- Components are Node.js modules of two types. Sources are deployed, run independently, and emit events. Actions are invoked on demand and return data — [Components](https://pipedream.com/docs/components)
- A workflow segment is a linear run of steps with no control-flow operators. Each segment compiles to its own executable function, and it is the unit for billing and `/tmp` scope — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow)
- Blocks are compound steps with independently testable start and end phases. Start evaluates rules, and End exports results — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow)
- A workflow can have multiple triggers — [Triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)

#### Inferences
- The segment model is the key design idea. Each pause or branch boundary ends one function and starts another, which explains the per-segment billing, the timeout reset, and the `/tmp` scoping.

#### Gaps
- The persisted workflow schema is not specified in the docs. The [export tool](https://pipedream.com/docs/workflows/export-workflows) outputs one JSON file per workflow covering triggers, steps, code, props, and control flow, but no format reference was found.

### 2. Triggers

#### Takeaway
Native HTTP, schedule, and email triggers sit alongside app-based sources. App sources use webhooks or timers, with deduplication applied at emit time by the source.

#### Cited Findings
- HTTP triggers get a unique URL and are public by default. They optionally support a static bearer token or Pipedream OAuth — [Triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)
- The default HTTP response is 200 OK. `$.respond()` customizes it and runs at the end of the workflow unless `immediate: true` is set, in which case the workflow continues after responding — [Triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)
- Schedule triggers accept "every N" intervals or cron expressions tied to any timezone. A **Run Now** button runs them manually — [Triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)
- HTTP body limit is 512KB, returning 413 above it. `pipedream_upload_body=1` or the `x-pd-upload-body: 1` header bypasses it up to 5TB. Rate is an average of 10 QPS, returning 429 above it, and paying customers can request more. Email is limited to 30MB — [Limits](https://pipedream.com/docs/workflows/limits)
- The timer interface takes `intervalSeconds` or `cron`, and the HTTP interface generates an endpoint for a source — [Component API](https://pipedream.com/docs/components/contributing/api)
- Some app triggers poll, with frequency set via `intervalSeconds` in the timer config — [Connect triggers](https://pipedream.com/docs/connect/components/triggers)
- Source lifecycle hooks are `deploy`, `activate`, and `deactivate`. `activate` runs on each deploy or update — [Component API](https://pipedream.com/docs/components/contributing/api)
- Sources keep state in `$.service.db` with `get` and `set`. Guidelines say to persist the last page, token, or record ID right after processing to minimize duplicates — [Component API](https://pipedream.com/docs/components/contributing/api); [Guidelines](https://pipedream.com/docs/components/contributing/guidelines)
- Deduplication requires an emitted `id` in event metadata, with three strategies: `unique` (FIFO cache of 100 ids), `greatest` (largest numeric id only), and `last` (only events after the last-seen id; if none match, all are emitted) — [Component API](https://pipedream.com/docs/components/contributing/api)
- Sources can emit to the API and SSE as well as workflows — [Triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)

#### Inferences
- The `unique` cache of 100 means a poll returning more than 100 new or repeating items can re-emit old ones. FlowBridge should size this cache per source rather than fix it.

#### Gaps
- No delivery guarantee (at-least-once or exactly-once) for workflow execution was found in the docs.
- Native HTTP and cron triggers have no documented deduplication. Dedupe is documented as a source feature only.

### 3. Logic

#### Takeaway
Branching, parallel, and delay exist as operators. Looping has no operator and is left to code. Long waits work by ending the current function and starting a new execution later.

#### Cited Findings
- Operators: If/Else (beta), Switch, Parallel, Delay, Filter, End Workflow. Blocks can nest with no stated limit — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow); [Parallel](https://pipedream.com/docs/workflows/building-workflows/control-flow/parallel)
- The rule builder supports nested groups with AND/OR over exists, string, number, boolean, and type checks. It is documented for If/Else only — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow)
- Parallel runs all matching branches. The End phase exports an object keyed by branch name slug, containing each branch's last-step exports. Queue settings "may not work as expected" with it in beta — [Parallel](https://pipedream.com/docs/workflows/building-workflows/control-flow/parallel)
- "More operators (including parallel and looping) are coming soon" still appears in the overview, even though Parallel has its own page — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow)
- Delay ranges from 1 millisecond to 1 year, as a no-code action or `$.flow.delay`. States are Paused, Resumed, and Cancelled — [Delay](https://pipedream.com/docs/workflows/building-workflows/control-flow/delay)
- Paused time consumes no credits, but a delayed workflow uses at least two credits: one to start and one on resume — [Node delay](https://pipedream.com/docs/workflows/building-workflows/code/nodejs/delay)
- Human input is `$.flow.suspend()`, which returns execution-specific `resume_url` and `cancel_url`. The workflow pauses at the end of the step, so URLs can be sent out first. Resume data appears in `$resume_data`. Default timeout is 24 hours, configurable in milliseconds — [Rerun](https://pipedream.com/docs/workflows/building-workflows/code/nodejs/rerun)
- `$.flow.rerun(delay, null, maxRetries)` re-runs one step, for polling a job or retrying an API call — [Rerun](https://pipedream.com/docs/workflows/building-workflows/code/nodejs/rerun)
- Sub-flows: `$.flow.trigger(workflowId, payload)` invokes another workspace workflow without leaving the platform. It is labelled alpha. A Trigger Workflow action also exists — [Node.js code](https://pipedream.com/docs/workflows/building-workflows/code/nodejs)
- `$.flow.exit()` ends a run, and `return $.flow.exit()` stops immediately — [Node.js code](https://pipedream.com/docs/workflows/building-workflows/code/nodejs)
- Code steps support Node.js, Python, Go, and Bash, and builder props on code steps are Node.js only — [Workflows overview](https://pipedream.com/docs/workflows/overview)

#### Inferences
- No loop operator was shipped, so the product stops short of a full visual orchestration model. A FlowBridge loop block would go beyond what Pipedream built.

#### Gaps
- Human input has no built-in form or approval UI in the pages read. The documented pattern is URLs delivered by email or another channel.

### 4. Data

#### Takeaway
Steps reference each other through a `steps` object, and `{{ }}` fields evaluate as Node.js. Scope is enforced by segment ancestry.

#### Cited Findings
- `steps.<name>.<export>` references earlier output, and `steps.trigger.event` holds the trigger payload. Exports must be JSON serializable. Renaming a step means updating references by hand — [Workflows overview](https://pipedream.com/docs/workflows/overview)
- Props accept `{{ }}` expressions with an object explorer and autocomplete, and they can run Node.js such as `{{JSON.stringify(event.foo)}}` — [Using props](https://pipedream.com/docs/workflows/building-workflows/using-props)
- A step can reference only earlier steps in its own segment or direct ancestors. Sibling branches cannot see each other, and later steps read a block's output through its End phase, e.g. `steps.ifelse.$return_value` — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow)
- Combined logs, exports, and original event data cannot exceed 6MB per execution, and this cannot be raised — [Limits](https://pipedream.com/docs/workflows/limits)
- Data stores are a shared key-value store with TTL, usable across workflows by no-code actions or code. Limits on store count, keys, and storage vary by plan — [Data stores](https://pipedream.com/docs/workflows/data-management/data-stores); [Limits](https://pipedream.com/docs/workflows/limits)
- File Stores persist files across segments and executions, because `/tmp` (2GB) is scoped per segment — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow); [Limits](https://pipedream.com/docs/workflows/limits)
- Variables can be workspace-wide or project-scoped and are read as `process.env.*` — [Environment variables](https://pipedream.com/docs/workflows/environment-variables)

#### Inferences
- Forcing cross-branch data through the End phase prevents references to steps that may not have run. It is a sound rule to copy.

#### Gaps
- Sandboxing of `{{ }}` expression evaluation is not documented.

### 5. Connections

#### Takeaway
Managed OAuth and key-based accounts are encrypted with AWS KMS and loaded into the isolated VM at run time. Connect extends this to a customer's end users through scoped tokens.

#### Cited Findings
- OAuth is preferred where available, with API keys otherwise. All OAuth grants, keys, and env vars are encrypted at rest using AWS KMS keys (256-bit AES-GCM, controlled by Pipedream, rotated yearly) — [Security](https://pipedream.com/docs/privacy-and-security)
- Linked credentials are loaded into the program's execution environment, a VM with isolated RAM and disk. Credentials are not logged by default, but user code that logs them will store them until deleted or expired — [Security](https://pipedream.com/docs/privacy-and-security)
- Deleting a grant in Pipedream does not revoke access at the third party — [Security](https://pipedream.com/docs/privacy-and-security)
- Code reads credentials from `this.myAppPropName.$auth` — [Component API](https://pipedream.com/docs/components/contributing/api)
- REST API OAuth client secrets are salted, hashed, and encrypted. Access tokens are ED25519-signed JWTs expiring after 1 hour. Private key JWT (RFC 7523) is supported — [Security](https://pipedream.com/docs/privacy-and-security)
- In Connect, end users are identified by `external_user_id`. Connect tokens are single use, expire after 4 hours, are scoped to one user and environment, and can only start an auth flow — [Connect tokens](https://pipedream.com/docs/connect/managed-auth/tokens); [Security](https://pipedream.com/docs/privacy-and-security)
- Connect has separate `development` and `production` environments for accounts and credentials — [Environments](https://pipedream.com/docs/connect/managed-auth/environments)
- With Pipedream's OAuth client you can run tools and proxy requests, but you cannot retrieve user credentials or invoke workflows. A custom OAuth client allows both. Client secrets are write-only through the API — [OAuth clients](https://pipedream.com/docs/connect/managed-auth/oauth-clients)
- Pipedream does not store or log request or response bodies for Connect API or MCP calls — [Security](https://pipedream.com/docs/privacy-and-security)
- Hosting is AWS `us-east-1`. SOC 2 Type 2, GDPR, annual pen tests, and HIPAA BAAs are documented — [Security](https://pipedream.com/docs/privacy-and-security)
- VPCs provide isolated networks with static egress IPs unique to the workspace — [Security](https://pipedream.com/docs/privacy-and-security)

#### Inferences
- The restriction on retrieving tokens from Pipedream's shared OAuth client protects its app approvals. A similar rule makes sense if FlowBridge offers shared OAuth apps.

#### Gaps
- Token refresh scheduling is not documented beyond Pipedream "ensuring you always have a fresh access token" ([OAuth clients](https://pipedream.com/docs/connect/managed-auth/oauth-clients)).

### 6. Integrations

#### Takeaway
3,000+ apps and 10,000+ tools. A connector is an app file plus Node.js component modules in a public registry, with a proxy and HTTP action for gaps.

#### Cited Findings
- 3,000+ connectors and 10,000+ prebuilt tools and triggers — [Pricing](https://pipedream.com/pricing)
- Components are Node.js modules using managed auth and most npm packages without `npm install`. They are developed locally and deployed or published with the CLI — [Components](https://pipedream.com/docs/components)
- Component fields include `name`, `key`, `version`, `props`, `hooks`, `dedupe`, and `run`, with semver required for the registry. TypeScript is in beta — [Component API](https://pipedream.com/docs/components/contributing/api); [Components](https://pipedream.com/docs/components)
- Props support async options with pagination context, shared prop definitions, and dynamic props — [Component API](https://pipedream.com/docs/components/contributing/api)
- Private actions are published with the CLI and referenced with the `~/` prefix — [Components](https://pipedream.com/docs/components)
- The HTTP Request action is a Postman-like builder that attaches a connected account and sets the auth header automatically. Code steps are the next fallback — [HTTP](https://pipedream.com/docs/workflows/building-workflows/http)
- The Connect proxy takes a request plus an end user, inserts that user's credentials, forwards it, and returns the response — [API proxy](https://pipedream.com/docs/connect/api-proxy)
- MCP exposes the tool catalogue to agents through a static OAuth URL, with `toolAnnotations` marking read, write, and destructive tools — [Changelog](https://pipedream.com/docs/changelog)
- Conduit is a newer product that connects AI assistants to work apps, is available as a hosted service, and runs with Docker or Kubernetes — [Conduit](https://pipedream.com/docs/conduit/index); [Install](https://pipedream.com/docs/conduit/deploy/install); [Cloud](https://pipedream.com/docs/conduit/cloud)

#### Inferences
- The durable asset is the connector registry and managed auth, not the workflow builder. Pipedream's own product decision supports this reading.

#### Gaps
- Review criteria and turnaround for registry contributions were not examined in depth. See the [contribution guide](https://pipedream.com/docs/components/contributing).

### 7. Testing and debugging

#### Takeaway
Test events drive per-step testing in the builder, with stale-state tracking. Testing is free but separate from live error handling.

#### Cited Findings
- A generated or selected test event feeds autocomplete and step tests — [Quickstart](https://pipedream.com/docs/workflows/quickstart)
- Later steps on the execution path are marked stale when earlier ones change. Steps outside the executed path can be tested, with a warning that results may be unreliable — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow)
- Start and End block phases test independently. Pipedream recommends testing Start, then path steps, then End, then generating events for other branches — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow)
- Testing uses no credits, but Free workspaces have a daily test runtime limit. The docs give "750" with no unit — [Limits](https://pipedream.com/docs/workflows/limits); [Pricing docs](https://pipedream.com/docs/pricing)
- Test errors do not trigger emails or `$errors` listeners — [Errors](https://pipedream.com/docs/workflows/building-workflows/errors)
- The Inspector lists events with logs and data for each step, and replays or deletes them — [Inspect](https://pipedream.com/docs/workflows/building-workflows/inspect)
- Debug with AI sends error details, step code, and static step configuration to OpenAI, but not event data — [Errors](https://pipedream.com/docs/workflows/building-workflows/errors)

#### Inferences
- Stale-step tracking plus execution-path highlighting is a lower-cost alternative to forcing a step-by-step test sequence.

#### Gaps
- None material for this question.

### 8. Publishing and versioning

#### Takeaway
Plain workflows have a build and deploy distinction. Real version control comes from GitHub Sync at project level, with branch-based editing and merges to production.

#### Cited Findings
- Saving and deploying pushes the workflow to servers. Each version of a source or workflow is deployed to its own VM — [Workflows overview](https://pipedream.com/docs/workflows/overview); [Security](https://pipedream.com/docs/privacy-and-security)
- GitHub Sync is bi-directional and per project, with one repo per project, using OAuth or deploy keys — [GitHub Sync](https://pipedream.com/docs/workflows/git)
- With sync on, all changes, including settings such as concurrency and auto-retry, must happen in a development branch. Merging to the `production` branch deploys every modified resource together — [GitHub Sync](https://pipedream.com/docs/workflows/git)
- Merges can be made in the UI with a diff, or via GitHub PR, but required PR reviews are not supported — [GitHub Sync](https://pipedream.com/docs/workflows/git)
- Known issues: branches cannot be deleted, and merging fails if a workflow uses a deprecated action — [GitHub Sync](https://pipedream.com/docs/workflows/git)
- Replay runs an event against the newest workflow version — [Inspect](https://pipedream.com/docs/workflows/building-workflows/inspect)

#### Inferences
- Failing a merge on a deprecated action suggests that registry action versions are checked at deploy time.

#### Gaps
- I found no version history or rollback page for non-Git workflows in the [docs index](https://pipedream.com/docs/llms.txt). This is absence from the docs, not proof the feature is absent from the product.

### 9. Execution engine

#### Takeaway
Serverless per-workflow VMs on AWS, Firecracker-linked, with scale-out by spawning workers. The docs describe behaviour and limits but not the internal architecture.

#### Cited Findings
- Each deployed version gets its own AWS VM with isolated RAM and disk. The docs link Firecracker for the virtualization details. VM instances are "workers", which AWS shuts down after about 5 minutes idle — [Security](https://pipedream.com/docs/privacy-and-security)
- Cold starts take a few seconds after about 5 minutes of inactivity or when existing workers are busy — [Settings](https://pipedream.com/docs/workflows/building-workflows/settings)
- A worker handles one request at a time. Dedicated workers remove cold starts, take 5–10 minutes to provision, and bill 5 credits per 10 minutes per worker per 256MB. Startup of about 50ms per step remains — [Settings](https://pipedream.com/docs/workflows/building-workflows/settings)
- Memory defaults to 256MB and goes up to 10GB, with CPU proportional. `/tmp` is 2GB — [Limits](https://pipedream.com/docs/workflows/limits)
- Default timeouts are 30s for HTTP and email and 60s for cron. Maximums are 300s on Free and 750s on paid — [Limits](https://pipedream.com/docs/workflows/limits)
- The timeout resets at each control-flow boundary, which enables long-running workflows — [Control flow](https://pipedream.com/docs/workflows/building-workflows/control-flow)
- Source-to-workflow events go through a queue. Controls are per-workflow concurrency (workers) and fixed-window throttling: limit 0–10000, interval 1–10000 seconds, minutes, or hours. Concurrency 1 gives serial, in-order execution — [Concurrency](https://pipedream.com/docs/workflows/building-workflows/settings/concurrency-and-throttling)
- The Free queue holds 100 events, and overflow is **dropped** with an error and email. Native HTTP, cron, SDK, and email triggers have no queue support — [Concurrency](https://pipedream.com/docs/workflows/building-workflows/settings/concurrency-and-throttling)
- Setting the throttle limit to 0 pauses queue processing — [Concurrency](https://pipedream.com/docs/workflows/building-workflows/settings/concurrency-and-throttling)
- A sample action response shows timing fields named `sidekiq_to_lambda` and `lambda_done` — [Connect actions](https://pipedream.com/docs/connect/components/actions)

#### Inferences
- The `sidekiq_to_lambda` fields suggest a Sidekiq-dispatched AWS Lambda path for at least Connect actions. This fits the Firecracker link and the 5-minute idle behaviour, but Pipedream does not state it as architecture.

#### Gaps
- Dispatch, queue technology, state store, and scaling internals are not documented. The execution platform source was not available in the material reviewed.
- Crash recovery semantics for a worker dying mid-segment are not documented.

### 10. Error handling

#### Takeaway
Step-level auto-retry with long backoff, a global `$errors` stream for custom handlers, and manual or API replay.

#### Cited Findings
- Auto-retry resumes from the failed step, up to 8 times over 10 hours with exponential backoff. It excludes out-of-memory and timeout errors — [Settings](https://pipedream.com/docs/workflows/building-workflows/settings)
- A retrying step exports `$summary` and `$attempt`, with `error`, `cancel_url`, `rerun_url`, and `resume_ts` — [Settings](https://pipedream.com/docs/workflows/building-workflows/settings)
- Notification comes after the final failure by default, and **Send notification on first error** is optional — [Settings](https://pipedream.com/docs/workflows/building-workflows/settings)
- `Workspace $error events` is a source any workflow can subscribe to for custom error handling, and it includes duplicates — [Errors](https://pipedream.com/docs/workflows/building-workflows/errors)
- A REST endpoint lists the most recent 100 errors per workflow, with `expand=event` returning the original event for programmatic replay — [Errors](https://pipedream.com/docs/workflows/building-workflows/errors)
- `id` changes per execution while `trace_id` stays constant across retries of one original event — [Triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)
- Code steps can use native `try/catch`. Pipedream says catch-style handling for built-in actions is planned — [Errors](https://pipedream.com/docs/workflows/building-workflows/errors)

#### Inferences
- Exposing retry state as step exports with cancel and rerun URLs makes retries operable from outside the platform, which is a useful pattern.

#### Gaps
- Retry intervals beyond "8 times over 10 hours" are not specified.

### 11. Monitoring

#### Takeaway
A per-workflow Inspector and a workspace Event History, with de-noised email alerts.

#### Cited Findings
- Event History shows all workflow events and stack traces, filterable by status (including Error and paused), time, and workflow name — [Event History](https://pipedream.com/docs/workflows/event-history)
- Default error email is limited to one per error, per workflow, per 24 hours — [Errors](https://pipedream.com/docs/workflows/building-workflows/errors)
- Event retention is 7 days on Free, plan-specific on paid, and event details expire after 365 days — [Limits](https://pipedream.com/docs/workflows/limits)
- **Disable data retention** turns off all workflow logging, but sources still log inbound events and the builder still surfaces them. `x-pd-nostore` is a per-request control — [Settings](https://pipedream.com/docs/workflows/building-workflows/settings); [Triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)
- Usage emails go at 100% on Free and 80% and 100% on paid — [Limits](https://pipedream.com/docs/workflows/limits)

#### Inferences
- The "first per error per day" email rule also appears at Activepieces in a similar form, so it looks like a proven way to limit alert noise.

#### Gaps
- No metrics export or OpenTelemetry integration was found for Workflows. Conduit has its own [telemetry export](https://pipedream.com/docs/conduit/configure/telemetry) and Prometheus [monitoring](https://pipedream.com/docs/conduit/deploy/monitoring).

### 12. Administration

#### Takeaway
A workspace, project, and folder hierarchy with three fixed roles. Project restriction, SSO, and SCIM sit on the Business plan.

#### Cited Findings
- Workspace roles are Owner, Admin, and Member. Only Owners can delete the workspace or remove owners — [Workspaces](https://pipedream.com/docs/workspaces)
- Workspace admins and owners have the same rights as project creators. Members can manage workflows, files, and variables but not member access, GitHub Sync settings, or project deletion — [Access controls](https://pipedream.com/docs/projects/access-controls)
- All members can access all projects by default, and restricting a project needs the Business plan — [Access controls](https://pipedream.com/docs/projects/access-controls)
- SSO supports Google Workspace, Okta, and SAML — [SSO](https://pipedream.com/docs/workspaces/sso)
- SSO, SCIM, HIPAA, and dedicated static egress IPs are listed on Business — [Pricing](https://pipedream.com/pricing)

#### Inferences
- Pipedream's governance is noticeably lighter than Activepieces', which fits its developer audience.

#### Gaps
- I found no audit log documentation for Workflows. Audit log references sit in the [Conduit access control](https://pipedream.com/docs/conduit/configure/access-control) section. Custom roles were not found either.

### 13. Templates, AI, limits, pricing

#### Takeaway
Pricing is compute time, not steps. Current public plans now sell Connect only, and the plan pages for Workflows are effectively retired.

#### Cited Findings
- Workflows credit: 1 per 30 seconds of compute at 256MB per segment, scaling with memory in 256MB increments, with no per-step charge — [Pricing docs](https://pipedream.com/docs/pricing)
- Registry sources are free when attached to a workflow, while private sources are billed — [Pricing docs](https://pipedream.com/docs/pricing)
- Connect credit: 1 per 30 seconds of compute for action runs, MCP tool calls, proxy requests, and deployed trigger emits. Listing and configuration calls are free — [Pricing](https://pipedream.com/pricing)
- Current plans: Free ($0, development only). Startup ($99/month annual or $150 monthly, 10,000 credits, 100 external users, then $0.012/credit and $2/user). Business (custom) — [Pricing](https://pipedream.com/pricing)
- Unused credits do not roll over — [Pricing FAQ](https://pipedream.com/docs/pricing/faq)
- Sharing creates a link that lets others make a template copy using their own connected accounts — [Sharing](https://pipedream.com/docs/workflows/building-workflows/sharing)
- AI: String.com builds and edits workflows, but cannot edit ones using control flow, GitHub Sync, Python, Connect, or multiple triggers. String is also shutting down — [Build with AI](https://pipedream.com/docs/workflows/building-workflows/build-with-ai); [Shutdown](https://pipedream.com/docs/workflows)
- All Workflows data, including credentials, is deleted by 30 April 2027, and export is per project as JSON — [Shutdown](https://pipedream.com/docs/workflows); [Export](https://pipedream.com/docs/workflows/export-workflows)

**Source conflicts and errors**
- The 1GB credit table shows 24 credits for three segments, where the stated rule gives 12 (4 × 3) and the two-segment row gives 8 — [Pricing docs](https://pipedream.com/docs/pricing). This looks like a docs error.
- Docs still cite an "Advanced Plan" for auto-retry ([Settings](https://pipedream.com/docs/workflows/building-workflows/settings)) and a "Basic" plan ([Pricing docs](https://pipedream.com/docs/pricing)), but neither is on the current [Pricing](https://pipedream.com/pricing) page.

#### Inferences
- The export tool outputs structure only, so a migration importer for FlowBridge would have to re-establish credentials. The window before March 2027 is a possible migration opportunity, though the user base's size is unknown.

#### Gaps
- Former Workflows plan prices and per-plan limits are no longer on the public pricing page.

---

## Activepieces

### 1. Workflow model and terminology

#### Takeaway
A flow is a trigger plus a tree of actions stored as JSON and run by a compiled TypeScript engine. Pieces are versioned npm packages providing the actions and triggers.

#### Cited Findings
- A flow has a trigger and actions — [Building flows](https://www.activepieces.com/docs/flows/building-flows)
- The engine is TypeScript that parses flow JSON and executes it, compiled to a single JS file running in the sandbox — [Architecture](https://www.activepieces.com/docs/install/architecture/overview)
- Pieces are standard npm packages, and each step is pinned to an exact version — [Piece syncing](https://www.activepieces.com/docs/install/architecture/piece-syncing)
- Building blocks are agents, flows, and tables, which can call each other — [Welcome](https://www.activepieces.com/docs/overview/welcome)
- A project contains flows, connections, and tables. A platform is the admin layer above projects — [Projects](https://www.activepieces.com/docs/admin-guide/guides/structure-projects)
- Step handlers are `router`, `ai-router`, `loop`, `code`, and `piece` executors (code) — [engine handlers](https://github.com/activepieces/activepieces/tree/main/packages/server/engine/src/lib/handler)
- Flows can be laid out vertically or horizontally, with parent-to-child data flow — [Passing data](https://www.activepieces.com/docs/flows/passing-data)

#### Inferences
- `firstLoopAction` in the loop handler suggests a linked next-action structure rather than a separate edge list ([loop-executor](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/handler/loop-executor.ts)).

#### Gaps
- The full flow JSON schema was not reviewed. The docs do not specify it in the pages read.

### 2. Triggers

#### Takeaway
Three trigger strategies in the piece framework, a 5-minute default poll, and a dedupe model that combines cursor state in the polling library with a short-lived Redis key.

#### Cited Findings
- Types: `TriggerStrategy.WEBHOOK`, `POLLING`, and `APP_WEBHOOK`, with `onEnable`, `onDisable`, `run` (returns an array, each item starting a run), and `test` — [Triggers](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/overview)
- Polling runs every 5 minutes on the piece model, configurable by `AP_TRIGGER_DEFAULT_POLL_INTERVAL`, with a 60-second default timeout — [Polling](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/polling-trigger); [Env vars](https://www.activepieces.com/docs/install/reference/environment-variables)
- The polling library gives two dedupe strategies. `DedupeStrategy.TIMEBASED` uses `lastFetchEpochMS`, and `DedupeStrategy.LAST_ITEM` uses the last item ID — [Polling](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/polling-trigger)
- `context.store` persists cursors between runs — [Triggers](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/overview)
- Republish behaviour differs by type. An unchanged polling trigger keeps polling with no hooks run, while a webhook trigger runs old `onDisable` and new `onEnable` with `isRepublish: true`. A failing `onEnable` fails the publish, while a failing `onDisable` is logged and ignored — [Triggers](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/overview)
- Webhooks can be asynchronous or `/sync`, which holds the connection until the flow finishes — [Benchmark](https://www.activepieces.com/docs/install/architecture/benchmark)
- A separate payload dedupe uses a Redis key `flowVersionId:dedupeKey` with a 30-second expiry, dropping repeats within that window when a payload carries the dedupe key property (code) — [dedupe-service](https://github.com/activepieces/activepieces/blob/main/packages/server/api/src/app/trigger/dedupe-service.ts)
- Core trigger pieces include `schedule`, `webhook`, `manual-trigger`, `forms` (form and chat triggers), and table-change triggers (code and docs) — [core pieces](https://github.com/activepieces/activepieces/tree/main/packages/pieces/core); [Tables in flows](https://www.activepieces.com/docs/tables/in-flows)
- Webhook payload limits: 5MB on Cloud, 25MB self-hosted default, returning 413 above it. Payloads under the inline threshold live in Redis, and larger ones go to file storage — [Limits](https://www.activepieces.com/docs/install/reference/limits); [Env vars](https://www.activepieces.com/docs/install/reference/environment-variables)

**Source conflict:** the trigger overview marks App Webhooks "Not Supported", yet the same page lists `APP_WEBHOOK` as a strategy and its own hook table and a [setup page](https://www.activepieces.com/docs/install/configure-operate/setup-app-webhooks) exist. The "Not Supported" text looks stale.

#### Inferences
- The 30-second window only catches near-simultaneous duplicates. Long-range idempotency for webhook senders would need flow logic or a store.

#### Gaps
- Which triggers set the dedupe key is not documented.
- Webhook signature verification is not covered as a platform-wide feature in the pages read; it appeared in piece or trigger configuration only.

### 3. Logic

#### Takeaway
Loops, routers, delays, approvals, and sub-flows are built in. Pauses are durable waitpoint rows, and parallel fan-out uses barriers. Loop iterations run sequentially in the handler.

#### Cited Findings
- The router has two modes, `EXECUTE_FIRST_MATCH` and `EXECUTE_ALL_MATCH`. Conditions form an OR of AND groups, with text, list, and other operators (code) — [router-executor](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/handler/router-executor.ts)
- The AI Router asks one question and an evaluation model picks a route, with a score floor and an "Otherwise" path. A model failure fails the step rather than taking the Otherwise route — [AI Router](https://www.activepieces.com/docs/flows/ai-router)
- The loop runs `for` over a resolved array, sequentially, with non-arrays failing the step. It stops when the run verdict leaves `RUNNING`, and tracks iterations by path (code) — [loop-executor](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/handler/loop-executor.ts)
- Waitpoints are durable rows of type `DELAY`, `WEBHOOK`, or `BARRIER`, unique on flow run plus step. The step name is path-qualified inside loops (`loop_1:3/approval`) — [Waitpoints](https://www.activepieces.com/docs/install/architecture/waitpoints)
- A pausing action runs twice and branches on `ctx.executionType`: BEGIN creates the waitpoint, and RESUME reads `ctx.resumePayload` — [Flow control](https://www.activepieces.com/docs/build-pieces/piece-reference/flow-control)
- Resume-before-pause races are handled by inserting a pre-completed waitpoint row. Duplicate callbacks are absorbed by the unique constraint — [Waitpoints](https://www.activepieces.com/docs/install/architecture/waitpoints)
- Barriers wait for N signals, capped at 10,000 by `AP_MAX_BARRIER_SIGNALS`. A sealed barrier always releases once none are pending. `requiredSuccesses` covers 2-of-3 approvals, and `releaseOnFirstFailure` covers a veto — [Waitpoints](https://www.activepieces.com/docs/install/architecture/waitpoints)
- The Delay piece has `delay-for` and `delay-until`. A delay waitpoint frees worker capacity during the wait — [delay piece](https://github.com/activepieces/activepieces/tree/main/packages/pieces/core/delay/src/lib/actions); [Changelog](https://www.activepieces.com/docs/about/changelog)
- The Approval piece has `wait-for-approval` (using a `WEBHOOK` waitpoint) and `create-approval-link` (code) — [approval piece](https://github.com/activepieces/activepieces/tree/main/packages/pieces/core/approval/src/lib/actions)
- Paused flows live up to 30 days and cannot exceed data retention — [Limits](https://www.activepieces.com/docs/install/reference/limits)
- Sub-flows have `call-flow`, `respond`, a `callable-flow` trigger, `stream-csv-to-flow`, and a fan-out helper (code) — [subflows piece](https://github.com/activepieces/activepieces/tree/main/packages/pieces/core/subflows/src/lib)
- Code steps support npm, but in code-only mode a fresh isolate has no `require`, filesystem, or npm — [README](https://github.com/activepieces/activepieces); [Sandboxing](https://www.activepieces.com/docs/install/architecture/sandboxing)
- Human input can also come through form and chat triggers — [README](https://github.com/activepieces/activepieces)
- `context.run.stop()` ends a flow and can return a webhook response — [Flow control](https://www.activepieces.com/docs/build-pieces/piece-reference/flow-control)

**Postmortem worth reading:** in March 2026, a Delay change made flows restart from the beginning instead of resuming, creating an infinite loop that flooded Redis and degraded queues for all users — [Postmortem](https://www.activepieces.com/docs/handbook/engineering/postmortems/2026-03-19-redis-and-delay-overload).

#### Inferences
- Modelling every human, delay, and fan-out wait with one waitpoint abstraction is a strong design to copy. It also creates a shared failure point, as the postmortem shows, so FlowBridge needs per-tenant job-creation limits.
- Sequential loops limit throughput on long lists, and "Process in Batches" with barriers is the fan-out path.

#### Gaps
- Docs have no user-facing page for loops or routers in the pages found. The behaviour above comes from code and may change.

### 4. Data

#### Takeaway
A mustache-style reference system, a typed function layer with a live preview, and three persistence options: tables, store, and project variables.

#### Cited Findings
- References use a data selector or `{{step_name['output']['path']}}`. **Copy reference** on a step generates the base. Steps can use outputs of parent steps — [Passing data](https://www.activepieces.com/docs/flows/passing-data)
- Each step must be tested before the next one, so the selector has real sample data — [Passing data](https://www.activepieces.com/docs/flows/passing-data)
- Typing `/` inserts data manipulation functions (Text, Number, Date, List, Logic) with semicolon-separated arguments and a preview panel. A step with a function error will not run — [Using formulas](https://www.activepieces.com/docs/flows/using-formulas); [Reference](https://www.activepieces.com/docs/flows/formula-reference)
- The resolver produces both a resolved and a censored input, so secrets stay out of logs (code) — [props-resolver](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/variables/props-resolver.ts)
- Variable scripts run through a code sandbox rather than plain `eval` (code) — [script-evaluator](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/variables/script-evaluator.ts)
- Files pass by reference, and some actions stream files larger than worker memory, which self-hosted needs S3 for — [Passing data](https://www.activepieces.com/docs/flows/passing-data)
- Large outputs are sliced above 32KB, and inputs truncated above 2KB. Run log limit: 25MB on Cloud, 50MB self-hosted default — [Limits](https://www.activepieces.com/docs/install/reference/limits)
- Tables store structured data, with new-record triggers and agent knowledge use — [Tables](https://www.activepieces.com/docs/tables/overview)
- The Store piece is a key-value store with get, put, append, remove, and list actions. Keys are limited to 128 characters, and values to 512KB — [store piece](https://github.com/activepieces/activepieces/tree/main/packages/pieces/core/store/src/lib/actions); [Limits](https://www.activepieces.com/docs/install/reference/limits)
- Project variables store a reusable value for any step in a project — [Project variables](https://www.activepieces.com/docs/flows/project-variables)

#### Inferences
- Having both no-code functions and JavaScript-style mentions serves non-developers without blocking developers. The preview panel is the part that makes this usable.

#### Gaps
- Exact isolation of `{{ }}` evaluation across all sandbox modes is not documented.

### 5. Connections

#### Takeaway
AES-256-CBC at rest with an instance key, credentials resolved by the engine only during runs, no retrieval API, and enterprise secret managers for credentials that stay outside the product.

#### Cited Findings
- Credentials use 256-bit encryption, with no API to retrieve them. They are sent only during processing and access is then revoked from the engine — [Security](https://www.activepieces.com/docs/admin-guide/security/practices)
- Algorithm is `aes-256-cbc` with a random 16-byte IV per object, storing `iv` and `data` (code) — [encryption.ts](https://github.com/activepieces/activepieces/blob/main/packages/server/api/src/app/helper/encryption.ts)
- `AP_ENCRYPTION_KEY` is required and documented as a 32-character hex key from `openssl rand -hex 16`. If unset, the code generates and stores one locally (code) — [Env vars](https://www.activepieces.com/docs/install/reference/environment-variables); [encryption.ts](https://github.com/activepieces/activepieces/blob/main/packages/server/api/src/app/helper/encryption.ts)
- Secrets are masked in logs — [Security](https://www.activepieces.com/docs/admin-guide/security/practices)
- Auth types: `SecretText`, `BasicAuth`, `OAuth2`, `CustomAuth`, each with an optional `getConnectionIdentifier` for labelling — [Piece auth](https://www.activepieces.com/docs/build-pieces/piece-reference/authentication)
- Each person's account is a separate connection. The admin page filters by name, status, piece, project, and owner, for example to find a leaver's connections — [Connections](https://www.activepieces.com/docs/admin-guide/guides/connections)
- Global Connections are admin-created and shared with selected projects through OAuth2, custom OAuth2, or service accounts — [Global connections](https://www.activepieces.com/docs/admin-guide/guides/global-connections)
- OAuth2 apps can be overridden with your own client ID and secret — [OAuth2 apps](https://www.activepieces.com/docs/admin-guide/guides/manage-oauth2)
- Secret managers: AWS Secrets Manager, HashiCorp Vault, CyberArk Conjur, 1Password. Retrieved secrets are cached encrypted in Redis for 1 hour — [Secret managers](https://www.activepieces.com/docs/admin-guide/guides/secret-managers/overview)
- Releases bring new connections over as placeholders that must be reconnected — [Project releases](https://www.activepieces.com/docs/admin-guide/guides/project-releases)
- Server-side OAuth refresh and similar calls always pass through an SSRF filter — [Network security](https://www.activepieces.com/docs/install/architecture/network-security)

**Source conflicts**
- The security page says integrations are "always done using OAuth2" ([Security](https://www.activepieces.com/docs/admin-guide/security/practices)), yet piece auth documents API-key and basic types ([Piece auth](https://www.activepieces.com/docs/build-pieces/piece-reference/authentication)).
- "256-bit" sits beside a key the docs call "32-character (16-byte)". Treating the 32 characters as raw bytes would give 256 bits, but I did not confirm how the key buffer is derived.

#### Inferences
- `connectionToken.handle` receives `engineToken` and `apiUrl`, suggesting the engine fetches each connection from the API at resolve time rather than receiving all credentials at start ([props-resolver](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/variables/props-resolver.ts)).
- CBC has no built-in authentication. For FlowBridge, an AEAD mode such as AES-GCM (which Pipedream's KMS uses) is the safer default.

#### Gaps
- OAuth refresh scheduling and failure handling were not found in the docs. Key rotation for `AP_ENCRYPTION_KEY` was not found either.

### 6. Integrations

#### Takeaway
About 770 pieces. A piece is a typed TypeScript package created with a CLI, published to npm, synced hourly, and pinned per step.

#### Cited Findings
- Docs claim 760+ apps — [Welcome](https://www.activepieces.com/docs/overview/welcome). The public catalogue API returned 774 pieces on 7 November 2026 — [catalogue API](https://cloud.activepieces.com/api/v1/pieces). The repo has 745 community entries plus core pieces — [community pieces](https://github.com/activepieces/activepieces/tree/main/packages/pieces/community)
- The README still says "200+" and "280+", which is stale — [README](https://github.com/activepieces/activepieces)
- Piece structure: `createPiece`, `createAction`, `createTrigger`, with props and auth from `@activepieces/pieces-framework`, HTTP through `@activepieces/pieces-common`, and scaffolding through `npm run cli actions create` — [Create action](https://www.activepieces.com/docs/build-pieces/building-pieces/create-action)
- Actions declare `errorHandlingOptions`, `outputSchema`, `audience`, and `aiMetadata` (code) — [action.ts](https://github.com/activepieces/activepieces/blob/main/packages/pieces/framework/src/lib/action/action.ts)
- `aiMetadata` includes an `idempotent` declaration, and `audience` can be `human`, `ai`, or `both` — [AI metadata](https://www.activepieces.com/docs/build-pieces/piece-reference/ai-metadata)
- `createCustomApiCallAction` adds a **Custom API Call** action using the piece's stored auth — [Custom API calls](https://www.activepieces.com/docs/build-pieces/piece-reference/custom-api-calls)
- Core utility pieces include `http`, `graphql`, `smtp`, `sftp`, `pdf`, `csv`, `math-helper`, `text-helper`, `date-helper`, `file-helper`, and `data-mapper` — [core pieces](https://github.com/activepieces/activepieces/tree/main/packages/pieces/core)
- Distribution: official pieces sync hourly from a registry, and custom npm and private `.tgz` pieces are managed by admins. Pieces declare `minimumSupportedRelease`, and the registry filters by server release — [Piece syncing](https://www.activepieces.com/docs/install/architecture/piece-syncing)
- Steps never auto-upgrade. A patch upgrade keeps trigger inputs, and a minor or major upgrade resets them to defaults — [Piece syncing](https://www.activepieces.com/docs/install/architecture/piece-syncing); [Triggers](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/overview)
- 60% of pieces are community-contributed, per the README — [README](https://github.com/activepieces/activepieces)
- Admins can control which pieces appear at platform level — [Manage pieces](https://www.activepieces.com/docs/admin-guide/guides/manage-pieces)

#### Inferences
- npm as a distribution layer gives versioning, hosting, and third-party publishing cheaply. The trade-off is supply-chain exposure, which version pinning partly reduces.

#### Gaps
- Count of total actions and triggers across pieces was not computed. Quality varies by contribution, but no official measure was found.

### 7. Testing and debugging

#### Takeaway
Step-by-step testing is mandatory while building, and a failed run opens in the builder as a read-only trace with inputs and outputs.

#### Cited Findings
- Each step must be tested before moving on, and untested steps show **Test me** — [Passing data](https://www.activepieces.com/docs/flows/passing-data)
- Trigger `test` loads recent items, with a recommended limit of five. `sampleData` is the static fallback — [Polling](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/polling-trigger); [Triggers](https://www.activepieces.com/docs/build-pieces/piece-reference/triggers/overview)
- Run details open the builder view-only, showing step status with input and output — [Debugging runs](https://www.activepieces.com/docs/flows/debugging-runs)
- In step-test mode, retries and continue-on-failure are skipped, and a loop runs a single iteration (code) — [error-handling](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/helper/error-handling.ts); [loop-executor](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/handler/loop-executor.ts)
- Test runs are unaffected by credit exhaustion — [Breaking changes](https://www.activepieces.com/docs/install/reference/breaking-changes)
- Piece authors use Vitest for unit tests and get hot reload locally — [Testing pieces](https://www.activepieces.com/docs/build-pieces/misc/testing-pieces); [README](https://github.com/activepieces/activepieces)
- A benchmark CLI tests an installation by tier — [Benchmark](https://www.activepieces.com/docs/install/architecture/benchmark)

#### Inferences
- Test mode skipping retries means retry and failure behaviour can only be checked by a real run. A FlowBridge dry-run with failure injection would close this gap.

#### Gaps
- The docs do not describe whole-flow test runs or a re-run with altered inputs in the pages read.

### 8. Publishing and versioning

#### Takeaway
Immutable published versions with one mutable draft, plus enterprise releases that move flows between projects or Git and can require approvals.

#### Cited Findings
- Drafts are editable, publishing locks the version, and editing a published flow creates a new draft by copying it — [Versioning](https://www.activepieces.com/docs/flows/versioning)
- Changes do nothing until published — [Publishing](https://www.activepieces.com/docs/flows/publishing-flows)
- Releases have three sources: Git, another project, and rollback. Each shows a change preview with selectable items — [Project releases](https://www.activepieces.com/docs/admin-guide/guides/project-releases)
- Git uses an SSH remote and key. Only published flows can be pushed, and **Push Everything** exports flows, connections, and tables — [Project releases](https://www.activepieces.com/docs/admin-guide/guides/project-releases)
- The Project Replace CLI mirrors a project across deployments by matching on `externalId`, with diff and convergent re-runs, plus a per-project lock — [Project Replace CLI](https://www.activepieces.com/docs/admin-guide/guides/project-replace-cli)
- Flow Approvals: in a project marked Sensitive, non-admins see **Request approval**, the prior version keeps running, approvers approve or reject with a reason, and all of it is audited — [Flow approvals](https://www.activepieces.com/docs/flows/flow-approvals)
- Releases and Git Sync are on the Ultimate plan — [Pricing](https://www.activepieces.com/pricing)

#### Inferences
- Dedupe keys scoped to `flowVersionId` show that the version is a first-class runtime identity. FlowBridge should do the same for run attribution.

#### Gaps
- Whether in-flight runs stay on the version they started with is not stated directly. Replay against the stored run log implies this, but no doc confirms it.

### 9. Execution engine

#### Takeaway
App, worker, sandbox, and engine tiers over Postgres, Redis/BullMQ, and S3. The recommended model is one flow per stateless worker, with checkpoint-and-replay durability. Docs here are unusually detailed.

#### Cited Findings

**Stack and layout**
- TypeScript throughout. React with shadcn and Tailwind, Fastify, PostgreSQL, Redis, BullMQ, Vitest, Playwright, Turbo with Bun, Sentry, evlog, and Kamal — [Stack](https://www.activepieces.com/docs/handbook/engineering/onboarding/stack)
- Monorepo packages: `web`, `server/{api,worker,engine,sandbox,common}`, `ee`, `pieces`, `shared` — [Architecture](https://www.activepieces.com/docs/install/architecture/overview)
- `pgvector` is used for knowledge bases when available — [Agent knowledge](https://www.activepieces.com/docs/agents/knowledge)

**Flow of a run**
- Webhooks and recurring jobs land on Redis and workers take them, so spikes queue rather than drop — [Architecture](https://www.activepieces.com/docs/install/architecture/overview)
- A worker allocates a sandbox, runs the engine in it over WebSocket, and returns results to the app — [Architecture](https://www.activepieces.com/docs/install/architecture/overview)

**Durability**
- Each run has one compressed run-log file containing each finished step's censored input, output, status, duration, and error, with loop and router data nested — [Durable execution](https://www.activepieces.com/docs/install/architecture/durable-execution)
- The log is written at start, every 15 seconds, and at the end, and each write overwrites the last. The cadence is fixed — [Durable execution](https://www.activepieces.com/docs/install/architecture/durable-execution); [Crash recovery](https://www.activepieces.com/docs/install/guarantees/crash-recovery)
- Resume has no special path. The engine walks from the trigger and returns saved output for each step that finished as `SUCCEEDED` or `PAUSED` — [Durable execution](https://www.activepieces.com/docs/install/architecture/durable-execution)
- Guarantee is at-least-once. The in-flight step re-runs, so external side effects can repeat — [Crash recovery](https://www.activepieces.com/docs/install/guarantees/crash-recovery)
- Redis data loss loses queued jobs, including webhooks already answered with 200, and recovery is bulk-retry — [Disaster recovery](https://www.activepieces.com/docs/install/guarantees/disaster-recovery)

**Isolation**
- Four `AP_EXECUTION_MODE` values: `UNSANDBOXED` (default), `SANDBOX_CODE_ONLY`, `SANDBOX_PROCESS`, `SANDBOX_CODE_AND_PROCESS` — [Env vars](https://www.activepieces.com/docs/install/reference/environment-variables)
- `SANDBOX_CODE_ONLY` wraps Code steps in a fresh `isolated-vm` context with 128MB, no `require`, disposed after the step, and warm processes. Activepieces recommends it for enterprise and says Cloud uses it — [Sandboxing](https://www.activepieces.com/docs/install/architecture/sandboxing)
- `SANDBOX_PROCESS` uses `ioi/isolate` with fresh namespaces and read-only mounts. It allows npm, but needs `CAP_SYS_ADMIN`, which means a privileged container and a cold boot per run — [Sandboxing](https://www.activepieces.com/docs/install/architecture/sandboxing)
- V8 isolation does not protect isolates if the host Node process is compromised — [Sandboxing](https://www.activepieces.com/docs/install/architecture/sandboxing)
- `AP_NETWORK_MODE=STRICT` (default is `UNRESTRICTED`) monkey-patches `dns.lookup` and `Socket.connect`, checking every A/AAAA record. Docs call it best-effort and say to enforce real egress in infrastructure — [Network security](https://www.activepieces.com/docs/install/architecture/network-security)
- Tenant data isolation is separate, enforced by scoping queries to `projectId` and `platformId` in the API — [Execution isolation](https://www.activepieces.com/docs/install/guarantees/execution-isolation)

**Concurrency and scale**
- Recommended: workers at 0.5 vCPU / 1GB with concurrency 1, one per concurrent flow, plus one 1 vCPU / 1GB app per 10 workers. The shipped default is concurrency 5, which widens the OOM blast radius — [Production setup](https://www.activepieces.com/docs/install/configure-operate/production-setup); [Workers](https://www.activepieces.com/docs/install/architecture/workers)
- About 300MB of 1GB is warm-process overhead — [Reserved resources](https://www.activepieces.com/docs/install/guarantees/reserved-resources)
- Cloud concurrency per project: Free 5, Plus 10, Team 20, Enterprise 30. Self-hosted enforcement is off by default — [Limits](https://www.activepieces.com/docs/install/reference/limits)
- Over-limit runs are queued with exponential backoff rather than dropped. Embedding can share a limit through `concurrencyPoolKey` — [Manage concurrency](https://www.activepieces.com/docs/admin-guide/guides/manage-concurrency)
- Worker groups reserve dedicated queues (`project-<name>-jobs`, `flow-<name>-jobs`) by project, flow, or platform. A flow pin beats its project's group. `SANDBOX_CODE_ONLY` is rejected for grouped workers — [Worker groups](https://www.activepieces.com/docs/install/configure-operate/worker-groups); [Production setup](https://www.activepieces.com/docs/install/configure-operate/production-setup)
- Measured warm sync webhook throughput: 213 req/s at 40 workers, 484 at 80, 641 at 120, 777 at 160. Per-worker rate peaks at 80. Postgres grows fastest, 529m to 2738m CPU, while workers stay under a fifth of their cap. These are Activepieces' own numbers — [Benchmark](https://www.activepieces.com/docs/install/architecture/benchmark)
- S3 is required in production, with signed URLs so bytes bypass the app — [Production setup](https://www.activepieces.com/docs/install/configure-operate/production-setup)
- Docs recommend static sizing for peak, because autoscaling lag cannot defend the 30-second sync budget — [Production setup](https://www.activepieces.com/docs/install/configure-operate/production-setup)

**Timeouts**
- 10 minutes per run and per action on Cloud, counting only active time. Sync webhook response 30s, configurable to 15 minutes self-hosted, and Cloudflare caps at 30s — [Limits](https://www.activepieces.com/docs/install/reference/limits); [Env vars](https://www.activepieces.com/docs/install/reference/environment-variables)

**Source conflicts**
- [Workers](https://www.activepieces.com/docs/install/architecture/workers) says each worker pulls from BullMQ in Redis, while [Production setup](https://www.activepieces.com/docs/install/configure-operate/production-setup) says workers hold no Redis or database credentials and reach the app only over `AP_FRONTEND_URL`. The second is the more specific statement, and a [worker RPC service](https://github.com/activepieces/activepieces/blob/main/packages/server/api/src/app/workers/rpc/worker-rpc-service.ts) exists in the repo. The likely reading is that workers dequeue through the app, but this was not verified.
- Crash Recovery says Cloud upholds the guarantees "through a different sandbox mechanism" while Sandboxing says Cloud uses `SANDBOX_CODE_ONLY`.

#### Inferences
- One-flow-per-worker trades density for simple reasoning. At 1GB per concurrent flow, cost scales with concurrency rather than throughput, so long-running or I/O-waiting flows are expensive unless they use waitpoints.
- Overwriting a single checkpoint every 15 seconds means fast steps can be lost and re-run in the window, not just the single in-flight step. The docs say "the single step", which seems optimistic given that cadence. Worth testing before relying on it.
- Keeping database credentials out of workers is a strong multi-tenant control to adopt.

#### Gaps
- Exact role of Deno in code execution: the code has a `useDeno` path ([code-executor](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/handler/code-executor.ts)) that the sandboxing docs do not mention.

### 10. Error handling

#### Takeaway
Per-step retry and continue-on-failure run inside the worker, with a much shorter window than Pipedream. Run-level retry from the failed step reuses the checkpoint log.

#### Cited Findings
- Steps have `retryOnFailure` and `continueOnFailure`. Any failed verdict is retryable when enabled (code) — [error-handling](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/helper/error-handling.ts)
- Defaults are `maxAttempts: 4`, `retryExponential: 2`, and `retryInterval: 2000` (code) — [engine-constants](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/handler/context/engine-constants.ts)
- Backoff is awaited with an in-process `setTimeout` (code) — [error-handling](https://github.com/activepieces/activepieces/blob/main/packages/server/engine/src/lib/helper/error-handling.ts)
- Retrying from a failed step reuses the log, re-queues the run, and replays to the failure point. A run whose log was lost can still retry from the start — [Durable execution](https://www.activepieces.com/docs/install/architecture/durable-execution); [Disaster recovery](https://www.activepieces.com/docs/install/guarantees/disaster-recovery)
- OOM produces `MEMORY_LIMIT_EXCEEDED`, then requeue and retry elsewhere — [Reserved resources](https://www.activepieces.com/docs/install/guarantees/reserved-resources)
- With credits gone, runs record `QUOTA_EXCEEDED` and keep their payload for later retry, and sync webhooks return 402 — [Breaking changes](https://www.activepieces.com/docs/install/reference/breaking-changes)
- Failed `/sync` runs previously held the connection until a 408, which was later changed — [Breaking changes](https://www.activepieces.com/docs/install/reference/breaking-changes)
- A failure-event handler can be generated: Event Streaming's **Generate handler flow** builds a webhook-triggered flow with one router branch per event — [Event streaming](https://www.activepieces.com/docs/admin-guide/guides/event-streaming)

#### Inferences
- From the constants, the formula gives waits of about 4s, 8s, and 16s, or roughly 28 seconds in total, while holding the worker. It suits transient blips, not outages. Pipedream's 10-hour window is designed for outages. FlowBridge could offer both: short in-process retries, then durable scheduled retries through a waitpoint.

#### Gaps
- No per-flow error workflow setting (the n8n or Pipedream `$errors` pattern at flow level) was found. The closest is platform Event Streaming.
- The docs do not describe step retry settings in a user-facing page in the material read.
- Whether a retry can run against a newer flow version is not documented.

### 11. Monitoring

#### Takeaway
Run history for builders, health pages for operators, and OTLP plus event streaming for external systems.

#### Cited Findings
- Dashboard **Runs** lists runs, which open in the builder — [Debugging runs](https://www.activepieces.com/docs/flows/debugging-runs)
- Project alert emails fire for only the first failure per flow per day, with others in a daily summary. Flow owners can be included — [Projects](https://www.activepieces.com/docs/admin-guide/guides/structure-projects)
- The Health page covers system (version, disk, RAM, CPU, 30-day job health), runs (success rate; internal errors grouped by project and flow), and queue (running, queued, stuck) — [Health](https://www.activepieces.com/docs/admin-guide/guides/health)
- The Triggers page groups trigger health by piece over 24 hours, 7 days, and 14 days — [Trigger health](https://www.activepieces.com/docs/admin-guide/guides/trigger-health)
- Bull Board is available for queue inspection — [Queues dashboard](https://www.activepieces.com/docs/install/troubleshooting/bullboard)
- Logs are wide events through evlog, exported over OTLP with `AP_OTEL_ENABLED`. `bullmq.job.count` is exported every 60 seconds with `AP_OTEL_QUEUE_METRICS_ENABLED` — [Observability](https://www.activepieces.com/docs/install/configure-operate/setup-opentelemetry)
- Event Streaming POSTs audit events to webhooks such as Datadog, PostHog, or Grafana Loki — [Event streaming](https://www.activepieces.com/docs/admin-guide/guides/event-streaming)
- Retention: run data 30 days by default, shortenable per project, with a floor at the paused-flow lifetime — [Limits](https://www.activepieces.com/docs/install/reference/limits)

#### Inferences
- Separating internal errors from flow errors in Runs Health is an unusually useful operator signal and is cheap to copy.

#### Gaps
- Flow-level latency metrics and SLO views were not found in the docs.

### 12. Administration

#### Takeaway
Platform and project scopes, four default roles plus custom roles, comprehensive audit logs, and identity governance, mostly on the top plan.

#### Cited Findings
- Projects isolate flows, connections, and tables. Platform admins can access all projects. Personal projects exist by default and can be turned off — [Projects](https://www.activepieces.com/docs/admin-guide/guides/structure-projects)
- Roles are Admin, Editor, Operator, and Viewer. Operator can publish and retry but not edit flows. Only Admin can manage members and Git — [Users](https://www.activepieces.com/docs/admin-guide/guides/permissions)
- Custom roles are set under Platform Admin → Security → Project Roles — [Users](https://www.activepieces.com/docs/admin-guide/guides/permissions)
- Audit events cover flows, runs, approvals, connections, folders, users, signing keys, and agent actions, and include the app, action, and account used. Retention is 30 days to forever — [Audit logs](https://www.activepieces.com/docs/admin-guide/security/audit-logs/overview)
- SSO and SCIM for Okta and Entra ID — [SSO](https://www.activepieces.com/docs/admin-guide/guides/sso); [SCIM](https://www.activepieces.com/docs/admin-guide/guides/scim/overview)
- Active flow limits can be set per project — [Projects](https://www.activepieces.com/docs/admin-guide/guides/structure-projects)
- Embedding: a white-label builder with JWT user provisioning and per-customer piece control, from $36k/year — [Embedding](https://www.activepieces.com/docs/embedding/overview); [Pricing](https://www.activepieces.com/pricing)
- Cloud data region is Germany — [Security](https://www.activepieces.com/docs/admin-guide/security/practices)

#### Inferences
- Operator (run and retry without editing) is a real-world role worth including in FlowBridge from the start.

#### Gaps
- Compliance certifications (such as SOC 2) were not found in the docs pages read. Check [trust materials](https://www.activepieces.com/) directly.

### 13. Templates, AI features, limits, pricing

#### Takeaway
Usage is priced per run regardless of step count, with AI steps costing more. AI is now central to the product: agents, chat building, and MCP.

#### Cited Findings
- **Pricing:** Free ($0, 1,000 credits, up to 5 users). Plus ($20, 10,000 credits, up to 5 users). Team ($200, 50,000 credits, 25 users). Ultimate (custom, yearly pool, unlimited users). Overage is $0.007/credit on Plus and Team. Community Edition is free to self-host — [Pricing](https://www.activepieces.com/pricing)
- **Metering:** 1 credit per run regardless of steps, with unlimited flows. AI steps cost 2 (fast), 10 (smart), or 20 (frontier). Agentic actions cost 1 each. With your own AI keys, AI steps drop to 1 — [Pricing](https://www.activepieces.com/pricing)
- Free-plan runs past quota wait for the next day. The page also describes the reset as both daily and monthly — [Pricing](https://www.activepieces.com/pricing)
- Usage page breaks credits into AI and run usage by project — [Usage](https://www.activepieces.com/docs/admin-guide/guides/usage)
- **Plan gates:** SSO on Team. SCIM, custom RBAC, Releases and Git Sync, audit logs, secret managers, event streaming, private pieces, and dedicated workers on Ultimate — [Pricing](https://www.activepieces.com/pricing)
- **Agents:** a brief plus tools, where any action from 760+ pieces can be a tool. They can use knowledge, run as flow steps, and return structured output. Published agents only run in flows — [Agents](https://www.activepieces.com/docs/agents/overview); [In flows](https://www.activepieces.com/docs/agents/in-flows)
- **Chat** builds flows from a description, labelled Beta — [Chat](https://www.activepieces.com/docs/ai/chat); [Welcome](https://www.activepieces.com/docs/overview/welcome)
- **MCP:** servers at platform and project scope, with tools documented — [MCP](https://www.activepieces.com/docs/mcp/overview); [Tools](https://www.activepieces.com/docs/mcp/tools)
- **Model governance:** BYO keys, named tiers with fallback order, and capabilities such as web search — [Providers](https://www.activepieces.com/docs/admin-guide/guides/setup-ai-providers); [Tiers](https://www.activepieces.com/docs/admin-guide/guides/ai-tiers)
- **Templates:** an Explore library by category with preview and setup guide. Admins add custom ones from exported flows — [Template library](https://www.activepieces.com/docs/flows/template-library); [Admin templates](https://www.activepieces.com/docs/admin-guide/guides/templates)
- **Limits (Cloud / self-host default):** run 10 min / 600s; memory 1GB; webhook 5MB / 25MB; step file 10MB / 25MB; run log 25MB / 50MB; pause 30 days; retention 30 days — [Limits](https://www.activepieces.com/docs/install/reference/limits)
- **Repo status on 7 November 2026:** 25,409 stars, latest release `0.92.3-hotfix.2` dated 28 October 2026, and code pushed the same day — [GitHub](https://github.com/activepieces/activepieces)
- **Licensing:** Community is MIT, while `packages/ee` and `packages/server/api/src/app/ee` are commercial — [LICENSE](https://github.com/activepieces/activepieces/blob/main/LICENSE)

#### Inferences
- Per-run pricing is easy to explain, but it undercharges heavy runs and penalizes nothing about length. The 10-minute cap and 1GB worker bound that exposure.
- Enterprise-edition instances without a key are now put on the free plan with credit limits ([Breaking changes](https://www.activepieces.com/docs/install/reference/breaking-changes)), so EE code in the repo should not be mistaken for free functionality.

#### Gaps
- Template count and annual plan prices are not stated. The page gives "two months free" without figures.

---

## Design contrasts for FlowBridge (inferences)

| Topic | Pipedream Workflows | Activepieces | Possible direction |
|---|---|---|---|
| Isolation | Per-version VM | Per-worker container plus V8 or namespaces | Separate code risk from connector risk |
| Long waits | End function, start new one | Durable waitpoint row and replay | Waitpoint model |
| Retry window | 8 tries over 10 hours | 4 attempts, about 28 seconds (code) | Short in-process, then durable scheduled |
| Billing | Compute time per segment | Flat per run, weighted AI | Decide by cost driver |
| Overflow | Queue can drop events | Queues in Redis, no drop by design | Never drop silently |
| Loops | Code only | Built-in, sequential | Built-in with bounded concurrency |
| Dedupe | Strategy on source emit | Cursor in library plus 30s Redis key | Cursor plus longer idempotency window |

---

## Needs user login

No page in this research required a login, and I did not attempt to sign in. These logged-in views would answer questions the public docs leave open.

- **https://pipedream.com/settings/billing** (signup closed to new Workflows users, so an existing account may be required): former plan limits for data stores, event retention, and queue size.
- **https://cloud.activepieces.com** (Free account): the builder's actual retry and continue-on-failure UI, whole-flow test behaviour, loop and router configuration, and the exact credit counters. The public docs cover these thinly.
- **https://pipedream.com/workflows** (existing account): the real build, test, and deploy interface, and whether version history exists outside GitHub Sync.
