# Microsoft Power Automate cloud flows: how the product works end to end

Research date: 7 November 2026. Audience: the team designing FlowBridge. Scope: cloud flows, with desktop flows and process mining only in brief.

How to read these notes:

- "Cited Findings" are documented facts or Microsoft's own statements. "Inferences" are my reasoning. "Gaps" are things I could not find or did not verify.
- Findings tagged **[LA]** come from Azure Logic Apps documentation. Microsoft calls Logic Apps "the workflow engine for Power Automate" ([Connectors overview](https://learn.microsoft.com/en-us/connectors/overview)), and Power Automate pages link to it for retries and expression functions. However, the two products differ in places, so a [LA] finding is not automatically true for Power Automate. Differences are called out where I found them.
- Microsoft's pages contradict each other in several places. Each conflict is stated where it occurs, and the main ones are collected under "Execution".
- Most Learn pages were read in full. The pricing page came back as a summary from the fetch tool, so its prices should be checked on the live page before they are quoted externally. Findings marked "search result only" rest on a search summary and not on a page I read.

## Workflow model and terminology: flows, triggers, actions, connectors, connection references, solutions

### Takeaway
A cloud flow is a JSON workflow definition with one starting trigger and a graph of actions ordered by `runAfter`. Actions call connectors, which are OpenAPI-described API proxies. Credentials live in separate connection objects. Inside a solution, flows bind to an indirection called a connection reference, which is what makes them portable between environments.

### Cited Findings
- Microsoft lists three flow categories: cloud flows (triggered automatically, instantly, or by schedule), desktop flows (web and desktop UI automation), and generative actions (preview, intent-based) — [What is Power Automate](https://learn.microsoft.com/en-us/power-automate/flow-types).
- A trigger is the event that starts a cloud flow, and most connectors offer prebuilt triggers. The three trigger scenarios map to flow types: Automated, Instant/manual, Scheduled — [Triggers](https://learn.microsoft.com/en-us/power-automate/triggers-introduction).
- Each connector offers operations classified as actions and triggers. "All actions directly map to operations defined in an OpenAPI specification" — [Connector architecture](https://learn.microsoft.com/en-us/connectors/connector-architecture).
- The vocabulary is defined in one place. A connector is "a proxy or a wrapper around an API". A connection is "a stored authentication credential for a connector". A connection reference is "a solution component that contains a reference to a connection about a specific connector" — [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).
- Binding differs by flow kind. Flows created outside a solution use connections directly. Flows created in a solution use connection references, which point at connections. To change a connection for a solution flow, you edit the reference, not the flow — [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).
- On solution import, a connection is supplied for every connection reference, so referencing flows can be turned on automatically after import — [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).
- A connection reference has no limit on how many flows or actions can use it. References are saved asynchronously, with an info banner linking to update details — [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).
- Solution-aware flows are defined in Dataverse. That storage is why only they get drafts and version history — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).
- A solution's Objects tab shows components such as connection references, environment variables, and child flows — [Create a cloud flow in a solution](https://learn.microsoft.com/en-us/power-automate/create-flow-solution).
- An environment setting can make new flows solution-aware by default, and admins can bulk-add existing flows with the `Add-AdminFlowsToSolution` cmdlet. Some non-solution flows cannot be added — [Create a cloud flow in a solution](https://learn.microsoft.com/en-us/power-automate/create-flow-solution).
- Connectors are shared across Copilot Studio, Power Automate, Power Apps, and Logic Apps. Power Apps does not support triggers — [Connectors overview](https://learn.microsoft.com/en-us/connectors/overview); [Connector architecture](https://learn.microsoft.com/en-us/connectors/connector-architecture).
- Connections are shared with Power Apps: a connection created in one service appears in the other, and updating or deleting it affects both — [Manage connections](https://learn.microsoft.com/en-us/power-automate/add-manage-connections).
- Ownership is structural. For a non-solution flow, "the owner is part of the flow identity", so changing the owner means creating a new flow. Solution flows allow an in-place change — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows).

### Inferences
- The model has five separately managed layers: definition, connector (API contract), connection (secret), connection reference (late binding), and solution (deployment package). The two-tier flow model (solution versus non-solution) looks like historical debt that FlowBridge can avoid by making every workflow "solution-aware" from day one.
- Sharing one connection object across products makes credential rotation simple, but it also widens the impact of deleting one.

### Gaps
- I did not find a Microsoft statement that a cloud flow may have only one trigger. The workflow language permits up to 10 triggers, but only in code and not through the designer **[LA]** — [WDL schema](https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-schema). Whether Power Automate accepts this is not documented in what I read.

## Triggers: automated, instant, scheduled; polling versus push; trigger conditions

### Takeaway
There are two underlying mechanisms. Polling triggers are stateful: the runtime re-calls the connector using a location header that carries a watermark. Webhook triggers subscribe with a callback URL. The choice affects behaviour: after a flow is turned back on, polling catches up on missed events and webhooks do not. Trigger conditions filter before a run is created.

### Cited Findings
**Polling mechanism**
- Polling steps: the runtime calls the trigger; the connector calls the backend; the first call only establishes state and returns `202 Accepted` with a retry interval (in seconds) and a location header holding the state; later calls use that location header; with no new data the connector returns 202 again and the state is unchanged; with new data it returns `200 OK`, a new state in the location, and the array of new values, and the flow starts — [Use a polling trigger](https://learn.microsoft.com/en-us/connectors/custom-connectors/create-polling-trigger).
- A custom polling trigger is configured by choosing the query parameter that tracks state and an expression that advances it, for example `TripId gt @{triggerBody().value[0].TripId}`. The backend must return results reverse sorted, so the newest item is first, and the collection holding the trigger data is declared — [Use a polling trigger](https://learn.microsoft.com/en-us/connectors/custom-connectors/create-polling-trigger).
- Polling frequency depends on licence. Example values: 15 minutes on Free; 5 minutes on the Office 365 and Dynamics 365 plans. A run triggered sooner is queued until the interval elapses — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot).
- A polling trigger can be identified by the `recurrence` block with `interval` and `frequency` in its code view. The same page classes the `recurrence` trigger as polling — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot).

**Webhook mechanism**
- A webhook trigger in a connector definition needs three parts: a create operation, the incoming payload shape, and a delete operation. `"x-ms-trigger": "single"` makes the operation appear as a trigger, and `x-ms-notification-content` defines the payload — [Webhook trigger](https://learn.microsoft.com/en-us/connectors/custom-connectors/create-webhook-trigger).
- The connector POSTs to the service's create-webhook endpoint when a flow is created and again if the trigger is modified. A parameter is designated to receive the callback URL — [Webhook trigger](https://learn.microsoft.com/en-us/connectors/custom-connectors/create-webhook-trigger).
- The service must return a `Location` header in its 201 response. The platform uses that path to DELETE the webhook when the trigger is updated or the flow is deleted. The delete call reuses the same connection — [Webhook trigger](https://learn.microsoft.com/en-us/connectors/custom-connectors/create-webhook-trigger).

**Turn-off and resume behaviour**
- Polling: turning a flow off stops polling but does not deregister the trigger. On resume, it picks up from the last poll and processes all pending events. To skip the backlog, copy the flow and delete the original, which resets the trigger — [Optimize triggers](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/optimize-power-automate-triggers).
- Webhook: events that occur while the flow is off are not processed — [Optimize triggers](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/optimize-power-automate-triggers).

**Schedule and timing**
- Recurrence interval: minimum 60 seconds, maximum 500 days — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Recurrence is best effort and can miss by a few seconds, early or late — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot).
- Expressions in trigger inputs are evaluated only at save. `utcNow()` in a trigger input becomes a hardcoded value and is not recalculated on each firing — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot).
- Registration is a tracked step. "There's a problem with the flow's trigger" means several attempts to register the trigger failed, and the fix is to edit and re-save so the flow re-registers — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot).

**Trigger conditions**
- A trigger condition is an expression in the trigger's settings. It must start with `@`. Multiple conditions are ANDed by default. For OR, use `@or(test1, test2, test3)` — [Customize triggers](https://learn.microsoft.com/en-us/power-automate/customize-triggers).
- If a condition is not met, "the flow isn't triggered, and no run history is logged". This keeps runs and request consumption down. A condition added inside the flow still runs and still counts — [Customize triggers](https://learn.microsoft.com/en-us/power-automate/customize-triggers).
- Conflict: the troubleshooting page says a run that was expected but did not happen can be found under All runs as a skipped trigger check, meaning the condition was not met — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot). This sits awkwardly beside "no run history is logged" on [Customize triggers](https://learn.microsoft.com/en-us/power-automate/customize-triggers).
- A shortcut for authors: build the condition in a Filter array action, copy the advanced expression into the trigger, then delete the action — [Customize triggers](https://learn.microsoft.com/en-us/power-automate/customize-triggers).
- Source-side filtering also exists, such as an OData filter on Dataverse triggers, which specifies a condition and the columns that can fire — [Optimize triggers](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/optimize-power-automate-triggers).

**HTTP request trigger**
- Three authentication modes: Any user in my tenant; Specific users in my tenant (emails, or object IDs of service principals); and Anyone, described as a "legacy setting" with open access to anyone who holds the URL and schema. Leaving Specific users blank limits access to the tenant only — [OAuth for HTTP triggers](https://learn.microsoft.com/en-us/power-automate/oauth-authentication).
- Authenticated calls need bearer token claims `aud` (matched exactly per cloud, for example `https://service.flow.microsoft.com/`), `iss`, `tid`, and `oid` when restricted to specific users — [OAuth for HTTP triggers](https://learn.microsoft.com/en-us/power-automate/oauth-authentication).
- Trigger URLs have changed under customers. `logic.azure.com` URLs on the old architecture stopped working on 30 November 2025. From 2 June 2026, URLs expose a scale unit identifier (for example `/direct/cu/20/workflows/...`), though the old form continues to work. New URLs can exceed 255 characters — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot).

**Debatching**
- For array-returning triggers, Split on creates one run per array item. Limits: 5,000 items for Low profile and 100,000 for others; only 100 when trigger concurrency is on — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

### Inferences
- A polling trigger is effectively a persistent cursor owned by the platform. Storing it in a server-driven location header means connector authors keep no database. This pattern is a good fit for FlowBridge's connector SDK.
- The resume difference is a real product trap. FlowBridge should expose a choice at turn-on ("process backlog" or "start from now"), since Microsoft's only documented way to skip the backlog is to copy and delete the flow.
- Changing trigger URLs twice within a year (November 2025 and June 2026) suggests webhook URLs should be stable aliases decoupled from infrastructure.

### Gaps
- I found no published polling interval for Premium or Process plans in the pages I read.
- Not documented in what I read: whether empty polls, or trigger evaluations rejected by a condition, count as Power Platform requests. The FAQ says "every trigger and action in the flow counts" but discusses runs, not empty checks.
- Not documented: whether turning a flow off deregisters a webhook subscription on the source system, and how webhook subscriptions are renewed for services that expire them.
- I did not find a Microsoft statement on event ordering guarantees.

## Logic: conditions, switch, apply to each, do until, scopes, child flows, parallel branches, delays, approvals

### Takeaway
All control flow is expressed as nested actions plus `runAfter` edges. Loops are bounded, with defaults that differ from Logic Apps. Child flows are the sanctioned escape hatch for size limits. Long-running human steps are bound by the 30-day run limit, and Microsoft's workaround is to split them across two flows.

### Cited Findings
**Conditions and switch**
- The Condition action compares values, and advanced expressions combine functions: `and`, `or`, `equals`, `less`, `lessOrEquals`, `greater`, `greaterOrEquals`, `empty`, `not`, `if`. Results route to True and False branches — [Expressions in conditions](https://learn.microsoft.com/en-us/power-automate/use-expressions-in-conditions).
- Switch allows up to 25 cases. Maximum action nesting depth is 8. Microsoft recommends child flows beyond that — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

**Apply to each**
- Limits: 5,000 items on Low profile and 100,000 otherwise. Concurrency defaults to 1 and is configurable from 1 to 50 — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Logic Apps' For each runs in parallel by default, "unlike Power Automate's Apply to each loop" **[LA]** — [Loops](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-control-flow-loops).
- Iterations use `item()`. Nested loops always run sequentially. Increment, Decrement, and Append variable actions can give unpredictable results in parallel loops **[LA]** — [Loops](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-control-flow-loops).
- An action inside a loop counts per iteration: the loop plus 2 actions over 10 iterations is 21 actions — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).

**Do until**
- Iterations: default 60, maximum 5,000 — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- The body runs before the condition is checked, so it always runs at least once. Default limits are count 60 and timeout `PT1H`. The timeout is evaluated per iteration, so a long iteration is not interrupted **[LA]** — [Loops](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-control-flow-loops).
- Status semantics are unusual: a failure in a non-final iteration does not fail the loop, and only the final iteration decides. `operationOptions: "FailWhenLimitsReached"` makes hitting the limit a failure **[LA]** — [Loops](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-control-flow-loops).
- Iteration details in run history appear only after the loop exits **[LA]** — [Loops](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-control-flow-loops).

**Scopes**
- A scope groups actions and receives an aggregate status after all its actions finish. If the final action is Failed or Aborted, the scope is Failed. `result('ScopeName')` returns an array of top-level action results, not deeper nested ones **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- Microsoft recommends try-catch scopes in Power Automate as well — [Robust error handling](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling).

**Child flows**
- Parent and child flows must be in a solution. The child must use the Manually trigger a flow trigger, with inputs defined there. It returns data through Respond to a Power App or flow, or the premium Response action. The parent calls it with the built-in Run a Child Flow action — [Child flows](https://learn.microsoft.com/en-us/power-automate/create-child-flows).
- "You can't pass connections from the parent flow to the child flow." Child flows must use embedded connections, unless they use only built-in actions or Dataverse — [Child flows](https://learn.microsoft.com/en-us/power-automate/create-child-flows).
- The parent waits for the child "for the lifetime of the flow (one year for flows that use built-in connections and Dataverse or 30 days for all other flows)" — [Child flows](https://learn.microsoft.com/en-us/power-automate/create-child-flows). The one-year figure conflicts with the 30-day run duration on [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Solution import re-links parent and child automatically, with no URL updates — [Child flows](https://learn.microsoft.com/en-us/power-automate/create-child-flows).
- Licensing and governance follow the call tree: child flows use the parent's user limits, DLP violations anywhere in the tree suspend the parent, and Process capacity is not inherited — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs); [DLP for Power Automate](https://learn.microsoft.com/en-us/power-automate/prevent-data-loss).
- `FlowRun` records carry the parent run ID — [Run history in Dataverse](https://learn.microsoft.com/en-us/power-automate/dataverse/cloud-flow-run-metadata).

**Parallel branches**
- In the definition, ordering is `runAfter`: an action names one or more predecessors and acceptable statuses for each. For example, `"Action A": ["Succeeded"], "Action B": ["Succeeded","Failed"]` **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- The engine follows every branch to determine its status. A branch ending in Skipped inherits its status from the skipped action's predecessor. If any branch ends in failure, the whole run is Failed **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).

**Delays**
- The minimum postpone interval is 5 seconds on the Low profile and 1 second on others — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Outbound asynchronous requests are configurable up to 30 days — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- All pending steps time out once 30 days pass from the run's start — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

**Approvals**
- `Start and wait for an approval` adds the request to the approvals centre and emails approvers, who respond from their inbox, the approvals centre, or the app. A condition on the response then branches. Modern email clients update the email when the approval completes — [Approval workflows](https://learn.microsoft.com/en-us/power-automate/modern-approvals).
- For flows that may exceed 30 days, Microsoft says to store approvals in Dataverse and use two flows: one to send the request and one to act on the response, using `Create an approval (v2)`. That action also supports cancellation — [Approval workflows](https://learn.microsoft.com/en-us/power-automate/modern-approvals).
- Approvers do not need a Premium licence — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- Guest users can approve through Entra guest accounts — [Approval workflows](https://learn.microsoft.com/en-us/power-automate/modern-approvals).
- The Approvals connector cannot be blocked by classic data policies — [Connector classification](https://learn.microsoft.com/en-us/power-platform/admin/dlp-connector-classification).
- The standalone mobile app reached end of support on 31 August 2026. Approvals move to the Teams Approvals app. Several pages still reference the app, and the approvals tutorial is one example — [Mobile app overview](https://learn.microsoft.com/en-us/power-automate/mobile/overview-mobile).
- Approvals can be mocked in tests using static results — [Test cloud flows](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/test-cloud-flows).

### Inferences
- The structure is a DAG with structured containers. The `runAfter` model is compact: a single mechanism gives ordering, joins, and error paths. It is a strong reference for FlowBridge's definition format.
- Do until's "only the final iteration matters" rule is surprising enough that FlowBridge should either avoid it or display it clearly.
- The 30-day wall makes the two-flow approval pattern necessary. A workflow engine that persists waiting state cheaply could offer long waits as a differentiator, but retention and quota design would need to be solved first.

### Gaps
- I could not find a Power Automate-specific reference for Switch, Scope, or Delay action behaviour in the pages I fetched. Delay and Delay until were found only through search summaries, partly from Q&A, so I do not treat them as verified. `create-scopes` and `wait-conditions` exist but I did not read them.
- I did not read a Power Automate page on parallel branches. The URL I tried returned 404. The semantics above are Logic Apps'.
- The maximum number of parallel branches for cloud flows did not appear on the Power Automate limits page.
- Approval data storage location and internal approval timeouts were not stated on the approvals page beyond the 30-day limit.

## Data: dynamic content, expressions, Workflow Definition Language, schemas

### Takeaway
Dynamic content is a picker over schema-typed outputs of earlier steps. It writes references in the same expression language that hand-written expressions use: Workflow Definition Language. Schemas come from the connector's OpenAPI definition and are captured when the action is added, which explains the well-known "re-add the action" problem.

### Cited Findings
- In the designer, the lightning-bolt button inserts dynamic values and the `fx` button inserts expressions. Typing `/` in a field opens the same picker. The expression editor is multi-line and can expand to full page, with search across content and functions — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer).
- Conditions and functions use Workflow Definition Language: "use functions that the Workflow Definition Language provides", with the reference guide shared with Logic Apps — [Expressions in conditions](https://learn.microsoft.com/en-us/power-automate/use-expressions-in-conditions).
- Definition shape: `$schema`, `actions`, `contentVersion`, `outputs`, `parameters`, `staticResults`, `triggers` **[LA]** — [WDL schema](https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-schema).
- WDL schema limits are 250 actions, 10 outputs, 50 parameters, 10 triggers **[LA]** — [WDL schema](https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-schema). Power Automate's own limit is 500 actions per workflow — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config). This is a real divergence or a stale page; the WDL page is dated October 2025.
- Syntax **[LA]** — [WDL schema](https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-schema):
  - `@expr` returns a typed JSON value. `@parameters('myAge')` returns the number 42.
  - `@{expr}` interpolates and always yields a string. `@{parameters('myAge')}` returns "42".
  - `@@` escapes a literal at sign.
  - Strings use single quotes, since double quotes conflict with the surrounding JSON.
  - `?` is the null-ignore operator: `triggerBody()?['x']` returns null rather than failing with "Unable to process template language expressions".
- Each action's Code View shows the JSON behind its card, and it updates as parameters change — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer).
- Connection binding in the definition appears as `@parameters('$connections')['office365']['connectionId']` **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- Definition parameter types include `securestring` and `secureobject`, which a GET does not return **[LA]** — [WDL schema](https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-schema).
- Expression limits: 8,192 characters per expression; 131,072 characters for evaluated `concat`, `base64`, and `string` results; 16,384 characters per request URL — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Schemas are snapshotted. If a SharePoint list gains a fifth column, the flow cannot see it until the action is deleted and re-added, and the same applies to Excel and Dataverse — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer).
- Output schemas in connector definitions use OpenAPI plus `x-ms-*` extensions such as `x-ms-summary` for display names. Parameter visibility is `none`, `advanced`, `internal`, or `important` — [OpenAPI custom connector](https://learn.microsoft.com/en-us/connectors/custom-connectors/define-openapi-definition).
- Per-action security: Secure inputs and Secure outputs toggles. Tracking: tracked properties up to 16,000 characters — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer); [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Variables: maximum 250 per workflow — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Parse JSON accepts a provided schema or one generated from a sample payload, and exposes the fields as dynamic content (search result only) — [Data operations](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations).
- Filter array and `result()` work together: `from: @result('My_Scope')`, `where: @equals(item()['status'], 'Failed')` **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- `workflow()` returns run and flow metadata, including environment name, flow name, trigger type, and run ID — [Robust error handling](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling).

### Inferences
- A clean design takeaway: dynamic content is only a UI over the expression language, not a second system. FlowBridge should keep one expression language and let pickers generate it.
- The `@expr` versus `@{expr}` typing rule causes subtle bugs. FlowBridge could show the resolved type next to each token.
- Schema refresh without deleting the action is a clear and cheap improvement over Power Automate.

### Gaps
- I did not read the full expression function reference, so no function count is given here.
- I did not read a Power Automate reference for Select, Compose, or Parse JSON directly.
- Microsoft does not state in these pages that a cloud flow definition matches the Logic Apps schema exactly. Pipelines, drafts, and the new "SelfHost Multitenant" architecture may cause further divergence. See Execution.

## Connections: connection types, OAuth, service principals, sharing, security, data loss prevention policies

### Takeaway
A connection is an environment-scoped credential stored in a central API Hub credential service. Consent is tracked per pairing of connection and flow, so sharing a flow does not pass secrets. Governance has two generations: classic data policies (Business, Non-Business, Blocked groups) and advanced connector policies (a default-deny allowlist).

### Cited Findings
**Storage and architecture**
- A "credential and metadata store" holds connector metadata, connection information, ACLs, and credentials. Azure API Management hosts Swagger files and policies, is the entry point for all connector calls, and verifies keys, tokens, and certificates. An App Service Environment hosts connector web apps — [Connector architecture](https://learn.microsoft.com/en-us/connectors/connector-architecture).
- "The API Hub credentials service always stores and manages credentials." Authentication to the data source is separate from authentication to the platform — [Connect to data sources](https://learn.microsoft.com/en-us/power-platform/admin/security/connect-data-sources).
- Consent is per pairing. For a connection provided by the flow author, the consent double is (connection, flow). For a connection provided by a user invoking the flow, the consent triple is (connection, flow, user) — [Connect to data sources](https://learn.microsoft.com/en-us/power-platform/admin/security/connect-data-sources).
- Connections are stored in the environment that hosts the app or flow — [Data policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention).

**Types and authentication**
- Authentication options for custom connectors: generic OAuth 2.0, service-specific OAuth 2.0 (Entra ID, Dropbox, GitHub, Salesforce), Basic, and API key. Microsoft recommends Entra ID — [Custom connectors](https://learn.microsoft.com/en-us/connectors/custom-connectors/).
- OAuth connectors use a per-connector redirect URI, enforced after February 2024 — [Custom connectors](https://learn.microsoft.com/en-us/connectors/custom-connectors/).
- Custom connector creation does not support client credentials in an OAuth security definition. If there are multiple security definitions, it picks the top one — [OpenAPI custom connector](https://learn.microsoft.com/en-us/connectors/custom-connectors/define-openapi-definition).
- Prebuilt connectors can offer several auth types per connector, each with its own parameters and a shareable flag. HTTP with Microsoft Entra ID offers Entra login, client certificate, and three gateway types (Basic, Windows, Anonymous) — [HTTP with Entra ID](https://learn.microsoft.com/en-us/connectors/webcontents/).
- Explicit authentication uses the app user's credentials and implicit authentication uses the maker's. Microsoft recommends explicit where possible. This page is written for Power Apps — [Connect to data sources](https://learn.microsoft.com/en-us/power-platform/admin/security/connect-data-sources).
- On-premises connectivity uses the on-premises data gateway, a selectable option on supported connectors — [Manage connections](https://learn.microsoft.com/en-us/power-automate/add-manage-connections).
- Connections break when a password expires or a token-lifetime policy ends. "Fix connection" prompts for new credentials and updates both Power Apps and Power Automate — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot); [Manage connections](https://learn.microsoft.com/en-us/power-automate/add-manage-connections).

**Turn-on permission model**
- The user turning on a flow must own, or have use permission on, all its connections. Once turned on by the connection owner, "the flow gets explicit permission to use those connections", and any co-owner can toggle it. Adding new connections restarts this requirement. `ConnectionAuthorizationFailed` is the resulting error — [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).
- OAuth connections "can only be explicitly shared with a user representing a service principal" — [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).
- Co-owners can use a connection but cannot modify credentials created by another owner — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows).
- Connection permission is not tied to a flow version: "Can connection permissions be associated with a certain version so a new connection authorization is needed when a co-owner changes the flow? Not at this time" — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).

**Sharing**
- Three sharing modes: add an owner, share run-only, send a copy. A copy carries no connections and works as an independent template, and access cannot be revoked — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows).
- Run-only sharing applies to instant flows. The owner chooses for each connection: "Provided by run-only user" or "Use this connection". In export, invoker connections have `RuntimeSource: invoker` — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows).
- Co-owner versus run-only comparison: co-owners get the definition, run history, settings, and connections; run-only users get trigger rights only and cannot see run history — [Sharing guide](https://learn.microsoft.com/en-us/power-automate/guide-to-cloud-flow-sharing-permissions).
- Group co-owners and SharePoint list co-owners are possible. Everyone with edit access on the list gets edit access on the flow — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows).

**Service principals**
- A service principal is represented by an application user, which can have connections shared with it and own flows. It solves the owner-leaves problem and suits DevOps deployment — [Service principal flows](https://learn.microsoft.com/en-us/power-automate/service-principal-support).
- Non-solution flows require connections to be shared with the application user; solution flows do not. A service principal can be owner but not co-owner — [Service principal flows](https://learn.microsoft.com/en-us/power-automate/service-principal-support).
- A licence cannot be assigned to it. Premium flows need a Process or per-flow licence, flow group membership, or a designated licensed user — [Service principal flows](https://learn.microsoft.com/en-us/power-automate/service-principal-support).
- Quota comes from a tenant pool of non-licensed user requests: 25,000 per 24 hours for Power Automate, or 500,000 plus 5,000 per user subscription (to 10 million) in Dynamics context — [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations).
- Limits only apply when the service principal is the owner, not when it is merely used in a connection. Manual flows use the invoker's limits even with a service principal owner — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- Microsoft recommends a service principal rather than a shared service account. A single Premium licence on a service account shared by many users counts as multiplexing and is non-compliant, though "this guidance isn't hard enforcement" — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).

**Classic data policies (renamed from DLP)**
- Learn now titles the feature "Data policies", though many pages still say DLP — [Data policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention).
- Three groups: Business, Non-Business, Blocked. Connectors in different groups cannot share data within one flow. New connectors go to the default group, which is Non-Business initially and should stay that way according to Microsoft — [Connector classification](https://learn.microsoft.com/en-us/power-platform/admin/dlp-connector-classification).
- Connectors that cannot be blocked include Dataverse, Approvals, Notifications, and Microsoft Enterprise Plan standard connectors such as SharePoint, Outlook, and Teams. They can still be classified — [Connector classification](https://learn.microsoft.com/en-us/power-platform/admin/dlp-connector-classification).
- Custom connectors at the tenant level are classified by an ordered list of host URL patterns ending in a `*` rule, with Ignore as the default. At the environment level they are listed alongside prebuilt connectors — [Connector classification](https://learn.microsoft.com/en-us/power-platform/admin/dlp-connector-classification).
- Enforcement steps: save policy; cascade to environments; resources periodically check; evaluate; suspend violators; disable connections for blocked connectors; running resources fail at runtime. Latency is usually under an hour, and up to 24 hours in the extreme — [Data policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention).
- At save, evaluation is synchronous for flows without a child flow ("99% of flows") and asynchronous within 24 hours for flows with one. A weekly background job re-checks all active flows. A cloud flow suspended in the previous seven days reactivates automatically if it no longer violates — [DLP for Power Automate](https://learn.microsoft.com/en-us/power-automate/prevent-data-loss).
- API state for a suspended flow is `State=Suspended`, `FlowSuspensionReason=CompanyDlpViolation`, plus `FlowSuspensionTime` — [DLP for Power Automate](https://learn.microsoft.com/en-us/power-automate/prevent-data-loss).
- Microsoft runs enforcement changes in stages: Investigating, Learning, Notify only, Design-time enforcement, Full enforcement — [DLP for Power Automate](https://learn.microsoft.com/en-us/power-automate/prevent-data-loss).
- Conflict on child flows and HTTP. The classification page warns that child flows "share an internal dependency with the HTTP connector", so HTTP's grouping can affect child flows — [Connector classification](https://learn.microsoft.com/en-us/power-platform/admin/dlp-connector-classification). A change log item says a change "to no longer block child flows when the HTTP connector is blocked" would roll out with full enforcement in March 2023 — [DLP for Power Automate](https://learn.microsoft.com/en-us/power-automate/prevent-data-loss).

**Endpoint filtering (still preview)**
- An ordered list of Allow and Deny URL patterns ending in `*`, for HTTP, HTTP with Entra ID, HTTP Webhook, SQL Server, Azure Blob, SMTP, Browser Automation, and UI Automation. It does not apply to environment variables, custom inputs, or endpoints built at runtime; only static endpoints in the designer are evaluated — [Endpoint filtering](https://learn.microsoft.com/en-us/power-platform/admin/connector-endpoint-filtering).

**Advanced connector policies (ACP)**
- A strict allowlist. All connectors and actions are blocked by default, including newly added connectors. Available per environment or per environment group. Visibility extends to triggers, internal actions, and deprecated actions — [ACP](https://learn.microsoft.com/en-us/power-platform/admin/advanced-connector-policies).
- Modes: Mixed, where the most restrictive settings from ACP and classic policies apply; and ACP-only, where classic policies are ignored but kept — [ACP](https://learn.microsoft.com/en-us/power-platform/admin/advanced-connector-policies).
- Supported: certified and MCP connectors. Custom and HTTP connectors are not yet supported. Virtual connectors will not be. Individual MCP tools cannot be controlled, only whole servers — [ACP](https://learn.microsoft.com/en-us/power-platform/admin/advanced-connector-policies).
- Nonblockable connectors can only be blocked on Managed Environments. Removing a rule from a group does not remove it from environments that inherited it — [ACP](https://learn.microsoft.com/en-us/power-platform/admin/advanced-connector-policies).
- Design-time enforcement is rolling out, starting with Power Automate. Each portal's release marks GA for that workload. Until then, ACP is runtime only — [ACP](https://learn.microsoft.com/en-us/power-platform/admin/advanced-connector-policies).

### Inferences
- The connection reference plus consent pairing is the core security design. Secrets never travel with a definition, yet a flow retains a grant after turn-on.
- One weakness is documented by Microsoft itself: once a flow has a grant, a co-owner can edit the flow and use that connection with no re-authorisation. FlowBridge could tie grants to the set of operations used, or require re-consent when new scopes or actions appear.
- Microsoft's move from group classification to a default-deny allowlist suggests the Business and Non-Business model did not hold up. Microsoft says it "wasn't deemed effective". FlowBridge should begin with allowlists.
- Endpoint filtering's dynamic-value bypass shows that design-time-only checks can be evaded. Enforcing at the outbound gateway at runtime is more robust.

### Gaps
- The classic data policy pages I read do not state how several overlapping classic policies combine. "Most restrictive" is stated only for ACP mixed mode.
- Encryption-at-rest and token-refresh details for the credential store were not on the pages I read. The security overview and data storage pages were not fetched.
- I did not find a statement of which prebuilt connectors support service principal authentication. Pipelines says only that service principal connections can be used "for connectors that support service principal authentication" — [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines).

## Integrations: connector counts and tiers, custom connectors from OpenAPI, HTTP action

### Takeaway
Microsoft says "over 1,000" connectors, and its reference lists now hold about 1,600. Tier is the commercial boundary: a premium connector needs a paid entitlement. Custom connectors still accept only OpenAPI 2.0. HTTP is premium and is governed separately from certified connectors.

### Cited Findings
- Microsoft's stated figure is "over 1,000 connectors" — [Custom connectors](https://learn.microsoft.com/en-us/connectors/custom-connectors/).
- My own count, taken on 7 November 2026 by counting distinct connector links in Microsoft's list pages, gives about 181 on the [Standard list](https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-standard-connectors), about 1,416 on the [Premium list](https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-premium-connectors), about 1,577 on the [Power Automate list](https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-powerautomate-connectors), and about 81 on the [MCP list](https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-mcpserver-connectors). This is a link count, so treat it as approximate. Microsoft publishes no such breakdown.
- Reference lists are organised by product, tier (Standard, Premium), release status (Preview, Production), and publisher (Microsoft, Verified) — [Connectors docs](https://learn.microsoft.com/en-us/connectors/).
- A connector can be Premium in Power Automate and Standard in Logic Apps. HTTP with Microsoft Entra ID is an example — [HTTP with Entra ID](https://learn.microsoft.com/en-us/connectors/webcontents/).
- Premium, custom, and on-premises connectors need a standalone licence. Free and seeded users are limited to standard connectors — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types); [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot).
- Connectors carry their own throttles. SharePoint: 600 calls per minute per connection. HTTP with Entra ID: 100 calls per 60 seconds per connection. Exceeding gives HTTP 429 — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs); [HTTP with Entra ID](https://learn.microsoft.com/en-us/connectors/webcontents/).

**Custom connectors**
- A custom connector is "a wrapper around a REST API". Sources: OpenAPI definition, Postman collection, or from scratch in the portal. Internally all use OpenAPI — [Custom connectors](https://learn.microsoft.com/en-us/connectors/custom-connectors/).
- The definition must be OpenAPI 2.0 and less than 1 MB. "OpenAPI definitions that are in OpenAPI 3.0 format are not supported." Headers must use ASCII only — [OpenAPI custom connector](https://learn.microsoft.com/en-us/connectors/custom-connectors/define-openapi-definition).
- The wizard flow is General, Security, Definition, Test. It includes a Validation area and a Test page. Testing is available only in Power Automate and Power Apps — [OpenAPI custom connector](https://learn.microsoft.com/en-us/connectors/custom-connectors/define-openapi-definition).
- When a field changes in the API, Microsoft says to republish the connector, then remove and re-add the connection or data source in each app — [Custom connectors](https://learn.microsoft.com/en-us/connectors/custom-connectors/).
- Limits: 50 custom connectors per user; 500 requests per minute per connection; premium or trial licence needed to run — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Lifecycle: build, secure, describe, use, share, certify. Certification reviews technical and content compliance for connectors shared with all users. Verified and Independent publisher paths exist — [Custom connectors](https://learn.microsoft.com/en-us/connectors/custom-connectors/); [Connectors docs](https://learn.microsoft.com/en-us/connectors/).
- A CLI (`paconn`), custom code, and policy templates are listed extension points — [Connectors docs](https://learn.microsoft.com/en-us/connectors/).
- Custom connectors must be imported in a separate solution before the connection references or flows that use them. Copying an environment breaks references, because custom connectors use environment-specific identifiers — [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).
- VNet-linked environments carry limits: OAuth and token requests do not pass through the VNet, only API requests do — [Custom connectors](https://learn.microsoft.com/en-us/connectors/custom-connectors/).
- MCP connectors expose tools, and "all connectors are agent ready" — [Connectors overview](https://learn.microsoft.com/en-us/connectors/overview); [Data policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention).

**HTTP**
- Child flows reference "the premium HTTP request/response connector" — [Child flows](https://learn.microsoft.com/en-us/power-automate/create-child-flows).
- HTTP with Microsoft Entra ID is Premium in Power Automate. It offers delegated access through a first-party trusted application, encodes request bodies in base64, does not support binary, and has limited scopes. Microsoft has released a newer version without preauthorisation so admins can grant consent discretely — [HTTP with Entra ID](https://learn.microsoft.com/en-us/connectors/webcontents/).
- HTTP, HTTP Webhook, and When an HTTP request is received are classifiable in data policies. Endpoint filtering applies to HTTP — [Connector classification](https://learn.microsoft.com/en-us/power-platform/admin/dlp-connector-classification); [Endpoint filtering](https://learn.microsoft.com/en-us/power-platform/admin/connector-endpoint-filtering).
- Outbound synchronous requests time out at 120 seconds, and Microsoft suggests an asynchronous polling pattern or Until loop. Message size is 100 MB, or 1 GB with chunking — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

### Inferences
- Staying on OpenAPI 2.0 while the world uses 3.x is a concrete weakness. Supporting 3.x in FlowBridge is a simple, visible advantage.
- The ratio of premium to standard connectors (about 8 to 1 by my count) shows connector tier is the main upsell mechanism. This is a commercial decision that FlowBridge should make deliberately.
- The re-add instruction after an API change suggests connector schema updates are not propagated well. A page on versioning connector operations exists (`custom-connectors/operational-versioning`), but I did not read it, so this is not a full assessment of connector versioning.

### Gaps
- No official current connector count or tier split is published. No count was found for the number of triggers and actions.
- I did not read the built-in HTTP action's own reference page. Its premium status comes from search results and related pages, and I did not verify its authentication options directly.

## Testing and debugging: test with recent runs, run history, flow checker

### Takeaway
Testing happens on the real runtime with real side effects. There is no sandbox mode, and solution-flow drafts cannot be tested without publishing. Mocking is available per action through static results. Debugging relies on step-level inputs and outputs from run history.

### Cited Findings
- The Test pane offers Manual (you perform the trigger) and Automatic (use a recently used trigger, or repeat a previous test run). You must save first and test manually at least once before the automatic option is available — [Test cloud flows](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/test-cloud-flows).
- A green check and processing time appear on each card when a test finishes — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer).
- "Can drafts be tested? Not at this time. Currently, flow changes need to be published and runnable to be tested. We're exploring the concept of creating a second runtime representation of a single flow to facilitate testing" — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).
- Static results: on the action's Testing tab, set a Status and Outputs (status code, headers, body). The action "is treated as successful without actually running". A beaker icon marks it. The usual method is to capture raw outputs from a real run and paste them in. It can also simulate failure codes — [Test cloud flows](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/test-cloud-flows); [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer).
- The static result definition sits in `staticResults` and is referenced via `runtimeConfiguration.staticResult` **[LA]** — [WDL schema](https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-schema).
- Flow checker is "always active" in the command bar and opens automatically on save if there are errors or warnings. It points to specific actions and provides guidance — [Flow checker](https://learn.microsoft.com/en-us/power-automate/error-checker).
- Flow checker also reports DLP violations and shows a Use connection references warning with a one-click fix. ACP violations surface there as well — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot); [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference); [ACP](https://learn.microsoft.com/en-us/power-platform/admin/advanced-connector-policies).
- Saving is blocked on errors, except that solution flows can Save draft with errors. For non-solution flows, the designer keeps a copy in browser storage, recoverable through Recover flow — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer).
- Test sessions longer than 10 minutes can show a timeout message while the flow continues in the background — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Run details expose raw inputs and outputs per step — [Test cloud flows](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/test-cloud-flows).
- Copilot offers a Troubleshoot feature during testing and in run history, in the new designer — [Copilot flows](https://learn.microsoft.com/en-us/power-automate/create-cloud-flow-using-copilot).
- The Dataverse trigger warning: FlowRun and FlowLog should not be targets of "When a row is added" because this causes an infinite loop — [Run history in Dataverse](https://learn.microsoft.com/en-us/power-automate/dataverse/cloud-flow-run-metadata).

### Inferences
- Replaying a captured trigger payload is the most useful test feature, and it is easy to build. Combined with a mock per action, it gives repeatable tests without side effects.
- The missing piece, which Microsoft itself names, is a separate test runtime for a draft. This is the clearest testing gap for FlowBridge to fill.
- There is no documented automated test framework or assertion concept in these pages. Tests are manual inspection.

### Gaps
- I found no Microsoft Learn page describing unit test or assertion features for cloud flows in what I read.
- I did not find how long the "recent runs" list used by automatic tests lasts, beyond general retention.
- The designer page describes the Test button with the manual path only. The automatic option comes from the guidance article. Its current label in the UI was not confirmed.

## Publishing and versioning: save, turn on and off, solutions, environments, application lifecycle management, version history

### Takeaway
Non-solution flows go live when saved and have no version history. Solution flows have separate draft and publish steps, version history in Dataverse, and deployment through managed solutions. Pipelines give a governed promotion path. Environment boundaries are hard: connections, flows, and data are bound to one environment and geography.

### Cited Findings
**Draft and publish**
- For solution flows: Save draft (allowed even with errors) and Publish (takes effect at runtime). A Draft or Published label appears by the title. Available in all regions since 7 February 2025. New designer only — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).
- Storage: the `workflow` table has a row for latest published and a row for latest draft. History is in the Component Version table — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).
- Version history is grouped by day and tagged Latest, Published, or Past published. Draft records expire after 6 months and published records after 12 months. A past version can be restored as a new draft — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).
- Stated limits ("Not at this time"): no version notes or titles, no filtering, no change summary, no side-by-side compare, no simple integer ID. Each version has a GUID that the cards do not show. Co-owners see the full history — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).
- Only the last published version is exported. Drafts and history are not — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).
- Known issue: the flow URL's `workflowUniqueId` changes with each version when opened from Solution Explorer — [Drafts and versioning](https://learn.microsoft.com/en-us/power-automate/drafts-versioning).

**Turn on and off, delete**
- Turn off: no new runs start, and in-progress and pending runs continue. Delete: no new runs, and in-progress and pending runs are cancelled, which may take significant time — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Throughput limits apply per flow version, so updating a flow resets them — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

**Environments**
- An environment is a tenant-bound and geography-bound container for apps, flows, connections, and gateways, with zero or one Dataverse database. Apps can only connect to data sources in the same environment — [Environments](https://learn.microsoft.com/en-us/power-platform/admin/environments-overview).

**Pipelines and ALM**
- Pipelines deploy solutions and target configuration (connections, connection references, environment variables), but not Dataverse data. Connections and variables are given upfront and validated before deployment. Admins can preconfigure some connections — [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines).
- Artifact immutability: a solution is exported when deployment is requested, the same artifact moves through stages in order, it is not re-exported, and tampering is prevented — [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines).
- Pipelines deploy only managed solutions to targets. Managed and unmanaged artifacts are stored in the host for every deployment. Default import is Upgrade without Overwrite customizations — [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines).
- Approvals use delegated deployments, and deployed objects are owned by the deploying identity, which may be a service principal. Rollback is possible by redeploying a previous version, if the setting is on — [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines).
- Constraints: same tenant only; cross-geo needs a setting; one solution per deployment; a single development environment per solution. Azure DevOps or GitHub are recommended for cross-tenant — [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines).
- From October 2026, admins are notified when pipelines deploy to unmanaged targets and have 30 days (extendable once) to approve enabling Managed Environments, or further deployments are blocked — [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines).
- The automatic linking and replacement of connections at import means a target environment needs no flow edits — [Connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).

### Inferences
- The publish model is a useful reference: separate draft, published, and historical copies. However, Microsoft's retention of only 12 months for published versions, with no notes and no diff, means audit and rollback rely on external source control. FlowBridge can do better with permanent, annotated, diffable versions.
- The solution model offers strong release discipline but high friction for simple cases. FlowBridge could expose promotion without requiring a concept as heavy as Dataverse solutions.

### Gaps
- Save behaviour for non-solution flows is described only implicitly: the Save button and "Your flow is ready to go". The page says non-solution flows "lack the 'Save draft' functionality" — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer). I did not find a statement of what in-flight runs do when a new version is published.
- I did not read the `overview-solution-flows` page or solution layering pages. Environment variable mechanics are not covered here beyond the pipeline deployment statements.
- It is not documented in what I read whether an in-progress run keeps using the version it started with. Resubmit guidance hints at this, without stating it.

## Execution: concurrency, throttling, request limits, run duration limits, retention

### Takeaway
The limits system has several independent layers: per-definition, per-run, per-version throughput, licence-based daily requests, and per-connection connector throttles. Going over usually slows a flow rather than failing it, but persistent overage turns the flow off. All organisations remain in a "transition period" with much higher enforced limits than the official ones.

### Cited Findings
**Performance profile**
- A flow's profile decides its limits: Low (Free, Microsoft 365, trials), Medium (Premium, Power Apps per user, Dynamics Enterprise), High (Process, per flow), Unlimited Extended (pay-as-you-go flows; Dynamics in-context flows under a service principal) — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- A flow uses its owner's plan. If the original owner leaves, it reverts to Low — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

**Definition limits**
- 500 actions; nesting depth 8; 25 switch cases; 250 variables; action and trigger names 80 characters; description 256 characters; 600 owned non-solution flows per user — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

**Run limits**
- Run duration 30 days, measured from start time and including pending steps — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Concurrent runs: unlimited with concurrency control off; 1 to 100 when on. Off by default. Turning it on "can't be undone without deleting and re-adding the trigger". Waiting runs: 10 plus the degree of parallelism. Beyond that, triggers "might be re-tried by the connector" but may not succeed. Microsoft says to leave control off to ensure all triggers produce runs — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Paginated items: 5,000 for Low and 100,000 otherwise — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Delivery is at-least-once. Duplicate actions and runs can occur due to "the at-least-once design of Azure Logic Apps", so flows should be idempotent — [Troubleshoot triggers](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot).

**Throughput per flow version, sliding window**
- Power Platform requests: 100,000 per 5 minutes, independent of licence — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config); [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations).
- Concurrent outbound calls: 500 for Low, 2,500 otherwise. Concurrent inbound calls: about 1,000 — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Runtime endpoint: 4,500 invokes per 5 minutes for Low and 45,000 otherwise; 6,000 and 60,000 reads per 5 minutes — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Content throughput: 120 MB (Low) or 1.2 GB per 5 minutes. Per 24 hours in the transition period: 2.5 GB Low, 20 GB Medium, 50 GB High — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

**Daily request limits (official limit and enforced transition limit)**

| Licence | Official per 24 hours | Transition per 24 hours |
| --- | --- | --- |
| Power Automate Premium | 40k per user | 200k per flow |
| Process, Hosted Process | 250k per licence | 500k per licence |
| Free, Office 365, D365 Team Member | 6k per user | 10k per flow |
| Power Apps Premium, D365 Enterprise | 40k per user | 200k per flow |

— [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations)

- The window is sliding, and unused capacity does not roll over. Capacity cannot be pooled at environment or tenant level — [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations).
- "Enforcement of the official limits won't start until at least six months after Power Automate usage reporting is generally available." The Limits page also states transition enforcement is not as strict — [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations).
- What counts: trigger plus every action, including built-ins such as variables, scopes, and compose. Successes and failures count. Retries and pagination count. Skipped actions do not. An action with several expressions counts as one — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- Whose limit: Process or per-flow licence if assigned. Automated and scheduled flows use the owner's limit regardless of connections. Instant flows use the invoker's limit. Child flows use the parent's context — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- Overage behaviour: subsequent actions are delayed, in proportion to the overage. A banner appears. Occasional overages are fine, but exceeding by 50,000 can hurt for days — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- Copilot Studio-triggered cloud flows share a tenant allowance of 250,000 requests per 24 hours, regardless of pack count. Agent flows use Copilot Credits instead — [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations).

**Timeouts and size**
- Synchronous outbound and inbound requests: 120 seconds. Actions after a Response action keep running beyond this — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

**Automatic turn-off**
- Continuous errors for 14 days; consistent throttling for 14 days; no trigger activity for 90 days. The inactivity rule exempts premium and capacity licensed owners and gives 30-day advance notice — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- Premium flow whose owner lost Premium: downgraded, owners notified, turned off in 14 days without action — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).

**Retention**
- Run retention in storage is 30 days from start — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config). The portal shows a "28-day run history" — [Bulk resubmit](https://learn.microsoft.com/en-us/power-automate/how-tos-bulk-resubmit).
- Dataverse `FlowRun` retention defaults to 28 days, selectable as 14, 7, or Disabled in admin, or custom through `FlowRunTimeToLiveInSeconds` (the page lists 60 days as an example). It uses Dataverse database capacity. Solution flows only. Storage is an elastic table partitioned per user, capped at 20 GB per partition — [Run history in Dataverse](https://learn.microsoft.com/en-us/power-automate/dataverse/cloud-flow-run-metadata).

**Architecture change**
- Environments are being auto-upgraded from the `LogicApps` hosting type to `SelfHostMultiTenant`, which brings "faster runtimes" and features such as express mode. Admins can check via `environmentFlowHostingType` — [Environment architecture](https://learn.microsoft.com/en-us/power-automate/environment-architecture).

**Conflicts between Microsoft pages, in one place**
1. Default degree of parallelism when concurrency is turned on: 25 on [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config); 1 on [Optimize triggers](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/optimize-power-automate-triggers).
2. Removing concurrency control: delete and re-add the trigger on [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config); "create a new flow" on [Optimize triggers](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/optimize-power-automate-triggers).
3. Default retry count: see Error handling below.
4. Action limit: 500 versus 250. See Data.
5. Run lifetime: 30 days versus one year for some child flow parents. See Logic.
6. Pay-as-you-go: see Templates, Copilot and AI features, limits, and licensing.

### Inferences
- Microsoft meters every action, including internal ones such as Compose. This makes costs easy to compute but penalises readable, well-structured flows. FlowBridge should decide whether control and data operations should be free.
- Slowing rather than failing protects business continuity, but it makes capacity problems hard to notice, hence the need for banners and emails.
- A 14-day auto-off rule on throttled flows is a harsh policy. It suits a multi-tenant platform protecting itself but needs strong notification. FlowBridge should plan an equivalent, with clear warnings.
- The move to "SelfHost Multitenant" suggests Microsoft is separating Power Automate's runtime from Logic Apps. Treat statements linking the two as possibly time-limited.

### Gaps
- Microsoft does not give a date for the end of the transition period. It gives only the "at least six months after usage reporting is GA" condition.
- No documentation I read gives the throttling algorithm or the delay magnitude.
- No internal architecture details exist for the "SelfHost Multitenant" runtime on the page I read.
- It is not stated whether 30-day and 28-day retention are the same thing with different labels.

## Error handling: retry policies, run after settings, try and catch scopes, resubmit runs

### Takeaway
There are four layers: action-level retry, `runAfter` status routing, scope-level try and catch with `result()`, and operator resubmission from run history. Failed actions cause successors to be Skipped unless routed, and the run's final status comes from the end of each branch.

### Cited Findings
**Retry**
- A retry policy resends when a request times out or fails with 408, 429, or 5xx **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- Types: `default`, `none`, `fixed`, `exponential`, with `count`, `interval`, `minimumInterval`, `maximumInterval` **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- The exponential policy picks a uniform random interval in a growing range: try 1 between max(0, min) and min(interval, max); try 2 between max(interval, min) and min(2×interval, max); and so on, doubling **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- Conflict on the default:
  - [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config): Low gets 2 retries, scaling by 5 minutes to about 10 minutes; Medium and High get 12 retries, scaling by 7 seconds to about 1 hour.
  - [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer): 2 for Low; 8 for Medium and High without premium connectors; 12 with premium connectors.
  - **[LA]** [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling): up to 4 retries at 7.5-second scale, capped between 5 and 45 seconds, though its JSON example shows `PT7S` with a maximum of `PT1H`.
- Maximums for custom settings: 90 attempts, 1-day maximum delay, 5-second minimum delay — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
- The Action Timeout setting is the maximum duration between retries and asynchronous responses. It does not change a single request's timeout — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer).

**Run after**
- Statuses: is successful, has failed, is skipped, has timed out. The default is Succeeded. At least one must always be selected. The first action always runs after the trigger, so the setting does not apply to it **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- The same four options are in Power Automate's designer — [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer); [Robust error handling](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling).
- An unhandled failure marks the action Failed and successors Skipped **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).

**Try and catch**
- Pattern: a Try scope; a Catch scope set to run after Try fails; a Filter array over `result('Try')` for status Failed; log; notify — [Robust error handling](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling); **[LA]** [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- `result()` items include name, inputs, outputs, start and end time, tracking IDs, code, and status **[LA]** — [Error handling](https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling).
- Terminate stops the flow with a status and message — [Robust error handling](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling).
- Building a link to the failing run from `workflow()` is a documented pattern. Microsoft warns against over-logging as an anti-pattern — [Robust error handling](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling).

**Resubmit and cancel**
- Single-run Resubmit and Cancel are available in run details, and bulk supports up to 20 runs at a time. The count is further limited by connector API limits — [Bulk resubmit](https://learn.microsoft.com/en-us/power-automate/how-tos-bulk-resubmit).
- Users can always resubmit their own instant runs. Resubmitting others' requires the tenant setting Power Automate flow run resubmission — [Bulk resubmit](https://learn.microsoft.com/en-us/power-automate/how-tos-bulk-resubmit).
- Cancel all runs acts on Running and Waiting runs, moving Waiting to Canceling to Canceled. It may take up to 24 hours, and can optionally turn off the flow. If the flow is off, cancelled runs stay Waiting until it is back on. If throttled, the queue stays stuck until more capacity is assigned — [Bulk resubmit](https://learn.microsoft.com/en-us/power-automate/how-tos-bulk-resubmit).
- Microsoft warns about duplicates, stale inputs, and changed definitions on resubmit: "It's best to resubmit using the version of the flow that was in place at the time of the original run" — [Test cloud flows](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/test-cloud-flows).
- Programmatic resubmit conflict: the Management connector lists Resubmit Flow and Cancel Flow Run actions (search result only) — [Management connector](https://learn.microsoft.com/en-us/connectors/flowmanagement/). A Microsoft Q&A answer says no supported way exists (search result only) — [Q&A](https://learn.microsoft.com/en-us/answers/questions/5663485/1-is-there-a-supported-way-to-programmatically-res).

### Inferences
- The default retry count varies with profile and premium use, and three Microsoft pages disagree. Treat the numbers as unsettled and do not copy them as fact in comparisons.
- Retries counting as billable requests means a failing dependency can raise a customer's usage. FlowBridge could exclude platform-initiated retries from metering.
- Resubmit restarts the whole run from the trigger payload, as the warnings about duplicates suggest. Step-level resume with idempotency keys would be a significant improvement.

### Gaps
- Not documented in what I read: whether resubmission re-runs from the trigger only or can resume from a failed step; whether it uses the original or latest definition. The Microsoft note reads as advice, and I found no setting for it.
- The status list on Power Automate pages does not fully enumerate run statuses. Aborted appears in Logic Apps scope logic; Cancelled appears in FlowRun data; Waiting and Canceling appear on the bulk page.

## Monitoring: run history, analytics, admin analytics, alerts

### Takeaway
Five monitoring surfaces exist and none is complete. A serious gap: admin analytics excludes solution flows while the automation center covers only solution flows. Real alerting requires Application Insights in a Managed Environment.

### Cited Findings
- Portal run history: "transactional, and therefore provides a lossless view of runs" — [Run history in Dataverse](https://learn.microsoft.com/en-us/power-automate/dataverse/cloud-flow-run-metadata).
- Per-flow analytics on the details page includes an Actions tab with action counts — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- Dataverse `FlowRun` holds start and end, duration, status (Success, Failed, Cancelled), trigger type, error code and message, owner, parent run ID, and TTL. It feeds the automation center and is not lossless. `FlowEvent` signals known gaps through codes such as `IngestionRateDataLoss` and `ElasticTablePartitionLimitReached`. Writing does not use request quota, but reading does — [Run history in Dataverse](https://learn.microsoft.com/en-us/power-automate/dataverse/cloud-flow-run-metadata).
- Automation center: Runs, Process map (preview), Work queues, Machines, Errors, AI Builder activity, Savings, Capacity utilization. Recommendations need a Managed Environment. Data may lag up to an hour. Only solution-based cloud flows are included. Visibility needs ownership or environment-wide access; co-ownership is not enough — [Automation center](https://learn.microsoft.com/en-us/power-automate/automation-center-overview).
- Admin analytics in the Power Platform admin center: Runs, Usage, Created, Errors, Shared, and Connectors reports, with about 24-hour refresh and data kept up to 28 days. Available to environment, Power Platform, Dynamics 365, and Global admins. "Solution-aware flows... are currently not included in analytics reports." Not in government and sovereign clouds — [Admin analytics](https://learn.microsoft.com/en-us/power-platform/admin/analytics-flow).
- Application Insights: Requests table holds runs and Dependencies holds triggers and actions. Managed Environments only. Not lossless. Not in sovereign clouds — [Application Insights](https://learn.microsoft.com/en-us/power-platform/admin/app-insights-cloud-flow).
- Alerts: Azure Monitor rules on Failed requests (run failures) and Dependency call failures (triggers and actions), plus custom log queries for a specific flow or action. A webhook action group can call a flow for richer notification — [Application Insights](https://learn.microsoft.com/en-us/power-platform/admin/app-insights-cloud-flow).
- Built-in alerts: the service emails owners about common or critical failures such as broken connections or throttling, with error details and tips — [Robust error handling](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling).
- Removing the mobile app also removes push notifications on failure. Microsoft says makers must add an explicit Teams or email step with Run after has failed — [Mobile app overview](https://learn.microsoft.com/en-us/power-automate/mobile/overview-mobile).
- Usage reporting: Licensing > Power Automate > Usage in the admin centre has superseded the downloadable reports, with fields such as caller, entitled and consumed quantity — [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations).
- Weekly usage insights are a Managed Environment feature — [Managed Environments](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview).

### Inferences
- Taking the two limitation statements together, I infer that no single native dashboard covers both solution and non-solution flows in an environment, other than per-flow views. Microsoft does not state this directly.
- Run data is split deliberately: a lossless operational store with short retention and lossy telemetry streams. This is a reasonable architecture, but FlowBridge should design one queryable source with honest retention from the start.
- Native per-flow alert rules (for example, "notify on N failures in M minutes") do not appear in what I read. Offering them directly is an easy win.

### Gaps
- I did not find a native, no-Azure alert rule feature in the pages I read. The Power Automate monitoring guidance page I tried returned 404, so this is absence of evidence.
- Latency for Application Insights data is not given on the page.
- Whether admin analytics will add solution flows is not documented.

## Administration: environments, security roles, co-owners, governance, audit

### Takeaway
Control runs from tenant to environment to flow. Governance is layered on Entra groups, Dataverse security roles, data policies, and Managed Environments. Audit covers lifecycle and permission events, but not runs. Ownership is the operational weak point, which service principals address.

### Cited Findings
**Environments**
- Types: Production, Default, Sandbox, Trial, Developer, Dataverse for Teams. Each tenant has one Default environment shared by all users, where all licensed users get the Maker role, and Microsoft advises against production use — [Environments](https://learn.microsoft.com/en-us/power-platform/admin/environments-overview).
- Deprecations: new unmanaged developer environments stop on 15 November 2026, with suspension from 15 December 2026. New Dataverse for Teams environments stop on 15 November 2026, with suspension on 15 September 2027 and decommission on 30 October 2027 — [Environments](https://learn.microsoft.com/en-us/power-platform/admin/environments-overview).
- Environment history is a timeline of lifecycle actions, and it is deleted with the environment — [Environments](https://learn.microsoft.com/en-us/power-platform/admin/environments-overview).

**Roles**
- Three permission levels: environment roles, Dataverse security roles, and flow-level sharing — [Sharing guide](https://learn.microsoft.com/en-us/power-automate/guide-to-cloud-flow-sharing-permissions).
- Environment Admin has full control, including data policies. Environment Maker creates apps, connections, custom connectors, and flows, but gets no data access in Dataverse by default. Basic User is often required to run flows touching Dataverse — [Environments](https://learn.microsoft.com/en-us/power-platform/admin/environments-overview); [Sharing guide](https://learn.microsoft.com/en-us/power-automate/guide-to-cloud-flow-sharing-permissions).
- Admins can see and manage all flows in the environment without being shared. A security group on the environment limits who can be a member — [Sharing guide](https://learn.microsoft.com/en-us/power-automate/guide-to-cloud-flow-sharing-permissions).
- There is no Environment Run-Only role, and Microsoft suggests security groups as run-only recipients — [Sharing guide](https://learn.microsoft.com/en-us/power-automate/guide-to-cloud-flow-sharing-permissions).
- Power Automate Operator role (Ignite 2025 tag): sees all flows' run metadata through `FlowRun`, across the environment, and can export logs. Cannot create or edit flows, see per-action inputs and outputs, or resubmit and cancel. Solution flows only. Action-level access needs co-ownership, and Microsoft admits this "reduces separation of duties" — [Operator role](https://learn.microsoft.com/en-us/power-automate/operator-role).

**Co-owners**
- A co-owner can edit, view history, manage properties, add or remove owners (other than the creator), and delete. Owners who leave cause actions using their connections to fail until those are updated. If no active owner remains, an admin must change the owner, or recreate for non-solution flows — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows).
- Sharing with someone not in Dataverse auto-adds them. In a non-default environment, they get no Maker role and may only be able to run the flow — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows).

**Governance**
- Managed Environments are premium capabilities: environment groups, sharing limits, weekly usage insights, pipelines, solution checker, IP firewall, IP cookie binding, customer-managed key, Lockbox, extended backup, Application Insights export, VNet support, and masking rules. Included with standalone Power Automate licences — [Managed Environments](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview).
- Admin tooling includes PowerShell, the Power Platform for Admins connector, the Power Platform API, and the CoE Starter Kit — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows); [ACP](https://learn.microsoft.com/en-us/power-platform/admin/advanced-connector-policies).

**Audit**
- Microsoft Purview logs flow create, edit, and delete; permission edits and deletes; and trial events. Fields include user, IP, flow URL, connector names at event time, permission type, and recipient. Also available through the Office 365 Management API — [Purview logs](https://learn.microsoft.com/en-us/power-platform/admin/activity-logging-auditing/activity-logs-power-automate).
- Purview "don't include individual flow runs, action executions, and connector calls at runtime". Desktop flow activity sits in Dataverse audit logs — [Purview logs](https://learn.microsoft.com/en-us/power-platform/admin/activity-logging-auditing/activity-logs-power-automate).
- Pipelines save customization and audit logs automatically — [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines).

### Inferences
- The Operator role shows the classic mismatch: people who need to support production cannot see the data without gaining edit rights. A built-in "support" role with read access to step data, ideally with field masking, is a clear FlowBridge requirement.
- Tying flows to individual owners causes recurring pain, including licence inheritance, owner departure, and connection failure. FlowBridge should make organisation-owned workflows the default.

### Gaps
- I did not read the Purview retention period for these events. It depends on Purview configuration and is not on the page.
- Security role privilege tables for flows beyond the operator role were not read.

## Templates, Copilot and AI features, limits, and licensing or pricing

### Takeaway
Templates are a curated public gallery submitted through Partner Center, with no private template support. Copilot is built on Azure OpenAI and can generate and edit flows conversationally, and it is on by default. Pricing combines a per-user licence with a per-automation capacity licence, and connector tier is the key upsell.

### Cited Findings
**Templates**
- Templates are searched or browsed by category, the user confirms connections, then edits the flow — [Templates](https://learn.microsoft.com/en-us/power-automate/get-started-logic-template).
- Submission is by exporting a package and uploading through Partner Center with a SAS URI valid for at least 15 days. Title under 75 characters, description under 1,024. No personal data or secrets. Review within 24 to 48 hours. The team "verifies and possibly modifies" it. Deployment takes up to 48 hours. "Templates are for use in the public gallery only. They aren't supported for private use" — [Submit a template](https://learn.microsoft.com/en-us/power-automate/publish-a-template).
- Send a copy serves as an informal private template — [Share a cloud flow](https://learn.microsoft.com/en-us/power-automate/create-team-flows).

**Copilot**
- It understands intent and creates a flow from a prompt, sets up connections, applies parameters, edits on request, answers questions about the flow and product, and suggests descriptions. Powered by Azure OpenAI Service. Optimised for English. New designer only — [Copilot flows](https://learn.microsoft.com/en-us/power-automate/create-cloud-flow-using-copilot).
- The creation path: prompt, review proposed trigger and actions, check connection status (green check or red exclamation), create, then open the designer with a Copilot pane — [Copilot flows](https://learn.microsoft.com/en-us/power-automate/create-cloud-flow-using-copilot).
- Microsoft recommends a "When X happens, do Y" prompt, naming connectors where possible — [Copilot flows](https://learn.microsoft.com/en-us/power-automate/create-cloud-flow-using-copilot).
- Other Copilot surfaces: an expression assistant, flow troubleshooting, automation center analysis, calling Copilot Studio agents, and flows as plugins for Copilot for Microsoft 365 (preview) — [Copilot overview](https://learn.microsoft.com/en-us/power-automate/copilot-overview); [Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer).
- Enablement: on by default. In GPU regions (UK, Australia, US, India), disabling needs a support request with a PowerShell script, at tenant level only. Elsewhere it depends on the cross-geo data sharing toggle, also tenant level. Environment-level control is not available — [Copilot overview](https://learn.microsoft.com/en-us/power-automate/copilot-overview).

**Generative actions (preview)**
- "Authored, tested, and executed through an AI runtime." The maker gives an intent, the AI suggests inputs, outputs, connectors, and actions, and the maker accepts or rejects. Preview mode pauses before taking any action. Only actions in the plan can run. Run history shows the reasoning for each action — [Generative actions](https://learn.microsoft.com/en-us/power-automate/generative-actions-overview).
- Limits: text inputs only, up to 2,500 characters; nine connectors; up to three Word documents under 10 MB from the owner's OneDrive; cancelling the flow does not cancel the generative action; DLP applies only at the generative action level — [Generative actions](https://learn.microsoft.com/en-us/power-automate/generative-actions-overview).

**Agent flows**
- Metered through Copilot Studio with Copilot Credits rather than Power Platform requests. A cloud flow can be converted, irreversibly — [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations).

**Licensing model**
- User licence versus capacity licence. Capacity is allocated to an automation and gives it entitlements regardless of who runs it — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types).
- Free: for work or school accounts; create and run without sharing; standard connectors only — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types).
- Premium: unlimited flows within limits; standard, premium, and custom connectors; attended RPA; process mining; 5,000 AI Builder credits per month; 250 MB database and 2 GB file Dataverse storage — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types).
- Process: 250k actions per day; flow must be in a solution; stackable to 10; or shared across a flow group of up to 25 solution flows, single environment, no stacking; no child flow inheritance — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types); [Flow groups](https://learn.microsoft.com/en-us/power-automate/flow-groups); [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- Hosted Process: adds a Microsoft-hosted machine. Its superset use on cloud flows "isn't yet available" — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types).
- Instant flows with premium connectors need Premium for each invoker or a Process licence on the flow. Using a shared account to avoid licences is multiplexing and a licence violation — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- User licences apply at tenant level across all environments. Process licences, flow groups, and capacity assignments are environment-specific, and importing a flow to another environment creates a separate flow that needs its own assignment — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
- A global admin can start a free 30-day Process trial, extendable once, for a throttled flow — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).

**List prices (US, paid yearly; check live page)** — [Pricing page](https://www.microsoft.com/en-us/power-platform/products/power-automate/pricing)

| Plan | Price | Basis |
| --- | --- | --- |
| Power Automate Premium | $15.00 | per user per month |
| Power Automate Process | $150.00 | per bot per month |
| Power Automate Hosted Process | $215.00 | per bot per month |
| Process Mining add-on | $5,000.00 | per tenant per month, with 100 GB storage |

- Copilot Studio appears on the page as prepaid Copilot Credit Commit Units, with pay-as-you-go coverage when credits run out — [Pricing page](https://www.microsoft.com/en-us/power-platform/products/power-automate/pricing).
- Conflict on trial length: the pricing page shows a 30-day free trial — [Pricing page](https://www.microsoft.com/en-us/power-platform/products/power-automate/pricing). The licensing page says the user trial is 90 days — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types).
- Conflict on pay-as-you-go:
  - The FAQ says "The Power Platform requests meter isn't available yet, so pay-as-you-go isn't currently a way to run a flow above its daily action limits", and usage above limits "is reported but isn't charged" — [Licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs).
  - The Limits page lists pay-as-you-go flows under Unlimited Extended with 10 million requests per day — [Limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).
  - Customize triggers says "pay-as-you-go environments, where every flow run is charged" — [Customize triggers](https://learn.microsoft.com/en-us/power-automate/customize-triggers).
  - The FAQ also says Process licences cannot currently be used in a pay-as-you-go environment. Of these sources, the FAQ is the most specific.

**Desktop flows and process mining (brief)**
- Desktop flows automate UIs by mimicking mouse and keyboard. Attended requires Premium and unattended requires Process. Their actions do not consume Power Platform requests. A cloud flow can trigger them — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types); [Request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations).
- Process mining analyses event logs. It is included with Premium at 50 MB per licence (to 100 GB per tenant) — [Licence types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types).

### Inferences
- The strict template review and lack of private templates leave room for FlowBridge: organisation-private templates and a versioned template gallery seem easy to support.
- Tenant-only Copilot control, with a support ticket needed in some regions, is a real enterprise objection. FlowBridge should offer per-workspace AI controls from day one.
- Generative actions show the emerging hybrid model: deterministic flow with a bounded AI step using an explicit tool allowlist, a dry-run preview, and logged reasoning. This is a sound pattern to study.
- Licence logic needs a roughly 9,000-word FAQ to explain: owner versus invoker, multiplexing, seeded rights, in-context rules. Plain usage-based or workspace-based pricing would be a real market differentiator.

### Gaps
- No official template count was found. Pages say "many" templates.
- The Power Platform Licensing Guide (PDF via `go.microsoft.com`) was not read, so seeded licence details are partial, and I have no prices outside US list.
- I did not verify whether AI Builder credits are changing in favour of Copilot Credits. The Licence types page still lists 5,000 AI Builder credits per month, and the pricing page summary did not mention them.
- Copilot's model versions, data handling, and accuracy figures were not read. See the `faqs-copilot` and `responsible-ai-overview` pages.

## Needs user login

No public page I tried required sign-in. I did not attempt to sign in anywhere. The following are portal pages that would answer remaining questions, and they would likely need a Microsoft work or school account:

- `https://make.powerautomate.com/templates/` — actual number of templates and their categories, plus what a template looks like when opened. Learn publishes no count.
- `https://make.powerautomate.com/connectors` — live connector catalogue with tier labels, to check my link-based counts.
- `https://make.powerautomate.com` (a test flow) — the current Test pane wording for "recently used trigger", the skipped trigger checks view, and how run history presents step inputs and outputs. This would also settle the conflict over whether skipped checks appear.
- `https://admin.powerplatform.microsoft.com/` (Licensing > Power Automate > Usage, and Analytics) — what usage and capacity views actually show, and whether solution flows are still excluded.
- `https://make.powerautomate.com/pricing` — plan information in the product, to reconcile the 30-day and 90-day trial statements.
