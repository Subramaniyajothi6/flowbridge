# FlowBridge testing report

Tested on 2026-11-10 against the real Neon database and the running application.

## Summary

| Test | Checks | Result |
|------|--------|--------|
| Automated rules (`npm test`) | 106 | All passed |
| Type checks, server and interface | 2 | Passed |
| Worker killed in the middle of a step (`crash-test`) | 1 scenario | Passed |
| Pauses and recovery, end to end | 18 | All passed |
| Sign-in, roles, publishing and limits, end to end | 57 | All passed |
| Screens reviewed in a browser | All pages, 4 roles, phone width | Passed, no browser errors |

## Successful executions

| Scenario | Result |
|----------|--------|
| Delay of 3 seconds | Showed as waiting, and the next step did not start until the wait ended |
| Approval, approved | The message was filled in with run data and the approved branch ran |
| Approval, rejected | The rejected branch ran |
| Loop over 3 items | 3 calls were made, each with its own item and position |
| Failure handled by an error path | The failed step's path ran and the run succeeded |
| Test run of a draft | Ran and was marked as a test, and was not counted in usage |
| Live run of a published workflow | Used the published version, not the newer draft |
| Real services | Slack, Google Sheets, Gmail and Stripe test mode were proven with real accounts |

## Failed executions

| Scenario | Result |
|----------|--------|
| Server replies 503, with retries | Tried twice, and both attempts were recorded with their reasons |
| Slack channel does not exist | Failed with a plain explanation and a next step |
| Loop given something that is not a list | Failed with a clear message |
| Second decision on an approval | Refused |
| Retry from failed step | New run, the first step was not repeated, the failed step ran again, and the original run was unchanged |
| Run from start | Repeated every step |
| Worker killed during a step | The finished step did not repeat, the interrupted step repeated once with the same idempotency key, and the run succeeded |
| Monthly limit reached | Live runs refused, while test runs still allowed |

## Security and permissions

| Scenario | Result |
|----------|--------|
| API, connections or runs without signing in | Refused |
| Wrong password | Refused, with no session created |
| Registering when a workspace exists | Refused |
| Business User or Technical Operator creating or publishing | Refused |
| Business User viewing step data | Hidden on the server |
| Business User or Technical Operator managing connections | Refused |
| Member and settings changes by non-Administrators | Refused |
| Removing or demoting the last Administrator | Refused |
| Deactivating a member | Signed out at once |
| Draft workflow started by run or webhook | Refused |
| Responses checked for password hashes and credentials | None found |

## Not tested

- The application has not been run on the public host yet.
- The "Welcome new customers" template has not been run with real accounts, because it sends real email and needs a spreadsheet with Customers and Tasks tabs.
- Approval timeouts were not waited out. The shortest timeout is one hour.
- There are no load tests.
