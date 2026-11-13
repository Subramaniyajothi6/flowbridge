# How Zapier works end to end (reference for FlowBridge)

State as of 7 November 2026.

How to read these notes:
- Pages were read through a fetch tool that summarises, so quoted wording is close to the source but should be re-checked before being quoted publicly.
- **[snippet]** means the claim comes from a search-result excerpt of that page. The full page was not opened.
- Help Center articles vary in age. Some still say "Company plan", the old name for Enterprise. Where a newer page disagrees, both are shown.
- No login was attempted. Everything here comes from public pages.

Zapier now has two workflow products, and most of the documentation describes the first:
- **Classic Zaps:** the step-based editor product.
- **Next Gen Zaps:** TypeScript durable workflows, in early access since September 2026.

Each section describes Classic Zaps unless it says otherwise.

---

## Workflow model and terminology

### Takeaway
A Classic Zap is one trigger followed by an ordered list of steps, with branches that never rejoin. Later steps read earlier steps' outputs through mapped fields, and billing counts successful action steps ("tasks"), not runs. Next Gen Zaps replace this structure with TypeScript code run by a durable engine.

### Cited Findings
- **Zap:** an automated workflow made of a trigger and one or more actions. Once on, it performs its actions each time the trigger occurs — [Learn key concepts](https://help.zapier.com/hc/en-us/articles/8496181725453-Learn-key-concepts-in-Zap-workflows)
- **Trigger:** "an event that starts a Zap". **Action:** "an event a Zap performs after it is triggered". **Run:** one triggering of the Zap and its action steps. **Task:** an action the Zap completes successfully — [Learn key concepts](https://help.zapier.com/hc/en-us/articles/8496181725453-Learn-key-concepts-in-Zap-workflows)
- That page does not formally define "step", "search", "connection" or "field" — [Learn key concepts](https://help.zapier.com/hc/en-us/articles/8496181725453-Learn-key-concepts-in-Zap-workflows)
- Connector operations come in three kinds: triggers (GET polling or REST Hooks), create actions (POST or PUT) and search actions (GET) — [Integration structure](https://docs.zapier.com/platform/quickstart/zapier-integration-structure)
- Size limits: 100 steps per Zap including steps inside paths, and only the first 30 steps run on a free trial. An action step can have 1,000 fields — [Zap limits](https://help.zapier.com/hc/en-us/articles/8496181445261-Zap-limits)
- Free plan Zaps are two-step (one trigger, one action) — [Free plan](https://help.zapier.com/hc/en-us/articles/32337438839565-What-s-included-in-Zapier-s-Free-plan)
- **Data flow:** the mappable fields in a step come from earlier steps' sample or test data. At run time a mapped field carries the live value from that run. Mapping works forward only — [Mapping fields](https://help.zapier.com/hc/en-us/articles/8496343026701-Send-data-between-steps-by-mapping-fields)
- Each step also exposes a Step Output field holding its entire output as one value. A step that errors produces no output, so fields mapped to it receive no data — [Mapping fields](https://help.zapier.com/hc/en-us/articles/8496343026701-Send-data-between-steps-by-mapping-fields)
- **Next Gen Zaps:**
  - Written as TypeScript by an AI agent using the `zapier:build-workflows` skill, then run on Zapier's infrastructure. The code limit is 200,000 characters, and runs can last up to 1 year including paused time — [Build a workflow](https://docs.zapier.com/mcp/get-started/build-a-workflow)
  - Announced 23 September 2026 at ZapConnect. Compared with Classic they add: no 500-item loop limit, branches that split and merge, nested loops, continuing after a step fails, and pausing for a human or a scheduled follow-up — [Community announcement](https://community.zapier.com/product-updates/the-next-generation-of-zaps-is-here-53832)
  - Classic Zaps keep running unchanged unless imported. Importing makes a copy, and leaving both on can produce duplicate runs — [Next Gen Zaps](https://help.zapier.com/hc/en-us/articles/48391476448141-Get-started-with-Next-Gen-Zaps)

### Inferences
- Classic Zaps are effectively a tree: a linear chain with branches that cannot rejoin, plus per-run storage of each step's output. This is my reading of "Paths must be the final step" and "shared actions can't follow the branches" (see Logic). Zapier does not publish a data model.
- Next Gen Zaps suggest Zapier treats the Classic structural limits (no merge, no nesting, stop on failure) as architectural enough to need a separate engine. FlowBridge should decide early whether its graph supports merges.
- "Task" as the billing unit means polling, filtering and failures cost the customer nothing, so Zapier absorbs those costs.

### Gaps
- The internal run or step data model and storage are not documented.

---

## Triggers

### Takeaway
There are two delivery types. Polling triggers fetch a newest-first list on a plan-based interval and deduplicate by ID. Instant triggers receive webhooks and are not deduplicated. Schedule by Zapier is a built-in timed trigger.

### Cited Findings

**Polling**
- Zapier periodically asks the app for its latest data and compares each item's unique ID against IDs already seen. A new ID starts the Zap. Most triggers are polling — [How triggers work](https://help.zapier.com/hc/en-us/articles/8496244568589-How-Zap-triggers-work)
- Intervals are Free 15 min, Professional 2 min, Team 1 min, Enterprise 1 min — [How triggers work](https://help.zapier.com/hc/en-us/articles/8496244568589-How-Zap-triggers-work); [Pricing](https://zapier.com/pricing)
- Polling frequency can be changed per Zap, and a published Zap can be polled manually with "Run". The Zap can't poll more often than the longer of the plan minimum and the app minimum. Instant triggers have neither option — [Control when your Zap runs](https://help.zapier.com/hc/en-us/articles/8495924437005-Control-when-your-Zap-runs)
  - That page says polling-interval options apply on all plans. The trigger page limits changing frequency to Professional and above — [How triggers work](https://help.zapier.com/hc/en-us/articles/8496244568589-How-Zap-triggers-work)
- Connector rules: return an array sorted in reverse chronological order. Only the first page is read, with no automatic pagination. Trigger logic has 30 seconds — [Deduplication](https://docs.zapier.com/platform/build/deduplication); [Trigger docs](https://docs.zapier.com/integrations/build/trigger)
- Default throttle is 100 new items per poll — [Operating constraints](https://docs.zapier.com/platform/build/operating-constraints)
- On Free or trial plans, runs are held above 200 requests per 10 minutes per Zap — [Zap limits](https://help.zapier.com/hc/en-us/articles/8496181445261-Zap-limits)

**Deduplication**
- `id` is the default primary key. It can be remapped in code, or other fields can be marked `primary` with the CLI. With no primary key, the trigger errors at run time — [Deduplication](https://docs.zapier.com/platform/build/deduplication)
- **Priming:** when a Zap is turned on, Zapier makes an initial call and stores all returned IDs as already seen, so existing items do not fire. Turning the Zap off clears the list, and turning it on repeats the priming — [Deduplication](https://docs.zapier.com/platform/build/deduplication)
- Updated-item triggers combine `id` with a timestamp such as `updatedAt`, so each update looks like a new item. The original ID is kept in a separate field — [Deduplication](https://docs.zapier.com/platform/build/deduplication)
- The deduplication table holds 105,000 rows per Zap — [Operating constraints](https://docs.zapier.com/platform/build/operating-constraints)
- Deduplication is per Zap, so two Zaps with the same trigger both fire. It applies only to polling triggers — [Duplicate data](https://help.zapier.com/hc/en-us/articles/8496260269965-How-Zapier-handles-duplicate-data-in-Zap-workflows)

**Instant (REST Hooks)**
- The app sends a webhook to Zapier when data is created, and no interval applies — [How triggers work](https://help.zapier.com/hc/en-us/articles/8496244568589-How-Zap-triggers-work)
- Each active Zap gets a unique webhook URL through a REST subscription API. For the handshake, Zapier echoes `X-Hook-Secret` when present, and "Zapier doesn't support further identity verification" — [Trigger docs](https://docs.zapier.com/integrations/build/trigger)
- Instant triggers are not deduplicated, because the app is assumed to send only new data — [Duplicate data](https://help.zapier.com/hc/en-us/articles/8496260269965-How-Zapier-handles-duplicate-data-in-Zap-workflows)
- Rate limit conflict:
  - 20,000 requests per 5 minutes per user returns 429 — [Zap limits](https://help.zapier.com/hc/en-us/articles/8496181445261-Zap-limits)
  - Legacy webhook routes (no user ID in the URL) get 1,000 per 5 minutes per Zap — [Webhook rate limits](https://help.zapier.com/hc/en-us/articles/29972220283789-Webhooks-by-Zapier-rate-limits)
  - The developer docs instead say REST Hooks are limited to 10,000 webhooks per 5 minutes and 30 webhooks per second — [Operating constraints](https://docs.zapier.com/platform/build/operating-constraints)
- Under high load Zapier may return 200 but delay processing by several minutes. Senders are told to retry non-200 responses with exponential backoff — [Webhook rate limits](https://help.zapier.com/hc/en-us/articles/29972220283789-Webhooks-by-Zapier-rate-limits)
- Hybrid triggers: some triggers show as instant but are notified of a change, then poll for details and deduplicate. Google Sheets "New or Updated Spreadsheet Row" is the example, and it can take about 3 minutes. **[snippet, community post, not official docs]** — [Types of triggers](https://community.zapier.com/featured-articles-65/different-types-of-zapier-triggers-7803)

**Webhooks by Zapier (triggers)**
- Catch Hook accepts GET, PUT and POST and parses the body. An optional "Pick Off A Child Key" setting limits it to one key. Catch Raw Hook returns the unparsed body plus headers — [Webhook triggers](https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks)
- A JSON array body produces one run per object — [Webhook triggers](https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks)
- Payload limits are 10 MB for triggers and 2 MB for Catch Raw Hook including headers — [Webhook triggers](https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks)
- The URL embeds the owner's Zapier ID and changes only if the Zap is transferred. Several Zaps with the same owner can share one URL by appending comma-separated final segments — [Webhook triggers](https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks)
- The response is a fixed 200 and cannot be customised, except for an empty body with `silent/` on Catch Raw Hook. When a Zap is off or deleted, the URL returns 404, but only after a delay of up to several hours — [Webhook triggers](https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks)
- Retrieve Poll is a polling GET. The endpoint must return JSON newest first (or XML/HTML with an XPath field). The dedupe key defaults to `id`, can be set explicitly, and otherwise falls back to the shortest key containing "id" — [Polling webhooks](https://help.zapier.com/hc/en-us/articles/8496274719757-Trigger-Zap-workflows-from-polling-webhooks)
- Webhooks by Zapier is available on Professional and above, not Free — [Webhook triggers](https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks)

**Schedule**
- Schedule by Zapier runs a Zap every hour, day, week or month, and supports custom intervals such as quarterly. Professional and above only — [Control when your Zap runs](https://help.zapier.com/hc/en-us/articles/8495924437005-Control-when-your-Zap-runs)

### Inferences
- A 105,000-row table together with first-page-only reading implies a bounded, probably rolling seen-set. A source that re-exposes very old IDs could re-fire once they are evicted, but eviction behaviour is not documented.
- Clearing dedupe on off/on avoids a flood from items created while off. It also means events during downtime are silently lost for polling triggers. This is a deliberate design trade-off that FlowBridge should consciously accept or reject.
- No signature verification and no instant-trigger dedupe mean webhook replays cause duplicate runs. An idempotency key on ingest would be a real improvement over Zapier here.

### Gaps
- Dedupe retention time and eviction policy are not documented.
- Polling jitter or how polls are scheduled across Zaps is not documented.
- The order in which items from one poll become runs is not stated on the pages read.

---

## Logic

### Takeaway
Control flow is delivered as built-in "apps" placed as steps: Filter, Paths, Delay, Looping, Sub-Zap, Code, Formatter, Digest and Human in the Loop. Most do not use tasks, and they carry strict structural limits.

### Cited Findings

**Filter**
- Each rule reads "Only continue if {field} {logic} {value}". The value can be mapped. Rules join with AND or OR. Boolean is true/false and Exists/Does not exist take no value — [Filter and Paths](https://help.zapier.com/hc/en-us/articles/34372501750285-Use-conditional-logic-to-filter-and-split-your-Zap-workflows-Filter-and-Paths)
- A failed filter gives the run a Filtered status, and later steps don't run — [Run statuses](https://help.zapier.com/hc/en-us/articles/20505304170637-Review-run-statuses-in-Zap-workflows)
- The pricing table shows Paths and Filters unavailable on Free — [Pricing](https://zapier.com/pricing)

**Paths**
- Branch types are custom rules, Always run, and Fallback (runs only when no other branch matches, and only one per group). Always run and Fallback are mutually exclusive within a group — [Paths](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zap-workflows-with-Paths)
- Limits are 10 branches per group, 3 levels of nesting and 100 steps in total. Paths must be the final step, and shared actions can't follow branches — [Paths](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zap-workflows-with-Paths)
- More than one custom-rule branch can apparently match. The page implies this rather than stating it, advising mutually exclusive conditions to avoid running several branches — [Paths](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zap-workflows-with-Paths)
- If a branch errors, subsequent branches still run. With Autoreplay on, Fallback runs only after all replay attempts fail — [Paths](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zap-workflows-with-Paths)
- Execution order is in transition:
  - An article updated 29 May 2026 says branches ran in parallel by default, Zaps would be moved to sequential starting in July, and parallel would be deprecated "later this year" — [Sequential path runs](https://help.zapier.com/hc/en-us/articles/37562074726029-Now-available-sequential-path-runs)
  - The main Paths page already describes branches running one at a time, left to right, with an earlier branch's 1-day Delay holding later branches — [Paths](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zap-workflows-with-Paths)

**Looping (open beta, Professional and above)**
- A loop is built from text (split by a delimiter), line items or a numeric range. Iterations run in parallel, and each creates a separate Zap run. Maximum is 500 iterations — [Looping](https://help.zapier.com/hc/en-us/articles/42969233918477-Understanding-Looping-by-Zapier)
- Only one Looping step is allowed per Zap, with no nesting. Loops stay parallel inside a sequential Path — [Looping](https://help.zapier.com/hc/en-us/articles/42969233918477-Understanding-Looping-by-Zapier)
- Any action after the loop runs once per value and uses 1 task per iteration. The Looping step itself is free — [Looping](https://help.zapier.com/hc/en-us/articles/42969233918477-Understanding-Looping-by-Zapier)
- The page does not describe how iteration outputs are combined or how errors behave inside a loop — [Looping](https://help.zapier.com/hc/en-us/articles/42969233918477-Understanding-Looping-by-Zapier)

**Delay**
- Delay For waits a set duration. Delay Until waits for a date, with a setting for past dates (up to 15 min, 1 hour, 1 day by default, or always continue). Delay After Queue processes runs one at a time, in order received, with a set gap — [Delays](https://help.zapier.com/hc/en-us/articles/8496288754829-Add-delays-to-Zaps)
- The minimum is 1 minute and the maximum hold is 30 days. Queue capacity follows from that: a 1-day gap holds 30 tasks, and a 31st errors the step. Queues are shared across Zaps by name — [Delays](https://help.zapier.com/hc/en-us/articles/8496288754829-Add-delays-to-Zaps)
- Strict one-at-a-time is not guaranteed, because slowdowns and replays can overlap — [Delays](https://help.zapier.com/hc/en-us/articles/8496288754829-Add-delays-to-Zaps)
- The Zap must be on when the delay fires, and actions scheduled while it was off won't run. Structural edits during a delay stop the run continuing — [Delays](https://help.zapier.com/hc/en-us/articles/8496288754829-Add-delays-to-Zaps)
- Available on Professional and above; Delay steps use no tasks — [Delays](https://help.zapier.com/hc/en-us/articles/8496288754829-Add-delays-to-Zaps)

**Sub-Zaps (beta, Professional and above)**
- A sub-Zap has a Start a Sub-Zap trigger (which defines its inputs), actions, and a final Return From a Sub-Zap. A parent calls it with Call a Sub-Zap — [Sub-Zap](https://help.zapier.com/hc/en-us/articles/32283713627533-Understanding-the-Sub-Zap-app)
- If no data returns, the parent stays Delayed indefinitely. Every path branch therefore needs a Return, and a fallback is advised. Two returning branches produce the error "We expected callbackUrl to be stored!" — [Sub-Zap](https://help.zapier.com/hc/en-us/articles/32283713627533-Understanding-the-Sub-Zap-app)
- Loops are restricted: the Sub-Zap page says they aren't allowed inside one, while the Looping page says loop actions can't come before a Return, and only the first Return in a looping sub-Zap succeeds — [Sub-Zap](https://help.zapier.com/hc/en-us/articles/32283713627533-Understanding-the-Sub-Zap-app); [Looping](https://help.zapier.com/hc/en-us/articles/42969233918477-Understanding-Looping-by-Zapier)
- Task conflict: Call and Return count 1 task each — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier). The same page and the pricing page list Sub-Zap among built-in tools that don't count — [Pricing](https://zapier.com/pricing)

**Code by Zapier**
- JavaScript (Node.js 22) and Python 3.13, with npm and PyPI packages and 512 MB of memory. Input comes through an Input Data dictionary, and code triggers can't map earlier fields — [Using Code](https://help.zapier.com/hc/en-us/articles/45405528551181-Using-Code-by-Zapier)
- Standard runtime is 1 s on Free, 30 s on Professional and Team, and 2 min on Enterprise. Exceeding it fails with a timeout — [Using Code](https://help.zapier.com/hc/en-us/articles/45405528551181-Using-Code-by-Zapier)
- Extended runtimes for action steps go "up to 10 minutes" — [Using Code](https://help.zapier.com/hc/en-us/articles/45405528551181-Using-Code-by-Zapier). The pricing page lists options of 1, 2, 4, 6 or 8 minutes, billed 1 task per 30-second block, off by default — [Pricing](https://zapier.com/pricing)
- Rate limits are 10 requests per 60 s on Free, 75 per 10 s on Trial, and 225 per 10 s on Professional, Team and Enterprise. Over the limit, runs are held until it resets — [Using Code](https://help.zapier.com/hc/en-us/articles/45405528551181-Using-Code-by-Zapier)
- No secret storage in code. Use app connections through the Zapier SDK or API by Zapier connections — [Using Code](https://help.zapier.com/hc/en-us/articles/45405528551181-Using-Code-by-Zapier)
- Next Gen Zaps do not support Code by Zapier steps. Imports replace them with a do-nothing placeholder, and from 17 November 2026 those workflows stop with an error at that step — [Build a workflow](https://docs.zapier.com/mcp/get-started/build-a-workflow)

**Formatter and Digest**
- Formatter has four action events: Date/Time, Numbers, Text and Utilities. Utilities cover CSV import, line items and lookup tables. When a valid date can't be parsed, the output becomes the moment the Zap executes. **[snippet]** — [Get started with Formatter](https://help.zapier.com/hc/en-us/articles/8496212590093-Get-started-with-Formatter); [Date formats](https://help.zapier.com/hc/en-us/articles/8496257974029-Modify-date-and-time-formats-in-Zap-workflows)
- Digest compiles data from triggers or actions into a batch, released on a schedule or count. If the count isn't reached within a month of the first entry, it releases what it has. **[snippet]** — [Digest](https://help.zapier.com/hc/en-us/articles/8496309901453-Compile-data-in-a-digest-in-Zap-workflows)

**Human in the Loop (Professional and above)**
- Actions are Collect Data and Request Approval. A New Approval Requested trigger lets another Zap send custom notifications — [Human in the Loop](https://help.zapier.com/hc/en-us/articles/38733184458765-Use-Human-in-the-Loop-to-pause-Zap-workflows-pending-human-review)
- The step shows Needs review while waiting, and later steps stay paused. Submit, skip or approve gives Success. Decline or timeout gives Success or Filtered, depending on configuration. Filter downstream on the `Decision` field ("approved") — [HITL statuses](https://help.zapier.com/hc/en-us/articles/38838306755981-Special-step-run-statuses-in-Human-in-the-Loop-actions)
- Timed-out or declined steps set to stop don't autoreplay. They replay only through a full run replay, and reviewers must re-review — [HITL statuses](https://help.zapier.com/hc/en-us/articles/38838306755981-Special-step-run-statuses-in-Human-in-the-Loop-actions)
- The timeout is configurable in minutes to weeks, with reminders. **[snippet]** — [Collect Data](https://help.zapier.com/hc/en-us/articles/38731264910733-Collect-data-for-your-workflow-with-Human-in-the-Loop)
- It is a premium app, and on Pro you can only send requests to yourself. **[snippet]** — [Request Approval](https://help.zapier.com/hc/en-us/articles/38731463206029-Request-approval-to-keep-your-workflow-running-with-Human-in-the-Loop)

### Inferences
- The callback-URL error text suggests sub-Zaps and likely long-running steps are built on the same suspend-and-callback mechanism as the developer-platform callback (see Execution). This is inference from an error string.
- The 30-day Delay limit and "edits break delayed runs" suggest a paused Classic run stores position by step identity against the current Zap structure. Next Gen pins runs to a version, avoiding this (see Publishing).
- Loop iterations being separate runs avoids in-run aggregation, which is why Classic loops have no native "collect results" step. FlowBridge should plan an explicit join.

### Gaps
- The full Filter operator list was not read (a separate conditions article exists).
- Current actual Paths default as of November 2026 after the July migration is not confirmed.
- Loop error semantics are not documented on the page read.

---

## Data mapping

### Takeaway
Fields hold either static text or colored "pills" referencing earlier step output. The field's type decides how Zapier coerces the value, and coercion can fail silently, as with unparseable dates.

### Cited Findings
- Typed text is the same every run, while a pill resolves to that run's data. Test data is only used to choose fields. Reordering steps, or changing a step's app or version, can break mappings, shown by a yellow warning — [Mapping fields](https://help.zapier.com/hc/en-us/articles/8496343026701-Send-data-between-steps-by-mapping-fields)
- Enhanced mapping (update dated 20 May 2026, all plans) shows nested objects and arrays as collapsible trees labelled string, number, array or object. You can map a value, an array or an object. "Get all values" maps a nested field as line items with no Formatter step — [Enhanced mapping](https://help.zapier.com/hc/en-us/articles/46001908703757-Enhanced-field-mapping-makes-structured-data-easier-to-work-with)
- Field names containing a double underscore (`key__field`) are always treated as nested — [Mapping fields](https://help.zapier.com/hc/en-us/articles/8496343026701-Send-data-between-steps-by-mapping-fields)
- Field types and their coercion — [Field types](https://help.zapier.com/hc/en-us/articles/8496259603341-Field-types-in-Zaps):
  - **Date/time:** accepts natural language, ISO 8601 and UNIX. An uninterpretable value defaults to the run time, with no error.
  - **Number:** whole numbers only; 4.7 becomes 4.
  - **Decimal:** exact, using a period separator.
  - **Boolean:** "true"/"false", though some apps use 0/1; often case-sensitive.
  - **Dropdown:** preset list plus "Load more" and custom values.
  - **File:** text becomes a .txt, a URL is fetched and uploaded, and a comma-plus-space list of files bundles into one ZIP.
  - **Others:** Dictionary (key/value), List, Line item (array of objects), Password, String, Text.
- Custom values let a dropdown take typed or mapped input. The value must already exist in the destination app, generally as an ID rather than a name. **[snippet]** — [Custom values](https://help.zapier.com/hc/en-us/articles/8496241696141-Add-custom-values-to-dropdown-menu-fields-in-Zap-workflows)
- Line items need support from both the trigger and the action, and Formatter can create them. **[snippet]** — [Use line items](https://help.zapier.com/hc/en-us/articles/8496277737997-Use-line-items-in-Zaps)
- Variables:
  - Zap variables: up to 1,000 per Zap, not usable in triggers.
  - Global variables: account-wide, string values, paid plans. Not for secrets.
  - System variables: Run ID, Step ID, Zap ID.
  - **[snippet]** — [Reusable variables](https://help.zapier.com/hc/en-us/articles/35720226565773-Create-reusable-variables-to-use-in-Zap-workflows); [System variables](https://help.zapier.com/hc/en-us/articles/36855498205453-Introducing-system-variables)

### Inferences
- Zapier historically flattened nested data, and `__` naming and line items are the leftovers. A typed JSON tree from day one would save FlowBridge this migration.
- Silent date fallback is a known footgun. FlowBridge should fail loudly instead.

### Gaps
- How empty values are sent (omitted, blank or null) is not addressed on the mapping page.
- The expression language is not documented. Classic Zaps appear to have none beyond Formatter and Code, but no page states that directly.

---

## Connections

### Takeaway
A connection is a reusable, per-user credential object, referenced from Zaps and owned by one person. Reconnecting updates every automation using it. Encryption and token handling are described only at marketing level.

### Cited Findings
- Each connection is tied to one user account and reusable across workflows. Auth types are OAuth 2.0, API key, basic, session and digest. Each user can have up to 5,000 connections — [App connections](https://help.zapier.com/hc/en-us/articles/36818633398157-App-connections-on-Zapier)
- Statuses are active, expired and non-compliant. "Test connection" returns Active or Expired, and bulk test or delete handles up to 100 — [Manage connections](https://help.zapier.com/hc/en-us/articles/8496290788109-Manage-your-app-connections)
- Reconnect works only for connections you own and applies to every Zap, agent and product using it. Replace connection swaps the account for all users of it — [Manage connections](https://help.zapier.com/hc/en-us/articles/8496290788109-Manage-your-app-connections)
- Sharing (Team and Enterprise): teammates use a connection without seeing credentials. Unsharing pauses published Zaps that rely on it. Deleting breaks automations until they are updated. Ownership can be transferred — [Manage connections](https://help.zapier.com/hc/en-us/articles/8496290788109-Manage-your-app-connections)
- If a Zap is shared without its connections, others can't view or edit those steps — [Manage connections](https://help.zapier.com/hc/en-us/articles/8496290788109-Manage-your-app-connections)
- Expiry causes: bad credentials, insufficient permissions, password change, new org security controls, 2FA on some apps, changed email or domain — [Manage connections](https://help.zapier.com/hc/en-us/articles/8496290788109-Manage-your-app-connections)
- A disconnected app puts runs On hold, and they can be replayed after reconnecting — [Held runs](https://help.zapier.com/hc/en-us/articles/37454233721869-How-to-troubleshoot-held-Zap-or-step-runs)
- Security page: TLS 1.2+ in transit and AES-256 at rest. Credentials are stored encrypted in account-owned connections, so agents and MCP clients never receive raw third-party tokens. Data is on AWS in the US — [Security](https://zapier.com/security-compliance)
- Static IP allowlisting and VPC Peering are offered — [Security](https://zapier.com/security-compliance)
- Warning from Zapier itself: Webhooks by Zapier credentials are "stored in plaintext step fields that anyone with access to the Zap can read". API by Zapier keeps them in a connection instead — [API requests](https://help.zapier.com/hc/en-us/articles/44391646192397-Ways-to-make-API-requests-in-Zapier)
- Enterprise accounts can control which connections are used — [App connections](https://help.zapier.com/hc/en-us/articles/36818633398157-App-connections-on-Zapier)
- SDK docs state that Zapier handles OAuth and token refresh — [SDK](https://docs.zapier.com/sdk)

### Inferences
- A separation of "connection" (user-owned) from "Zap" (references connection) gives a clean reconnect flow. Single-owner reconnect is a real operational risk when the owner has left, which is why admin transfer exists.

### Gaps
- Key management (KMS, per-tenant keys, rotation) is not documented publicly.
- Refresh retry and when a connection flips to expired are not documented on pages read.

---

## Integrations

### Takeaway
Zapier's moat is its connector catalog, now about 9,000 to 10,000+ apps. Connectors are declarative or Node.js definitions with a fixed shape (auth, triggers, creates, searches) and strict execution limits. Generic HTTP steps fill the gaps.

### Cited Findings

**Catalog size**
- zapier.com/apps claims "10456+ apps" across 15 categories — [Apps](https://zapier.com/apps)
- Developer docs and MCP say "9,000+" apps and 40,000+ actions — [MCP](https://docs.zapier.com/mcp/home)
- The SDK's `.fetch()` makes authenticated raw calls to about 3,600 app APIs — [SDK](https://docs.zapier.com/sdk)

**How a connector is built**
- Two build paths: the Platform UI, and the Platform CLI (Node.js v22). CLI-built apps can only have branding edited in the UI. **[snippet]** — [CLI overview](https://docs.zapier.com/integrations/build-cli/overview)
- Auth options in the UI docs are basic, API key, digest, session and OAuth v2. Secrets live in environment variables — [Integration structure](https://docs.zapier.com/platform/quickstart/zapier-integration-structure)
- The CLI docs also list OAuth1 and OAuth2 with PKCE. The auth `test` runs when a user adds an account. `zapier-platform invoke` tests operations locally, and `push` uploads a build. **[snippet]** — [CLI tutorial](https://docs.zapier.com/integrations/quickstart/cli-tutorial)
- Operating limits — [Operating constraints](https://docs.zapier.com/platform/build/operating-constraints):
  - 30 s for test steps, polling triggers, REST Hook processing and create/search actions.
  - 10 MB webhook payload; 6 MB trigger/action input (35 MB with v17.2.0+); 20 MB HTTP response; about 120 MB downloaded file; 1,000 custom fields.
  - File inputs are dehydrated between steps, so their contents don't count toward input limits.
  - Outbound IPs are AWS East.
- An AI app guide says test steps are limited to 50 s, conflicting with the 30 s above. **[snippet]** — [AI app reference](https://docs.zapier.com/platform/reference/ai-app)
- Long operations use a callback: the action returns, the step shows Waiting/Delayed, and it resumes when POSTed to — [Action timeouts](https://docs.zapier.com/platform/build/troubleshoot-action-timeouts)

**Versioning and publishing**
- Versioning is semver. Patch is a fix, minor is additive, and major breaks Zaps. Promotion compares schemas and blocks undeclared breaking changes, though removed output keys and changed perform behaviour aren't detected — [Versions](https://docs.zapier.com/integrations/manage/versions)
- Automatic migration works only within a major version. Crossing a major needs manual user updates — [Versions](https://docs.zapier.com/integrations/manage/versions)
- Private versions with fewer than 5 users are editable. Public versions, or those with more users, must be cloned first — [Versions](https://docs.zapier.com/integrations/manage/versions)
- All integrations start private. Public ones can appear in the directory, in Zap templates, in embedding and in MCP, and access can't be restricted. Private ones can invite up to 100 by email or share by link, and link access can't be revoked — [Private vs public](https://docs.zapier.com/platform/quickstart/private-vs-public-integrations)
- Private integration rate limits are 100 calls per 60 s on Free and Professional, and 5,000 on Team and Enterprise, measured across all users — [Private vs public](https://docs.zapier.com/platform/quickstart/private-vs-public-integrations)
- Publishing needs: a publicly launched app, production endpoints, a non-expiring test account, API docs, and a team member with a matching email domain — [Publishing requirements](https://docs.zapier.com/integrations/publish/integration-publishing-requirements)
- Static webhooks aren't allowed in public integrations, and credentials can't be requested in triggers or actions. **[snippet]** — [Build guidelines](https://docs.zapier.com/platform/publish/integration-build-guidelines)

**Webhooks and API requests**
- Webhooks by Zapier actions are GET, POST, PUT and Custom Request (which adds PATCH and DELETE but can't send file objects). Payloads are Form, JSON, XML or Raw, with a 5 MB limit and optional static IP. Auth is basic only — [Send webhooks](https://help.zapier.com/hc/en-us/articles/8496326446989-Send-webhooks-in-Zaps)
- Four options exist — [API requests](https://help.zapier.com/hc/en-us/articles/44391646192397-Ways-to-make-API-requests-in-Zapier):
  - **Webhooks by Zapier:** any API, basic or no auth, credentials in the step.
  - **API by Zapier:** any API, OAuth2 or API key, credentials in a connection.
  - **API Request actions:** apps already on Zapier, using the existing connection, usable only in the Zap where created.
  - **Custom Actions:** apps already on Zapier, reusable across Zaps and teammates, AI-assisted with an optional TypeScript editor.
- API Request runs error if the app doesn't return a 200, unless custom error handling is used. **[snippet]** — [API Request actions](https://help.zapier.com/hc/en-us/articles/12899473501453-API-Request-actions-in-Zapier)

**Other developer surfaces**
- Zapier MCP has two server modes: agentic (the AI finds actions) and managed (a fixed set). Each successful tool call uses 2 tasks. Streamable HTTP only — [MCP](https://docs.zapier.com/mcp/home)
- The Zapier SDK is a TypeScript library in open beta. Pre-built actions use `zapier.apps.<app>.<type>.<action>()`. Org app restrictions don't yet apply to `.fetch()` — [SDK](https://docs.zapier.com/sdk)
- Powered by Zapier embeds automation with Zapier branding. White Label runs it under your own brand and domain — [Docs home](https://docs.zapier.com/)

### Inferences
- The 10,456 and 9,000 figures probably count differently (listed apps versus connector-backed ones), but Zapier doesn't explain the gap.
- A 30 s step budget plus a callback pattern is a simple, enforceable contract for third-party connector code. It is worth copying as a starting point.
- FlowBridge can't match the catalog early. Generic HTTP plus connection-stored auth (the API by Zapier model) gives the widest cover for the least work.

### Gaps
- Review duration and beta stages are not on the page read.
- Connector execution environment (Lambda or otherwise) is not stated on pages read.

---

## Testing and debugging

### Takeaway
Testing is per step and live: testing an action really executes it. Test records feed the mapping UI. Debugging relies on per-step Data In, Data Out and HTTP logs in run details.

### Cited Findings
- Each test creates a test record, a representative sample used to set up later steps. **[snippet]** — [Test steps](https://help.zapier.com/hc/en-us/articles/18811411817741-Test-Zap-steps)
- Action tests run live and can change data in the app. They can be skipped. **[snippet]** — [Test steps](https://help.zapier.com/hc/en-us/articles/18811411817741-Test-Zap-steps)
- The trigger and any Filter or Paths steps must be tested before Publish is enabled. Changing a required field resets a step's test, and changing an optional one doesn't. **[snippet]** — [Test steps](https://help.zapier.com/hc/en-us/articles/18811411817741-Test-Zap-steps)
- Trigger tests return the three most recent items. Test records may be generic sample data — [How triggers work](https://help.zapier.com/hc/en-us/articles/8496244568589-How-Zap-triggers-work)
- A recent Zap run can be used as a test record — [Mapping fields](https://help.zapier.com/hc/en-us/articles/8496343026701-Send-data-between-steps-by-mapping-fields)
- Testing doesn't use tasks — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)
- A slow test returns "The app did not respond in-time. It may or may not have completed successfully." — [Action timeouts](https://docs.zapier.com/platform/build/troubleshoot-action-timeouts)
- Run details show status, timestamp, version used, run ID and replay links. Per step they show Data In, Data Out, an AI Troubleshoot guide and HTTP Logs. Logs take up to 3 minutes to load and last 7 days — [Run details](https://help.zapier.com/hc/en-us/articles/20512774106125-View-specific-Zap-run-details)
- Next Gen draft tests with sample input don't touch published workflows or use tasks, capped at 60 test runs per hour per user — [Build a workflow](https://docs.zapier.com/mcp/get-started/build-a-workflow); [Next Gen drafts](https://help.zapier.com/hc/en-us/articles/49007970890509-Create-Next-Gen-Zap-drafts-and-versions)

### Inferences
- Classic Zaps lack a sandbox or dry-run mode for actions, so a test can create real records. Step mocks or a dry-run mode are an obvious differentiator.

### Gaps
- No documented way to run a whole Classic draft end to end before publishing was found. Absence on pages read is not proof.

---

## Publishing and versioning

### Takeaway
Classic Zaps have one draft alongside the live version, and publishing creates an immutable version. Rollback means "edit from old version, then publish". Next Gen adds multiple drafts and explicitly pins in-flight runs to their starting version.

### Cited Findings
- Drafts autosave and can be edited while the Zap keeps running. Publishing replaces the live Zap and creates a version. Publishing a new Zap turns it on — [Drafts and versions](https://help.zapier.com/hc/en-us/articles/9693520498445-Create-Zap-drafts-and-versions)
- Only one draft can exist per Classic Zap — [Drafts and versions](https://help.zapier.com/hc/en-us/articles/9693520498445-Create-Zap-drafts-and-versions)
- Versions record a number, publisher, timestamp and optional name. They can be renamed but not changed or deleted — [Drafts and versions](https://help.zapier.com/hc/en-us/articles/9693520498445-Create-Zap-drafts-and-versions)
- Version retention is none on Free, 1 month on Pro, 6 months on Team and 1 year on Enterprise. The current and most recent past versions always show on paid plans. Comparing draft to published is Enterprise only — [Drafts and versions](https://help.zapier.com/hc/en-us/articles/9693520498445-Create-Zap-drafts-and-versions)
- Rollback is "Edit from this version", then publish — [Version rollback](https://help.zapier.com/hc/en-us/articles/14094586364941-Restore-your-Zap-to-a-prior-version-with-version-rollback). It is a paid feature — [Free plan](https://help.zapier.com/hc/en-us/articles/32337438839565-What-s-included-in-Zapier-s-Free-plan)
- Runs record their version. Structural changes after a run began cause "Zap has diverged too much" on step replay, and even reverting doesn't help. The fix is a full replay. A delayed run from an earlier version can also conflict — [Diverged](https://help.zapier.com/hc/en-us/articles/16813373170317-Zap-error-Zap-has-diverged-too-much)
- Publishing restrictions (Enterprise): members need approval to publish, edit, add notes, turn off or delete a Zap. States are Draft, Pending, Approved, Denied and Deleted by requester. A Zap can have one pending request of each type. Approvers can edit the draft, and denials need an explanation. Renames and replays are exempt — [Publishing restrictions](https://help.zapier.com/hc/en-us/articles/21705940108941-Enable-publishing-restrictions-in-your-Enterprise-account)
- Next Gen: multiple shared drafts, a run stays on the version it started with, and publish validates the code. Rollback is a new version made from an old one. Publishing from the Workflow Manager also turns the workflow on, while through MCP it keeps its on/off state. New MCP-created workflows are off, so their webhooks receive nothing. No side-by-side compare — [Next Gen drafts](https://help.zapier.com/hc/en-us/articles/49007970890509-Create-Next-Gen-Zap-drafts-and-versions)
- Turning off: a turned-off Zap clears its dedupe list (see Triggers). Delayed actions scheduled while off won't run (see Logic). Replay requires the Zap to be on — [What is replay](https://help.zapier.com/hc/en-us/articles/19220226086797-What-is-replay)
- Canvas is a separate diagramming product. Build from an AI prompt or blank, link steps with split paths, text boxes and groups, share it and pin it to a folder. **[snippet]** — [Create a canvas](https://help.zapier.com/hc/en-us/articles/19880280846221-Create-a-canvas-to-visualize-your-automated-system)
- Canvas can generate a draft Zap from part of a diagram (older blog post). **[snippet]** — [Canvas open beta](https://zapier.com/blog/zapier-canvas-open-beta-release/)

### Inferences
- The explicit in-flight statement exists only for Next Gen. Classic behaviour (runs tied to a version number, yet "diverged" errors) suggests partially live resolution. Version-pinned runs from the start avoid this whole class of error.

### Gaps
- The Classic docs don't say which version an in-flight run or errored-step replay uses after a non-structural edit.

---

## Execution

### Takeaway
Runs are asynchronous and step-by-step, with hard limits at each layer: per-step timeouts, flood protection at trigger, throttles, and holds that preserve trigger data. The public docs describe the behaviour but not the engine.

### Cited Findings

**Statuses**
- Run statuses are Delayed, Errored, Filtered, Handled error, On hold, Needs review, Running, Safely halted, Scheduled, Successful, and Skipped (step only) — [Run statuses](https://help.zapier.com/hc/en-us/articles/20505304170637-Review-run-statuses-in-Zap-workflows)

**Holds**
- Hold reasons: flood protection, disconnected app, task limit or premium app outside plan, payment issue, team-plan downgrade, trial ended or plan change, app access policy, more than 100 steps. Trigger data stays stored while held, and replay after the fix loses no data — [Held runs](https://help.zapier.com/hc/en-us/articles/37454233721869-How-to-troubleshoot-held-Zap-or-step-runs)

**Flood protection**
- A polling trigger with 100 or more events at once is held for confirmation. The count happens before Filter or Paths steps. Replay runs at 1 per second, so 1,000 runs take a little over 15 minutes — [Zap limits](https://help.zapier.com/hc/en-us/articles/8496181445261-Zap-limits)
- The limit is configurable per Zap from the 100 default up to 1,500 — [Flood protection](https://help.zapier.com/hc/en-us/articles/14230420160269-Choose-your-Zap-workflows-flood-protection-limit)
- That article says Company plan only, while a newer one says paid plans can adjust it — [Throttled errors](https://help.zapier.com/hc/en-us/articles/8496038845325-Fix-Throttled-by-Zapier-or-Zapier-has-blocked-this-task-errors-in-Zap-workflows); [Webhook rate limits](https://help.zapier.com/hc/en-us/articles/29972220283789-Webhooks-by-Zapier-rate-limits)

**Throttles and rate limits**
- Error templates: "Too much data received for one task (... bytes)", "Too much data received (...) within a ... second window ... Resets in ... seconds", "Throttled by Zapier! Max ... runs per ... seconds." The public page doesn't state the numbers — [Throttled errors](https://help.zapier.com/hc/en-us/articles/8496038845325-Fix-Throttled-by-Zapier-or-Zapier-has-blocked-this-task-errors-in-Zap-workflows)
- Tables steps allow 450 requests per 60 s and 150 per 5 s per Zap-and-table pair. The error says how long to wait, and Autoreplay retries — [Tables rate limits](https://help.zapier.com/hc/en-us/articles/27163808375949-Rate-limits-for-Zapier-Tables-and-Zap-workflows)
- Other limits (webhooks, Code, private apps) are in Triggers, Logic and Integrations above.

**Timeouts**
- Create and search actions must finish in 30 s. On timeout the outcome is uncertain, since the action may still have finished — [Action timeouts](https://docs.zapier.com/platform/build/troubleshoot-action-timeouts)

**Replay**
- Step replay from history re-runs only errored steps. It never replays the trigger, successful steps, Filter or Paths. Full run replay re-runs every step, using the current published Zap, and allows editing trigger data — [What is replay](https://help.zapier.com/hc/en-us/articles/19220226086797-What-is-replay)
- Previously successful steps cost tasks again in a full replay — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)
- Replays must occur within 60 days of the trigger event, with the Zap on — [What is replay](https://help.zapier.com/hc/en-us/articles/19220226086797-What-is-replay)
- Bulk selection is up to 5,000 runs from Zap history — [Replay runs](https://help.zapier.com/hc/en-us/articles/8496241726989-Replay-Zap-runs); the concept page says up to 10 runs — [What is replay](https://help.zapier.com/hc/en-us/articles/19220226086797-What-is-replay)
- Free can manually replay errored runs only — [Replay runs](https://help.zapier.com/hc/en-us/articles/8496241726989-Replay-Zap-runs)

**Autoreplay**
- Up to 5 attempts: +5 min, +30 min, +1 h, +3 h, +6 h, with the last about 10 h 35 min after the first error — [What is replay](https://help.zapier.com/hc/en-us/articles/19220226086797-What-is-replay)
- A different article says it retries immediately, and then a few more times. **[snippet]** — [Troubleshoot errors](https://help.zapier.com/hc/en-us/articles/8496037690637-How-to-troubleshoot-errors-in-Zap-workflows)
- On-hold runs and safely halted runs aren't autoreplayed — [What is replay](https://help.zapier.com/hc/en-us/articles/19220226086797-What-is-replay); [Replay runs](https://help.zapier.com/hc/en-us/articles/8496241726989-Replay-Zap-runs)

**Long-running and on-demand**
- Next Gen runs last up to 1 year. A run awaiting a callback that never comes waits until cancelled. They can't be limited to one run at a time, so overlapping runs can repeat actions — [Build a workflow](https://docs.zapier.com/mcp/get-started/build-a-workflow) **[overlap point is snippet]**
- Next Gen pause supports "until an event arrives or a time limit passes, whichever comes first" — [Next Gen Zaps](https://help.zapier.com/hc/en-us/articles/48391476448141-Get-started-with-Next-Gen-Zaps)

### Inferences
- Autoreplay re-invoking non-idempotent actions after an ambiguous timeout can create duplicates, since Zapier states the outcome of a timed-out call is unknown. The docs offer no general idempotency-key mechanism. FlowBridge should pass one to connectors.
- "1 replay per second" and shared named queues suggest per-Zap rate control exists in the engine, but this isn't documented.

### Gaps
- Worker architecture, queueing, per-account concurrency limits, global ordering guarantees and any maximum total Classic run duration are not publicly documented on pages read.
- Numeric Zapier-level throttle values are absent from the troubleshooting page.

---

## Error handling

### Takeaway
There are three layered mechanisms: Autoreplay (automatic retries), custom error handler paths (explicit branches), and notifications or auto-off at the Zap level. Adding a handler disables Autoreplay for that Zap.

### Cited Findings
- Handlers: from a step menu, "Add error handler" creates a Success and an Error path. There is one handler per step and many per Zap, and handlers can contain Paths or nested handlers — [Custom error handling](https://help.zapier.com/hc/en-us/articles/22495436062605-Set-up-custom-error-handling)
- An `Error Message` field is mappable within the handler — [Custom error handling](https://help.zapier.com/hc/en-us/articles/22495436062605-Set-up-custom-error-handling)
- Effects of a handler: the run shows Stopped/Handled. The errored step doesn't count toward the error ratio. No error emails are sent. Autoreplay turns off for that Zap on publish. Those runs can't be step-replayed, only fully replayed. Downgrading to Free turns such Zaps off — [Custom error handling](https://help.zapier.com/hc/en-us/articles/22495436062605-Set-up-custom-error-handling)
- Successful handler steps use tasks — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)
- Autoreplay is an account-wide setting on Professional and above, enabled by a super admin or owner on Team and Enterprise — [What is replay](https://help.zapier.com/hc/en-us/articles/19220226086797-What-is-replay)
- Per-Zap options are account default, Always Replay and Never Replay. An older article limits per-Zap overrides to Company — [Advanced settings](https://help.zapier.com/hc/en-us/articles/14167175792909-Decide-how-your-Zap-handles-errors-with-advanced-settings). An update title says this later reached Professional and Team — [Advanced settings update](https://help.zapier.com/hc/en-us/articles/21142460418701-Advanced-settings-are-now-available-to-Professional-and-Team-accounts)
- Auto-off: a Zap pauses if 95% or more of its runs error over the last 7 days. It can be overridden with "Keep running if errors occur" — [Advanced settings](https://help.zapier.com/hc/en-us/articles/14167175792909-Decide-how-your-Zap-handles-errors-with-advanced-settings)
- Notification frequency options are Immediately (default), Immediately then hourly summary, Hourly summary, and Never. Per-Zap or per-folder custom rules need Pro or above and aren't available during trial — [Notifications](https://help.zapier.com/hc/en-us/articles/8496289225229-Manage-notifications-when-errors-occur-in-Zap-workflows)
- With Autoreplay, error emails are sent only after the final attempt fails, and runs show Scheduled meanwhile — [What is replay](https://help.zapier.com/hc/en-us/articles/19220226086797-What-is-replay)
- Turning Autoreplay off cancels scheduled attempts, even if turned back on before the next one. **[snippet]** — [Replay Zap runs](https://help.zapier.com/hc/en-us/articles/8496241726989-Replay-Zap-runs)
- Next Gen's Agentic Management is on by default. It diagnoses failures and prepares fixes (such as renamed fields or expired connections), publishing them as new versions, and it can suggest improvements after successes — [Next Gen Zaps](https://help.zapier.com/hc/en-us/articles/48391476448141-Get-started-with-Next-Gen-Zaps)
- By default an agent can apply some fixes without approval, which can be restricted — [Build a workflow](https://docs.zapier.com/mcp/get-started/build-a-workflow)

### Inferences
- "Handler disables retry" forces a choice between retries and handled branching. A combined model (retry N times, then run the handler) would be more useful, and Next Gen's continue-on-failure seems to move that way.

### Gaps
- Which error classes are retryable versus permanent is not documented on pages read.

---

## Monitoring

### Takeaway
Zap history is the main tool. Team and Enterprise add usage exports and audit logs, and Enterprise adds Alerts, Analytics and log streaming.

### Cited Findings
- Zap history has Zap runs and Task usage tabs. Runs filter by date, Zap, apps, folder, owner, status and version ("v3"). Deleting a playing or waiting run also stops it — [Zap history](https://help.zapier.com/hc/en-us/articles/8496291148685-View-and-manage-your-Zap-history)
- Retention conflict:
  - Maximum 60 days guaranteed, with display up to 10,000 runs — [Zap history](https://help.zapier.com/hc/en-us/articles/8496291148685-View-and-manage-your-Zap-history)
  - "29-69 days" by default, and Enterprise can set 7-30 days — [Data retention](https://help.zapier.com/hc/en-us/articles/8496327478413-Customize-data-retention-in-Zapier)
  - "Extend up to 90 days" on a Team/Enterprise page. **[snippet]** — [Manage Team/Enterprise](https://help.zapier.com/hc/en-us/articles/8496291989645-Manage-your-Zapier-Team-or-Enterprise-account)
- Task usage appears in the sidebar, Billing (Subscription, Usage Insights), Zap history, per run, in AI and Code steps, in MCP, and in Admin Center. Billing uses UTC and history uses local time, and deleted Zaps count on the bill but aren't listed — [Task usage locations](https://help.zapier.com/hc/en-us/articles/46426440004621-Where-to-review-your-task-usage-in-Zapier)
- Usage Insights exports the last 12 billing periods as CSV, not on Enterprise — [Task usage locations](https://help.zapier.com/hc/en-us/articles/46426440004621-Where-to-review-your-task-usage-in-Zapier)
- Analytics dashboard (Enterprise) tracks usage by Zap, app or member, and error rates — [Task usage locations](https://help.zapier.com/hc/en-us/articles/46426440004621-Where-to-review-your-task-usage-in-Zapier)
- Alerts (Enterprise, generally available): one place for errors across Zaps, priority ranking, and alert rules — [Alerts](https://help.zapier.com/hc/en-us/articles/29206590194445-Alerts-is-now-generally-available)
- Task alerts are emailed at 80% and 100% of the relevant limit, and Enterprise can set usage alerts — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)
- Zapier Manager offers further account and Zap notifications — [Monitor account](https://help.zapier.com/hc/en-us/articles/22334604476941-Monitor-your-Team-or-Enterprise-account)
- Zap runs API: GET with bearer token and `zap:runs` scope, filtering by date, zap, status and search, defaulting to the last 30 days. It sits under the "experimental" section. **[snippet]** — [Get Zap Runs](https://docs.zapier.com/api-reference/workflow/experimental/get-zap-runs)

### Inferences
- Paywalling Alerts and Analytics to Enterprise suggests observability is a key upsell. FlowBridge can use basic run alerts as a differentiator at lower tiers.

### Gaps
- Alert rule conditions and non-email channels are not described on the page read.

---

## Administration

### Takeaway
Team plans get shared folders, connections, SSO and an audit log. Enterprise adds super admins, workspaces, SCIM, app and action policies, and publishing approval.

### Cited Findings
- Team roles are Owner, Admin and Member. Enterprise adds Super admin. There is one owner per account — [Roles](https://help.zapier.com/hc/en-us/articles/39698983334797-User-roles-and-permissions-in-Team-and-Enterprise-accounts)
- Notable permissions (matrix columns inferred from a flattened table) — [Roles](https://help.zapier.com/hc/en-us/articles/39698983334797-User-roles-and-permissions-in-Team-and-Enterprise-accounts):
  - Admin and above configure SAML, SCIM and retention.
  - Super admin and owner view the audit log and reach connections or folders not shared with them.
  - Owner alone transfers ownership or deletes the account.
- Asset roles are Owner, Editor and Viewer, and only Canvas, Tables and Agents have Viewer — [Roles](https://help.zapier.com/hc/en-us/articles/39698983334797-User-roles-and-permissions-in-Team-and-Enterprise-accounts)
- Newer Enterprise org model: an Organization holds users, workspaces and billing. Roles are Organization Owner, Organization Super Admin, Workspace Admin and Workspace Member. User Groups mapped to a workspace grant access, the highest level wins, and Teams handle sharing within a workspace — [Orgs and workspaces](https://help.zapier.com/hc/en-us/articles/47031545308557-Roles-and-permissions-in-organizations-and-workspaces)
- Folders and sharing: shared folders can go to members or teams. Admins can transfer a departing member's Zaps — [Collaborate](https://help.zapier.com/hc/en-us/articles/22330977078157-Collaborate-with-members-of-your-Team-or-Enterprise-account)
- Plan table: Pro 1 seat, Team 25, Enterprise unlimited. SAML SSO, shared connections, folder permissions and audit log (6 months) are on Team. Enterprise audit log is 1 year. "Advanced roles & permissions" is marked Coming soon — [Pricing](https://zapier.com/pricing)
- Conflict: the security page presents SSO and SCIM as Enterprise — [Security](https://zapier.com/security-compliance)
- Audit logs are described as immutable and searchable, streaming to Datadog, Splunk or a SIEM on Enterprise. Annual pen tests, bug bounty, 2FA on every plan, SOC 2 Type II and SOC 3, GDPR, UK GDPR and CCPA. HIPAA and ISO not mentioned on that page — [Security](https://zapier.com/security-compliance)
- App policies:
  - Restricted apps (open) or Allowed apps (closed). Accounts created on or after 5 October 2026 use allowed apps. Exceptions for members or teams. Only Allowed apps supports blocking individual triggers and actions. **[snippet]** — [App access policies](https://help.zapier.com/hc/en-us/articles/8496307974541-Manage-access-to-apps-in-Zapier)
  - Existing published Zaps stay on but their steps are held, replayable once permitted. **[snippet]** — [App access settings](https://help.zapier.com/hc/en-us/articles/45852792795917-Configure-app-access-settings-for-your-Enterprise-account); also [Held runs](https://help.zapier.com/hc/en-us/articles/37454233721869-How-to-troubleshoot-held-Zap-or-step-runs)
- Next Gen early access lacks: audit log, Log Streams, action restrictions, custom retention, approval requests, editor role, folders, SOC 2 audit scope, among others. Zapier advises against running the most sensitive workflows there — [Next Gen Zaps](https://help.zapier.com/hc/en-us/articles/48391476448141-Get-started-with-Next-Gen-Zaps)
- Zapier does not train on workflow data on any plan, but may learn from workflow structure. Enterprise is auto opted out, and others can opt out by form — [Security](https://zapier.com/security-compliance)

### Inferences
- Two role docs coexist because Zapier is moving Enterprise to org and workspace tenancy. Modelling Org > Workspace > Folder from day one avoids a later migration.

### Gaps
- Exact Editor and Viewer permissions by asset couldn't be read from the flattened table.
- Whether new accounts all use the workspace model is not stated.

---

## Templates, Tables, Forms (Interfaces), Agents and AI, limits and pricing

### Takeaway
Tasks are the shared currency, with multipliers for AI and Code. Agents are being folded into a task-billed AI by Zapier step. Interfaces is now Forms, and shared Zap templates end on 15 December 2026.

### Cited Findings

**Templates**
- Shared Zap templates will be deprecated on 15 December 2026, no new ones can be created, and links will stop working. Zaps already made from them continue. **[snippet]** — [Share a template](https://help.zapier.com/hc/en-us/articles/8496292155405-Share-a-template-of-your-Zap)
- Guided templates replace them: they carry field values and configuration, and consumers follow a wizard. Creators control which fields can be edited, add help text, and choose who it's shared with. **[snippet]** — [Guided templates](https://help.zapier.com/hc/en-us/articles/43465487495181-Guided-templates)
- Developers can publish Zap templates for beta or public integrations, not private ones. **[snippet]** — [Developer templates](https://docs.zapier.com/platform/publish/zap-templates)

**Tables**
- Records are 2,500 on Free, 100,000 on Pro and 500,000 on Team. Enterprise is via sales. 100 fields per table; views 3 on Free and 50 on paid — [Pricing](https://zapier.com/pricing)
- Text is 255 characters, Long Text 10,000, Decimal 7 digits, Link 2,048 — [Tables limits](https://help.zapier.com/hc/en-us/articles/15721386410765-Zapier-Tables-usage-limits)
- CSV import must be under 50 MB. **[snippet]** — [Import data](https://help.zapier.com/hc/en-us/articles/19693186435853-Import-data-into-Zapier-Tables)
- Tables steps don't use tasks — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)

**Forms (formerly Interfaces)**
- A help page's URL still says "Interfaces" while its title says "Zapier Forms" — [Forms components](https://help.zapier.com/hc/en-us/articles/19103226147853-Use-Zaps-with-Interfaces-components). A Zapier FAQ excerpt confirms the rename and that existing forms keep working. **[snippet]** — [Forms](https://zapier.com/forms)
- Pages are 10 on Free, 50 on Pro and 150 on Team. Uploads are 5 MB and 3 files on Free, 10 MB and 100 files on Pro, 25 MB and 100 files on Team — [Pricing](https://zapier.com/pricing)

**AI by Zapier and Agents**
- Agents is migrating into AI by Zapier inside the Zap editor. Each agent becomes a Zap with a trigger and one AI step holding the prompt, tools and reasoning. No shutdown date is set — [Migration](https://help.zapier.com/hc/en-us/articles/47402591569805-Migrating-from-Agents-to-AI-by-Zapier)
- Per-run cap: 75 tasks by default, adjustable up to 500, and excess pauses for review — [Migration](https://help.zapier.com/hc/en-us/articles/47402591569805-Migrating-from-Agents-to-AI-by-Zapier). The blog says adjustment comes "in the future" — [Blog](https://zapier.com/blog/zapier-agents-is-now-ai-by-zapier/)
- Not yet supported in the AI step: admin-level BYOM, chat-triggered agents, and most knowledge sources other than Notion — [Migration](https://help.zapier.com/hc/en-us/articles/47402591569805-Migrating-from-Agents-to-AI-by-Zapier)
- Model tiers: Standard 1× (no tools), Advanced 3×, Premium 5× (default for new steps), Bring Your Own Key 1× including tool calls (OpenAI, Anthropic, Gemini, Azure OpenAI, Bedrock). Each tool call costs extra — [AI by Zapier](https://help.zapier.com/hc/en-us/articles/8496342944013-Use-AI-by-Zapier-to-analyze-and-return-data)
  - Conflict: the blog says default models are free, with other tiers at 3 or 5 tasks per step — [Blog](https://zapier.com/blog/zapier-agents-is-now-ai-by-zapier/)
- The step has structured output fields (or one combined output, or a list). Up to 20 knowledge sources per step. No memory between runs. It can't read websites or URLs. Moderation is always on for Zapier-provided models — [AI by Zapier](https://help.zapier.com/hc/en-us/articles/8496342944013-Use-AI-by-Zapier-to-analyze-and-return-data)
- Per-tool "Require approval before running". History records tools called, inputs, outputs, model tier and tasks — [Blog](https://zapier.com/blog/zapier-agents-is-now-ai-by-zapier/)
- Agents add-on remains on the pricing page, using activities instead of tasks: Free 400 per month, Pro 1,500. Per-run caps are 10 on Free, 40 on paid. Pro from about $33.33 per month annually. Chatbots: 2 free — [Pricing](https://zapier.com/pricing)
- Knowledge limits in Agents: 75,000 rows or records per account (per user on Team and Enterprise), 100 MB files, 24-hour resync, stopping after 90 days inactive. **[snippet]** — [Add data](https://help.zapier.com/hc/en-us/articles/24569690575117-Add-your-own-data-to-an-agent)
- Copilot is included: daily message limit on Free, unlimited on paid — [Pricing](https://zapier.com/pricing)

**How tasks are priced**
- Counts: 1 task per successful action, including search set to proceed when empty. Full-replay reruns count again. Lead Router is 5. MCP is 2 per call — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)
- Doesn't count: triggers and polling, Filter, Paths, tests, failed or halted steps, Tables, Forms, Formatter, Delay, Looping, Digest, Zapier Manager, Storage — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)
- From 1 December 2026: Next Gen uses the same rates with at least 1 task per completed run, even one doing only filters or loops. The SDK outside a Next Gen Zap is 1 task per action, external call and inbox-lease trigger. MCP calls to free By Zapier apps stop counting — [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)
- Next Gen billing date conflict: a help page says 1 December 2026 — [Next Gen Zaps](https://help.zapier.com/hc/en-us/articles/48391476448141-Get-started-with-Next-Gen-Zaps). An early-access FAQ says details are to be announced. **[snippet]** — [Early access](https://zapier.com/early-access)
- Plans (USD per month) — [Pricing](https://zapier.com/pricing):

| Tasks/mo | Pro annual | Pro monthly | Team annual | Team monthly |
|---|---|---|---|---|
| 100 (Free) | $0 | $0 | n/a | n/a |
| 750 | $19.99 | $29.99 | n/a | n/a |
| 2,000 | $49 | $73.50 | $69 | $103.50 |
| 10,000 | $129 | $193.50 | $169 | $253.50 |
| 100,000 | $489 | $733.50 | $599 | $898.50 |
| 1,000,000 | $2,199 | $3,299 | $2,499 | $3,749 |
| 2,000,000 | $3,389 | $5,099 | $3,999 | $5,999 |

- Annual billing is stated as 33% off. Allowances reset monthly, even on annual plans. Enterprise uses an Annual Task Limit — [Pricing](https://zapier.com/pricing)
- Pay-per-task: Pro and above. Overage is 2.5× the base rate on monthly and 1.25× on annual. Usage stops at 3× the plan's tasks, even with it on. With it off, runs are held until the cycle resets — [Pricing](https://zapier.com/pricing); [Task usage](https://help.zapier.com/hc/en-us/articles/8496196837261-How-is-task-usage-measured-in-Zapier)
- Other: 15% non-profit discount and a 14-day Pro trial — [Pricing](https://zapier.com/pricing)

### Inferences
- Effective per-task price drops sharply with volume: from $19.99/750, about $0.027, to $3,389/2,000,000, about $0.0017 (my arithmetic, annual Pro).
- Holding runs at the limit rather than dropping them protects customers from data loss and creates a strong upgrade moment. The cost is storing held trigger data.
- Next Gen's "at least 1 task per run" closes the free-logic loophole, and suggests Zapier sees compute costs in code-based runs.

### Gaps
- Exact pay-per-task dollar rates: the pricing page points to zapier.com/pricing/rates, which returned 404 through the fetch tool.
- The per-tool-call task cost for AI by Zapier was not found on pages read.
- Interfaces-era limits other than pages and uploads, and any Canvas limits, were not found.

---

## Needs user login

No sign-in was attempted. These views are behind a Zapier account per the docs. The in-app URLs are not verified, so start from https://zapier.com/app.

| Where | What it would answer |
|---|---|
| Zap editor (Classic) | Exact mapping UI, test flow, Paths execution setting and whether sequential is now the default |
| Zap history and run details | Actual run and step payload shape and log format |
| Settings: Autoreplay and notifications | Which per-Zap overrides are really available on each plan, resolving the Company versus Professional/Team conflict |
| Billing, Usage Insights (and https://zapier.com/pricing/rates if it needs a session) | Exact pay-per-task rates, and any AI tool-call rates |
| Admin Center: App permissions, Alerts, Analytics, Audit log (Team or Enterprise account needed) | Alert rule conditions and channels, real audit event list, action-level restriction UI |
| Next Gen Zaps Workflow Manager, access via https://zapier.com/workflow/early-access (paid plan and request needed) | Generated TypeScript shape, durable-run primitives, Agentic Management approval settings, run retention |
| Zapier Developer Platform build UI at https://developer.zapier.com | Connector builder UX and exact form fields (the docs cover the concepts) |
| Zapier Trust Center (SOC 2 report, under NDA per the security page) | Key management and control details the public pages omit |
