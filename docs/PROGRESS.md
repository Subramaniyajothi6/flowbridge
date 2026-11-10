# FlowBridge progress tracker

**Read this first at the start of every work session. Update it before ending one, then commit and push.**

The project is worked on from two machines, a laptop and a PC. This file says where things stand, whichever machine was used last.

Before starting: run `git pull`. When finishing: add a new entry at the top of the log, update "Current state" and "Next", then commit and push.

## Log (newest first)

### 2026-11-11
- The notification bell now opens a Notifications panel instead of going to Overview. Read status is saved per person.
- Overview: Recent activity is full width, one entry per line, and the cards above it line up in two rows.
- New **Add app** on Integrations, for Administrators: add an app such as Jira by describing its web API. Jira was added and connected this way with a real account, but no workflow has used it yet.
- Logos: an uploaded logo is used, or else the app's own site icon is fetched. Administrators can change any app's logo, including the built-in ones.
- Integrations now has a Connected accounts tab (status, used by, last checked, added by), search and category chips, an "Expiring soon" status for Google connections, and a confirm step before disconnecting.
- Avatar menu at the top right, with Settings, Help and Sign out.
- Member, password, settings and logo activity is now shown only to Administrators.
- A connection's key is now removed from any reply before it is saved. A test service that echoes headers showed this was needed.
- 137 automated checks and the type check pass. Every role was checked in the browser except Business User, whose demo password Jonah reset on 2026-11-10.
- Four small database updates were added and applied to the shared database.

### 2026-11-10, laptop, manual check
- Pulled the stage 5 to 7 work and started checking the whole app by hand.
- Proved the "Welcome new customers" template in a test run with real accounts: rows added to Sheets, email sent, Slack message posted.
- Google Sheets "Add row" can now write column headings when the first row of a tab is empty. The templates use this.
- Integrations cards now wait for both lists, so a connected service no longer shows an orange Connect button for a moment.
- The Workflows list now shows the result of a test run with a "Test only" label, instead of "Never run".
- 109 automated checks and the type check pass. The Workflows label has not yet been seen on screen after a server restart.

### 2026-11-10, laptop
- Reviewed the stage 4 screens against the prototype and fixed the differences on Integrations, the run page and the builder.
- Built stage 5: delay, approval, loop, retries with increasing waits, error paths, retry from failed step and run from start.
- Built stage 6: sign-in, the four roles enforced on the server, Team, Settings, draft and publish, test runs, Overview, Analytics, system health and the monthly run limit.
- Built stage 7 apart from going live: public Home page, Docs, Templates, deployment settings and the documents the assignment asks for.
- Tested with 106 automated checks, the crash test, 75 end-to-end checks against the real database, and a browser review as all four roles and at phone width. Results are in `docs/TESTING.md`.
- After `npm run build`, a restart is no longer needed.
- Demo accounts now exist in the shared database. Their password is in `flowbridge-html/README.txt`.

### 2026-11-09, laptop
- Built the visual builder and execution screens (stage 4). Code is committed and pushed.
- Tested by driving the real interface in a headless browser against the real database: create a workflow, add steps, blocked save on a blank URL, single-step test, data picker, branching, save, run, live status on the canvas, execution details, reload, Integrations page, small-screen message. All passed with no browser errors.
- Not done: nobody has looked at the new screens by eye yet. The automated test proves they work, not that they look right.
- The laptop has 4 GB of RAM and ran out of memory during this work, which is why work is moving to the PC.

## Current state

| Stage | Status |
|---|---|
| 1. Run engine with crash recovery | Done |
| 2. Triggers: webhook, schedule, polling | Done |
| 3. Connections and integrations | Done, proven with real accounts |
| 4. Visual builder and execution screens | Done, reviewed against the prototype |
| 5. Pauses and recovery: delay, approval, loops, retries, error paths, retry from failed step | Done and tested |
| 6. Sign-in, the four roles, draft and publish, monitoring, usage limits | Done and tested |
| 7. Public Home page, Sign in and remaining designed pages, deployment, testing report | Built. Going live is still to do |

## Next

1. Finish the manual check: build, publish and run, failure and retry, approval. The Integrations Test buttons and the role checks were done on 2026-11-11.
2. Use the connected Jira app in a workflow ("Create issue" in project `SCRUM`), and walk through adding GitHub with Add app.
3. Deploy on Render, following the Deployment section of `README.md`.
4. Before sharing the address, change the demo password by running the seed command with a new `SEED_PASSWORD`.
5. Add the public address to the Google OAuth redirect addresses, then reconnect Gmail and Sheets on the live site.
6. Copy `reports` and `research_notes` into `docs`, and make the repository public or share access.
7. Add the deployment link to the README and the final demonstration notes, then rehearse the demonstration.

