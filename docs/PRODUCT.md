# FlowBridge product requirements

## The problem

Organisations run their daily work across disconnected applications. People move information between them by hand, send repetitive notifications, and find out about failures late. FlowBridge connects those applications, runs the process automatically, and shows exactly what happened.

## Who uses it

| Role | What they do |
|------|--------------|
| Administrator | Manages members, the workspace and integrations, and can do everything else |
| Workflow Creator | Builds, tests and publishes workflows, and manages integrations |
| Technical Operator | Investigates failures, sees step data, retries runs and checks system health. Sees the builder read-only |
| Business User | Runs published workflows, follows their progress and makes approval decisions |

The full permissions are in section 3 of [DECISIONS.md](DECISIONS.md) and in `apps/server/src/auth/permissions.ts`.

## What it does

| Area | Capability |
|------|------------|
| Build | Visual canvas, templates, data picker, single-step testing |
| Steps | HTTP request, If / else, Delay, Approval, Loop, Slack, Google Sheets, Gmail, Stripe test mode |
| Start | Webhook with optional signature, schedule, polling for new items, manual run |
| Publish | Drafts stay private, test runs are separate, and each publish is a numbered version |
| Reliability | Background processing, crash recovery, retries with increasing waits, error paths, retry from the failed step |
| Monitor | Execution history, the step-by-step run page, Overview, Analytics, system health, CSV export |
| Control | Four roles enforced on the server, encrypted credentials, monthly run limit |

## Example: new customer registration

This follows the scenario in the assignment, and is available as the template "Welcome new customers".

| Step | FlowBridge step |
|------|-----------------|
| 1. Receive the registration event | Webhook trigger |
| 2. Validate the submitted data | If / else, with a separate path for invalid data |
| 3. Store the customer | Google Sheets, Append row |
| 4. Send a confirmation email | Gmail, Send email, retrying up to 3 times |
| 5. Notify the sales team | Slack, Send message |
| 6. Create a follow-up task | Google Sheets, Append row |
| 7. Record execution history | Automatic for every run |

If the welcome email fails, the run page shows the step and the reason. Retry from failed step carries on from there, and the customer is not saved twice.

## Assumptions and limitations

- One workspace per installation. The first person registers, and an Administrator adds everyone else.
- There is no email service, so new members receive a temporary password from their Administrator.
- A spreadsheet stands in for a customer database, because no database connector is included. An HTTP step can call any database that has a web API.
- References are looked up as paths, so a workflow cannot run custom code.
- A loop repeats one action, for up to 100 items.
- Waits are checked every 20 seconds, so a delay can end up to 20 seconds late.
- Google connections expire after 7 days while the Google project is in Testing status.
- Slack, Gmail and Sheets offer no repeat protection, so a crash during those steps can repeat them.
- The free host sleeps when idle. Overdue schedules and delays run when it wakes.
