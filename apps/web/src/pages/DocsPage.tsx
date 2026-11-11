import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.tsx";
import { BrandMark } from "../components/Shell.tsx";

type Point = { title: string; text: ReactNode };
type Topic = { title: string; intro: string; points: Point[] };

const topics: Topic[] = [
  {
    title: "Getting started",
    intro: "Build and publish your first workflow in four steps.",
    points: [
      { title: "1. Connect your apps", text: "Open Integrations and connect the services you use. Credentials are encrypted and never shown again." },
      { title: "2. Start a workflow", text: "Pick a template, or create a blank workflow. The Trigger on the canvas is the event that starts it." },
      { title: "3. Add and connect steps", text: "Add steps from the list on the left, then draw a line from one to the next. Select a step to fill in its settings." },
      { title: "4. Test, then publish", text: "Test workflow runs your draft for real, but marks it as a test. When it works, Publish makes it live." },
    ],
  },
  {
    title: "Workflows and steps",
    intro: "A workflow is a set of steps connected in order.",
    points: [
      { title: "Triggers", text: "A workflow can start from a webhook, a schedule, a check for new items in a list, or a person clicking Run." },
      { title: "Actions", text: "HTTP request calls any web address. Slack, Gmail, Google Sheets and Stripe steps use your connected accounts." },
      { title: "Logic", text: "If / else chooses a path. Delay waits for up to 7 days. Approval pauses until a person decides. Loop repeats one action for up to 100 items." },
      { title: "Using data from earlier steps", text: <>Use Insert data to pick a value, or type a reference such as <code className="var">{"{{steps.save.output.id}}"}</code>. A webhook's data is under <code className="var">{"{{trigger.body}}"}</code>. Inside a Loop, use <code className="var">{"{{loop.item}}"}</code>.</> },
    ],
  },
  {
    title: "Publishing and versions",
    intro: "Editing never changes what is live until you publish.",
    points: [
      { title: "Drafts", text: "Save keeps your changes as a draft. Webhooks, schedules and the Run button keep using the published version." },
      { title: "Test runs", text: "A test really sends messages and changes data, so use test accounts. Test runs are left out of statistics and usage." },
      { title: "Testing a webhook workflow", text: <>Select the Trigger and enter test data in the same shape a webhook delivers, for example <code className="var">{'{ "body": { "email": "a@example.com" } }'}</code>.</> },
      { title: "Versions", text: "Each publish creates a new numbered version. A run keeps the version it started with, so history stays accurate." },
    ],
  },
  {
    title: "When a run fails",
    intro: "Every run records what happened at each step.",
    points: [
      { title: "Automatic retries", text: "A step can try up to 5 times, waiting longer after each attempt. The run page shows what each attempt saw." },
      { title: "Error paths", text: "Connect the red dot at the bottom of a step to run other steps when it fails, instead of stopping the run." },
      { title: "Retry from failed step", text: "This starts a new run that keeps the steps that succeeded, so nothing is repeated, and carries on from the failure using the published version." },
      { title: "Run from start", text: "This starts a new run with the same data and repeats every step." },
    ],
  },
  {
    title: "Team and roles",
    intro: "Each person has one of three roles.",
    points: [
      { title: "Administrator", text: "Everything, including adding members, changing workspace settings and adding new apps." },
      { title: "Workflow Builder", text: "Builds, tests, publishes and looks after workflows. Manages integrations, investigates failures with full step data and checks system health." },
      { title: "Business User", text: "Runs published workflows, follows their progress, retries failed runs and makes approval decisions." },
    ],
  },
];

export function DocsPage() {
  const { session } = useAuth();
  const [index, setIndex] = useState(0);
  const topic = topics[index];
  const next = topics[index + 1];

  return (
    <div className="docs">
      <header className="docs-top">
        <Link className="row docs-brand" to="/" aria-label="FlowBridge home"><BrandMark /> FlowBridge</Link>
        <div className="grow" />
        {session ? (
          <Link className="btn btn-p" to="/overview">Back to the app</Link>
        ) : (
          <>
            <Link className="btn btn-g" to="/sign-in">Sign in</Link>
            <Link className="btn btn-p" to="/register">Get started</Link>
          </>
        )}
      </header>

      <div className="docs-body">
        <nav className="docs-side" aria-label="Topics">
          {topics.map((item, position) => (
            <button key={item.title} className={`docs-link ${position === index ? "is-on" : ""}`} aria-current={position === index ? "page" : undefined} onClick={() => setIndex(position)}>{item.title}</button>
          ))}
        </nav>
        <article className="docs-article">
          <h1 className="page-title">{topic.title}</h1>
          <p className="page-sub">{topic.intro}</p>
          <div className="docs-points">
            {topic.points.map((point) => (
              <div className="card card-b" key={point.title}>
                <b>{point.title}</b>
                <p className="muted">{point.text}</p>
              </div>
            ))}
          </div>
          {next && <button className="btn" onClick={() => setIndex(index + 1)}>Next: {next.title}</button>}
        </article>
      </div>
    </div>
  );
}