## Setting up a new machine

The following are deliberately not in Git and must be brought over by hand, never through chat or Git:

- **`.env`** in the repository root. Copy it from the other machine. It must be the same file, because `ENCRYPTION_KEYS` is what unlocks the saved connections. With a different key, Slack, Stripe, Gmail and Sheets all have to be connected again.
- **`client_secret_*.json`** is the Google client download. It is ignored by Git and not needed to run the app, because its values are already in `.env`.

Then:

```
git clone https://github.com/Subramaniyajothi6/flowbridge.git
cd flowbridge
npm install
npm run db:migrate
npm run build
npm start
```

Open http://localhost:3000.

`npm start` serves the built interface and the API from one process, which is the lightest way to run. After changing frontend code, run `npm run build` again. After changing server code, restart it. On a machine with enough memory, run `npm run dev` for the server and `npm run dev --workspace apps/web` for live frontend reloading.

## Where things are

- `apps/server`: API, run engine, triggers, connections, connectors.
- `apps/web`: the React interface. `src/design-system.css` is the approved stylesheet, copied from the design prototype.
- `docs/DECISIONS.md`: every decision and the reason for it. Add new decisions as they are made.
- Neon database project: `flowbridge`, id `muddy-bar-55995003`, in Singapore. It is one of three projects in the account. Do not touch `recycleconnect` or `classroom-management-application`.
- Private GitHub repository: `Subramaniyajothi6/flowbridge`. The separate `flowbridge-design-options` repository only holds design comparison pages.
- Connected accounts: Slack workspace FlowBridge Demo (post to `#all-flowbridge-demo`, there is no `#general`), a Stripe sandbox, and Google project `flowbridge-514215`.

Outside this repository, in the laptop's `D:\Adz4\FlowBridge Project` folder:

- `flowbridge-html`: the approved HTML design prototype, the visual reference for all remaining screens.
- `reports` and `research_notes`: the product research.
- The assignment PDF.

## Rules for this project

**Commits and repository text**
- Commits are authored by the owner only. No co-author lines, and no mention anywhere in commits, pull requests or repository text of how the code was produced or what tools helped write it.
- Commit and push only when asked, or when finishing a session as described above.
- Never commit `.env` or any key.

**Cost and machine limits**
- Only free and open-source tools and free hosting. Never suggest a paid plan as a solution, because this is an internship project.
- Check current free limits before relying on a service, and design around them.
- Secrets are typed into the app or `.env`, never pasted into chat.

**Code**
- The owner knows JavaScript and has to explain this code to the team. Keep it plain and well named, avoid clever abstractions and advanced TypeScript.
- A lease must always be longer than the longest step.

**Design (all of it was reviewed and approved by the team)**
- Do not produce a generic template look.
- Public Home page: Ember, with warm browns and burnt orange, Manrope and DM Mono fonts, and the existing hero with two side glows. Other pages: orange and graphite, with zinc neutrals and a solid dark sidebar.
- Orange `#C94C0A` means an action or the selected item, nothing else. Running is blue `#2563EB`. Error `#BE123C`, warning `#A16207`, success `#166534`. Chart bars and role chips are neutral.
- No gradients on buttons or the scroll progress line, and no gradient sidebar. Other approved gradients stay. Change only what was asked for.
- Background placements: Horizon glow on Sign in, the Create workspace panel and the Home closing section. Fine grid on the Home failure section and the replay panel. Light grid at the top of Docs. Grain and spotlight on No access. Flow lines in empty states. Busy work pages stay plain.

**Roles (from the assignment)**
- Administrator, Workflow Creator, Business User, Technical Operator. The permissions are listed in section 3 of `docs/DECISIONS.md`.

## Things to remember

- Google connections expire 7 days after connecting, while the Google project is in Testing status. The current ones expire around 2026-11-16. Reconnect them on the Integrations page shortly before any demo.
- Stripe is a sandbox registered as a United States account only because Stripe is invitation-only in India. Keep it in test mode and never activate it.
- The Render free host sleeps after 15 minutes idle. Open the site a few minutes before a demonstration.
- Demo accounts: jonah@ (Administrator), priya@ (Workflow Creator), rahul@ (Technical Operator), lena@ (Business User), all at meridianlogistics.example.
- The workflow "Welcome new customers" is in the workspace and has passed a test run. It uses a spreadsheet with Customers and Tasks tabs.
- If `npm start` fails with `getaddrinfo ENOTFOUND` for the Neon address, the network's DNS is refusing it. Setting the Wi-Fi DNS to 8.8.8.8 and 8.8.4.4 fixed it on the laptop.
- To test a workflow that uses webhook data, enter test data as `{ "body": { "name": "Asha", "email": "you@example.com", "company": "Acme" } }`.
