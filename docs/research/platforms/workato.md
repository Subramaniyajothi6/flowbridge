# How Workato works end to end (docs retrieved 7 November 2026)

Evidence conventions used in these notes:
- Pages were read through a fetch tool that returns a model-written extraction, not raw HTML. Numbers were cross-checked where two pages overlap, but quotes are not guaranteed verbatim.
- "(search excerpt)" marks a fact seen only in a search result excerpt, not on a page I read in full. The search tool reported some of these pages as 1 year old or more.
- "Inferences" are my reasoning, including what FlowBridge might take from the fact. They are not Workato statements.
- Workato's product naming is mid-transition (Callable Recipes to Recipe Functions, Tasks to Business actions to Credits, RLCM to Environments, legacy roles to environment and project roles). Expect older pages to use older terms.

## Workflow model and terminology

### Takeaway
A recipe is a trigger plus an ordered tree of steps. Each trigger event becomes one job (except for batch and bulk triggers), and each job is an isolated run carrying that event's data through the steps. Data moves between steps through datapills, which are typed references to earlier step outputs.

### Cited Findings
- Recipe: an automated workflow that runs a series of steps across apps, with conditional logic, loops and error handling. Recipe types are workflow, API, data pipeline, app event and knowledge base — [Recipes](https://docs.workato.com/recipes.html)
- Trigger: every recipe has one, and it "defines the event that starts the workflow". Starting points include an app trigger, a schedule, a webhook, an API request, a recipe function call and a Slack bot command — [Recipes](https://docs.workato.com/recipes.html)
- Action: a step that creates, updates or searches in a target app. It takes input fields and returns an output data tree that later steps can map — [Steps](https://docs.workato.com/recipes/steps.html)
- Job: created each time a recipe processes a trigger event. It holds that event's data and runs the steps against it. Statuses are Completed, Failed, Processing, Paused and Aborted (rare) — [Jobs](https://docs.workato.com/recipes/jobs.html)
- Connector vs connection: connectors let recipes interact with apps ([Recipes](https://docs.workato.com/recipes.html)). A connection is one authenticated app instance, reusable across recipes ([Connections](https://docs.workato.com/en/connections)).
- Most connectors allow one connection per app per recipe. Apps with "secondary connectors" allow two. Adding a second connection without that support replaces the first — [Connections](https://docs.workato.com/en/connections)
- Datapills: output values from a trigger or action, used as variables in later steps — [Datapills](https://docs.workato.com/recipes/data-pills-and-mapping.html)
- A Task is one executed action step, and a job can contain several — [Tasks](https://docs.workato.com/recipes/tasks.html)
- Recipes can be built by hand, by AIRO from a plain-language description, or by cloning from the community library — [Recipes](https://docs.workato.com/recipes.html)

### Inferences
- The core data model is Recipe (versioned definition), Trigger cursor state, Job (per-event instance with frozen trigger data), and per-step input and output records.

### Gaps
- No published formal recipe schema or internal job state machine beyond the status list. The Recipes overview page does not define job or datapill; those definitions come from the Jobs and Datapills pages.

## Triggers

### Takeaway
Workato separates how events are detected (polling, real-time, scheduled, CDC) from how they are grouped into jobs (single, batch, bulk). A durable cursor plus a record of seen events gives per-recipe deduplication. Trigger conditions are filters applied after fetch and are not state-transition detectors.

### Cited Findings
**Detection**
- Polling: checks the app at a set interval, as often as every 5 minutes. One poll can yield several jobs. After a restart it fetches events from the stopped period — [Triggers](https://docs.workato.com/recipes/triggers.html)
- Real-time: instant notification. Most real-time triggers (not HTTP webhook triggers) also poll in the background, typically about once an hour, to recover dropped events — [Triggers](https://docs.workato.com/recipes/triggers.html)
- Scheduled: runs hourly, daily, monthly or by cron. Each run fetches all matching events, including ones already picked up earlier. Scheduler by Workato's minimum interval is 5 minutes — [Triggers](https://docs.workato.com/recipes/triggers.html)
- CDC: captures inserts, updates and deletes without continuous polling; no numbers on this page — [Triggers](https://docs.workato.com/recipes/triggers.html)

**Dispatch**
- Single: one job per event, the most common form — [Triggers](https://docs.workato.com/recipes/triggers.html)
- Batch: user-set batch size. Batch size 100 with 420 events produces five jobs (four of 100, one of 20) — [Triggers](https://docs.workato.com/recipes/triggers.html)
- Bulk: streams data as CSV on a schedule, with no upper limit on records per job. Requires dedicated users to check completion and cannot run in test mode — [Triggers](https://docs.workato.com/recipes/triggers.html)

**Cursor and start point**
- Progress persists across stops and restarts. The "When first started" date can be set once only and cannot change after the recipe has run or been tested. Without that field, the start is an offset from recipe start (commonly start time, minus one hour, or minus one day) — [Triggers](https://docs.workato.com/recipes/triggers.html)
- Connector SDK expression of the cursor: `poll` receives `connection`, `input` and `closure`, and returns `events`, `next_poll` (the new closure) and `can_poll_more` (poll again immediately) — [SDK triggers](https://docs.workato.com/developing-connectors/sdk/sdk-reference/triggers.html)
- SDK webhook lifecycle: `webhook_subscribe` runs on recipe start and can return an expiry that schedules `webhook_refresh`; `webhook_unsubscribe` runs on stop; `webhook_notification` converts a payload into one or more jobs and cannot make HTTP calls — [SDK triggers](https://docs.workato.com/developing-connectors/sdk/sdk-reference/triggers.html)

**Duplicate prevention**
- Workato keeps a record of all seen trigger events so each is processed once — [Triggers](https://docs.workato.com/recipes/triggers.html)
- In SDK connectors `dedup` is required. It takes one record and returns a string signature, for example `"#{record['id']}@#{record['updated_at']}"`. The version timestamp in the key is what lets an updated record count as a new event — [SDK triggers](https://docs.workato.com/developing-connectors/sdk/sdk-reference/triggers.html)
- Events picked up in test mode are not reprocessed once the recipe starts — [Start and stop](https://docs.workato.com/recipes/start-and-stop.html)

**Trigger conditions**
- Evaluated after fetch, so records that later come to meet the condition are not picked up. Usually checked on each fetch, not on first change into a state, so every update to an already Closed Won opportunity is picked up — [Triggers](https://docs.workato.com/recipes/triggers.html)
- Values are case-sensitive exact matches, joined with AND or OR — [Triggers](https://docs.workato.com/recipes/triggers.html)
- Not recommended for batch or bulk: batch conditions check only the first record, so the whole batch is processed or skipped. Use app-native filtering such as a SOQL WHERE clause instead — [Triggers](https://docs.workato.com/recipes/triggers.html)

**Limits**
- Webhooks: 20 events/s steady (72,000/hour), burst allowance 9,000 events, 30 MB/minute with 30 MB burst, up to 100 recipes per webhook URL; trigger event payload 50 MB — [Recipe quotas](https://docs.workato.com/en/recipes/limits.html)
- SDK: 1,000 events per poll, and exceeding it stops the recipe. Empty-poll allowance starts at 600 consecutive polls and decreases to 50, then polling pauses for 5 minutes. The counter resets when a poll produces jobs — [SDK trigger quotas](https://docs.workato.com/developing-connectors/sdk/guides/trigger-limit.html)
- Polling trigger timeout is 5 minutes — [Recipe quotas](https://docs.workato.com/en/recipes/limits.html)
- HTTP webhook responses default to 200 with `{"status":"ok"}`; `workato_response_code` accepts only 2XX and `workato_empty_response` empties the body (search excerpt) — [Webhooks](https://docs.workato.com/connectors/workato-webhooks/config.html)

### Inferences
- The two axes (detection and dispatch) are a cleaner model than a flat trigger-type list and are worth copying.
- Dedup key = record ID + version timestamp implies at-least-once fetching made effectively once by an idempotency check at job creation. Workato does not state this in those terms.
- The "scheduled triggers refetch everything" and "conditions are not state transitions" rules are behaviours users have to learn. FlowBridge could offer true transition detection as a differentiator, at the cost of storing prior state.

### Gaps
- Not documented on pages read: how the seen-event record is keyed for prebuilt connectors, how long it is retained, and whether dedup state resets on any action. Maximum batch size is not stated generally (some connector-specific caps exist, such as JDBC 20,000 rows and Kafka batch 100 messages per [Platform quotas](https://docs.workato.com/limits.html)).
- Whether the 5-minute polling floor varies by plan was not confirmed.

## Logic

### Takeaway
Control flow is a small block set: IF, ELSE IF, ELSE, two repeat forms, stop job, handle errors, and call recipe function. Reuse happens through recipe functions (the successor to callable recipes). Small reference data lives in lookup tables, with data tables as the structured store. Custom code runs as connector actions with hard time, memory and package limits.

### Cited Findings
**Conditions and loops**
- IF runs its branch when true, ELSE IF is evaluated only if preceding conditions fail, ELSE runs when none match, and only one branch runs per pass — [Steps](https://docs.workato.com/recipes/steps.html)
- Repeat while is a do-while: the body runs at least once and the condition is checked afterwards. It has a hard cap of 50,000 iterations, described as a defence against uncontrolled task consumption. Multiple conditions use AND or OR but cannot be mixed. An Index pill appears in the REPEAT step output — [Loops](https://docs.workato.com/en/recipes/loops)
- Repeat for each runs nested steps per list item, or per batch with Repeat mode "Batch of items". An unset or below-1 batch size defaults to 100. "Clear step output" set to Yes isolates iterations so earlier ones do not affect later IF logic — [Repeat for each](https://docs.workato.com/en/recipes/repeat-for-each)

**Stop job**
- Ends the job early and marks it Failed or Successful, with an optional message that can include datapills — [Steps](https://docs.workato.com/recipes/steps.html); [Error handling](https://docs.workato.com/recipes/best-practices-error-handling.html)

**Recipe functions (formerly callable recipes)**
- A recipe type started by the New function call trigger. Actions are call asynchronously, call synchronously, return data, and wait for async calls. Queue size 10,000. Benefits named include single-sourced logic and runtime user connections. A migration guide exists for callable recipes — [Recipe functions](https://docs.workato.com/en/connectors/recipe-functions)
- Sync call: blocks for the response. Output is Job ID, Job URL and Result, shaped by the function's Response schema. Input fields come from the function's Input schema. Subject to a timeout, and the job fails if it is exceeded. Invoking multiple functions from one parent can cause job-out-of-order behaviour — [Sync call](https://docs.workato.com/en/connectors/recipe-functions/actions/call-recipe-function-synchronously)
- Async call: moves on immediately, is not guaranteed to run in order, and returns only a Job reference (not the job ID) and Job URL. To return data, Workato's recommended workaround is that the function writes to a lookup table, and the parent runs Wait for async calls and then searches the table — [Async call](https://docs.workato.com/en/connectors/recipe-functions/actions/call-recipe-function-asynchronously)
- Assets from other projects are not pulled in automatically on export, so functions from other projects must be moved into the same project first (search excerpt) — [Export](https://docs.workato.com/recipe-development-lifecycle/export.html)

**Lookup tables**
- Rows and columns with an Entry ID. Quotas: 100 tables per workspace, 10 columns per table, 100,000 rows per table, 128 KB per row. Get all entries returns the first 10,000. Batch size 10,000. RLM import/export 10,000 rows and 10 MB file. CSV download blocked above 50,000 entries. Workato advises against cell values over 10 KB and against use as a large relational database — [Lookup tables](https://docs.workato.com/en/features/lookup-tables)
- Lookup entry fails the step if no match is found. Update and delete have an "Ignore if not found" option. Truncate cannot be undone, even in a test job — [Lookup tables](https://docs.workato.com/en/features/lookup-tables)
- Formula form: `lookup("TABLE_NAME", "REFERENCE_COLUMN": datapill)["LOOKUP_COLUMN"]`. Passing the Entries output of a Search entries action instead of a table name makes an in-memory lookup, faster for thousands of repeats — [Lookup tables](https://docs.workato.com/en/features/lookup-tables)

**Custom code**
- Python connector: Execute Python code action on Python 3.9+, standard library plus a fixed package list (including numpy, pandas, requests, lxml, pypdf). User-provided libraries are not supported. 256 MB memory, 90 s timeout, 1 MB script — [Python](https://docs.workato.com/connectors/python.html)
- Quotas for other runtimes: JavaScript 30 s, Ruby 30 s, Python/Ruby/JavaScript memory 256 MB, JavaScript code 1 MB — [Platform quotas](https://docs.workato.com/en/limits)

**Error monitors**: see "Error handling" below.

### Inferences
- Async calls returning no result, with a lookup-table workaround in official docs, shows a real gap in Workato's fan-out and fan-in model. A first-class join with returned values would be a clear improvement.
- Repeat while's 50,000 cap is a cost and safety guard, not a technical limit, and any loop construct in FlowBridge needs an equivalent.

### Gaps
- Not documented on pages read: nesting depth for loops or function calls, maximum list size for Repeat for each, exact sync-call timeout value, how errors propagate from child to parent, and the sandbox or isolation model for custom code.

## Data

### Takeaway
Each step exposes a typed output tree. Later steps pick typed pills from that tree. A per-field formula mode evaluates a Ruby-derived expression language restricted to an allowlist. Connectors supply the schemas, and detected upstream schema changes create new recipe versions.

### Cited Findings
- Recipe data (the datatree) lists the output of the trigger and all preceding actions, so each step can see only earlier steps — [Datapills](https://docs.workato.com/recipes/data-pills-and-mapping.html)
- Types are string, integer or number, date or datetime, list, object and boolean. Workato converts types by default when there is no ambiguity or loss. Explicit conversions are `to_i`, `to_f`, `to_s`, `to_date`, `to_time`, `to_currency` — [Datapills](https://docs.workato.com/recipes/data-pills-and-mapping.html)
- Default pills (Job ID, Recipe ID, Is test) sit under Properties. On error pills appear only when a handle errors step exists — [Datapills](https://docs.workato.com/recipes/data-pills-and-mapping.html)
- Root-level pills expose a step's whole output schema in formula mode, for `.to_json` or `.pluck` — [Datapills](https://docs.workato.com/recipes/data-pills-and-mapping.html)
- A field in the payload but not in the schema can be reached by mapping the parent and appending brackets, for example `Params['C']` — [Datapills](https://docs.workato.com/recipes/data-pills-and-mapping.html)
- Pills from steps that did not run (an untaken branch) are typically blank, and a required field mapped at design time but empty at run time fails the job — [Datapills](https://docs.workato.com/recipes/data-pills-and-mapping.html)
- Sample data from the connected account appears next to pills in the editor — [Datapills](https://docs.workato.com/recipes/data-pills-and-mapping.html)
- Formula mode is per field, and most but not all fields support it. Ruby methods not in the documentation are not allowlisted. The editor filters formulas by pill type. Text mode evaluates only pills, and `#{...}` interpolation no longer works there — [Formula mode](https://docs.workato.com/formulas/formula-mode.html)
- Passing null does not null a field; the `clear` formula is needed (search excerpt) — [Other formulas](https://docs.workato.com/formulas/other-formulas)
- Schema updates: when Workato detects changed object schemas (for example, a new Salesforce custom field), a schema refresh creates a "Schema change" recipe version automatically — [Version management](https://docs.workato.com/recipes/version-management.html)
- SDK `output_fields` returns an array of field hashes that become pills — [SDK triggers](https://docs.workato.com/developing-connectors/sdk/sdk-reference/triggers.html)
- Job details store at most 1 MB of inputs and outputs across all steps — [Recipe quotas](https://docs.workato.com/en/recipes/limits.html)

### Inferences
- Allowlisting Ruby gives familiar syntax and a secured surface, but also a request-a-formula bottleneck. A custom small expression language (or a sandboxed JS subset) would give equal safety with full control.

### Gaps
- Formula null-handling semantics and the total formula count were not on the pages read. How users define custom schemas (for example from a sample payload) was not on the pages read.

## Connections

### Takeaway
Connections hold credentials centrally, encrypted under a per-workspace key hierarchy, with optional external vaults and customer-managed keys. On-premise reach uses an outbound-only mutual TLS tunnel from an agent inside the customer's network, so no inbound firewall opening is needed.

### Cited Findings
**Authentication and scope**
- OAuth 2.0, OAuth 1.0 and variants, Basic, API key or secret. Custom OAuth profiles control scopes, branding and app ownership — [Connections](https://docs.workato.com/en/connections)
- Workato's access generally equals the authorising account's permissions, so Workato recommends a dedicated app user. Quotas: 500 shared connections per workspace, 100,000 combined runtime user and verified user access connections — [Connections](https://docs.workato.com/en/connections)
- Runtime user connections swap in a different credential at run time, available only in Recipe function, Workbot and skills — [Connections](https://docs.workato.com/en/connections)

**Encryption and keys**
- Three levels: a per-workspace Customer Main Key (Workato-managed or customer-managed) encrypts Hourly keys, which encrypt the data-level keys (connection keys, data or job keys, and a log key) — [Key management](https://docs.workato.com/security/data-protection/encryption-key-management/)
- A new hourly key is generated each hour and then becomes decrypt-only, so compromise exposes about one hour of job data. Trigger events are encrypted only with an hourly key — [Key management](https://docs.workato.com/security/data-protection/encryption-key-management/)
- Workato-managed CMK rotates at least yearly. Customer-managed rotation is manual unless KMS auto-rotation is enabled, and replacement is allowed once per 24 hours. Data tables and Workflow apps data use filesystem-level encryption instead of the CMK — [Key management](https://docs.workato.com/security/data-protection/encryption-key-management/)
- AES-256 for data; job history double-encrypted with a provider-managed global key and a tenant key; stored credentials encrypted with a 256-bit key; OAuth 2.0 preferred so no credential is stored — [Security](https://docs.workato.com/en/security); [Security FAQs](https://docs.workato.com/security/security-faqs.html)

**Secrets management**
- Providers: AWS Secrets Manager, Azure Key Vault, CyberArk Conjur, Google Secret Manager, HashiCorp Vault. Runtime flow: Workato requests the secret, receives the decrypted value, and authenticates. Plan-gated — [Secrets management](https://docs.workato.com/security/data-protection/secrets-management/secrets-management.html)
- Workspace-level or project-level but not mixed: if one project uses project-level, all must. Values are cached; rotation means updating the vault then clearing the cache via API, with no reconnect — [Secrets management](https://docs.workato.com/security/data-protection/secrets-management/secrets-management.html)
- Azure cache period is 60 minutes (search excerpt) — [Azure Key Vault](https://docs.workato.com/security/data-protection/secrets-management/using-azure-key-vault-in-connections.html)

**On-premise agents (OPA)**
- Runs inside the customer's network with outbound-only TLS WebSocket to gateways on TCP 443, no inbound ports. Mutual TLS: gateway certificate signed by Workato's private CA, agent client certificate issued at activation. TLS-inspecting proxies break trust, so gateway FQDNs must bypass inspection — [On-prem](https://docs.workato.com/en/on-prem)
- On-prem groups provide HA and load balancing. Minimums: 8 GB RAM, 768 MB disk, 800 MHz 64-bit CPU. Windows, Linux DEB/RPM, Docker and Mac packages — [On-prem](https://docs.workato.com/en/on-prem)
- Secrets from the agent: cloud profiles are configured in Workato (AWS, Azure, HashiCorp). Connection profiles are defined in a config file on the agent host (AWS, Azure, Google), so passwords stay in the vault and out of config files — [OPA secrets](https://docs.workato.com/on-prem/agents/secrets-manager.html)
- On-prem connector request time is 500 s — [Platform quotas](https://docs.workato.com/en/limits)

**Security model elsewhere**
- Workspace isolation for users and resources, plus dev, test and prod separation; IP allowlists; TLS 1.2 and 1.3 on API platform endpoints — [Security](https://docs.workato.com/en/security)
- Data centres listed: US, EU, JP, SG, AU, IL, CN, plus a self-service centre (search excerpt) — [Workato API intro](https://docs.workato.com/workato-api.html). Quota pages also mention KR and UK — [Recipe quotas](https://docs.workato.com/en/recipes/limits.html)
- Virtual Private Workato is a quote-priced isolation add-on — [Pricing](https://www.workato.com/pricing)

### Inferences
- The hourly key pattern (crypto-shred by retention window, small blast radius) is a strong, low-cost pattern to copy, and customer-managed keys only need to change the top wrapping key.
- The agent model means gateway-side orchestration with agent-side execution, and credential locality as a selectable option.

### Gaps
- Tenant-isolation architecture at the compute level is not on the pages read. Agent command-flow detail and per-connector reference syntax for secrets were not on the pages read.

## Integrations

### Takeaway
Three tiers: prebuilt connectors maintained by Workato, a no-code HTTP connector for one-off API use, and a Ruby-style Connector SDK for reusable connectors, with community sharing on top.

### Cited Findings
- 1,200+ prebuilt connectors claimed on the pricing page, included for all users — [Pricing](https://www.workato.com/pricing). The docs directory describes "officially supported platform connectors" and community connectors built by users, and states no total — [Prebuilt connectors](https://docs.workato.com/en/connectors/prebuilt-connectors)
- HTTP connector gives universal API access, and method, URL, headers and body are configured manually per request — [HTTP v2](https://docs.workato.com/developing-connectors/http-v2.html)
- HTTP treats non-2xx as errors by default, which stops the job without a Handle errors step; a setting marks them as success. V1 is deprecated (search excerpt) — [HTTP action](https://docs.workato.com/developing-connectors/http/building-http-action.html); [V1](https://docs.workato.com/developing-connectors/http.html)
- REST or HTTP timeouts: wait for response true 1 hour, false 120 s — [Recipe quotas](https://docs.workato.com/en/recipes/limits.html)
- HTTP vs SDK: both support OAuth 2.0, Basic and API key, and JSON, XML, form, multipart and binary. SDK only: OAuth 1.0, digest, multi-step auth, trigger closure, webhook+poll hybrid triggers, data transformation, pre and post processing, pagination, and reuse across recipes. Clone and run is HTTP only. Auto webhook is SDK-supported and "can cause issues" on HTTP — [HTTP vs SDK](https://docs.workato.com/developing-connectors/http-vs-sdk.html)
- SDK connectors are private by default, can be shared open or closed source, and new-version notifications go to users and child connectors. Connector Copilot can generate code — [SDK](https://docs.workato.com/en/developing-connectors/sdk); [HTTP vs SDK](https://docs.workato.com/developing-connectors/http-vs-sdk.html)
- SDK quotas: 150 custom connectors per workspace, 3 minute HTTP runtime timeout, 40 s in test console, 5 s compile, 30 s credential refresh, 100 multi-step swap outs with 60 s minimum interval, 50 job suspensions, 10 MB connector code — [SDK quotas](https://docs.workato.com/en/developing-connectors/sdk/limits.html)
- Custom actions exist as a middle path for extending connectors — [SDK](https://docs.workato.com/en/developing-connectors/sdk)

### Inferences
- The HTTP-to-SDK ladder is a useful product shape: a visual API call for the 80% case, code for anything needing cursors or pagination.
- A connector here is a declarative object of trigger, action and auth hooks run by the platform. Hosting it as data gives versioned, hot-swappable connectors and fits an equivalent FlowBridge DSL or TypeScript format.

### Gaps
- SDK Ruby sandbox restrictions, CLI and test-harness detail were not read. Connector tiering and licensing are not documented on the directory page.

## Testing and debugging

### Takeaway
There are three layers: a test job that runs one real event against real systems, recipe test cases that mock steps and assert, and job reports with optional per-step network traces.

### Cited Findings
- Test mode picks one event and runs it through all unskipped actions. Polling triggers pick by the start date. Real-time triggers use the first event received, so one may need to be created. Recipe function triggers take supplied input as fields or raw JSON — [Testing](https://docs.workato.com/recipes/testing.html)
- Testing validates required fields, mappings and connections first (search excerpt) — [Testing](https://docs.workato.com/recipes/testing.html)
- Skip step lets a recipe be tested in parts. Failed jobs highlight the failing step — [Testing](https://docs.workato.com/recipes/testing.html)
- Long actions work in test mode; bulk triggers do not — [Long actions](https://docs.workato.com/recipes/long-actions); [Triggers](https://docs.workato.com/recipes/triggers.html)
- Test Automation: create multiple test cases per recipe with mock data and automatic checks on step outputs, with API access for CI/CD. Permissions by project roles — [Test automation](https://docs.workato.com/test-automation.html)
- Case setup: mock the trigger (required), optionally copying a previous job or supplying JSON; mock steps; add data checks and step failure checks; validate. Mocked steps still evaluate input fields, skip the external call and return the mock output. A failed check fails the run (search excerpt) — [Test case setup](https://docs.workato.com/test-automation/test-case-set-up.html)
- Test Automation API runs by recipe, folder, project, manifest or IDs, and runs are asynchronous so callers poll. Test cases are not cloned and are deleted with the parent recipe (search excerpt) — [Test Automation API](https://docs.workato.com/workato-api/test-automation.html)
- Quotas: 100 test cases per recipe, 1,000,000 character body, batch of 500 by ID — [Recipe quotas](https://docs.workato.com/en/recipes/limits.html)
- Job reports: up to 10 custom columns from pills, 256 characters per value, 5 KB per report. Applied only to jobs created afterward. An active recipe must be stopped to edit. CSV export gives the latest 1,000 rows matching filters. Job details show ID, start time, version, status, duration, tasks used, rerun number and runtime user connections — [Jobs](https://docs.workato.com/recipes/jobs.html)
- Job debug tracing records URL, request and response headers, payload and response per action. Admin toggle at Workspace admin > Settings > Network trace. Retained 1 day, access via the Debug Trace privilege, unsupported on connectors including Salesforce Marketing Cloud, Snowflake, MySQL, NetSuite, Kafka, SFTP. No automatic redaction described — [Debug tracing](https://docs.workato.com/recipes/job-debug-tracing.html)

### Inferences
- Test jobs seem to hit real connected apps (the docs recommend sandboxes rather than stating a dry-run mode). FlowBridge could offer a real dry-run mode for every action, which Workato only has through mocks.
- Capturing test cases from a past job is a low-effort way to create fixtures from production data.

### Gaps
- Whether test jobs count as billable usage is not stated on the testing page. The Tasks page counts mocked actions, while the Business actions page does not (see "Templates, AI features, limits, pricing"). Test coverage metrics were not found.

## Publishing and versioning

### Takeaway
A recipe version is created on each save, and you stop a recipe to edit it, then start it again. Promotion between environments is by project-level deployment, with a rollback history and optional review. There is no Git-style branching.

### Cited Findings
- Start activates and fetches by the start date on first run. Stop halts new pickups. Most triggers resume from where they stopped, processing events from the stopped period. Webhook-based real-time triggers may miss events while stopped — [Start and stop](https://docs.workato.com/recipes/start-and-stop.html)
- An active recipe must be stopped to edit or rename — [Start and stop](https://docs.workato.com/recipes/start-and-stop.html)
- Workato may stop a recipe after 60 consecutive errors fetching trigger events, emailing the account address and configured recipients — [Start and stop](https://docs.workato.com/recipes/start-and-stop.html)
- Each save creates a version with user, timestamp and change type (recipe change or schema change). Restore copies the old version as the new current one, and history is preserved — [Version management](https://docs.workato.com/recipes/version-management.html)
- Recipe Diff visually compares two versions (search excerpt) — [Recipe diff](https://docs.workato.com/recipe-development-lifecycle/compare-versions-with-recipe-diff.html)
- Paused jobs continue on the version they began with, while new jobs and reruns use the latest — [Jobs](https://docs.workato.com/recipes/jobs.html)
- Environments: each workspace has DEV, TEST and PROD with separate assets, members and projects. Collaborators are granted per environment. Usage aggregates across all. Deploy from DEV to TEST or PROD with a deployment privilege in both. Deployment history and rollback exist. Plan-gated, and automatic for new customers after 22 December 2021 — [Environments](https://docs.workato.com/features/environments.html)
- Deployment is per project. Existing recipes in the target are overwritten and new ones added. Moving a recipe to another folder in the source can leave duplicates in the target (search excerpt) — [Deployment](https://docs.workato.com/features/environments/deployment.html)
- Recipe Lifecycle Management (RLCM) still works, but Workato recommends migrating to Environments — [Managing recipes](https://docs.workato.com/recipes/managing-recipes.html). RLCM builds a manifest into a ZIP of JSON assets, which can be moved to Git, and the docs state no native Git-style branching (search excerpt) — [Export](https://docs.workato.com/recipe-development-lifecycle/export.html)
- Developer API has endpoints to build, deploy and review (submit, approve, reject) (search excerpt) — [API resources](https://docs.workato.com/workato-api/resources.html). RLCM import limit is 500 requests/hour per user — [Platform quotas](https://docs.workato.com/en/limits)

### Inferences
- Stop-to-edit is a notable product limit: a recipe's live and draft states are one thing. Draft and published versions with atomic hot swap, which keep the trigger running, would be a clear differentiator for FlowBridge.
- Schema-change versions show that connector metadata is treated as part of the recipe. FlowBridge should decide early whether schema snapshots live inside workflow versions.

### Gaps
- Not documented on pages read: version retention count, how connections and properties map per environment, and whether PROD is enforced read-only (only recommended).

## Execution

### Takeaway
Events pass through documented queues into jobs, with a default of one concurrent job per recipe and oldest-first ordering. Long actions put a job on hold and let the next job start, which breaks strict ordering. Timeouts apply at several levels. Worker architecture is not documented.

### Cited Findings
- Events are delivered chronologically, oldest first. Processing is one job at a time by default — [Triggers](https://docs.workato.com/recipes/triggers.html)
- Concurrency is a recipe setting with default 1, and the maximum depends on contract and plan — [Recipe settings](https://docs.workato.com/recipes/settings.html); [Recipe quotas](https://docs.workato.com/en/recipes/limits.html). Pricing lists 1, 1, 15 and 30 for Standard, Business MCP, Enterprise MCP and Workato ONE, with concurrency sold as an add-on — [Pricing](https://www.workato.com/pricing). An older search excerpt said the maximum is 30, which current pages replace with contract-variable wording
- Long actions hold the job and poll for completion. The next job starts even at concurrency 1, disregarding sequence. Supported across databases, warehouses, Salesforce, NetSuite, Snowflake, RPA and Callable recipes, among others — [Long actions](https://docs.workato.com/recipes/long-actions)
- Wait actions: Wait for interval, Wait until specified time, Wait for user action. Pauses up to 732 days, single or cumulative — [Long actions](https://docs.workato.com/recipes/long-actions)
- Job timeout 90 minutes of active execution by default, admin configurable — [Jobs](https://docs.workato.com/recipes/jobs.html)
- API platform job 30 s default, 240 s maximum. MCP tool 30 s sync, 300 s total. Read request 180 s for most connectors. Database action 500 s, deferred 2 hours. Salesforce bulk 24 hours. Developer and Embedded APIs 40 s — [Platform quotas](https://docs.workato.com/en/limits)
- Queue sizes: recipe function 10,000, user actions 1,000, long action 10,000, poller events 10,000, webhook events 20,000 — [Recipe quotas](https://docs.workato.com/en/recipes/limits.html)
- Recipe limits: 1,000 steps. Code size 90 MB in US, 1,000 lines in EU, SG, JP, AU, IL, KR, UK and self-service. Name 255 characters — [Recipe quotas](https://docs.workato.com/en/recipes/limits.html)
- Throttling: Developer API most endpoints 60 requests/minute, create recipe, force run and repeat or cancel jobs 1 request/second, 25 jobs per repeat or cancel request. Embedded API has its own tiers. Headless API 200 req/s unauthenticated and 50 req/s authenticated (global) — [Platform quotas](https://docs.workato.com/en/limits)
- Paused jobs resume on restart. Pending jobs fail after the recipe has been stopped for 30 days, including nested jobs — [Jobs](https://docs.workato.com/recipes/jobs.html)
- API platform calls that exceed a concurrency limit or a rate or quota limit return 429 (search excerpt) — [Calling APIs](https://docs.workato.com/api-mgmt/calling-apis.html)
- Do not store any data retention mode can reduce latency on API recipes by skipping log creation — [Recipe settings](https://docs.workato.com/recipes/settings.html)

### Inferences
- Per-recipe concurrency sold as a licence dimension means capacity is metered at recipe level. Cheap ordering guarantees (default 1) trade off throughput.
- FIFO at concurrency 1 is only a best-effort ordering once long actions are used, since sequence is explicitly disregarded. A per-key ordering (partition) option is not documented and would be an improvement.

### Gaps
- Not documented on pages read: what happens when a queue is full, worker infrastructure, whether ordering holds at concurrency above 1, partition-key ordering, and the exact sync recipe function timeout. Automatic backoff on upstream rate limits was not described on the pages read.

## Error handling

### Takeaway
Handling is opt-in, and an unhandled action error fails the job. Handle errors is a try-and-catch block with a small retry budget (3 retries, 1 to 10 s), and reruns replay stored trigger data through the latest version with no idempotency guarantee.

### Cited Findings
- Default: an error ends the job as Failed and no further steps run — [Jobs](https://docs.workato.com/recipes/jobs.html)
- Handle errors has Monitor and On error blocks. On error is skipped if monitored steps succeed. Retries are off by default, up to 3, interval 1 to 10 s, with an optional Retry IF condition. On error steps run only after retries fail — [Error handling](https://docs.workato.com/recipes/best-practices-error-handling.html)
- Error pills: `error[type]`, `error[message]`, `error[retry_count]`, UUID, errored step, app and action, inner message (with a warning that third-party format is unstable). Structured fields: `error_type_id`, `error_type`, `error_id`, `error_message`, `http_response` — [Error handling](https://docs.workato.com/recipes/best-practices-error-handling.html)
- API recipes: on a request timeout the Monitor block does not trigger and On error steps do not run. The extraction also said "the recipe then continues", which conflicts with "job terminates immediately" — [Error handling](https://docs.workato.com/recipes/best-practices-error-handling.html)
- Stop job: see Logic — [Error handling](https://docs.workato.com/recipes/best-practices-error-handling.html)
- Errors are classed as internal (Workato's platform actions) vs upstream or downstream (connected systems) — [Errors](https://docs.workato.com/recipes/run-time-errors/internal-upstream-errors.html)
- HTTP error reference marks 408, 429 and most 5xx as retryable, most 4xx as not (search excerpt) — [HTTP errors](https://docs.workato.com/developing-connectors/http/error-message.html)
- Rerun: any completed or failed job can be rerun from stored trigger data, using the latest recipe version — [Jobs](https://docs.workato.com/recipes/jobs.html). Select multiple in the job report and click Repeat job. The rerun processes the entire recipe and "may result in duplicate records". Original place and rerun history stay in the job report. Older jobs depend on retention — [Rerun](https://docs.workato.com/recipes/rerun-job.html)
- API quota for repeat: 25 jobs per request, 1 request/second — [Platform quotas](https://docs.workato.com/en/limits)
- The rerun page says the button is unavailable "if the job rerun is not the latest version", which I read as the latest rerun attempt of that job, not recipe version — [Rerun](https://docs.workato.com/recipes/rerun-job.html)
- RecipeOps can automate recovery: restart a recipe or rerun jobs when triggered by events — [RecipeOps](https://docs.workato.com/en/connectors/recipeops)

### Inferences
- Rerun restarts the whole job, with no resume-from-failed-step, so non-idempotent steps are a user problem. Checkpointed resume and step-level idempotency keys would be a major FlowBridge differentiator.
- Three retries over 10 s is too short for real outages. Longer exponential backoff with a dead-letter queue is a sensible upgrade.

### Gaps
- Not documented on pages read: nested Monitor behaviour, child-to-parent error propagation, automatic platform-level retries, and trigger-error backoff before the 60-errors stop.

## Monitoring

### Takeaway
Observability has per-recipe job history, an Operations hub dashboard, a Logger connector and service, an audit log, audit log streaming to external sinks, and RecipeOps, which is alerting implemented as recipes.

### Cited Findings
- Job history: per-run trigger, each step's outcome, errors and the data moved, with rerun and replay of failures. Operations hub dashboard: real-time recipe activity, job outcomes, connection status and business metrics. Logging service: structured entries from Logger by Workato, searchable by recipe, level and content — [Observability](https://docs.workato.com/en/observability)
- Logging service retains a maximum of 30 days or 1 million entries (search excerpt) — [Logging service](https://docs.workato.com/features/logging-service.html)
- Audit log streaming sends JSON per job or event via HTTP POST, typically 1 KB to 1 MB, quota 40 MB (above this, step lines are dropped). Masked data appears as `"masked"`. Destinations: S3, Azure Monitor, Azure Blob, Sumo Logic, Datadog, Splunk, Google Cloud Storage. Plan-gated — [Streaming](https://docs.workato.com/features/activity-audit-log-streaming.html)
- Streaming only captures data created after configuration — [Data retention](https://docs.workato.com/security/data-protection/data-retention/)
- RecipeOps triggers: recipe started, stopped by user, stopped by Workato, job failed, connection events, credential refresh failed, API concurrency and quota violations, deployments, on-prem agent disconnected. Actions: list and search, start and stop recipes, rerun jobs. No built-in alerting engine; alerts are recipes that notify Slack, email, SMS, or a Twilio call — [RecipeOps](https://docs.workato.com/en/connectors/recipeops)
- Notifications: Notifications and Error alerts in workspace admin receive recipe-stop emails — [Start and stop](https://docs.workato.com/recipes/start-and-stop.html). SDK throttling notifications go to workspace admins — [SDK trigger quotas](https://docs.workato.com/developing-connectors/sdk/guides/trigger-limit.html)
- Retention: job data 30 days on Standard and Business, 90 on Enterprise (customisable 1 hour to 90 days). Reducing is not retroactive, extending is. After expiry, job summaries remain but action data, trigger events and report columns are deleted, which disables reruns — [Data retention](https://docs.workato.com/security/data-protection/data-retention/)
- Per-recipe retention modes: workspace default, do not store trigger event (reruns disabled), do not store any data — [Recipe settings](https://docs.workato.com/recipes/settings.html)
- Data masking per step stops storage and display of its input and output; report pills for that step are blocked. A Create variable step is the workaround for non-sensitive values. Trigger event data is still stored (search excerpt) — [Data masking](https://docs.workato.com/features/data-masking.html)
- Acumen (under AIRO) monitors the workspace, helps troubleshoot, forecasts usage and surfaces incidents — [AIRO](https://docs.workato.com/en/airo)

### Inferences
- "Alerts are recipes" is elegant dogfooding, but monitoring then depends on the platform being monitored, and alert recipes consume usage. A built-in alert path independent of the workflow engine is safer.

### Gaps
- Streaming delivery semantics and retries are not documented on the page read. Insights was not read.

## Administration

### Takeaway
The tenancy unit is a workspace with per-environment roles. The current model separates environment roles (settings and tools) from project roles (content), plus custom roles. SAML, SCIM, 2FA and an audit log support enterprise control, and most are plan-gated.

### Cited Findings
- A workspace owns recipes, so contributions survive when a collaborator leaves. One account may join multiple workspaces. Invitations are under Workspace admin > Access control — [Team collaboration](https://docs.workato.com/en/user-accounts-and-teams/team-collaboration.html)
- Environment roles: Environment admin (everything), Environment manager (env settings and tools but no workspace-wide permissions), Member (view only, "Use in recipes" for SDK). Roles are per environment. They grant no project content access, and creating a project makes you its Project admin — [Environment roles](https://docs.workato.com/en/user-accounts-and-teams/role-based-access/new-model/system-environment-roles.html)
- Project roles include Project admin, Advanced builder, Builder, Project operator and View only. Legacy system roles are Admin, Analyst, Operator and View only — [Test automation](https://docs.workato.com/test-automation.html)
- Custom roles can scope to folders, recipes and connections — [Security](https://docs.workato.com/en/security)
- Admins must explicitly join a project to access it, and this is logged (search excerpt) — [RBAC FAQs](https://docs.workato.com/en/user-accounts-and-teams/role-based-access/permission-model-faqs)
- SSO via SAML under Authentication > Login methods. 2FA can be required. Session timeout configurable. SCIM provisioning available — [Admin settings](https://docs.workato.com/en/workspace-admin-settings)
- SCIM 2.0 requires the Data Monitoring or Advanced Security and Compliance capability. Guidance is SCIM for lifecycle and SAML for roles (search excerpt) — [SCIM FAQs](https://docs.workato.com/scim-faqs.html)
- Activity audit log: logins, invitations, recipe changes and more. Retained one year by default, and streaming extends this. Plan-gated. Viewable by owner, Admin and Activity audit privilege holders — [Audit log](https://docs.workato.com/features/activity-audit-log.html)
- Compliance: PCI-DSS v4.0.1 Level 1, ISO 27001, 27701 and 42001, SOC 1 Type II, SOC 2 Type II, SOC 3, HIPAA with BAAs, IRAP, NIST 800-171A r2 — [Security FAQs](https://docs.workato.com/security/security-faqs.html)
- Automation HQ workspaces share a pooled task quota (search excerpt) — [AHQ usage](https://docs.workato.com/en/ahq-usage.html)
- Pricing states unlimited workspaces and users — [Pricing](https://www.workato.com/pricing)

### Inferences
- Unmetered seats and metered runs remove the incentive to limit builders, and let admins grant wide access with roles rather than licences.

### Gaps
- Deployment review roles were described as private beta in admin settings, and the status elsewhere is unclear. The Trust Center was not visited. The compliance list comes from the FAQ page rather than attestations.

## Templates, AI features, limits, and pricing

### Takeaway
List prices exist only for self-service. Enterprise plans are quote-based on edition plus metered credits. The billing unit is inconsistent across docs (Tasks, Business actions, Credits) and depends on the contract. AI has moved from assistant to a builder agent (AIRO) and a separate agent runtime (Agent Studio).

### Cited Findings
**Templates**
- Community library offers recipes, connectors and skills as "a reusable set of templates, best practices and guidelines". Not in the China data centre. Installing a connector requires full SDK access, and cloning recipes requires recipe creation permission — [Community library](https://docs.workato.com/en/community-library)

**AI**
- AIRO: described as an AI automation engineer. Knowledge agents answer questions, a Solution Architect pipeline turns a PRD into a blueprint and assets, and single requests are built directly. Available in Workato and MCP clients such as Claude Code and Cursor. Admin-enabled. Token budget per model on a rolling 60 s window, throttling delays up to 30 s — [AIRO](https://docs.workato.com/en/airo)
- Agent Studio: registry for genies (agents with job description, skills, knowledge bases). Skills connect to apps, custom APIs, data tables or external MCP servers, with version history, rollback and test cases. Genies can delegate and call A2A agents. Skill invocations run as jobs — [Agentic](https://docs.workato.com/en/agentic/agentic)
- Formula Copilot and Connector Copilot exist (search excerpt) — [Formula copilot](https://docs.workato.com/en/recipes/copilot-in-formula-mode.html)
- AI data residency: processed within source region for US and EMEA, with SG, JP and AU within APAC (search excerpt) — [AI by Workato](https://docs.workato.com/en/connectors/ai-by-workato/analyze-text-action.html)

**Limits**
- See the Execution, Triggers and Logic sections for numbers — [Platform quotas](https://docs.workato.com/en/limits). Defaults can be extended on Enterprise by request — [SDK quotas](https://docs.workato.com/en/developing-connectors/sdk/limits.html)

**Pricing**
- Editions: Standard, Business MCP, Enterprise MCP, Workato ONE. No dollar amounts. Consumption tracked by capability. Connectors, users and workspaces unlimited. Workbots 1, 10, unlimited. OPAs 3, 10, 30 on the upper three tiers. Concurrency 1, 1, 15, 30. Log retention 30 days (Standard), 90 (Enterprise MCP) — [Pricing](https://www.workato.com/pricing)
- Quote-only add-ons: Pre-Packaged Genies, Advanced Security and Governance, OpenLegacy, RobotiQ RPA, Private Link, On-premises Agents, Workflow Apps, Data Hub, Concurrencies, EDI, Virtual Private Workato — [Pricing](https://www.workato.com/pricing)
- Self-service: Workato Free is a one-time 50,000 credits. Pro at $75 for 2,500, $100 for 3,500, $275 for 10,000, $780 for 30,000, $1,275 for 50,000 credits/month. Unused credits expire monthly — [Self-service](https://docs.workato.com/en/pricing/self-service/self-service)
- Credit conversion: credits are a common unit across Tasks, API Calls, Rows Processed and Genie Actions, and one prompt to a genie is one Genie action (search excerpt) — [Pricing FAQs](https://docs.workato.com/en/pricing/pricing-faqs.html). No published conversion rate was found on the pages read
- Tasks: 1 per action, per iteration in loops, 1 for bulk or batch actions regardless of record count, more than 1 for AI by Workato. Triggers, IF, loop, Stop and Handle errors do not count. A function call counts 1 plus its steps — [Tasks](https://docs.workato.com/recipes/tasks.html)
- Business actions: counted triggers from eligible apps and actions in eligible apps. Mapper, Lookup Tables, Logger, Variables, Scheduler, Workflow apps and Data Tables are ineligible, Recipe Function steps are ineligible. Failed actions do not count, and each successful retry attempt does. Example: 1 + (2 × 10) = 21 — [Business actions](https://docs.workato.com/en/pricing/usage-metrics/recipes.html)
- Conflict: [Tasks](https://docs.workato.com/recipes/tasks.html) counts mocked actions and does not count triggers, while [Business actions](https://docs.workato.com/en/pricing/usage-metrics/recipes.html) excludes mocked actions and counts eligible triggers. Different plans use different metrics, so both may be right for their plan. The Tasks page's retry text is also internally inconsistent (1 Task vs 2 Tasks in an example)
- Reruns count like original runs, and steps successful before a failure still count (search excerpt) — [Pricing FAQs](https://docs.workato.com/en/pricing/pricing-faqs.html)
- Non-official contract estimates (third party, unverified, low sample size): median $65,000/year on 4 purchases per [CostBench](https://www.costbench.com/software/ai-automation/workato/); $61,800 to $78,500 for mid-market Business per [Zapier citing Vendr](https://zapier.com/blog/workato-pricing)

### Inferences
- Counting batch actions as one Task incentivises batch design and reduces per-record cost. The self-service Pro rate of about $25 to $30 per 1,000 credits (derived) is expensive relative to volume, so enterprise contract pricing must differ a lot.
- Excluding control flow and utility steps from billing removes the penalty on well-structured recipes. FlowBridge should decide this deliberately.

### Gaps
- No official per-credit, per-Task or edition price for enterprise plans. The credit conversion rate and the current mapping of plans to metrics are not published on the pages read. Plan structures may vary by contract and sign-up date per [Pricing](https://www.workato.com/pricing).

## Needs user login

No page that I attempted required a login, and I did not attempt to sign in. Items that only a signed-in workspace or the contract could settle:
- https://app.workato.com/ — what test jobs and mocked steps actually count on the usage dashboard, and the current editor flow for stopping and editing a recipe. Workato's docs conflict or are silent here.
- Your Customer Success or contract terms (not a URL) — credit conversion and concurrency maximums.
