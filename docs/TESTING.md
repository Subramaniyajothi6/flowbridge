# FlowBridge testing report

Testing ran from 9 to 13 November 2026, against the real Neon database, real service accounts and the deployed site.

## Summary

| Test | Size | Result | Last run |
|------|------|--------|----------|
| Automated tests (`npm test`) | 174 tests in 13 files | All passed | 13 Nov |
| Type checks, server and interface | 2 | Passed | 13 Nov |
| Real workflow runs against real services | 32 runs, 174 steps | Recorded below, including real failures | 9 to 13 Nov |
| Worker killed in the middle of a step (`crash-test`) | 1 scenario | Passed | 10 Nov |
| Pauses and recovery, end to end | 18 checks | All passed | 10 Nov |
| Sign-in, roles, publishing and limits, end to end | 57 checks | All passed | 10 Nov |
| Every API route called as each of the three roles | 52 routes x 3 roles | Each allowed or refused exactly as designed | 12 Nov |
| Every main page measured at four screen widths | 11 pages x 4 widths | No overflow or clipped text, after fixes | 13 Nov |
| Live site after deployment | Pages, API, sign-in, connections | Working | 13 Nov |

## Automated tests

Run with `npm test` in `apps/server`, using Node's built-in test runner.

| Area | Tests | What is covered |
|------|-------|-----------------|
| Run engine (`engine.test.ts`) | 36 | References, definition rules, choosing the next action, pauses and error paths, If steps, the private address check |
| Connections and connectors (`connections.test.ts`) | 32 | Encryption, hiding secrets, each connector's requests for Slack, Stripe, Google Sheets and Gmail, connector steps in workflows, poll secrets |
| Triggers and webhooks (`triggers.test.ts`) | 23 | Poll planning, finding the list in a response, schedules, poll settings, webhook signatures and limits |
| Added apps (`custom-app.test.ts`) | 22 | Describing an app's API, running its actions, how it signs in |
| Designed emails (`email-layout.test.ts`) | 10 | Both styles, the body rules, escaping customer text, safe button links, the FlowBridge signature |
| App logos (`app-logo.test.ts`) | 7 | Finding a site's icon, checking uploaded images |
| Administrator tasks (`admin-tasks.test.ts`) | 5 | What needs an Administrator: expiring connections, limits, members who have not signed in |
| Plain words (`plain-words.test.ts`) | 4 | Run now form fields, failure explanations, one-sentence run summaries |
| Failure reasons (`failure-reasons.test.ts`) | 4 | Grouping real error messages into plain reasons |
| Dates (`dates.test.ts`) | 4 | Ready-made dates in the person's time zone |
| Notifications (`events.test.ts`) | 4 | Defaults, which rows each role sees, undeliverable addresses, 09:00 in each time zone |
| Roles (`permissions.test.ts`) | 3 | Each role's exact permissions |
| Templates (`templates.test.ts`) | 2 | Saving a workflow as a template without its connections |

## Real executions

Every run below used real accounts: a Slack workspace, Gmail, Google Sheets, a Stripe sandbox and a Jira site.

| | Live runs | Test runs |
|---|---|---|
| Succeeded | 15 | 12 |
| Failed | 2 | 3 |

Across all 32 runs, 174 steps were recorded: 105 succeeded, 63 were skipped because their branch was not taken, and 6 failed. Two steps used all 3 of their attempts, and one failed run was retried from its failed step and succeeded.

## Successful executions

| Scenario | Result |
|----------|--------|
| Support request to Jira, High priority, started by a Business User with the Run now form | Jira ticket SCRUM-18 created with the form's fields, logged in the Tasks sheet, "Request received" email delivered in the Branded header design, comment added to the ticket. The urgent steps were skipped. 5 seconds. |
| Support request to Jira, Highest priority | SCRUM-19 created, logged, escalated in Jira, Slack alert posted, "Urgent: escalated" email delivered, comment added. The normal email was skipped. 6 seconds. |
| Welcome new customers, the assignment's scenario | Customer row added, welcome email sent, Slack message posted, follow-up task added |
| Jira test: support request to Jira and Slack | SCRUM-9 created and its key posted in Slack |
| Slack, Gmail, Google Sheets and Stripe, one workflow each | Message posted, email sent, row added, test customer created |
| Delay of 3 seconds | Showed as waiting, and the next step did not start until the wait ended |
| Approval, approved and rejected | The message was filled in with run data, and the matching branch ran |
| Loop over 3 items | 3 calls were made, each with its own item and position |
| Failure handled by an error path | The error path ran and the run succeeded |
| Test run of a draft | Ran, was marked as a test, and was not counted in usage or statistics |
| Live run of a published workflow | Used the published version, not the newer draft |
| Version history | Support request to Jira went from Version 1 to 3. Earlier runs still show the version they used |

