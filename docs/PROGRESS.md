# FlowBridge progress tracker

**Read this first at the start of every work session. Update it before ending one, then commit and push.**

The project is worked on from two machines, a laptop and a PC. This file says where things stand, whichever machine was used last.

Before starting: run `git pull`. When finishing: add a new entry at the top of the log, update "Current state" and "Next", then commit and push.

## Log (newest first)

### 2026-11-13, laptop
- Ran "Support request to Jira" Version 2 as Lena with case 1 (High): the ticket and the Tasks row were created. The workflow has no step for the Customers sheet; adding one is still undecided.
- **`docs/demo-data.md`**: four ready-made support requests (High, Highest, Medium, Low) with what each should do, plus JSON versions. Customer emails are a placeholder because the repository is public.
- **Emails:** every designed email is signed "Powered by FlowBridge". New Style choice on Send email (Clean card or Branded header) with Tagline and Facts fields. The builder now shows fixed choices as a dropdown.
- **"Support request to Jira" Version 3** (published by Priya): all three customer emails use the Branded header. Not yet run.
- Notification emails are claimed before sending, so the laptop and the live site cannot both send one.
- **Deployed** on Render's free plan, Singapore: https://flowbridge-gxx7.onrender.com. It shares the Neon database with local copies. `PUBLIC_URL` is set, and the live callback address is added to the Google client.
- **Demo password changed** for all four accounts. The new one is in `D:\Adz4\FlowBridge Project\demo-accounts.txt` on the laptop, outside the repository; copy it to the PC by hand. The password in `flowbridge-html\README.txt` no longer works.
- **Reconnecting the same Google account now refreshes the existing connection** (same id, new 7-day clock) instead of adding a second one that no workflow uses.
- 174 automated checks, the type checks and the build pass.

