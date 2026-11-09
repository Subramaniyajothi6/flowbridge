# FlowBridge progress tracker

**Read this first at the start of every work session. Update it before ending one, then commit and push.**

The project is worked on from two machines, a laptop and a PC. This file says where things stand, whichever machine was used last.

Before starting: run `git pull`. When finishing: add a new entry at the top of the log, update "Current state" and "Next", then commit and push.

## Log (newest first)

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
| 4. Visual builder and execution screens | Built and tested, visual review still to do |
| 5. Pauses and recovery: delay, approval, loops, retries, error paths, retry from failed step | Not started |
| 6. Sign-in, the four roles, draft and publish, monitoring, usage limits | Not started |
| 7. Public Home page, Sign in and remaining designed pages, deployment, testing report | Not started |

The API and all screens have **no sign-in yet**. Do not deploy publicly until stage 6 is done.

## Next

1. Open the app and review every screen by eye against the design prototype. Fix anything that looks wrong.
2. Build stage 5.

## Setting up a new machine

The following are deliberately not in Git and must be brought over by hand, never through chat or Git:

- **`.env`** in the repository root. Copy it from the other machine. It must be the same file, because `ENCRYPTION_KEYS` is what unlocks the saved connections. With a different key, Slack, Stripe, Gmail and Sheets all have to be connected again.
- **`client_secret_*.json`** is the Google client download. It is ignored by Git and not needed to run the app, because its values are already in `.env`.

Then:

```
git clone https://github.com/Subramaniyajothi6/flowbridge.git
cd flowbridge
npm install
npm run build
npm start
```

Open http://localhost:3000.

`npm start` serves the built interface and the API from one process, which is the lightest way to run. After changing frontend code, run `npm run build` again. On a machine with enough memory, run `npm run dev` for the server and `npm run dev --workspace apps/web` for live frontend reloading.

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
- Test accounts from the prototype, for the sign-in stage: jonah@ (Administrator), priya@ (Workflow Creator), rahul@ (Technical Operator), lena@ (Business User), all at meridianlogistics.example.
