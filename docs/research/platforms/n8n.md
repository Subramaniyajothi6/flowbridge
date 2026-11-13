# n8n: how the product works end to end (reference for designing FlowBridge)

Retrieved 2026-11-07. Docs were read as raw Markdown from docs.n8n.io (the site publishes a `.md` version of every page; n8n restructured its docs around `build/`, `deploy/`, `connect/`, `administer/`). Source links point to the `master` branch of `n8n-io/n8n` on the same date.

**Version baseline, which matters when reading everything below.** GitHub's `stable` tag and latest non-prerelease is `n8n@2.46.6`, published 2026-11-04, while `3.1.0` and `2.47.x` are prereleases — [GitHub releases](https://github.com/n8n-io/n8n/releases). The release notes list n8n 3.0 as "Released: 2026-10-27" — [Release notes](https://docs.n8n.io/changelog/release-notes); the breaking changes page calls 3.0.0 an "early access release" — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes). So 2.x is the current stable line and 3.x is rolling out. Differences are marked "3.0" below.

Licence, which affects how FlowBridge may use the source: the core is under the "Sustainable Use License", and files with `.ee.` in the name or `.ee` in the directory need an n8n Enterprise License — [LICENSE.md](https://github.com/n8n-io/n8n/blob/master/LICENSE.md). Treat the source as a reference for behaviour, not as code to copy, and get legal advice before reusing any of it (my inference).

## Workflow model and terminology

### Takeaway
A workflow is a directed graph of named nodes. The unit of data is the **item**, and every connection carries an array of items. Nodes implicitly iterate over items, so most "loops" are not drawn on the canvas. This item-array model is the most distinctive design choice in the product.

### Cited Findings
- A workflow is "a collection of nodes that automate a process". It starts when a trigger condition occurs, when run manually, or when another workflow calls it, then executes node by node and can branch, merge and loop — [Glossary](https://docs.n8n.io/key-concept-glossary).
- Nodes start the workflow, fetch or send data, or process data. Node operations are either Triggers or Actions — [Work with nodes](https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes).
- A connection passes data from one node's output to another node's input — [Connect nodes](https://docs.n8n.io/build/understand-workflows/workflow-components/connect-nodes-together).
- In the stored model a connection targets a destination `node` (by name), a `type` (for example `main`) and an input/output `index`. Connections are keyed by node name — [interfaces.ts](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/interfaces.ts).
- All data between nodes is an array of objects. Each item has a `json` object and an optional `binary` object (entries have required `data`, plus optional `mimeType`, `fileExtension`, `fileName`) — [Data structure](https://docs.n8n.io/build/work-with-data/understand-n8ns-data-structure).
- A node receiving multiple items runs its operation once per item: two input items to a Trello "create card" node create two cards — [Data structure](https://docs.n8n.io/build/work-with-data/understand-n8ns-data-structure).
- Each output item carries metadata linking it to the input item(s) that produced it, forming a chain back through the run ("item linking"). If a node doesn't declare links, n8n guesses: 1→1 links, 1→many all link to the one input, equal counts link in order, and unequal counts or brand-new items can't be auto-linked, which raises an error — [How items link](https://docs.n8n.io/build/work-with-data/reference-data/link-data-items/how-items-link-through-workflows). The stored shape is `pairedItem` with `{item, input?, sourceOverwrite?}` — [interfaces.ts](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/interfaces.ts).
- A workflow can contain multiple trigger nodes, but only one of them executes per execution, depending on the event — [Choose a node type](https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-a-node-type).
- Execution order for multi-branch workflows has two versions. **v1** (default for workflows created from n8n 1.0) completes one branch before the next, ordered top to bottom by canvas position, then left to right. **v0** (legacy) runs the first node of every branch, then the second, and so on. It is a per-workflow setting — [Execution order](https://docs.n8n.io/build/flow-logic/understand-execution-order).
- Cluster nodes are a root node plus attached sub-nodes (chat model, tools, memory, vector store), used for AI features — [Glossary](https://docs.n8n.io/key-concept-glossary).
- Execution modes are Manual and Production — [Understand executions](https://docs.n8n.io/build/understand-workflows/understand-executions).
- Data tables give project-scoped built-in storage (rows and columns, CSV import/export, a Data Table node, an API). The default limit is 200 MiB per instance, with a warning at 80%. At the limit, inserts and updates fail. Code nodes can't access them directly — [Data tables](https://docs.n8n.io/build/work-with-data/data-tables).

### Inferences
- Because branch order depends on canvas position, moving a node can change run behaviour. FlowBridge should either make order explicit or show it clearly.
- Item-level iteration makes simple flows short, but it creates a whole class of "my node ran N times" and item-linking errors. Those errors are serious enough that n8n documents them as their own topic.

### Gaps
- No official formal schema document for the workflow JSON turned up in the pages read. The shape above comes from TypeScript interfaces.

## Triggers

### Takeaway
There are three underlying firing mechanisms: inbound HTTP (webhook, form, chat, and app events from services that support webhooks), periodic polling, and time or long-lived connections (schedule, message queues, IMAP). A trigger only fires in production once the workflow is **published**.

### Cited Findings
**Types**
- Node-builder docs define three trigger types: Webhook (real time, for services with webhooks), Polling (periodic checks, for services without), and Others (message queues and time-based, such as AMQP, MQTT, Schedule, IMAP) — [Choose a node type](https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-a-node-type).
- Publishing makes webhook and form triggers use production URLs, schedules run, and connected-app events fire — [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows).

**Webhook**
- Each Webhook node has a Test URL and a Production URL — [Webhook workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development).
- **Test URL:** registered when you select "Listen for test event" or "Execute workflow". It stays active for 120 seconds and incoming data shows in the editor — [Webhook workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development). The source has `TEST_WEBHOOK_TIMEOUT` = 2 minutes plus a 30-second buffer, and test webhooks have their own registrations service — [constants.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/constants.ts), [test-webhooks.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/webhooks/test-webhooks.ts).
- **Production URL:** registered on publish. Data doesn't show in the editor, and runs appear in the Executions tab — [Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/).
- Route paths are `/webhook/*` (production), `/webhook-waiting/*` (resume) and `/webhook-test/*` (manual, must go to main) — [Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode).
- Table `webhook_entity` records active webhooks for all trigger nodes, not just the Webhook node — [Database](https://docs.n8n.io/deploy/host-n8n/understand-the-architecture/understand-the-database).
- Options: methods DELETE, GET, HEAD, PATCH, POST, PUT. The path is random by default and accepts route params such as `/:variable`. Auth is Basic, Header, JWT, n8n User Auth (OAuth2), or None. Response modes are Immediately, When Last Node Finishes, Using 'Respond to Webhook' Node, and Streaming. Other options include IP allowlist (403 otherwise), CORS (default `*`), Ignore Bots, Raw Body, Binary Property, and "Only Run If" (an expression; non-matching requests get 200 with no execution). Max payload is 16 MB (`N8N_PAYLOAD_SIZE_MAX`) — [Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/).

**Polling**
- Polling nodes periodically check for new data, with a **Poll Times** parameter (Every Hour/Day/Week/Month modes and so on) — [Gmail poll modes](https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.gmailtrigger/poll-mode-options).
- A node implements `poll()` and keeps a cursor in workflow static data. Gmail stores `lastTimeChecked` and `possibleDuplicates` — [GmailTrigger.node.ts](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Google/Gmail/GmailTrigger.node.ts).
- A poll counts as an execution only when it finds new data — [Understand executions](https://docs.n8n.io/build/understand-workflows/understand-executions).
- Poll triggers stay on the in-memory scheduler unless opted in with `N8N_SCHEDULER_POLL_TRIGGERS_ENABLED` (from 2.33.0, "isn't 100% stable"). Missed polls are always skipped, and polling resumes at the next scheduled time — [Durable scheduler](https://docs.n8n.io/deploy/host-n8n/configure-n8n/durable-scheduler).
- Source shows poll cursors and backoff tied to the durable poller chain — [poll-backoff.service.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/workflows/triggers/poll-backoff.service.ts).

**Schedule**
- Intervals are seconds, minutes, hours, days, weeks, months, or custom cron, with multiple rules per node. A monthly day that doesn't exist in a month doesn't fire. Timezone is the workflow's, then the instance's — [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger).
- **Durable scheduler** (default from 2.45.0): schedules and individual upcoming runs live as database rows. The five stages are Materialization (record upcoming runs), Execution (claim up to one check interval early, then fire at the instant), Recovery (a reaper releases runs from crashed instances), Retention, and Owner reconciliation. Every main instance runs all stages and claiming prevents duplicates. Missed runs fire late within a grace period (default one minute). Beyond that, the policy is Don't Run (default), Run Most Recent, or Run Most Recent Per Rule. No policy replays a backlog run by run — [Durable scheduler](https://docs.n8n.io/deploy/host-n8n/configure-n8n/durable-scheduler).
- The older in-memory scheduler kept timers in the main process and lost runs across restarts — [Durable scheduler](https://docs.n8n.io/deploy/host-n8n/configure-n8n/durable-scheduler).
- From 2.45.0, "every N seconds/minutes" runs at uniform intervals measured from publication, not clock boundaries. Cron keeps its timing — [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger).

**Manual**
- Fires only from the Execute Workflow button. Only one per workflow. Publishing for production requires a trigger other than Manual — [Manual Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.manualworkflowtrigger), [Types of executions](https://docs.n8n.io/build/understand-workflows/understand-executions/types-of-executions).

**Form**
- The node generates a hosted form page, with Test and Production URLs (`.../form/<path>`). Further pages come from the n8n Form node. Auth is Basic, n8n User Auth, or None. Query parameters pre-fill fields in production only. Respond When offers Form Is Submitted or Workflow Finishes, among others — [Form Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger).

**Chat**
- Modes are Hosted Chat or Embedded Chat (your UI calls the webhook URL, or you use n8n's widget). Auth is None, Basic, or n8n User Auth. It must connect to an agent or chain root node. **Every message is one execution** — [Chat Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.chattrigger).

**Sub-workflow and error entry points**
- Execute Sub-workflow Trigger and Error Trigger start workflows from other workflows — [Sub-workflows](https://docs.n8n.io/build/flow-logic/break-workflows-into-smaller-parts), [Error handling](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully).

### Inferences
- App-event triggers on webhook-capable services presumably auto-register a subscription with the third party on publish. This fits the documented "Published, partial" state, where a trigger failed "because a connected app was unavailable". I did not confirm the node-level mechanism in the pages read.
- The durable scheduler is n8n correcting an earlier design flaw. FlowBridge should start with database-recorded runs rather than in-process timers.

### Gaps
- Minimum polling interval and any per-plan limits on it: not found in pages read.
- How long production webhook requests may be held open when responding at workflow end: not found.
- Webhook dedup or idempotency guarantees: not found in the docs read. Assume none until shown otherwise.

## Logic: branching, loops, filters, merge, sub-workflows, code, delays, human approval

### Takeaway
All logic is expressed as ordinary nodes on the graph. Pauses work by persisting execution state to the database and resuming later. Human approval is built on that same pause and resume mechanism.

### Cited Findings
- **If:** comparison conditions by data type, AND/OR, true and false outputs. Types are String, Number, Date & Time, Boolean, Array, Object — [If](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if).
- **Switch:** Rules mode (one rule per output, renameable, with a Fallback Output of None, Extra Output, or Output 0) or Expression mode (returns an output index) — [Switch](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.switch).
- **Filter:** passes items meeting conditions and omits the rest — [Filter](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.filter).
- **Implicit iteration:** nodes run per item by default; **Execute Once** restricts to the first item — [Loop](https://docs.n8n.io/build/flow-logic/loop).
- **Explicit loops:** connect an output back to an earlier node with an If to stop, or use **Loop Over Items (Split in Batches)**, which stores the original data, emits a batch on its `loop` output each pass, then returns everything on `done`. A Reset option treats incoming data as a new set, for example for unknown-length pagination; n8n warns that you must include a termination condition — [Loop Over Items](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.splitinbatches).
- **Nodes that don't auto-iterate:** Code in all-items mode, Execute Workflow in all-items mode, HTTP Request pagination, several DB insert/update operations, and RSS Read — [Loop](https://docs.n8n.io/build/flow-logic/loop).
- **Merge:** waits for all connected inputs. Modes: Append; Combine by Matching Fields (Keep Matches ≈ inner join, Keep Non-Matches, Keep Everything ≈ outer join, Enrich Input 1 or 2 ≈ left or right join), by Position, or by All Possible Combinations; and SQL Query (AlaSQL over `input1`, `input2`, and so on). More than two inputs since 1.49.0 — [Merge](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.merge).
- Multi-input nodes hold data in a `waitingExecution` structure until inputs are ready, alongside a `nodeExecutionStack` — [workflow-execute.ts](https://github.com/n8n-io/n8n/blob/master/packages/core/src/execution-engine/workflow-execute.ts).
- **Sub-workflows:** Execute Sub-workflow node plus Execute Sub-workflow Trigger. Inputs are typed fields, a JSON example, or "accept all data". The last node's output returns to the parent. Modes are run once with all items or for each item. "Wait for Sub-Workflow Completion" can be turned off. "This workflow can be called by" restricts callers. Links connect parent and child executions. Doesn't count toward quota — [Sub-workflows](https://docs.n8n.io/build/flow-logic/break-workflows-into-smaller-parts), [Execute Sub-workflow](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow).
- 3.0 removes the Local File and URL sources — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes). The parent parks at `WAIT_FOR_SUB_EXECUTION` and is resumed when the child finishes — [wait-tracker.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/wait-tracker.ts).
- Sub-workflows are also a memory tactic: the child holds only the current batch and returns a small result, then the memory is freed — [Manage your data](https://docs.n8n.io/deploy/use-n8n-cloud/configure-cloud/manage-your-data).
- **Code:** JavaScript (Node.js) or Python, in Run Once for All Items (default) or Run Once for Each Item. No file system or HTTP from the node. Cloud allows only `crypto` and `moment`; self-hosted can enable npm modules. Native Python exposes only `_items`/`_item`, with bracket access. Pyodide was removed in 2.0 — [Code](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code).
- **Code isolation:** task runners connect over WebSocket to a broker in the n8n process, and the Code node is the requester. Internal mode is a child process with the same uid (deprecated in 3.0). External mode is a sidecar `n8nio/runners` image, with one per worker in queue mode. Docs call runners "the only isolation layer" — without them, a workflow editor could read the database and encryption key — [Task runners](https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners).
- Task timeout `N8N_RUNNERS_TASK_TIMEOUT` drops from 300 s to 60 s in 3.0 — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes).
- **Wait node:** resumes After Time Interval, At Specified Time, On Webhook Call, or On Form Submitted. It offloads execution data to the database and reloads on resume. Under 65 seconds, the process simply stays running with no offload. Server time is always used, regardless of workflow timezone. `$execution.resumeUrl` is unique per execution and generated at runtime, with optional auth (Basic, Header, JWT) and an optional "Limit Wait Time" timeout. A partial execution changes the resume URL — [Wait](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait).
- Wait resume mechanics: the leader polls every 60 seconds for `waiting` executions due in the next 70 seconds, then sets a `setTimeout` for each. An `ExecutionAlreadyResumingError` guards against double resume in multi-main — [wait-tracker.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/wait-tracker.ts), [execution.repository.ts](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/db/src/repositories/execution.repository.ts).
- **Human approval, three forms:**
  - App nodes with "Send and Wait" operations, such as Gmail "Send and Wait for Approval" (Approve Only, or Approve and Disapprove, with custom labels). Docs advise the Wait node for more complex approvals — [Gmail message operations](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.gmail/message-operations).
  - Native Slack approvals. The default uses signed link buttons, where the first decision stands and output is `approved`, `respondedAt`. In-Slack approval limits responders to a listed set and records who responded — [Slack approvals](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.slack/approvals).
  - AI-tool gating: approve or deny before an agent's tool runs, with the reviewer on a different channel from the user (Chat, Slack, Discord, Telegram, Teams, Gmail, WhatsApp, Google Chat, Outlook). The `$tool` variable builds the review message — [Human-in-the-loop for tools](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools).
- Form-based approval is the Wait node's On Form Submitted resume — [Wait](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait).

### Inferences
- A resume URL in an email, a pruning exclusion for `waiting` runs, and a time-limit parameter together form a complete approval primitive. FlowBridge could expose approval as a first-class step using the same three pieces.
- There is no documented approval inbox, escalation or multi-approver chain among the pages read. Those are possible areas for FlowBridge to differentiate.

### Gaps
- Maximum wait duration for a Wait node: not stated.
- Dedicated approval-queue UI: none found in pages read. The "Reviews" menu is for workflow versions, not runtime approvals.

## Data mapping and expressions

### Takeaway
Any parameter can switch to expression mode, which evaluates JavaScript inside `{{ }}` per item with `$`-prefixed helpers. Drag-and-drop mapping simply writes an expression. References use node **names**, and the "paired item" chain is what makes `$('Node').item` resolve correctly.

### Cited Findings
- Dragging a field creates, for example, `{{ $json.fruit }}`; the value changes per item as the node iterates — [Data structure](https://docs.n8n.io/build/work-with-data/understand-n8ns-data-structure).
- Multi-statement code needs an IIFE inside the braces. Luxon's `DateTime` is available — [Expressions](https://docs.n8n.io/build/work-with-data/transform-data/expressions-for-data-transformation).
- Core references: `$json` (current item), `$binary`, `$input.item/all()/first()/last()/params`, `$('<name>').item` (linked item), `.first(branchIndex?, runIndex?)`, `.last()`, `.all()`, `.params`, `.context`, and `.itemMatching(i)` for Code nodes — [Reference previous nodes](https://docs.n8n.io/build/work-with-data/reference-data/reference-previous-nodes).
- Root helpers include `$execution`, `$fromAI(key, description?, type?, defaultValue?)`, `$if()`, `$ifEmpty()`, `$itemIndex` and more; type-specific method references cover array, string, number, object, boolean, date and binary — [Expression reference](https://docs.n8n.io/build/work-with-data/transform-data/expression-reference/root).
- Python isn't available in expressions — [Reference previous nodes](https://docs.n8n.io/build/work-with-data/reference-data/reference-previous-nodes).
- Common errors: referencing an unexecuted node ("Referenced node is unexecuted"), with `$("<name>").isExecuted` as the guard — [Expressions](https://docs.n8n.io/build/work-with-data/transform-data/expressions-for-data-transformation).
- Best practice from n8n: prepare data in Edit Fields (Set) instead of scattering complex expressions across nodes — [Expressions](https://docs.n8n.io/build/work-with-data/transform-data/expressions-for-data-transformation).
- Engines: `N8N_EXPRESSION_ENGINE` defaults to `vm` on the backend. The editor still defaults to `legacy`, with `quickjs` recommended. `legacy` runs without isolation and is slated for deprecation — [Expression engine](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/expression-engine).
- Data types: items are JSON, and conditions expose String, Number, Date & Time, Boolean, Array and Object — [If](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if). Sub-workflow inputs may declare types, with an "Attempt to convert types" option — [Execute Sub-workflow](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow).
- **Binary:** carried under the `binary` key by named property, default `data` — [Reference previous nodes](https://docs.n8n.io/build/work-with-data/reference-data/reference-previous-nodes). Dedicated nodes are Convert to File, Extract From File, Read/Write Files from Disk, Compression, Edit Image, and FTP — [Files and images](https://docs.n8n.io/build/work-with-data/handle-special-data-types/work-with-files-and-images).
- **Binary storage modes:** `default` (memory), `filesystem`, `database` (per-file cap 512 MiB, hard max 1024), `s3`, `azure` — [Binary data env vars](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/binary-data). In-memory mode is removed in 3.0 — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes).
- Sources partly conflict on binary in queue mode: [Handle binary data](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/handle-binary-data) says use `database`, while [Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode) points to S3 for persistence. Both agree filesystem isn't supported with queue mode.
- Pinned data can't include binary — [Pin and mock data](https://docs.n8n.io/build/work-with-data/pin-and-mock-data).

### Inferences
- Referencing by node name means a rename must rewrite expressions. A stable ID reference plus a display label would avoid this fragility.
- Arbitrary JavaScript in expressions forces a sandbox. n8n's multiple engines show how costly it is to retrofit that sandbox, so FlowBridge should choose its expression language and isolation up front.

### Gaps
- Rename-rewrite behaviour: not covered in the pages read.
- Expression evaluation resource limits (time, memory): not read.

## Connections and credentials

### Takeaway
A credential is an encrypted, reusable record belonging to a user or project, defined by a declarative credential-type class. Encryption uses an instance master key; with key rotation (on by default from 3.0) that master key protects rotatable data keys. OAuth tokens live inside the same record and are refreshed on demand by the request helper when the API signals expiry.

### Cited Findings
**Flows**
- Credentials are created from a menu or from a node's dropdown, in personal space or a project. n8n tests them on save — [Credentials](https://docs.n8n.io/build/understand-workflows/create-and-edit-credentials).
- API-key style: the credential file declares `properties` (form fields), `authenticate` (injects into `header`, `qs`, `body`, or `auth` via expressions such as `={{$credentials.apiKey}}`), and `test` (a request used to verify) — [Credentials files](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/credentials-files).
- OAuth: the user registers n8n's OAuth Redirect URL with the service, then uses a "Connect" flow — [HTTP Request credentials](https://docs.n8n.io/integrations/builtin/credentials/httprequest), [End-user credentials](https://docs.n8n.io/administer/manage-credentials/end-user-credentials).
- **Credential overwrites** (self-hosted) set fields such as client secrets globally so users only see a "Connect" button. Docs recommend a REST endpoint over an environment variable, which can leak — [Credential overwrites](https://docs.n8n.io/administer/manage-credentials/credential-overwrites).

**Storage and encryption**
- A random key is created on first launch and stored in `~/.n8n`, or set by `N8N_ENCRYPTION_KEY`; workers must share it — [Encryption key](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/set-a-custom-encryption-key).
- Two-layer model: the instance key never changes and only protects data encryption keys. Data keys encrypt credentials and OAuth tokens and are stored encrypted in the database. Rotation creates a new key for future writes; old records remain readable and re-encrypt lazily on update. Stored format includes a key ID. It's self-hosted only, off by default on 2.x and on by default in 3.0. There's no downgrade path once data is written in the new format — [Rotate keys](https://docs.n8n.io/deploy/host-n8n/configure-n8n/security/rotate-encryption-keys).
- Source has `CipherAes256CBC` (MD5-based key derivation, legacy) and `CipherAes256GCM` — [cipher.ts](https://github.com/n8n-io/n8n/blob/master/packages/core/src/encryption/cipher.ts), [aes-256-cbc.ts](https://github.com/n8n-io/n8n/blob/master/packages/core/src/encryption/aes-256-cbc.ts).
- External vaults: 1Password Connect, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, HashiCorp Vault, Infisical (Enterprise). Secrets resolve only in credential fields, and vaults can be global or per-project — [External secrets](https://docs.n8n.io/administer/manage-credentials/use-external-secret-stores).

**Token refresh** (source; not described in user docs)
- A request that receives the expired status (default 401, configurable per credential or node with `tokenExpiredStatusCode`) triggers a refresh. Before refreshing, n8n re-reads the decrypted credential; if the stored token has changed, another process already refreshed it, so that token is used. Client-credentials grants fetch a new token. Revoked or expired refresh tokens produce a specific error asking for reconnection. New tokens persist through `updateCredentialsOauthTokenData` — [oauth.ts](https://github.com/n8n-io/n8n/blob/master/packages/core/src/execution-engine/node-execution-context/utils/request-helpers/oauth.ts), [credentials-helper.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/credentials-helper.ts).

**Sharing and runtime identity**
- Sharing gives the **Can use** role: run and publish with it, but not view or edit. Instance owners and admins can view and share all. Project role decides access for project-held credentials. Available on all Cloud plans and self-hosted Business and Enterprise — [Share credentials](https://docs.n8n.io/administer/manage-credentials/share-credentials-securely).
- **Acting user:** a manual run acts as the person who pressed Execute; a triggered run acts as whoever last published the workflow — [Personal credentials](https://docs.n8n.io/administer/manage-credentials/use-personal-credentials-in-projects).
- If an execution used a credential you can't use, its data is hidden from you, with status and timing still visible — [Understand executions](https://docs.n8n.io/build/understand-workflows/understand-executions).
- **End-user credentials** (Enterprise, Preview, OAuth only, team projects only): one template, one connection per user. Resolves to the triggering user at runtime (manual, Chat Hub, MCP, or webhook/form/chat with n8n User Auth). Other users, including admins, see redacted output — [End-user credentials](https://docs.n8n.io/administer/manage-credentials/end-user-credentials).
- **Allowed HTTP Request Domains** (All, Specific, None) stops a credential being sent to arbitrary URLs through the HTTP Request node — [Credentials](https://docs.n8n.io/build/understand-workflows/create-and-edit-credentials).
- Credential fields accept expressions evaluated per execution, enabling dynamic credentials — [Credentials](https://docs.n8n.io/build/understand-workflows/create-and-edit-credentials).

### Inferences
- The re-read check before refresh is a useful pattern: it solves the race between concurrent workers refreshing the same token, without a distributed lock.
- The domain allowlist and execution-data hiding exist because a "Can use" holder could otherwise exfiltrate a secret through an HTTP node or through run data. FlowBridge will face the same two leak paths.

### Gaps
- Whether n8n refreshes proactively before expiry, as well as on expired status: `n8n_expires_at` is stored, but I did not confirm a proactive path.
- Which cipher is the default for new data keys: both classes exist, and I did not confirm the active default.
- Cloud key management (customer vs n8n-held): rotation is not available on Cloud, and nothing further is documented in pages read.

## Integrations

### Takeaway
Marketing says "2,000+"; the repo holds a few hundred first-party node files. A connector is a TypeScript class in an npm package, written declaratively (JSON routing) for REST or programmatically for everything else. The generic HTTP Request node, with reuse of existing credentials, covers the long tail.

### Cited Findings
- Counts differ by source:
  - The integrations page says "Browse 2,000+ integrations" and its listing shows "2629 integrations" — [n8n.io/integrations](https://n8n.io/integrations/).
  - `nodes-base/package.json` lists 443 node entries and 413 credential entries; `@n8n/nodes-langchain` lists 127 nodes — [nodes-base package.json](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/package.json), [nodes-langchain package.json](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/package.json).
  - The docs index has 312 app-node, 108 trigger-node, 332 credential, 113 cluster-node and 81 core-node lines, which include some sub-pages — [llms.txt](https://docs.n8n.io/llms.txt).
- **Connector anatomy:** node file, credentials file, codex file, and version rules — [Node reference index](https://docs.n8n.io/connect/create-nodes/overview), [Credentials files](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/credentials-files).
- **Two styles:**
  - **Declarative** (default): JSON-based, `routing` per operation, no `execute()`, REST only.
  - **Programmatic:** required for all trigger nodes, non-REST (including GraphQL), external dependencies, and complex transforms.
  - Both can coexist in one package — [Building style](https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-a-node-building-style).
- **Versioning:** a saved workflow keeps the node version it was built with, and new workflows get the latest. Declarative nodes can't use full versioning (only light) — [Versioning](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/versioning).
- **Custom and community:**
  - npm package named `n8n-nodes-*` or `@scope/n8n-nodes-*`, keyword `n8n-community-node-package`, nodes and credentials declared in the `package.json` `n8n` attribute, built with the `n8n-node` CLI. Verification goes through the Creator Portal and needs a GitHub Actions provenance publish — [Submit community nodes](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes).
  - Community nodes get full access to the host machine, per the docs. n8n vets the verified subset — [Risks](https://docs.n8n.io/integrations/community-nodes/risks).
  - In 3.0, unverified packages are off by default — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes).
- **Generic HTTP Request node:** import cURL; predefined credential type (reuses a node's credential for custom calls) or generic auth (Basic, Custom, Digest, Header, OAuth1, OAuth2, Query, Simplified Custom); batching; built-in pagination; usable as an AI tool — [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest).
- MCP: n8n can both expose workflows and connect to MCP servers — [MCP servers](https://docs.n8n.io/build/integrate-ai/mcp-servers), [n8n MCP server](https://docs.n8n.io/connect/connect-to-n8n-mcp-server).

### Inferences
- The "2,629" likely mixes first-party nodes, community nodes, and credential-only entries. Which is included isn't stated, so treat it as marketing.
- Community nodes running with host access is a real risk. FlowBridge should isolate third-party connector code from day one, and the 3.0 default-off move supports this view.

### Gaps
- Breakdown of the integrations count by first-party vs community: not stated.

## Testing and debugging

### Takeaway
The editor is a live debugger: run all or part of a graph, see each node's input and output, freeze any node's output with pinning, and pull a failed production run's data back into the canvas.

### Cited Findings
- **Manual execution:** the Execute button runs the whole workflow and shows data in the editor. Doesn't count toward quota — [Types of executions](https://docs.n8n.io/build/understand-workflows/understand-executions/types-of-executions).
- **Partial execution:** "Execute step" runs a node plus the preceding nodes needed for its input. It needs a connected trigger. It can fail with "Existing execution data is too large" on many-branch workflows, because the data is sent to the backend — [Types of executions](https://docs.n8n.io/build/understand-workflows/understand-executions/types-of-executions).
- **Dirty nodes:** successful nodes whose output is now stale, flagged yellow, and potential partial-execution start points. Triggers: editing parameters, inserting or deleting, adding a connector, deactivating, or pin changes. A dirty node inside a loop also marks the loop's first node dirty — [Dirty nodes](https://docs.n8n.io/build/understand-workflows/understand-executions/understand-dirty-nodes).
- **Pinning:** saved output replaces execution of that node on later manual runs. It can be edited for edge cases. Only for single main-output nodes, no binary, and production ignores it — [Pin and mock data](https://docs.n8n.io/build/work-with-data/pin-and-mock-data).
- **Deactivating** a node temporarily skips it, and the Limit node can bound data during tests — [Types of executions](https://docs.n8n.io/build/understand-workflows/understand-executions/types-of-executions).
- **Debug in editor / Copy to editor:** from a past execution, copies the data into the current workflow and pins it to the first node. Available on all Cloud plans and self-hosted Registered Community and up — [Debug executions](https://docs.n8n.io/build/understand-workflows/understand-executions/debug-executions).
- **Test triggers:** a Form "Execute Step" runs only that node, and "Execute Workflow" runs everything — [Form Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger).
- **AI evaluations:** light evaluations against test cases, and metric-based evaluations with their own concurrency (Community/Pro 1, Business 3, Enterprise 5) — [Quick evaluations](https://docs.n8n.io/build/integrate-ai/test-and-improve-ai-workflows/run-quick-evaluations), [Control concurrency](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/control-concurrency).
- Docs advise unpublishing while manually testing — [Understand executions](https://docs.n8n.io/build/understand-workflows/understand-executions).

### Inferences
- Pinning on the trigger node turns one captured webhook into a repeatable test fixture. Combined with debug-in-editor, a real failure becomes a test case in two clicks. This is the feature most worth matching.

### Gaps
- Automated regression testing outside AI evaluations (assertions, CI runs): not found in pages read.

## Publishing and versioning

### Takeaway
n8n uses a draft and publish model. Edits autosave as versions, and production always points at one published version. Multi-instance promotion runs through Git, and a new Environments feature is in Preview alongside the older source control.

### Cited Findings
- **Autosave:** edits save within roughly 1–5 seconds and stay draft until publish. Production executions use the published version — [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows).
- **Publishing is asynchronous and diffs triggers:** only changed triggers re-register, and unchanged ones keep running without interruption. Button states are Publishing, Published up to date, Published with changes, Published invalid, Published error, Published partial (some triggers failed, workflow keeps running the rest), and Failed to publish (no triggers activated). State is stored on the server — [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows).
- Settings-only changes republish automatically and don't create a version — [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows), [Change history](https://docs.n8n.io/build/manage-workflows/view-change-history).
- **Editing lock:** only one person edits at a time; others get read-only until the lock releases — [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows).
- **Version history:** restore (saves the latest first), clone, open in a new tab, download JSON, and name. Named versions are never pruned (Cloud Pro and up; self-hosted Business and up). Retention is 24 hours for all, 5 days on Cloud Pro, full on Enterprise — [Change history](https://docs.n8n.io/build/manage-workflows/view-change-history).
- Restore lets you work on a version without affecting production — [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows).
- **Workflow reviews** (Enterprise, Preview, from 2.37.0): submit a specific version, visual diff, comments, and auto-publish on approval. Reviews cover only nodes and connections, not settings, credentials, variables, data tables or sub-workflows. No notifications are sent — [Workflow reviews](https://docs.n8n.io/build/manage-workflows/workflow-reviews).
- **Environments (Enterprise, Preview, replacing Environments Classic):** separate instances per environment. Promote to a Git branch, optional review, then Apply on target. Includes dependencies, but never credential secrets, data table rows or executions; variables travel with values. An instance apply overwrites all team projects and deletes those absent — [Environments](https://docs.n8n.io/administer/environments).
- Known limits: no multi-main, no log streaming of these events, only instance owners and admins, only Generic Git and GitLab providers, personal projects excluded — [Known limitations](https://docs.n8n.io/administer/environments/known-limitations).
- **Source control (Classic):** Business and Enterprise. Owners and admins push and pull; project admins push only — [Understand source control](https://docs.n8n.io/administer/use-source-control-and-environments/understand-source-control).
- Pull can override local work, and new credentials and variables arrive as stubs. Auto publish on pull is Off, If already published, or On. n8n advises one direction per instance. Deleted repo items are flagged, not auto-deleted — [Push and pull](https://docs.n8n.io/administer/use-source-control-and-environments/push-and-pull-changes).
- Version history lives in the instance database, not Git — [Change history](https://docs.n8n.io/build/manage-workflows/view-change-history).

### Inferences
- The separate-instance environment model puts environment isolation at the deployment level. FlowBridge could offer lighter environments within one tenant, but must solve credential and URL differences itself. This is a design choice worth considering.
- Reviews excluding credentials and settings is a real governance hole that FlowBridge can address.

### Gaps
- Whether a running execution finishes on the old version after a new publish: implied by the execution_data table storing "the workflow at time of running", but not stated directly.

## Execution engine

### Takeaway
Two modes. **Regular:** the main process runs everything. **Queue:** main produces, Redis (Bull) brokers execution IDs, and workers load from Postgres, run, and write results back. Scale by adding workers, webhook processors, and (Enterprise) multiple mains.

### Cited Findings
**Flow in queue mode**
1. Main handles a trigger or webhook and creates an execution without running it. 2. It sends the execution ID to Redis. 3. A worker takes the message. 4. It loads the workflow from the database. 5. It saves results and reports to Redis. 6. Redis notifies main — [Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode).
- The queue library is Bull, with default queue name `jobs` — [scaling.service.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/scaling/scaling.service.ts), [queue-name.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/scaling/queue-name.ts). Jobs have priority 50 when `realtime`, otherwise 100 — [workflow-runner.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/workflow-runner.ts).
- Source has named **worker pools** (`jobs-<pool>`) — [queue-name.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/scaling/queue-name.ts). I found no mention in the queue-mode docs or env var page.
- An `engine-v2` module with control-plane and data-plane clients is in source; no README exists — [engine-v2 directory](https://github.com/n8n-io/n8n/tree/master/packages/cli/src/modules/engine-v2).

**Workers and leases**
- `n8n worker --concurrency=N`, default 10; n8n recommends 5 or higher, since low values across many workers can exhaust the DB pool. Graceful shutdown default is 30 s (`N8N_GRACEFUL_SHUTDOWN_TIMEOUT`) — [Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode).
- Lease 60 s (`QUEUE_WORKER_LOCK_DURATION`), renew 10 s, stalled-job check 30 s — [Queue env vars](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/queue-mode).
- Webhook processors (`n8n webhook`) sit behind a load balancer, and main shouldn't be in that pool. Large responses relay through Redis up to `N8N_WEBHOOK_RESPONSE_RELAY_SIZE_MAX` (64 MiB), with offload to binary storage from 2.34.0 — [Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode).
- **Multi-main** (self-hosted Enterprise only per the queue-mode page; pricing says "Coming soon" on Enterprise, see the pricing section): followers handle API, UI, webhooks; leader runs at-most-once tasks such as timers, pollers, pruning. Leader key TTL is 10 s, with sticky sessions — [Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode).
- Manual executions run on main by default in 2.x (`OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=false`) — [Queue env vars](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/queue-mode). In 3.0 they always run on workers — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes).

**Concurrency**
- Regular mode has no limit by default. `N8N_CONCURRENCY_PRODUCTION_LIMIT` queues excess in FIFO order. Applies only to production executions, not manual, sub-workflow, error, or CLI. Queued runs can't be retried, and they resume or re-enqueue on startup. In queue mode the same variable overrides `--concurrency` — [Control concurrency](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/control-concurrency).
- Cloud limits are per plan and instance-wide; queue mode is available on Cloud Enterprise on request — [Cloud concurrency](https://docs.n8n.io/deploy/use-n8n-cloud/understand-concurrency).

**Timeouts and memory**
- `EXECUTIONS_TIMEOUT` default −1 (none), `EXECUTIONS_TIMEOUT_MAX` default 3600 s per workflow — [Executions env vars](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/executions).
- In the main process, the timeout is soft: it takes effect after the current node finishes. In its own process, soft first, then kill after a further fifth of the timeout — [Workflow timeouts](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/configure-workflow-timeouts).
- Cloud RAM: Trial and Starter 640 MiB, Pro-1 640, Pro-2 1280, Enterprise 4096; up to 100 GB storage. Heavy workflows can crash the instance. n8n's own baseline is about 180 MiB — [Manage your data](https://docs.n8n.io/deploy/use-n8n-cloud/configure-cloud/manage-your-data).
- Cloud max execution duration: Starter 5 min, Pro and Enterprise 40 min — [Pricing](https://n8n.io/pricing/).

**Persistence and retention**
- Postgres is the distributed database; SQLite isn't supported for distributed setups — [Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode).
- `execution_data` stores the workflow at time of running plus run data; `execution_entity` holds saved executions — [Database](https://docs.n8n.io/deploy/host-n8n/understand-the-architecture/understand-the-database).
- `N8N_EXECUTION_DATA_STORAGE_MODE` is `database` (default), `filesystem`, `s3`, or `azure` — [Executions env vars](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/executions).
- **Pruning:** on by default. Soft delete, then hard delete after a buffer. Triggers are age above 336 h (14 days) or count above 10,000, oldest first. `new`, `running`, `waiting` and annotated executions are exempt. Soft-delete runs every 60 min, hard-delete every 15 min — [Manage execution data](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/manage-execution-data), [Executions env vars](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/executions).
- Per-workflow save settings cover failed, successful, manual, and per-node progress — [Workflow settings](https://docs.n8n.io/build/manage-workflows/configure-workflow-settings).
- System tasks (pruning, compaction, licence) run as Leader timer or Instance timer modes, among others — [System tasks](https://docs.n8n.io/deploy/host-n8n/configure-n8n/system-tasks).
- Self-hosted 3.0 requires Docker; npm install is dropped — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes).

### Inferences
- Passing only an execution ID through the queue keeps Redis small and makes Postgres the single source of truth. Workers then depend heavily on the database, which is why n8n warns about connection pool exhaustion.
- Holding run data in memory in one process, plus low Cloud RAM, is the practical scaling ceiling. n8n's "use sub-workflows to save memory" advice is a workaround for this.
- `engine-v2` and its plane split suggest a future engine re-architecture; I found no documentation confirming intent.

### Gaps
- Internal details of `nodeExecutionStack` scheduling are not documented for users; only source shows them.
- Exactly-once guarantees and duplicate-run behaviour after worker crash: `QUEUE_WORKER_MAX_STALLED_COUNT` was removed in 2.0, but the guarantee isn't stated in pages read.
- Per-tenant fairness: none documented. Each Cloud customer has its own instance (implied by "instance" limits).

## Error handling

### Takeaway
There are four layers: node-level retry and on-error routing, an error output branch, a per-workflow error workflow, and after-the-fact retry from saved state. n8n's own docs warn that retries are at-least-once for the failed node.

### Cited Findings
- **Node settings:** Retry On Fail; On Error of Stop Workflow, Continue (next node using last valid data), or Continue (using error output, a dedicated branch); Always Output Data, which can cause infinite loops on If nodes — [Work with nodes](https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes).
- **Retry limits (source):** max tries are clamped to 2–5, default 3; wait is clamped to 0–5000 ms, default 1000. Docs wording "reruns until it succeeds" doesn't reflect the cap — [workflow-execute.ts](https://github.com/n8n-io/n8n/blob/master/packages/core/src/execution-engine/workflow-execute.ts). No exponential backoff appears in that code path.
- 3.0 changes Always Output Data on multi-output nodes: an empty item only if every output is empty — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes).
- **Error workflow:** set per workflow, must start with Error Trigger, reusable across workflows. Payload has `execution.{id,url,retryOf,error,lastNodeExecuted,mode}` and `workflow.{id,name}`. A trigger failure sends instead a `trigger{error,mode}` object with `WorkflowActivationError`. Not counted toward quota — [Error handling](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully), [Understand executions](https://docs.n8n.io/build/understand-workflows/understand-executions).
- **Stop And Error** node forces a failure on your own conditions and triggers the error workflow — [Error handling](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully).
- **Retry of a failed execution:** options are "with currently saved workflow" or "with original workflow".
  - Resumes from saved state; completed nodes keep results.
  - The failed node **reprocesses every item**, including those it handled before failing, so duplicates are possible. n8n recommends upsert operations.
  - A failed Execute Sub-workflow reruns the whole child.
  - Each retry is a new execution, and retrying both an original and a failed retry can repeat work.
  - Successful executions can't be retried; use Copy to editor, which reruns everything after the first node.
  - Only stored executions can be retried. Credentials load at retry time — [View all executions](https://docs.n8n.io/build/understand-workflows/understand-executions/view-all-executions).
- "Save execution progress": per-node data saved so a workflow resumes from where it stopped, at some latency cost — [Workflow settings](https://docs.n8n.io/build/manage-workflows/configure-workflow-settings).
- Crash handling: optional `N8N_WORKFLOW_AUTODEACTIVATION_ENABLED` unpublishes a workflow after 3 crashed executions (default off) — [Executions env vars](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/executions). Recovery marks `new`, `running`, `unknown` as `crashed` — [execution-status.ts](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/execution-status.ts).

### Inferences
- Item-level checkpointing inside a node is the obvious missing piece. FlowBridge could track per-item success and retry only failed items, which would remove a major documented duplicate risk.
- A capped retry of five attempts and five seconds is too short for real outages. Durable retries with backoff would be a clear improvement.

### Gaps
- Automatic workflow-level retry policy: none found in pages read, only manual retry (or a self-built error workflow).
- Bulk retry UI: not described in pages read.
- Dead-letter concept: none found.

## Monitoring

### Takeaway
Execution lists serve day-to-day use, Insights provides aggregated metrics, and log streaming, Prometheus and OpenTelemetry feed external tooling. Alerting is mostly left to the user, through error workflows or external tools.

### Cited Findings
- **Lists:** per-workflow and all-workflows, filtered by workflow, status (Failed, Running, Success, Waiting), start time, and saved custom data (Cloud Pro and up, self-hosted Registered Community and Enterprise). Deleting a workflow deletes its execution history — [View all executions](https://docs.n8n.io/build/understand-workflows/understand-executions/view-all-executions).
- **Internal statuses:** `canceled, crashed, error, new, running, success, unknown, waiting` — [execution-status.ts](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/execution-status.ts).
- **Custom data:** set metadata from a Code node to make runs searchable — [Customize executions data](https://docs.n8n.io/build/understand-workflows/understand-executions/customize-executions-data).
- **Insights:**
  - Metrics are total production executions, failures, failure rate, time saved, and average run time (including waits).
  - A 7-day banner is on all plans. The dashboard is Cloud Pro and up, self-hosted Business and up.
  - Ranges: Pro 7/14 days; Business to 30 days; Enterprise to 1 year.
  - Stored hourly, then compacted to day and week. Retention default 365 days, cap 730.
  - Time saved is fixed or dynamic through Time Saved nodes — [Insights](https://docs.n8n.io/administer/observe-and-log/track-usage-with-insights).
  - Excludes manual and sub-workflow runs. Available from 1.89.0 — [Insights](https://docs.n8n.io/administer/observe-and-log/track-usage-with-insights).
- **Log streaming** (Enterprise): destinations are webhook, syslog, Sentry. Event groups: Workflow (started, success, failed, cancelled), Node (started, finished), Audit, Worker, AI node logs, Runner, Queue, MCP. Events persist to a local log file first, so undelivered ones re-emit after restart, with a circuit breaker option. `anonymizeAuditMessages` masks email and name — [Log streaming](https://docs.n8n.io/administer/observe-and-log/stream-logs-to-external-systems).
- **Health and metrics:** `/healthz`, `/healthz/readiness` (DB connected and migrated), `/metrics` (off by default, self-hosted only) — [Monitor n8n](https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/monitor-n8n).
- **OpenTelemetry** (Preview from 2.19.0): `workflow.execute` span per execution with node spans, plus custom span attributes — [OpenTelemetry](https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/trace-executions-with-opentelemetry).
- **Redaction** (Enterprise, 2.16.0 per workflow, 2.26.0 instance-wide): hides input and output while keeping status, timing and node names — [Redact execution data](https://docs.n8n.io/deploy/host-n8n/configure-n8n/security/redact-execution-data).

### Inferences
- Combining error workflow and Slack or email is the de facto alerting mechanism. Built-in alert rules (failure rate thresholds, per-workflow notifications) would be a differentiator.

### Gaps
- Native alerting or threshold rules: none found in pages read.

## Administration

### Takeaway
Two role layers: instance roles (Owner, Admin, Member, Chat user) and project roles (Admin, Editor, Viewer), with custom roles on Enterprise. Projects are the isolation unit. Feature gates are complex and vary between Cloud and self-hosted.

### Cited Findings
- **Instance roles:** Owner, Admin (Cloud Pro and up; self-hosted Enterprise per docs), Member, Chat user. Owners and admins see and share all workflows and credentials, manage users, create projects and use source control. Only Owner reaches the Cloud console. n8n recommends owners also hold a Member account, partly because "there is no way to see who created a particular workflow" — [Instance roles](https://docs.n8n.io/administer/manage-users-and-access/understand-instance-roles).
- **Project roles:** Admin (settings, members, plus all content), Editor (view, create, update, delete, execute; Cloud Pro, self-hosted Enterprise), Viewer (read only, can't run; Enterprise). Variables and tags sit outside RBAC, as global — [Available roles](https://docs.n8n.io/administer/manage-users-and-access/set-permissions-and-roles-rbac/see-available-roles).
- **Projects:** group workflows and credentials, with roles per project. Instance owners and admins create them. On deletion, content transfers or deletes. RBAC is on all Cloud plans and self-hosted Registered Community and up, with varying counts — [Projects](https://docs.n8n.io/administer/manage-users-and-access/set-permissions-and-roles-rbac/organize-work-in-projects).
- Community edition has no projects per the editions page — [Compare editions](https://docs.n8n.io/deploy/host-n8n/community-edition-features). This conflicts with the RBAC availability line just above; the likely reading is Registered Community gets a limited version.
- **Custom roles:** project and instance level, Enterprise — [Custom roles](https://docs.n8n.io/administer/manage-users-and-access/set-permissions-and-roles-rbac/create-custom-roles).
- **Workflow sharing:** direct user sharing only from Personal space; project workflows are shared through project membership — [Share with others](https://docs.n8n.io/build/manage-workflows/share-with-others).
- **Identity:** 2FA, LDAP, SAML, OIDC — [Verify identity](https://docs.n8n.io/administer/manage-users-and-access/verify-user-identity). SAML on Business and Enterprise — [SAML](https://docs.n8n.io/administer/manage-users-and-access/verify-user-identity/use-saml); OIDC on Enterprise — [OIDC](https://docs.n8n.io/administer/manage-users-and-access/verify-user-identity/use-oidc). The public API has resources for role mapping rules, SSO settings, security policy, node type policy and credential type policy — [llms.txt API section](https://docs.n8n.io/llms.txt).
- **Audit, two different things:**
  - "Security audit" (`n8n audit`, `POST /audit`, n8n node) is a one-off risk report on credentials, database, filesystem, nodes, and instance — [Security audits](https://docs.n8n.io/deploy/host-n8n/configure-n8n/security/run-security-audits).
  - Activity audit events (logins, credential and workflow changes, API keys, MFA, packages, variables) are delivered through log streaming — [Log streaming](https://docs.n8n.io/administer/observe-and-log/stream-logs-to-external-systems). Pricing lists "Audit logging" as Enterprise — [Pricing](https://n8n.io/pricing/).
- **Free tier:** Community edition excludes custom variables, environments, external secrets, external binary storage, log streaming, multi-main, projects, SSO, sharing, Git. Registered Community adds folders, debug in editor, custom execution data — [Compare editions](https://docs.n8n.io/deploy/host-n8n/community-edition-features).
- Hardening options include `NODES_EXCLUDE`, SSRF protection (larger default blocklist in 3.0), and credential or node type policy — [Security index](https://docs.n8n.io/deploy/host-n8n/configure-n8n/security), [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes).

### Inferences
- Tenancy is "one instance per customer", with projects inside. A multi-tenant FlowBridge has to design org isolation that n8n gets from deployment.

### Gaps
- An in-app audit-log viewer: not found; audit appears to depend on streaming to an external system.
- SCIM provisioning: not found in pages read.
- Admin role on self-hosted Business: docs say Enterprise only, while pricing lists Business as a superset of Pro's "admin roles". Unresolved.

## Templates, AI features, limits and pricing

### Takeaway
Pricing charges per **workflow execution**, regardless of step count or data volume, which is n8n's core commercial message. AI is billed separately through credits. The self-hosted Community edition is free.

### Cited Findings
**Templates**
- Start from a template via the library on the n8n website, submit through the Creator Dashboard, or self-host a private library with `N8N_TEMPLATES_HOST` and matching API endpoints — [Use templates](https://docs.n8n.io/build/ways-of-building-workflows/use-templates).
- n8n Packages exist for export and import of bundled workflows — [llms.txt](https://docs.n8n.io/llms.txt).

**AI**
- **Node level:** AI Agent, chains, memory, tools, vector stores as cluster nodes; `$fromAI()` lets the model fill parameters — [AI](https://docs.n8n.io/build/integrate-ai), [Expression reference](https://docs.n8n.io/build/work-with-data/transform-data/expression-reference/root).
- **n8n Assistant:** chat agent that plans, builds, tests and fixes real workflows. Cloud Starter and Pro; self-hosted Community to Business; limited enterprise readiness — [n8n Assistant](https://docs.n8n.io/build/ways-of-building-workflows/n8n-assistant).
- **AI Workflow Builder:** natural language to workflow, with `/clear` — [AI Workflow Builder](https://docs.n8n.io/build/ways-of-building-workflows/ai-workflow-builder).
- **Agents** (Preview; all plans; self-hosted from 2.32.3): first-class project artifacts with model, instructions, tools, skills and knowledge base, reachable through chat, channels, schedules, MCP and a "Message an Agent" node — [Agents](https://docs.n8n.io/build/build-and-manage-agents).
- **Chat Hub:** central chat with a Chat user role — [Chat Hub](https://docs.n8n.io/build/ways-of-building-workflows/chat-hub). Off by default in 3.0, to be removed in 4.0 — [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes).
- **MCP server:** clients search, trigger and test workflows and create and edit workflows and data tables, at a URL ending `/mcp-server/http` — [n8n MCP server](https://docs.n8n.io/connect/connect-to-n8n-mcp-server).

**Credits**
- **Assistant credits:** token-based. Plan allowance resets on the 1st of the month at midnight UTC with no rollover; extras carry over. Used only for Assistant, not workflow runs — [Assistant credits](https://docs.n8n.io/deploy/use-n8n-cloud/assistant-credits). The Workflow Builder page describes a different model (one interaction = one credit, failures don't count) — [AI Workflow Builder](https://docs.n8n.io/build/ways-of-building-workflows/ai-workflow-builder). These two sources may describe different generations of the feature.
- **Gateway credits:** prepaid balance, routed through an n8n gateway, billed per request. Covers models (OpenAI, Anthropic, Gemini) and tools (Brave Search, Firecrawl). Cloud Starter and Pro, from 2.36.0 — [Gateway credits](https://docs.n8n.io/deploy/use-n8n-cloud/gateway-credits).

**Plans**, from [Pricing](https://n8n.io/pricing/), page shows € only and annual prices (monthly toggle, "Save 17%"):

| | Starter | Pro | Business | Enterprise |
|---|---|---|---|---|
| Price (billed annually) | €20/mo | €50/mo | €667/mo | Contact sales |
| Hosting | n8n | n8n | Self-hosted only (Cloud waitlist) | Either |
| Executions/month | 2.5K | 10K | 40K | Custom |
| Concurrency | 5 | "Up to 50" on card, "20 / 50" in table | not listed | 200+ |
| Shared projects | 1 | 3 | 6 | Unlimited |
| Active workflows | Unlimited | Unlimited | Unlimited | Unlimited |
| Workflow history | 1 day | 5 days | not in table | 365+ days |
| Execution log retention | 7 days | 30 days | not in table | Unlimited |
| Max saved executions | 2.5k | 25k | not in table | 50k |
| Saved execution storage | 2.5 GB | 25 GB | not in table | 50 GB |
| Max execution duration | 5 min | 40 min | not in table | 40 min |
| Insights | "None" in table (docs: 7-day banner on all plans) | 7 days | 30 days | 365 days |
| Assistant credits | 1,600/mo | up to 9,600/mo | | on request |

- **What counts:** "An execution is a single run of your entire workflow", with step count and data volume irrelevant. Examples: daily schedule ≈ 30–31 a month; every 5 minutes ≈ 8,600–8,900 — [Pricing](https://n8n.io/pricing/).
- **By trigger:** schedule fires count even on failure, polls only when new data arrives, webhooks per request (including empty body; malformed don't count). Manual, sub-workflow, and error workflow runs don't count — [Understand executions](https://docs.n8n.io/build/understand-workflows/understand-executions).
- **Over quota:** workflows keep running, and overage charges may apply. Starter and Pro overage is listed as "Capped". Saved-execution limits delete oldest rather than stopping work — [Pricing](https://n8n.io/pricing/).
- **Trial:** no card, 1,000 executions, 5 concurrent, 180-second timeout, 1 team project, 800 Assistant credits, 100 AI credits. Business trial is 14 days with card. Startup plan is 50% off Business for under 20 employees. Business keys work on unlimited instances against a shared quota. Data in EU (Frankfurt) — [Pricing](https://n8n.io/pricing/). Docs: "14 days" with Pro features — [Choose how to use n8n](https://docs.n8n.io/choose-how-to-use-n8n).
- **Conflicts on plan details:**
  - Multi-main is "Coming soon" on pricing, but documented as available on self-hosted Enterprise — [Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode).
  - Queue mode appears as a Business feature on pricing but "is included" in Community — [Compare editions](https://docs.n8n.io/deploy/host-n8n/community-edition-features).
  - Cloud docs list Pro-1 (10k) and Pro-2 (50k) memory tiers — [Manage your data](https://docs.n8n.io/deploy/use-n8n-cloud/configure-cloud/manage-your-data) — and the FAQ mentions 4,000 credits on smaller Pro plans, while the pricing page shows no Pro tier selector.
  - The comparison table omits the Business column, so SSO and Git appear Enterprise-only in the table but are on the Business card.
- **Community Edition price:** free — [Compare editions](https://docs.n8n.io/deploy/host-n8n/community-edition-features). The pricing page says only that "a standard, self-hosted version" is on GitHub — [Pricing](https://n8n.io/pricing/).

**Other documented limits**
- Webhook payload 16 MB; data tables 200 MiB; 512 MiB per file in database binary mode; execution duration, concurrency and RAM limits are in the engine section and the table above. Each is cited where it first appears.

### Inferences
- Per-run pricing rewards combining many steps in one workflow, and penalises chatty triggers such as chat (one execution per message) and frequent schedules. It is also cheap for n8n to explain. FlowBridge should decide deliberately between this model and per-step pricing.
- Not charging for polls with no data, sub-workflows, or error handlers removes incentives that would push users to poor designs. That part is worth copying.
- Rapid change to the AI product (Chat Hub retiring, Agents in Preview, separate credit models across pages) means AI details here are the most perishable section.

### Gaps
- Number of templates: the templates site did not expose a count in the HTML I retrieved.
- Overage rates: not on the public page.
- Monthly (non-annual) € prices: toggled in the page but not returned in the text I retrieved.
- USD prices: not shown (the page's text carries only €, apart from a mention of invoice forms in $).
- Exact Gateway credit rates: live on a separate service pricing page, not read.

## Needs user login

No page I needed for this research required a login; docs, pricing and source were all public, and I did not attempt to sign in anywhere. The items below are not blockers. They would only add confirmation that public pages can't give.

- **n8n Cloud app and console** — https://app.n8n.cloud — Would confirm the actual Usage and plan screen, the Pro tier selector (10k vs 50k), monthly prices and overage messaging at checkout, and how publishing states and the execution views look in the current UI.
