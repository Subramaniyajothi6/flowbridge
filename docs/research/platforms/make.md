# How Make (make.com, formerly Integromat) works end to end

Research date: 2026-11-07. Main source: Make's official documentation, read in full-text form from [help.make.com/llms-full.txt](https://help.make.com/llms-full.txt) and [developers.make.com/llms-full.txt](https://developers.make.com/llms-full.txt), both downloaded on the research date. Every item under "Cited Findings" comes from the linked page unless it is marked otherwise. "Inferences" are my own reasoning for FlowBridge, not Make's statements.

**Three things in this reference differ from older write-ups of Make:**
1. Make scheduled cycles for removal on 1 October 2026. All runs complete one cycle from that date.
2. "Credits" replaced "operations" as the billing unit. Operations still exist as the record of work done.
3. The error handling docs now call the directives Skip and Retry. Older pages still say Ignore and Break.

---

## Workflow model and terminology: scenarios, modules, bundles, operations or credits, cycles. How does data flow between modules?

### Takeaway
A scenario is a linear or branching chain of modules. Modules process bundles one at a time, and each module run is an operation, normally billed at 1 credit. So a multi-bundle output multiplies cost and work across every later module.

### Cited Findings
**Hierarchy**
- A module is a building block that performs one action, such as retrieving data, creating or updating a record, or downloading a file. — [Types of modules](https://help.make.com/types-of-modules)
- Module types by function: Trigger, Search, Action, Universal ("Make an API Call"). — [Types of modules](https://help.make.com/types-of-modules)
- Custom app docs list six module types, including action, search, trigger, instant trigger, universal, and responder. — [Modules (developers)](https://developers.make.com/custom-apps-documentation/app-components/modules)
- Modules also split into Apps (connect to a service or third-party API) and Tools (no connection or third-party API; for example Iterator, Aggregator, Data store, Set variable). — [Types of modules](https://help.make.com/types-of-modules)
- A trigger can be added only once, as the first module. A scenario can also start with a Search or Action module, which then acts as a polling trigger on the schedule. — [Types of modules](https://help.make.com/types-of-modules)

**Bundles and data items**
- Bundles are containers of related data items. For example, a contact is a bundle with name and email items. — [Operations](https://help.make.com/operations)
- An operation contains an input bundle (what the module receives) and an output bundle (the module's response). — [Operations](https://help.make.com/operations)

**How data moves**
- If the first module returns no bundles, the scenario ends there. Otherwise each bundle passes to the next module, one module at a time. — [Scenario execution flow](https://help.make.com/scenario-execution-flow)
- A later bundle does not start until the earlier bundle has finished the chain. In Make's example, the second image waits until the first has been converted and uploaded. — [Scenario execution flow](https://help.make.com/scenario-execution-flow)
- "Modules process each bundle separately, meaning each bundle triggers its own module run." — [Operations](https://help.make.com/operations)
- Worked example: a trigger plus 3 modules with 10 bundles equals 1 + 30 = 31 operations. — [Operations](https://help.make.com/operations)
- Clicking Stop cannot interrupt a module mid-way. The current module finishes all its bundles, then later modules do not run. — [Operations](https://help.make.com/operations)

**Operations vs credits**
- An operation is "a single module run to process data or check for new data". — [Operations](https://help.make.com/operations)
- Credits are the currency you buy and spend. Operations show what happened, and credits track spend. — [Credits](https://help.make.com/credits)
- Non-AI apps use 1 credit per operation, regardless of file or data size. — [Credits](https://help.make.com/credits)
- Credit cost by module type: — [How features use credits](https://help.make.com/how-features-use-credits)
  - Trigger: 1 credit per run, even when no data is found.
  - Search: 1 credit per run, even if it returns many bundles.
  - Action: 1 credit per input bundle.
  - Aggregator: 1 credit per aggregation.
  - Iterator: 1 credit to split the array, then later modules pay per bundle.
- No credit cost: error handlers, routers, filters, the Scenarios app modules (Call a subscenario, Start a scenario, Return output, Customize run name), and Make Functions modules. — [How features use credits](https://help.make.com/how-features-use-credits)
- If-else and Merge "use operations" but consume no credits. — [If-else and Merge](https://help.make.com/if-else-and-merge)

**Cycles**
- A cycle is one pass through all modules. Multiple cycles repeated the pass within one run, pulling from the trigger until no records were waiting. — [Cycles removal](https://help.make.com/cycles-removal-on-october-1-2026)
- From 1 October 2026 the Cycles per run setting is gone and "all scenario runs complete one cycle". Related options also go: Increment function's "After one cycle" reset and Set variable's "One cycle" lifetime. — [Cycles removal](https://help.make.com/cycles-removal-on-october-1-2026)
- Make's stated reasons: few users used cycles, the setting confused people, and removal simplifies the engine. — [Cycles removal](https://help.make.com/cycles-removal-on-october-1-2026)

### Inferences
- The execution order is depth-first per bundle. It is not a batch stage model where a module finishes all bundles before the next module starts.
- Billing is close to bundle-count times module-count, which makes "reduce bundles early" the main cost lever. Filters and routers being free encourages that.
- Dropping cycles suggests the "transaction per trigger batch" concept was not worth its complexity. FlowBridge could start with one run per trigger batch and skip cycles entirely.

### Gaps
- The cycles notice is written in future tense. I found no post-1-October confirmation page, and [Scenario settings](https://help.make.com/scenario-settings) and [Cycles and phases](https://help.make.com/scenario-execution-cycles-and-phases) still describe the setting. Treat the removal as scheduled and probably effective, not confirmed.
- The internal bundle schema or wire format is not documented.

---

## Triggers: instant vs polling, schedules, webhooks, queues of incoming webhooks

### Takeaway
Polling triggers hold a cursor and run on a schedule. Instant triggers are webhooks that feed a per-webhook queue. The queue size scales with purchased credits and is capped at 10,000 items, and overflow is rejected rather than dropped silently.

### Cited Findings
**Polling**
- A polling trigger checks for new data since the last run, on the scenario's schedule. A run that finds nothing is a "check run". — [Types of modules](https://help.make.com/types-of-modules)
- "The trigger module is a special module that saves the information about the last item processed and continues the execution from that item." — [Trigger (polling), developers](https://developers.make.com/custom-apps-documentation/app-components/modules/trigger)
- "Choose where to start" offers the current moment, a specific date, a specific ID, or the first record. It only affects the first run. — [Types of modules](https://help.make.com/types-of-modules)

**Schedules**
- Options: At regular intervals, Once, Daily, Weekdays, Weekly, Monthly, Specified dates, On demand, and Immediately (some triggers only). The default is every 15 minutes. Optional start and end dates exist. The minimum interval depends on plan. — [Schedule a scenario](https://help.make.com/schedule-a-scenario)
- On-demand scenarios run only through an API call or Run once. — [Schedule a scenario](https://help.make.com/schedule-a-scenario)

**Instant triggers and webhook types**
- Adding an instant trigger sets the schedule to "Immediately as data arrives". If you reschedule it, the webhook still receives data on arrival and holds it in the queue until the next run. — [Types of modules](https://help.make.com/types-of-modules)
- Scheduled webhooks process a set number of requests per run, set by "Maximum number of results" (default 2). — [Webhooks](https://help.make.com/webhooks)
- Custom app webhook types: — [Shared](https://developers.make.com/custom-apps-documentation/app-components/webhooks/shared), [Dedicated](https://developers.make.com/custom-apps-documentation/app-components/webhooks/dedicated)
  - **Dedicated attached:** the URL registers automatically via an attach directive and unregisters via detach.
  - **Dedicated not attached:** the user pastes the URL manually.
  - **Shared:** one URL for all users, routed using a `uid` defined in both connection and webhook.
  - Make says over 90% of services use dedicated webhooks.
- Webhook specs can include a `verification` block that answers service handshakes. — [Webhooks (developers)](https://developers.make.com/custom-apps-documentation/app-components/webhooks)

**Webhook queue and limits** — all from [Webhooks](https://help.make.com/webhooks)
- Each webhook has its own queue. Capacity is 667 items per 10,000 credits per month, to a hard maximum of 10,000.
- A full queue rejects new data with 400 "Queue is full". Queued data is deleted once processed.
- The rate limit is 300 incoming requests per 10 seconds. Beyond that, the response is 429 "Too many requests".
- The default response when accepted is 200 "Accepted". A Webhook response module customizes it.
- Query parameters and body merge into one bundle.
- A webhook not connected to any scenario for more than 5 days (120 hours) is deactivated and returns 410 "Gone".
- Logs are kept 3 days, or 30 days on Enterprise. They show request, response, parsed items, and size.

**Other queue behaviour**
- Webhooks run in parallel by default. "Process data in order" makes each run wait for the previous one. — [Webhooks](https://help.make.com/webhooks)
- Out of credits: scenarios stop, webhooks queue up to the limit and process when credits return, and polling scenarios resume from the last successful run. — [Make pricing FAQ](https://www.make.com/en/pricing)
- There are API endpoints and MCP tools for the webhook queue, including deleting items. — [Developer docs](https://developers.make.com/llms-full.txt)

### Inferences
- Tying queue depth to spend (667 per 10k credits) limits both abuse and storage per tenant. Returning 400 on overflow pushes retry responsibility to the sender.
- Trigger state must commit separately from the run, or items get lost or duplicated. See the "Commit trigger last" setting under Error handling.

### Gaps
- Webhook maximum payload size, signature checking, and IP restriction are not covered on the Webhooks page.
- Per-plan minimum schedule interval could not be read from an official page; see the Pricing section.

---

## Logic: routers, filters, iterators, aggregators, sub-scenarios, sleep, code, data stores

### Takeaway
Control flow is built from generator modules (Iterator, Repeater), bracketing aggregators, sequential routers, and newer If-else and Merge modules. Reuse comes through synchronous or asynchronous subscenarios, and state lives in small data stores and variables.

### Cited Findings
**Routers and If-else**
- A Router branches the flow into routes with conditions. "Routes are processed sequentially, not in parallel." A second route does not start until the first finishes. Order is configurable. A fallback route runs last for data that fits no other route. — [Router](https://help.make.com/router)
- Router vs If-else: the Router runs all matching routes and cannot be rejoined. If-else runs only the first true condition (otherwise Else) and can be rejoined with Merge, which works only with If-else. — [If-else and Merge](https://help.make.com/if-else-and-merge)
- No converger module exists for routers. Documented workarounds are a data store record, JSON stored in a variable, Set/Get variable, or a separate scenario called by webhook. — [Converger](https://help.make.com/converger)

**Filters**
- A filter sits on the link between two modules. It passes a bundle on or terminates that bundle's processing. Operators include exists, not exists, text, numeric, date, and array comparisons. Operands accept mapped values. — [Filtering](https://help.make.com/filtering)
- Copying filters natively was documented as unsupported on this page, with a DevTool workaround. A later release note title mentions filter copying, so this page may be stale. — [Filtering](https://help.make.com/filtering)

**Iterators, Repeater, Aggregators**
- An Iterator converts an array into one bundle per item. Its output also includes `Total number of bundles` and `Bundle order position`. — [Iterator](https://help.make.com/iterator)
- A Repeater generates bundles, each with a numeric item `i`, using an initial value, a repeat count, and a step. — [Flow control](https://help.make.com/flow-control)
- An aggregator accumulates bundles from "a single source module's operation" and outputs one bundle. Its Source Module setting defines the start of the grouped span, and the editor shades that span. — [Aggregator](https://help.make.com/aggregator)
- Group by evaluates a formula per bundle and outputs one bundle per distinct key. "Stop processing after an empty aggregation" is optional. — [Aggregator](https://help.make.com/aggregator)
- Items from bundles between source and aggregator are not available afterwards unless they are explicitly included. — [Aggregator](https://help.make.com/aggregator)
- Other aggregators include numeric, table, and text. — [Tools](https://help.make.com/util)

**Subscenarios**
- A parent calls a child via Scenarios > Call a scenario. The child starts with Scenarios > Start a scenario and returns with Return outputs. Inputs and outputs have defined structures. — [Subscenarios](https://help.make.com/subscenarios)
- Synchronous mode pauses the parent until outputs return. Asynchronous mode continues immediately. — [Subscenarios](https://help.make.com/subscenarios)
- The child must be active and scheduled on demand. Only scenarios in the same team can be called this way. Otherwise use Make > Run a scenario or a Custom webhook. — [Subscenarios](https://help.make.com/subscenarios)
- Subscenario calls through the Scenarios app use no credits. They can also serve as tools for AI agents and MCP clients. — [Subscenarios](https://help.make.com/subscenarios)

**Sleep and variables**
- Sleep delays the flow for up to 300 seconds. For longer pauses, Make suggests splitting into two scenarios. — [Tools](https://help.make.com/util)
- Set and Get variables hold values within a run. Custom variables are team or organization level, persist between runs, and require Pro, Teams, or Enterprise. — [Tools](https://help.make.com/util), [Custom variables](https://help.make.com/custom-variables)

**Code**
- Make Code runs JavaScript or Python in an isolated sandbox on paid plans. It costs 2 credits per second of execution time, excluding backend processing time. — [Make Code release](https://help.make.com/the-make-code-app-is-available)
- Limits for Core, Pro, and Teams: 1 CPU, 512 MB RAM, 30 seconds. Enterprise: 2 CPUs, 1024 MB RAM, 300 seconds, plus custom library imports. — [Make Code release](https://help.make.com/the-make-code-app-is-available)
- Preinstalled libraries: moment, moment-timezone, lodash (JS); pendulum, toolz, requests (Python). — [Make Code release](https://help.make.com/the-make-code-app-is-available)
- Custom functions (Enterprise): JavaScript ES6, 300 ms maximum runtime, 5,000 characters maximum, synchronous only, no third-party libraries, and no validation on save. They belong to a team. — [Custom functions](https://help.make.com/custom-functions)

**Data stores** — from [Data stores](https://help.make.com/l6du-data-stores)
- A data store is similar to a simple database and persists data across runs and scenarios.
- Storage is 1 MB per 1,000 credits per month. The minimum per store is 1 MB, the maximum is 1,000 stores per organization, and the maximum record size is 15 MB.
- A store may have a data structure, with an optional Strict mode that rejects extra fields. Record keys can be supplied or generated.
- Renaming a structure field orphans the old column data. Structure changes apply only to new data.
- Data store modules are transactional (see ACID under Error handling). — [Overview of error handling](https://help.make.com/Overview-of-error-handling)

### Inferences
- Make is an interpreter over a tree, not a general DAG. A router never rejoins, and the Merge module is a recent, narrow exception. FlowBridge should decide early whether it supports true joins, because retrofitting is visibly awkward.
- The aggregator's Source Module is effectively an explicit "end of loop" scope marker. It avoids needing visual loop containers.
- Sequential route execution gives deterministic ordering but means slow routes block others in a run.

### Gaps
- Data store query capability, indexing, and concurrent write behaviour were not found in what I read.
- Sandbox network egress rules were not extracted. The Make Code module reference at apps.make.com may cover them.

---

## Data mapping and functions: the mapping panel, functions, data structures, data types

### Takeaway
Mapping is a formula language in every field, driven by output metadata that each module publishes to later modules. Unknown schemas are "learned" by running the module once, and Make coerces types automatically with some surprising rules.

### Cited Findings
**Mapping panel**
- Clicking a field opens the mapping panel. The first tab shows items from earlier modules. Other tabs hold General, Math, Text and binary, Date and time, Array, and Custom functions, plus Custom and system variables. — [Use functions](https://help.make.com/use-functions)
- Hovering a mapped item pulses its source module. — [Mapping](https://help.make.com/mapping)
- Mapped values can be double-clicked into editable text, and copied between fields. — [Release note](https://help.make.com/improved-error-handling-and-plain-text-editing-for-mapped-values)
- "Each module is responsible for providing information about items it outputs" so they can display in later panels. — [Iterator](https://help.make.com/iterator)
- If a module lacks a structure (Parse JSON, Custom webhook), nothing shows until you run it once or use "Run this module only". It then learns its output. — [Iterator](https://help.make.com/iterator)
- Array indexing uses square brackets, 1-based in the docs' example (an empty index means the first element, and entering 2 selects the second). Key lookup combines `first()` and `get()`. — [Mapping arrays](https://help.make.com/mapping-arrays)

**Data types and validation**
- Types: Text, Number, Boolean, Date and time, Buffer (binary), Collection, Array. — [Item data types](https://help.make.com/item-data-types)
- Invalid data stops the module with a DataError. — [Item data types](https://help.make.com/item-data-types)
- Dates display in the profile's locale and time zone, and pass through APIs as ISO 8601. — [Item data types](https://help.make.com/item-data-types)
- Coercion examples: a non-array becomes a one-element array; any number becomes Yes for Boolean, "even if the value is `0`"; text `false` or empty becomes No, other text becomes Yes; buffers convert codepages or return a validation error. — [Type coercion](https://help.make.com/type-coercion)

**Data structures**
- A data structure describes the format of data transferred, so the editor knows what modules take and return. It is used for parsing JSON, XML, CSV, and data store columns. A generator creates one from a sample. — [Data structures](https://help.make.com/data-structures)

**System variables**
- These expose scenario ID, name and URL, execution ID, operations and data consumed, start time, team and organization info, operations left, data left, and zone domain. — [System variables](https://help.make.com/system-variables)

**Custom apps**
- Custom apps use IML, Make's template expression language, such as `{{connection.apiKey}}` and `{{payload.id}}`. — [Base](https://developers.make.com/custom-apps-documentation/create-your-first-app/apps-environment/base)
- RPCs fetch live dropdown options, dynamic fields, and samples while the user configures a module. — [RPCs](https://developers.make.com/custom-apps-documentation/app-components/rpcs)

### Inferences
- The "run once to learn the shape" pattern avoids requiring declared schemas, at the cost of a real test call. FlowBridge should offer both sample paste and live learning.
- `0` coercing to Yes is a known kind of trap. FlowBridge should warn on implicit coercion rather than copy this.

### Gaps
- Formula evaluation internals and sandboxing are not documented. I did not enumerate every function in the catalog; see the function pages linked from [Functions](https://help.make.com/functions).

---

## Connections: OAuth and API key connections, keys, scopes, reauthorization, credential security

### Takeaway
Connections are team-owned, reusable credential objects, and each app defines how they verify and refresh. Keychains hold keys and certificates separately. Credential requests let third parties authorize without exposing secrets. The storage-encryption design is barely documented in what I read.

### Cited Findings
**Model**
- Connections are created in the builder when adding a module, depending on the app's method: OAuth grant, or typed credentials such as API key, username and password, or client ID and secret. — [Connect an application](https://help.make.com/connect-an-application)
- "All users in your team in Make can use and manage any connections you create in that team." Make suggests a separate team for personal accounts. — [Connect an application](https://help.make.com/connect-an-application)
- Multiple connections per app per team are allowed. — [Connect an application](https://help.make.com/connect-an-application)
- Private spaces give each member a personal workspace for scenarios and connections. — [Private spaces](https://help.make.com/private-spaces)
- The API documents a per-connection access list with member roles. — [Developer docs](https://developers.make.com/llms-full.txt)

**Lifecycle**
- Management actions: edit, verify, reauthorize, delete. You can see which scenarios use a connection and what permissions it was granted. — [Connect an application](https://help.make.com/connect-an-application)
- Editing replaces all data, because "Make doesn't keep the original connection data" for re-display. Modules using it update automatically. — [Connect an application](https://help.make.com/connect-an-application)
- Changing the account or auth method means creating a new connection and replacing it across modules. — [Connect an application](https://help.make.com/connect-an-application), [Replace connections](https://help.make.com/replace-connections-across-multiple-modules)
- Via API, OAuth connection edits need a login and a Reauthorize click, while other connection types take effect immediately. — [Developer docs](https://developers.make.com/llms-full.txt)
- Reauthorization can fail from blocked pop-ups, expired or revoked tokens, changed permissions, or a temporary outage. — [Connect an application](https://help.make.com/connect-an-application)

**OAuth mechanics (custom apps)**
- Connection types: Basic, JWT, OAuth 1.0, OAuth 2.0. — [Connections (developers)](https://developers.make.com/custom-apps-documentation/app-components/connections)
- OAuth 2.0 flow sections are `preauthorize => authorize => token => info`, with separate `refresh` and `invalidate`. Client-credentials flow skips `authorize`. — [OAuth 2.0](https://developers.make.com/custom-apps-documentation/app-components/connections/oauth2)
- Callback URL is `https://www.make.com/oauth/cb/app`, with a legacy integromat.com URL still recognized. — [OAuth 2.0](https://developers.make.com/custom-apps-documentation/app-components/connections/oauth2)
- Every connection has a test request (a "whoami"-style call) to validate credentials. — [Connections tutorial](https://developers.make.com/custom-apps-documentation/create-your-first-app/apps-environment/connection)
- Client secrets go in common data, which locks after app approval. — [Connections (developers)](https://developers.make.com/custom-apps-documentation/app-components/connections)
- Logs must be sanitized by field path (for example `request.headers.accesstoken`). Without sanitization, request and response logs are not shown at all. — [Sanitization](https://developers.make.com/custom-apps-documentation/app-components/base/sanitization)

**Scopes**
- Scopes are set in the connection. Make warns it "cannot ensure that the edited connection has the scopes required for all modules". — [Connect an application](https://help.make.com/connect-an-application)
- The generic OAuth guide tells users to add service parameters such as `token_access_type=offline` to avoid constant refreshes. — [Any web service using OAuth 2.0](https://help.make.com/connect-to-any-web-service-using-oauth-2-0)
- Make's own API has its own scopes such as `scenarios:read`, `scenarios:write`, `scenarios:run`. Its OAuth access tokens last 5 minutes and refresh tokens 6 months. — [API scopes](https://developers.make.com/api-documentation/authentication/api-scopes-overview), [Token expiration](https://developers.make.com/api-documentation/authentication/oauth-flow/token-expiration)

**Keys and advanced credentials**
- Keychains store keys for the Encryptor app (AES, PGP, signatures), SSH, and HTTP API key and Basic auth. — [Keys and certificates](https://help.make.com/keys-and-certificates)
- In the advanced AES flow, "the shared AES key is encrypted by Make and is inaccessible". — [Securing data](https://help.make.com/securing-data-with-make)
- Dynamic connections (Enterprise) are variables holding a connection, chosen per run through scenario inputs, with a build-time value used for design. — [Dynamic connections](https://help.make.com/dynamic-connections)
- Credential requests (Enterprise and partners): a builder sends a link and the recipient authorizes, joining as Guest if external. The requester can never view the secrets, and the recipient can revoke or reauthorize. — [Credential requests](https://help.make.com/credential-requests)
- Email goes to a connection or key owner the first time a teammate adds it to a scenario. Enterprise also records this in audit logs. — [Usage notifications](https://help.make.com/manage-connection-and-key-usage-notifications)
- "Keep data confidential" stops storing run payloads in logs, limiting error recovery. — [Scenario settings](https://help.make.com/scenario-settings)
- On-prem agent (Enterprise) reaches local systems without firewall changes. — [On-premise agent](https://help.make.com/on-premise-agent)
- Fixed egress IP lists are published per zone, and ingress IPs are dynamic. — [IP addresses](https://help.make.com/allow-connections-to-and-from-make-ip-addresses)

### Inferences
- Team-wide use of any connection by default is a convenience that creates a real insider-risk gap. Usage notifications, private spaces, and access lists look like later patches. FlowBridge should design per-connection ACLs from the start.
- Credential requests solve the agency-building-for-a-client problem. That is a strong FlowBridge feature candidate.

### Gaps
- At-rest encryption algorithm, key management, and per-tenant isolation for connection secrets are not in the docs I read. The only general statement found was in Maia's context ("encrypted in transit and at rest") — [Maia system card](https://help.make.com/maia-by-make-system-card). Make's trust or security pages may say more; I did not read them.
- Proactive token refresh timing and connection-expiry alerts are not documented in what I read.

---

## Integrations: number of apps, custom apps, HTTP module

### Takeaway
Make markets 3,500+ apps, plus a universal API-call module on most apps and a modern HTTP app for everything else. Custom apps are JSON/IML declarations (Base, Connections, Modules, RPCs, Webhooks, Functions) run by Make's engine.

### Cited Findings
- "3,500+ Integration Apps" is the integrations page claim. — [Integrations](https://www.make.com/en/integrations)
- Conflict: the pricing page says standard apps are "over 1,000", which may count only one tier. — [Pricing](https://www.make.com/en/pricing)
- Over 300 REST API endpoints manage the platform. — [Pricing](https://www.make.com/en/pricing)
- App tiers: Verified (Standard, Paid plan, Enterprise), Community (partner-built, no Make review, developer owns support), Custom (user-built). — [Introduction to Make apps](https://help.make.com/introduction-to-make-apps)

**HTTP app v4** — from [HTTP app](https://apps.make.com/http), as summarized by the fetch tool
- Modules: Make a request, Download a file, Resolve URL.
- Auth: none, API key and Basic (keychain), OAuth 2.0 (connection), plus mTLS in advanced TLS settings. Proxy support.
- HTTPS only. Self-signed certificates are rejected.
- Timeout 1 to 300 seconds. Output 1 to 10,000 items. Up to 10 redirects.
- Native pagination: offset, page, URL or link, and token or cursor. Offset can get past the 3,200-item limit.
- "Return error if HTTP request fails" stops on 4xx and 5xx. Parse response structures output.

**Custom apps**
- Build options: an AI coding agent with a Make skill, the web interface, or the deprecated VS Code extension. — [Choose how to build](https://developers.make.com/custom-apps-documentation/get-started/make-apps-editor)
- Base holds shared base URL, authorization, error handling, and sanitization. Modules inherit and can override. — [Base](https://developers.make.com/custom-apps-documentation/create-your-first-app/apps-environment/base)
- Private apps are usable only by the author until installed into an organization. — [App visibility](https://developers.make.com/custom-apps-documentation/create-your-first-app/app-visibility)
- Verified third-party apps must pass [app review](https://developers.make.com/custom-apps-documentation/app-review) and be actively maintained. — [Introduction to Make apps](https://help.make.com/introduction-to-make-apps)
- Polling trigger responses carry a `trigger` directive object. Custom modules have an `epoch` section. — [Trigger](https://developers.make.com/custom-apps-documentation/app-components/modules/trigger), [Developer docs](https://developers.make.com/llms-full.txt)

### Inferences
- Declarative app definitions let Make run thousands of connectors in one engine and enforce sanitization, pagination, and error mapping centrally. This is a strong pattern for FlowBridge compared with connector code per app.

### Gaps
- Actual HTTP app page details came through a summarizing fetch, so verify exact numbers before quoting them. Count of custom apps per plan was not read.

---

## Testing and debugging: Run once, execution inspector, DevTool

### Takeaway
Testing happens live on real services in the canvas with Run once. Output bubbles inspect every operation. Run replay reuses stored trigger data, and a Chrome DevTool extension exposes raw requests. No separate sandbox or dry-run mode was documented.

### Cited Findings
- Run once starts a one-time execution of an inactive or active scenario in the builder. — [Active and inactive](https://help.make.com/active-and-inactive-scenarios)
- "Run this module only" runs a single module to get bundles and learn output. — [Mapping](https://help.make.com/mapping)
- Instant triggers wait during Run once until data arrives. — [Mapping](https://help.make.com/mapping)
- The module run panel opens from the bubble above a module. It shows inputs and outputs per operation, data transferred, credits, and AI reasoning, with Fields, JSON, and Reasoning views, plus search across operations. Data updates during the run. — [View module run data](https://help.make.com/view-module-run-data)

**Run replay** — from [Scenario run replay](https://help.make.com/scenario-run-replay)
- All plans. It runs the current scenario version with an earlier run's trigger data.
- Data stored: trigger output, scenario inputs, and the latest variable values (historic variable values are not preserved).
- All modules re-run, even ones that previously succeeded, and credits are consumed.
- Check runs and single-module runs cannot be replayed.
- Available from the builder ("Run with existing data"), history, and run details, one at a time or in bulk. Uses include testing, error recovery, and backfill.

**DevTool** — from [Make DevTool](https://help.make.com/make-devtool)
- A Chrome extension adding a pane in Chrome Developer Tools.
- Live Stream shows request and response headers and bodies per module for Run once, with raw JSON and cURL copy.
- Scenario Debugger gives history search by module name or ID.
- Tools include Focus module, Find by mapping, Copy filter, and more.

**Other**
- Undo and redo exist in the builder. — [Undo and redo](https://help.make.com/undo-and-redo-scenario-changes)
- Maia sees run history and logs and can explain and fix errors. — [Introduction to Maia](https://help.make.com/introduction-to-maia-by-make)

### Inferences
- Run once makes real side effects on real systems, as does replay. FlowBridge could differentiate with mock or dry-run modes and per-step pinned test data.
- Exposing raw HTTP through a browser extension is a developer-friendly but odd placement. A built-in panel would be simpler.

### Gaps
- A dedicated test or staging environment per scenario is not documented in what I read. No documented dry-run mode was found.

---

## Publishing and versioning: active vs inactive, scheduling, blueprints, version history

### Takeaway
There is no draft and production split in what I read. Saving edits the scenario, an active toggle turns on schedule, blueprints are portable JSON, and version history keeps named versions for 60 days.

### Cited Findings
- New scenarios are inactive by default. Active ones run on schedule. Inactive ones run only when started manually. — [Active and inactive](https://help.make.com/active-and-inactive-scenarios)
- Schedule includes optional start and end dates. — [Schedule a scenario](https://help.make.com/schedule-a-scenario)
- Blueprints contain modules, settings, and mapped values. They export as `.json` or copy to clipboard, and import by file or paste. Connections are not included and must be created after import. — [Blueprints](https://help.make.com/blueprints)
- Imported blueprints must be under 2 MB. Each scenario has a 2 MB size limit. — [Blueprints](https://help.make.com/blueprints), [Create your first scenario](https://help.make.com/create-your-first-scenario)
- Save a version (optional description) is available in the toolbar. Versions keep for 60 days, except the latest, which is kept until a newer one is saved. — [Scenario version control](https://help.make.com/scenario-version-control)
- Version history shows description, user, and time. Restore loads into the editor and must then be saved manually. — [Scenario version control](https://help.make.com/scenario-version-control)
- Scenario recovery auto-saves a background blueprint to recover from crashes. It is "not an autosave feature". — [Scenario version control](https://help.make.com/scenario-version-control)
- API endpoints exist for getting blueprints and blueprint versions. — [API scopes](https://developers.make.com/api-documentation/authentication/api-scopes-overview)
- Incomplete executions store the blueprint from the time of error, and API retries run with it. — [Developer docs](https://developers.make.com/llms-full.txt)
- Scenario sharing makes a public page via link, always showing the latest saved version. — [Scenario sharing](https://help.make.com/scenario-sharing)
- Change log entries in history record scheduling changes, edits, and activation. — [Scenario history](https://help.make.com/scenario-history)
- There is also a Make CLI and TypeScript SDK. — [Make CLI](https://help.make.com/the-make-cli-is-now-live), [TypeScript SDK](https://help.make.com/make-typescript-sdk-and-app-updates)

### Inferences
- Edits to a saved, active scenario appear to apply to the next run directly. FlowBridge could add a real draft and publish step with deployment history, which Make lacks in what I read.
- Pinning failed runs to their original blueprint is a very useful guarantee for retries.

### Gaps
- Behaviour of in-flight runs during a save, and Git integration or promotion between environments, are not documented in what I read.

---

## Execution: how cycles run, sequential processing, parallelism, timeouts, execution limits

### Takeaway
A run is a transaction with initialization, one cycle (operation then commit or rollback), and finalization. Scenarios run in parallel by default, limited by an organization-wide parallel capacity pool measured in Processing Units.

### Cited Findings
**Phases** — from [Cycles and phases](https://help.make.com/scenario-execution-cycles-and-phases)
- **Initialization:** creates and verifies connections and checks each module can perform its operation. An error here goes straight to finalization.
- **Operation:** reads from and writes to services.
- **Commit:** if all modules succeeded, Make commits and notifies services.
- **Rollback:** an error in operation or commit aborts and voids that cycle.
- **Finalization:** closes connections such as FTP or database connections.

**Parallelism**
- Instant scenarios run in parallel by default, and a slower earlier run can finish after a later one. — [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- "Process data in order" allows only one execution at a time, in trigger order. New runs pause until all incomplete executions are resolved. — [Scenario settings](https://help.make.com/scenario-settings), [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- Inside a run, routes are sequential. — [Router](https://help.make.com/router)
- Retries: at most 3 parallel per scenario, and no retry while the original scenario is running. — [Automatic retry](https://help.make.com/automatic-retry-of-incomplete-executions)

**Parallel capacity** — from [Parallel capacity](https://help.make.com/parallel-capacity)
- Limit is at organization level, shared by all teams and scenarios. It is measured in Processing Units: a typical run takes 1 PU, and memory-heavy runs take more for their whole duration.
- At the limit:
  - Instant or on-demand with a webhook response, including subscenarios: not queued. The caller gets 429 "Too many executions running in parallel on organization level".
  - Instant without a webhook response: queued, with delay and no error.
  - Scheduled: next run delayed, no error.
- A dashboard charts PU usage by scenario over time.

**Scenario rate limit**
- "Maximum runs to start per minute" applies to instant scenarios. The default is 100, blank means no limit, excess queues, and responsive scenarios get 429 "Too many requests for scenario". — [Schedule a scenario](https://help.make.com/schedule-a-scenario), [Parallel capacity](https://help.make.com/parallel-capacity)

**Timeouts and limits**
- Run duration: 45 minutes (10 minutes on Free), then `ExecutionInterruptedError`, a warning status, remaining bundles unprocessed, and scheduling continues. — [Fix errors and warnings](https://help.make.com/fix-errors-and-warnings)
- Contradiction: another page says "the 40-minute scenario run time limit". — [Types of modules](https://help.make.com/types-of-modules)
- Runs over the limit do not create an incomplete execution. — [Errors that don't create incomplete executions](https://help.make.com/errors-that-dont-create-incomplete-executions)
- Module timeouts: most have "a runtime limit of 40 or 60 seconds", then `ModuleTimeoutError`. Airtable is extended to about 80 seconds. — [Fix errors and warnings](https://help.make.com/fix-errors-and-warnings)
- Some app modules run longer: a 2026 release note lists an API timeout of 300 seconds in its updated-modules section, though its scope is unclear. — [Release note](https://help.make.com/google-gemini-ai-model-removals-expanded-airtable-modules-gemini-4-argon-in-vertex-ai-openai-and-other-updates)
- HTTP app: 1 to 300 seconds. — [HTTP app](https://apps.make.com/http)
- AI agent step timeout: default 300 seconds, maximum 600. — [Make AI Agent (New)](https://help.make.com/make-ai-agent-new-app)
- MCP toolbox scenarios: must finish within 40 seconds. — [MCP toolboxes](https://help.make.com/mcp-toolboxes)
- Searches: usually up to 3,200 objects or 5 MB per run. Some modules have a 5 MB per run data limit only. — [Types of modules](https://help.make.com/types-of-modules)
- File size by plan: Free 5 MB, Core 100 MB, Pro 250 MB, Teams 500 MB, Enterprise 1,000 MB. Overflow follows the data-loss setting. — [Working with files](https://help.make.com/working-with-files)

### Inferences
- PUs mean Make meters concurrency by memory, not just run count, likely reflecting a worker-pool model. FlowBridge should separate three quotas: usage (credits), concurrency (PUs), and rate (per-scenario).
- The asymmetry at capacity is well designed: async work queues, but sync callers receive a clear 429 because Make "can't queue responsive scenarios without changing the behavior you designed".

### Gaps
- PU counts per plan and the memory-to-PU conversion are not documented in what I read.
- The worker architecture (language, queue technology, isolation) is not documented.
- Maximum nesting depth for subscenarios was not found.

---

## Error handling: error handler routes and directives such as Break, Resume, Ignore, Commit, Rollback; incomplete executions; automatic deactivation; ACID behaviour

### Takeaway
Any module can have a dotted error route ending in one of five directives. Failed state can be saved as an incomplete execution, retried automatically with backoff, or fixed by hand. Rollback only reverts ACID-tagged modules, so most third-party side effects are not reversible.

### Cited Findings
**Naming**
- The current overview lists five handlers: Skip, Retry, Resume, Commit, Rollback. — [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- Older terminology persists: "Rollback, Break, Resume, Commit, Ignore". — [How features use credits](https://help.make.com/how-features-use-credits)
- Inference from matching descriptions: Skip = Ignore and Retry = Break. I found no page stating the rename outright.

**Directives** — from [Overview of error handling](https://help.make.com/Overview-of-error-handling)

| Handler | Mechanism | Scenario stops? | Run status |
|---|---|---|---|
| Skip | Removes the failing bundle and continues with the next | No | Success |
| Retry | Removes the bundle, stores error and remaining steps as an incomplete execution, others continue | No | Warning |
| Resume | Replaces failed output with a substitute mapping, and the same bundle continues | No | Success |
| Commit | Stops and commits transactional changes made so far; if no transactional apps, just stops | Yes | Warning |
| Rollback | Stops and reverts changes in transactional modules; repeats lead to deactivation | Yes | Error |

**Error routes** — from [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- Routes are drawn as a dotted connection. Error handlers consume no operations.
- A route can have ordinary modules and no handler (for example a Slack alert). If nothing errors on that route, the error is skipped.
- An error within the error route ends the run with an error.
- Default with no handler and incomplete executions off: Rollback.
- "Throw" is covered on a page of alternatives and workarounds that mimic the directive, for example deliberately making a JSON > Parse JSON module fail under a condition. — [Throw](https://help.make.com/throw)
- Retry config: "Automatically complete execution" Yes or No, default 3 attempts, 15-minute delay, both customizable. It requires incomplete executions to be enabled. — [Retry handler](https://help.make.com/retry-error-handler), [Automatic retry](https://help.make.com/automatic-retry-of-incomplete-executions)

**Incomplete executions**
- Off by default. If on, Make saves the unfinished run in a tab. — [Incomplete executions](https://help.make.com/incomplete-executions)
- Stored: the error, mappings, data, and remaining flow. Errors become warnings. — [Retry handler](https://help.make.com/retry-error-handler), [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- If earlier modules have unprocessed bundles (iterator, search, router), the scenario continues: the failing bundle halts and is stored, and the others proceed. — [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- Statuses: Unresolved, Pending, In progress, Resolved. Resolved items are deleted after 30 days. — [Manage incomplete executions](https://help.make.com/manage-incomplete-executions)
- Retrying starts from the failed module with the same configuration, and the scenario must be active. — [Manage incomplete executions](https://help.make.com/manage-incomplete-executions)
- Manual resolving: fix the module, save, and click Run once with the original input. A failure on a different module creates a new incomplete execution. — [Manage incomplete executions](https://help.make.com/manage-incomplete-executions)
- Not created when: — [Errors that don't create incomplete executions](https://help.make.com/errors-that-dont-create-incomplete-executions)
  - The first module fails (unless a Retry handler is attached).
  - Storage is full.
  - The run exceeds the duration limit.
  - The error occurs in initialization or rollback.
- Storage: 10 MB per 10,000 credits per month, maximum 2 GB, pooled across the organization. — [Pricing](https://www.make.com/en/pricing), [Incomplete executions](https://help.make.com/incomplete-executions)
- Storage full: with data loss off, the scenario is disabled. With it on, scheduling continues and the data is discarded. — [Overview of error handling](https://help.make.com/Overview-of-error-handling)

**Automatic retry**
- Applies to `RateLimitError`, `ConnectionError`, `ModuleTimeoutError`, and Retry handlers with auto-complete. — [Automatic retry](https://help.make.com/automatic-retry-of-incomplete-executions)
- Schedule with incomplete executions on: 1 min, 10, 10, 30, 30, 30 min, 3 h, 3 h (8 attempts, roughly 7 h 51 min). — [Automatic retry](https://help.make.com/automatic-retry-of-incomplete-executions)
- Schedule with incomplete executions off: 1, 2, 5, 10 min, 1 h, 3 h, 12 h, 24 h. — [Exponential backoff](https://help.make.com/exponential-backoff)
- Conflict: that table names `ConnectionError` and `ModuleTimeoutError`, while [Automatic retry](https://help.make.com/automatic-retry-of-incomplete-executions) also includes `RateLimitError`.
- `RateLimitError` on scheduled scenarios pauses the next run for 20 minutes. With incomplete executions off, the failed run is not rerun. On instant scenarios the run reruns with backoff. — [Fix rate limit errors](https://help.make.com/fix-rate-limit-errors)
- `ConnectionError` is identified by HTTP 503 and 504. `RateLimitError` maps to 429. — [Fix connection errors](https://help.make.com/fix-connection-errors), [Fix rate limit errors](https://help.make.com/fix-rate-limit-errors)
- Final failure marks the item Unresolved. — [Automatic retry](https://help.make.com/automatic-retry-of-incomplete-executions)

**Deactivation**
- "Errors before deactivation" counts consecutive error runs; the default is 3. — [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- Instant scenarios deactivate at the first error, ignoring the setting. — [Scenario settings](https://help.make.com/scenario-settings)
- `AccountValidationError`, `OperationsLimitExceededError`, and `DataSizeLimitExceededError` disable scheduling immediately. — [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- Warnings do not count, so scheduling continues. — [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- A mid-scenario Webhook response followed by an error does not deactivate, which can raise credit use. Placing it last ensures error notification. — [Webhooks](https://help.make.com/webhooks)

**ACID**
- Rollback works only for ACID-tagged modules, mostly database apps such as Data Store and MySQL. Non-transactional modules take effect immediately. — [Cycles and phases](https://help.make.com/scenario-execution-cycles-and-phases), [Overview of error handling](https://help.make.com/Overview-of-error-handling)
- ACID example: on rollback, the ACID module is undone and gets the same two bundles on the next run, and a non-ACID later module processes both again. — [Types of modules](https://help.make.com/types-of-modules)
- Commit after each module (auto-commit) is off by default. With it on, only the erroring module can revert. With it off, all transactional modules for that bundle can. — [Scenario settings](https://help.make.com/scenario-settings), [Rollback handler](https://help.make.com/rollback-error-handler)
- Commit trigger last is on by default, so the trigger commits after other modules. — [Scenario settings](https://help.make.com/scenario-settings)

### Inferences
- "Commit trigger last" presumably means the polling cursor moves only after downstream work commits, giving at-least-once delivery. Duplicates are therefore possible in non-ACID modules, so FlowBridge should give modules idempotency keys. This is my reasoning, not a documented guarantee.
- Instant deactivation on one error is harsh but protects against webhook floods. FlowBridge might use a circuit breaker with thresholds instead.
- The "ACID" name oversells: there are no cross-service transactions, and FlowBridge could call this honestly "reversible step" and add saga-style compensation routes.

### Gaps
- No documented delivery-guarantee statement (at-least-once or exactly-once) was found. Make does not publish a compensation pattern for non-ACID modules beyond error routes.

---

## Monitoring: scenario history, analytics dashboard, audit logs, notifications

### Takeaway
Monitoring has four layers: per-scenario run history with drill-down, Enterprise analytics and audit logs, a parallel capacity dashboard, and email notifications. Event subscriptions, in beta, can push platform events to external systems.

### Cited Findings
- Run history entries show date, run name, trigger type, status (Success, Warning, Error), duration, operations, credits, data size, source run, replay, and details. Retention depends on plan. — [Scenario history](https://help.make.com/scenario-history)
- Details shows bundles per module with simple and advanced logs. — [Scenario history](https://help.make.com/scenario-history)
- A Customize run name module gives runs readable names. — [How features use credits](https://help.make.com/how-features-use-credits)
- Analytics dashboard (Enterprise): operations by team, total operations, errors, error rate, executions, and trends over 24 hours, 7 days, or 30 days, filtered by status, team, and folder. Deleted scenarios are not shown. — [Analytics dashboard](https://help.make.com/analytics-dashboard)
- Audit logs (Enterprise): organization and team level, stored 12 months. Events cover scenarios, connections, webhooks, keys, teams, and variables, with who, what, and when. — [Audit logs](https://help.make.com/audit-logs)
- Email notifications: immediate on warning or error, then a digest (15 minutes later for warnings, 5 for errors) linking to history. Team toggles exist. — [manage-your-email-preferences](https://help.make.com/manage-your-email-preferences), [Teams](https://help.make.com/teams)
- Event subscriptions (beta; Teams includes 3, Enterprise unlimited): sends events such as "scenario created" or "run failed" to a public HTTPS endpoint you control. — [Event subscriptions](https://help.make.com/event-subscriptions)
- Credit usage is tracked by dashboard, usage table, and more. — [How to track credits](https://help.make.com/how-to-track-credits)
- Make Grid shows error indicators across scenarios. — [Introduction to Make Grid](https://help.make.com/introduction-to-make-grid)

### Inferences
- The most useful ideas for FlowBridge are run naming, the source-run link for replay lineage, and a capacity chart stacked by scenario.

### Gaps
- History retention by plan is on the pricing table, which I could not read. OpenTelemetry or log-export integrations were not found.

---

## Administration: organizations, teams, roles, SSO, audit logs

### Takeaway
Organization owns billing, region, and capacity. Teams own resources and permissions. Enterprise adds custom roles, SSO, audit logs, feature controls, and team credit limits.

### Cited Findings
**Organizations**
- An organization is the container for scenarios, users, and data, with separate plan and billing. — [Organizations](https://help.make.com/organizations)
- Region (US or EU) is chosen at creation and cannot change. — [Organizations](https://help.make.com/organizations)
- Data zones include US1, US2, EU1, EU2, and Celonis-hosted zones appear in IP lists. — [AI providers and data zones](https://help.make.com/ai-providers-and-data-zones-in-make), [IP addresses](https://help.make.com/allow-connections-to-and-from-make-ip-addresses)
- Time zone drives scheduling and date parsing. — [Organizations](https://help.make.com/organizations)
- Roles: Owner (only one who can transfer or delete), Admin, Member, Accountant, among others. — [Organizations](https://help.make.com/organizations)

**Teams**
- Team-owned: scenarios, templates, connections, webhooks, keys, devices, data stores, data structures, custom functions, credential requests. Items cannot move between teams. — [Teams](https://help.make.com/teams)
- Below the Teams plan there is only one team and no team role management. — [Teams](https://help.make.com/teams)
- Team roles: Team Admin, Team Member, Team Operator (read plus activate, deactivate, schedule), Team Monitoring (read-only), Team Restricted Member (deprecated). Org Owner and Admin are implicitly Team Admins. — [Teams](https://help.make.com/teams)

**Enterprise controls**
- Custom roles: org and team level, chosen from a predefined permission list. Permissions are "all-or-nothing per resource type", so per-scenario limits need a separate team. Not available on private instances. — [Custom roles](https://help.make.com/custom-roles)
- SSO: OIDC and SAML 2 with Okta, Microsoft AD, and Google. Configured per organization with a namespace and team provisioning. On save you are logged out and get a one-time disable link by email. — [Single sign-on](https://help.make.com/single-sign-on)
- Domain claim blocks self-service accounts on your domain. — [Domain claim](https://help.make.com/domain-claim)
- 2FA enforcement across the organization. — [2FA enforcement](https://help.make.com/two-factor-authentication-enforcement)
- Session timeout from 15 minutes to 7 days; the shortest applies across organizations. — [Session timeout](https://help.make.com/set-the-length-of-your-session-timeout)
- Feature controls toggle AI and beta features across the organization. — [Feature controls](https://help.make.com/feature-controls)
- Team credit limits pause a team's scenarios once its allocation is used. — [Credits per team](https://help.make.com/credits-per-team-management)
- Private spaces (all plans; admin visibility is Enterprise) have credit limits per member. — [Private spaces](https://help.make.com/private-spaces)
- Make Managed Services lets distributors manage child organizations and allocate credits, also through API. — [Make Managed Services](https://help.make.com/make-managed-services-mms)

### Inferences
- The resource-to-single-team rule keeps authorization simple, but it forces team sprawl for per-scenario limits. FlowBridge may want per-resource ACLs if customers are agencies or large organizations.

### Gaps
- SCIM provisioning was not found in what I read. A separate docs reference to an on-premise platform administration role and "private instances" suggests a private offering whose details I did not read.

---

## Templates, Make Grid, AI features, limits, and how usage is priced

### Takeaway
AI is now spread through the product: Maia builds and debugs, agents are modules, and MCP exposes scenarios to external AI. Pricing is a credit plan with allowances that scale per 10,000 credits, plus a 25% premium for extra credits. Exact tier prices could not be read from Make's pricing page by my tools.

### Cited Findings
**Templates and sharing**
- Public templates cover "over 7,500 use cases", and team templates can be private or published by link. Team templates can be submitted for public review. — [Scenario templates](https://help.make.com/scenario-templates), [Create and manage templates](https://help.make.com/create-and-manage-scenario-templates)
- Guided setup prompts field by field, and authors control fields with "Use in Wizard" and "Use as a default value". — [Create and manage templates](https://help.make.com/create-and-manage-scenario-templates)

**Make Grid**
- An auto-generated dependency map of scenarios, apps, and AI agents, updated near real time, with error indicators, data-flow tracing, live collaborator cursors, and search inside blueprints (field values, notes, agent prompts). — [Introduction to Make Grid](https://help.make.com/introduction-to-make-grid), [How to use Grid](https://help.make.com/how-to-use-make-grid)

**AI features**
- Maia (public beta, all paid plans; 30-day Free trial): builds, modifies, and debugs through chat with Build or Plan modes. Plan shows a preview with Reject, Revise, or Accept. — [Introduction to Maia](https://help.make.com/introduction-to-maia-by-make)
- Maia credits vary by token usage (examples of 140.04 and 160.18 credits per message), with promotional free messages. — [Maia pricing](https://help.make.com/maia-by-make-pricing)
- Maia has no access to connections or keys, and customer data does not train the model. Data is stated as encrypted in transit and at rest. — [Maia system card](https://help.make.com/maia-by-make-system-card)
- Make AI Agent (New, open beta, all plans): an agent is a module with instructions, knowledge files, model choice, reasoning effort, tools (modules, scenarios, MCP tools, other agents), conversation ID memory, steps per call, and a step timeout. — [Introduction](https://help.make.com/introduction-to-make-ai-agent-new), [App reference](https://help.make.com/make-ai-agent-new-app)
- Other AI apps: AI Toolkit, AI Web Search, AI Content Extractor. — [Credits](https://help.make.com/credits)
- Make MCP server lets clients such as Claude and ChatGPT run on-demand active scenarios (all plans) and manage the account (paid plans), through OAuth or token. — [Make MCP server](https://help.make.com/make-mcp-server)
- MCP toolboxes are dedicated servers exposing selected scenarios only. — [MCP toolboxes](https://help.make.com/mcp-toolboxes)
- Make Skills (open beta) are zip files of markdown for AI assistants. — [Make Skills](https://help.make.com/make-skills)
- EU zones do not guarantee all AI processing stays in the EU. Some features route to the US or UK. — [AI providers and data zones](https://help.make.com/ai-providers-and-data-zones-in-make)

**Plans and pricing mechanics**
- Plans in docs: Free, Core, Pro, Teams, Enterprise. — [Introduction to Make apps](https://help.make.com/introduction-to-make-apps)
- Pricing page text also mentions a "Business" plan and a start-up offer of 50% off Business for under-20-employee organizations, which conflicts with the docs' plan list. — [Pricing](https://www.make.com/en/pricing)
- Free: 1,000 credits per month, 1 MB storage, 1 data store. — [Pricing](https://www.make.com/en/pricing)
- Per 10,000 credits per month: 5 GB data transfer, 10 MB data storage, 10 MB incomplete execution storage (2 GB maximum), 667 webhook queue items (10,000 maximum). — [Pricing](https://www.make.com/en/pricing)
- Credit limits by plan as of Nov 2025: Core up to 300,000 per month; Pro up to 8 million. Example: 500,000 credits cost $338.13/month. — [Plan adjustments](https://help.make.com/adjustments-to-plans-and-pricing)
- Extra credits cost 25% more than plan credits, whether manual (from 1,000, multiples of 1,000) or automatic (10,000 at a time, Core, Pro, and Teams). — [Plan adjustments](https://help.make.com/adjustments-to-plans-and-pricing), [Pricing](https://www.make.com/en/pricing)
- Plan credits are consumed first. Extra credits expire with the billing cycle or billing year; Core annual expires them monthly. — [Extra credits](https://help.make.com/extra-credits)
- Unused plan credits expire. — [Pricing](https://www.make.com/en/pricing)
- `DataSizeLimitExceededError` fires when data transfer quota runs out. — [Fix errors and warnings](https://help.make.com/fix-errors-and-warnings)
- Make API rate limits per minute: Core 60, Pro 120, Teams 240, Enterprise 1,000. — [Rate limiting](https://developers.make.com/api-documentation/getting-started/rate-limiting)

**AI credit logic** — from [Credits](https://help.make.com/credits)
- Three connection modes:
  - **Make's AI Provider** (all plans): credits for tokens plus operations.
  - **Custom connection** (paid plans): credits for operations, and you pay the provider for tokens.
  - **Automatic connection:** usage-based.
- Tiers convert tokens to credits. For example, Small: 18,080 input and 2,260 output tokens per credit; Large: 3,616 and 452. Per-model rates are published.
- Dynamic credit tags: Tokens, File size, Per page, Run time.

**Third-party price data (not official, not verified)**
- At 10,000 credits per month, secondary sources show Core about $9, Pro $16, and Teams $29 on annual billing, and about $10.59, $18.82, and $34.12 monthly. Results conflict and I did not verify them against Make's table. — [G2](https://www.g2.com/products/make-formerly-integromat/pricing), [Costbench](https://www.costbench.com/software/ai-automation/make/)
- A search-result source gives a minimum interval of 1 minute on Core and 15 on Free, and another gives 2 active scenarios on Free. Unverified. — [Jetadmin](https://www.jetadmin.io/blog/make-pricing/amp/), [Costbench free plan](https://costbench.com/software/ai-automation/make/free-plan/)

### Inferences
- Bundling allowances per 10k credits means one number scales all quotas. That simplifies pricing, and FlowBridge could copy it for storage, queue depth, and data transfer.
- Charging for empty polling checks is a notable cost: at 5-minute intervals that is 8,640 credits a month. Webhooks avoid this. Charging only for runs with data could be a competitive angle for FlowBridge.
- Keeping flow control free (routers, filters, handlers, subscenarios) nudges good design habits.

### Gaps
- **Plan comparison table not read.** The page returned 403 to direct download, and the fetched text omits the table: tier prices, minimum interval, history retention, per-plan features, and PU limits. Chrome was not connected during this research. The user can open [the pricing page](https://www.make.com/en/pricing) in a browser to fill this in.
- Grid plan availability and limits were not extracted. See [Access Make Grid](https://help.make.com/access-make-grid).
- A model list on the Credits page may lag recent releases, so rates should be rechecked before use.

---

## Needs user login

No page I needed returned a login wall. These items would still help and may need a signed-in view:

| URL | What it would answer |
|---|---|
| https://www.make.com/en/pricing (public, but needs a real browser; 403 to direct download, table absent from fetched text) | Tier prices, minimum interval, history retention, per-plan feature matrix |
| https://eu1.make.com/ or https://us1.make.com/ > Org > Subscription (exact path not verified) | Actual plan parameters on the user's account |
| Same zone > Organization settings > Dashboard > Parallel capacity | PU limit for a plan, which the docs do not state |
| Same zone > Scenario Builder > scenario settings | Whether Cycles per run is actually gone as of November 2026, and whether the toolbar uses Skip and Retry names |