### 2026-11-13, PC
- **Laptop work checked by eye:** the Administrator and Business User Overviews work. Fixed the missing red dot under "Did not finish" and the light-grey hover on the sidebar's sign-out button.
- **New workflow "Support request to Jira"** (published, Version 2): check the email, create a Jira ticket, log it in the Tasks sheet, then for Highest priority escalate the ticket and alert Slack, email the customer, and comment on the ticket. If Jira fails, Slack is alerted and the customer still gets an email. It is in the shared database, not in the code.
- **Jira app:** Create issue now fills Assignee, Priority, Labels, Start date, Due date, Story points and Sprint. New actions: Update issue and Add comment. Changed directly in the shared database, because there is no edit screen for an added app yet. Parent needs an epic and Team needs an Atlassian team; neither exists yet.
- **Dates in steps:** `{{dates.today}}`, `{{dates.tomorrow}}`, `{{dates.in_3_days}}` and so on, counted from when the run started, in the time zone of the person who started it (or the workflow's creator).
- **Custom apps:** a field left blank is now left out of the request entirely, instead of sending an empty `{}` the app rejects.
- **Designed emails:** Gmail's Send email has optional Heading, Highlight, Button text, Button link, Brand and Footer. With a heading, it sends a designed HTML email (plus a plain-text copy). Body rules: `## Title`, `1.` and `- ` lists, `Label: value` lines become a table. All text is escaped.
- **Run now form:** set up in the builder by clicking the Trigger card. Each question's wording, kind (short text, long text, email, dropdown), required, help text and order. Saved and published with the workflow. Dialogs taller than the window now scroll, so Run now can always be reached.
- **Checked by a real run as Lena:** she filled the form and SCRUM-14 was created with the fields filled. That run showed priority "High" becoming Medium and the date being a day behind (UTC); both are fixed in Version 2, which has **not been run yet**.
- Test leftovers: SCRUM-14 in Jira, Tasks sheet rows, Slack messages and test emails to ssrithar68@gmail.com. SCRUM-12 was deleted.
- 171 automated checks, the type checks and the build pass.

- **Sidebar:** Collapse button from the design.
- **Administrator Overview:** one row of figures with icons, status dots and small bars (members, connected apps, runs used, workflows, success rate), "Needs an Administrator" (expiring or broken connections, apps hitting a limit, run limit at 80%, members who have not signed in) and "Team by role". Recent activity has avatars.
- **Team templates:** Create template on the Templates page, saved without connections, with a "Made by your team" filter. Database update 0014.
- **Workspace settings:** keep run history (default 90 days; old run data is cleared daily, runs stay listed), default retries for new steps, and a Plan and usage card. Database update 0015.
- **Notifications tab** as in the design, with Email and In app switches for failures, a daily summary, expiring connections, changes to your workflow and new members. Emails go from the connected Gmail. Workflows now have owners, filled in from Activity. Database update 0016. Demo addresses on `.example` cannot receive email.
- **Roles checked route by route:** all 52 API routes allow exactly the roles in the agreed table. Two small fixes came out of it.
- **Business Users:** see only published workflows and live runs; Activity shows only their own and relevant entries (updates 0017 and 0018); and they have their own Overview with approvals, failures in plain words, automation cards with a simple Run form, and "What happened today".
- 158 automated checks, the type check and the build pass. Business User and Administrator screens were checked against the real data through the routes, but **not yet by eye in the browser**.

### 2026-11-12, PC
- **Builder checked by eye** and fixed: right-click menus now close when the canvas is moved or zoomed, and the "On error" line is drawn below the cards instead of behind them.
- **Builder tools from the design:** a ghost card while dragging a step in, plus and delete buttons on a pointed-at connection (the plus inserts a step and makes room for it), undo and redo (Ctrl+Z, Ctrl+Y), a live "N problems" badge, buttons above a selected card, and a bottom bar with Tile view, zoom, fit and Tidy. All use the design's own icons.
- **Activity:** numbered pages of 10 instead of Show more. Entries older than a year are removed once a day. Database update 0012 adds an index for this and is applied.
- **Workflows:** Sort by, list or grid view (remembered in the browser), grid cards as in the design, and numbered pages. Workflows now have an optional description, set when creating one or taken from a template. Without one, the card sums up the steps. Database update 0013 is applied.
- **Executions:** numbered pages, Workflow and Date filters, Retry or View on each row, "Failed at" the step's name, a step progress bar, the version that ran, and the design's totals. Export CSV covers every matching run, up to 1,000.
- 144 automated checks, the type check and the build pass. Everything above was checked in Chrome, except pressing Retry on a real run.

### 2026-11-11, laptop
- **Three roles instead of four:** Administrator, Workflow Builder and Business User. Workflow Creator and Technical Operator were merged into Workflow Builder after comparing Workato, Make and n8n (decisions 3.16 to 3.18). Priya and Rahul are now Workflow Builders in the shared database. Business Users can now retry failed runs. Database update 0011 is applied.
- New **Activity** page with the full history, search, day headings and Show more. Reached from **View all** on Overview and from an Activity tab in Settings.
- **Analytics** matches the design: Integration usage card, "Why runs failed" grouped into plain reasons, red failed-runs chart, taller successful-runs chart, and Failure as a percentage. Bars stay neutral grey, not orange.
- **Builder:** right-click a card (Open settings, Duplicate, Remove its connections, Delete step) or a connection (Delete, or switch between success and error, True and False, Approved and Rejected). Steps can be dragged from the left panel onto the canvas. Connections are easier: bigger dots, snapping when let go near a dot, and connecting when let go anywhere on a card.
- **Crash fix:** a dropped database connection no longer stops the whole server.
- **Jira proven:** the "Jira test" workflow (still a draft) took a customer problem, created `SCRUM-9` in Jira and posted the key in Slack. `SCRUM-6`, `SCRUM-7` and `SCRUM-8` are leftover tests to delete in Jira.
- The GitHub repository is now public. Its whole history was checked for secrets first.
- 144 automated checks, the type check and the build pass. **Not yet checked by eye:** the builder right-click menus, drag and drop and easier connecting, the Activity page and the new Analytics cards.

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
| 6. Sign-in, the three roles, draft and publish, monitoring, usage limits | Done and tested |
| 7. Public Home page, Sign in and remaining designed pages, deployment, testing report | Built. Going live is still to do |

## Next

1. On the laptop: `git pull`, then restart the server **before** running any Jira workflow. The shared database already has the new Jira app and Version 2 of "Support request to Jira", which need this code. Then run it as Lena with priority High and with Highest, and check the Jira fields, dates, email design and Slack alert. Delete SCRUM-14 and other test tickets afterwards if not wanted.
2. Check by eye as each role: Lena's new Overview (Run form, approvals, What happened today), the Administrator Overview, Templates, Settings (Workspace and Notifications) and the collapsed sidebar. Decide whether a workflow's description should be editable in the builder.
3. Lena signed in with the demo password on 2026-11-13, so re-seeding may not be needed. Check the other demo accounts can sign in.
4. Finish the manual check: publish and run, failure and retry, approval. Publish "Jira test" if it is wanted in the demo.
5. Deploy on Render, following the Deployment section of `README.md`.
6. Before sharing the address, change the demo password by running the seed command with a new `SEED_PASSWORD`.
7. Add the public address to the Google OAuth redirect addresses, then reconnect Gmail and Sheets on the live site. Google connections expire around 2026-11-16.
8. Copy `reports` and `research_notes` into `docs`.
9. Add the deployment link to the README and the final demonstration notes, then rehearse the demonstration.

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

**Roles**
- Three roles: Administrator, Workflow Builder and Business User. The assignment listed four, and Workflow Creator and Technical Operator were merged on 2026-11-11 after comparing Workato, Make and n8n. The permissions are listed in section 3 of `docs/DECISIONS.md` and in `apps/server/src/auth/permissions.ts`.

## Things to remember

- Google connections expire 7 days after connecting, while the Google project is in Testing status. The current ones expire around 2026-11-16. Reconnect them on the Integrations page shortly before any demo.
- Stripe is a sandbox registered as a United States account only because Stripe is invitation-only in India. Keep it in test mode and never activate it.
- The Render free host sleeps after 15 minutes idle. Open the site a few minutes before a demonstration.
- Demo accounts: jonah@ (Administrator), priya@ and rahul@ (Workflow Builder), lena@ (Business User), all at meridianlogistics.example.
- The workflow "Welcome new customers" is in the workspace and has passed a test run. It uses a spreadsheet with Customers and Tasks tabs.
- If `npm start` fails with `getaddrinfo ENOTFOUND` for the Neon address, the network's DNS is refusing it. Setting the Wi-Fi DNS to 8.8.8.8 and 8.8.4.4 fixed it on the laptop and the PC.
- To test a workflow that uses webhook data, enter test data as `{ "body": { "name": "Asha", "email": "you@example.com", "company": "Acme" } }`.