## Failed executions

### Real failures that happened during testing

| What failed | Cause | How FlowBridge handled it |
|-------------|-------|---------------------------|
| Welcome new customers, step "Save customer", 2 test runs | The sheet's tab was named " Customers" with a leading space | Each run tried the step 3 times with growing waits, recording every attempt, then failed with Google's own message (`Unable to parse range: Customers`). After the tab was renamed, one run was retried from the failed step and succeeded, without repeating the steps that had already worked. |
| Slack test, step "Notify", 2 live runs | The Slack channel did not exist (`channel_not_found`) | The step had no retries set, so each run failed on the first attempt, with the step and reason shown. Analytics grouped it as "Slack: could not find what it needed", and Business Users were told it needs a Workflow Builder, because retrying would not help. |
| Jira test, 1 test run, 2 steps | Started without the subject the workflow needs (`Could not find "trigger.body.subject"`) | Failed at once without retrying, because a missing value cannot appear by retrying. The Run now form now asks for every value a workflow uses, so a Business User cannot start a run with one missing. |

### Failures caused on purpose

| Scenario | Result |
|----------|--------|
| Server replies 503, with retries | Tried twice, and both attempts were recorded with their reasons |
| Loop given something that is not a list | Failed with a clear message |
| Second decision on an approval | Refused |
| Retry from failed step | New run, the steps that had worked were not repeated, the failed step ran again, and the original run was unchanged |
| Run from start | Repeated every step |
| Worker killed during a step | The finished step did not repeat, the interrupted step repeated once with the same idempotency key, and the run succeeded |
| Monthly limit reached | Live runs refused, while test runs were still allowed |
| Run data older than the history period | Its inputs and outputs were cleared and the run stayed listed, tried inside a transaction that was then undone |

## Security and permissions

| Scenario | Result |
|----------|--------|
| API, connections or runs without signing in | Refused, on the local app and the live site |
| Wrong password | Refused, with no session created |
| Registering when a workspace exists | Refused |
| Every API route as Administrator, Workflow Builder and Business User | 52 routes, each allowing or refusing exactly the roles in DECISIONS.md section 3 |
| Business User viewing step data, drafts or test runs | Not sent by the server |
| Business User's activity | Only their own entries, entries about them, and changes to live workflows |
| Member and settings changes by non-Administrators | Refused |
| Removing or demoting the last Administrator | Refused |
| Deactivating a member | Signed out at once |
| Draft workflow started by run or webhook | Refused |
| Responses checked for password hashes and credentials | None found |
| Two copies of the app sharing one database | Each notification email is claimed with a row lock before it is sent, so only one copy can send it. The claim query was run against the database. Two copies racing each other were not staged. |
| Reconnecting the same Google account | Refreshed the existing connection, so workflows kept working. Tried with throwaway rows, then on the live site |

## Interface

- Every main page was measured at 375, 768, 1024 and 1440 pixels wide, signed in as an Administrator. Nothing was wider than the screen, stuck out of the sidebar or bottom bar, or had its text clipped. Three problems found this way were fixed:
  - The sign-out button stuck out of the tablet sidebar.
  - A figure sat alone on its row on tablets.
  - A fifth figure stood alone on phones.
- The phone bottom bar shows exactly five tabs, and its More sheet fits the screen, lists the right pages for the role and closes with Esc.
- Screens were reviewed by eye on 11 November (every role except Business User) and 13 November (the Administrator and Business User Overviews).

## Not tested

- **Notification emails** have not reached a real inbox. The demo accounts use reserved `.example` addresses, which FlowBridge deliberately does not send to. The sending code and the claim that prevents duplicates were run against the database.
- **The "Jira fails" path** of Support request to Jira has not been forced in a live run.
- **Webhooks from a real third-party service:** deliveries were sent with test requests, including signed ones, rather than from a service such as Stripe or GitHub.
- **Approval timeouts** were not waited out. The shortest timeout is one hour.
- **Screen widths as a Business User:** the measurements were done as an Administrator.
- **Load:** there are no load tests. The free database and host set the limits.
