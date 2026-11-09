import type { Connection, Definition, RetryPolicy, WorkflowStep } from "../types.ts";

// Ready-made workflows. Each one is only a starting draft: the person
// chooses connections and fills in their own details in the builder.

export type Template = {
  id: string;
  name: string;
  category: "Sales" | "Finance" | "Support" | "Operations";
  description: string;
  stepLabels: string[];
  definition: Definition;
};

const RETRY: RetryPolicy = { maxAttempts: 3, delaySeconds: 30 };

function connector(id: string, name: string, service: string, action: string, params: Record<string, unknown>, retry?: RetryPolicy): WorkflowStep {
  return { id, name, type: "connector", config: { connector: service, action, connectionId: "", params }, retry };
}

const slack = (id: string, name: string, text: string) => connector(id, name, "slack", "send_message", { channel: "#all-flowbridge-demo", text }, RETRY);
const email = (id: string, name: string, to: string, subject: string, body: string) => connector(id, name, "gmail", "send_email", { to, subject, body }, RETRY);
const addRow = (id: string, name: string, range: string, values: string[]) => connector(id, name, "google_sheets", "append_row", { spreadsheetId: "", range, values }, RETRY);

export const templates: Template[] = [
  {
    id: "welcome",
    name: "Welcome new customers",
    category: "Sales",
    description: "Check each registration, save it, send a welcome email, tell the sales team and create a follow-up task.",
    stepLabels: ["Validate", "Save", "Email", "Notify", "Task"],
    definition: {
      steps: [
        { id: "validate", name: "Validate customer", type: "if", config: { left: "{{trigger.body.email}}", operator: "exists" } },
        addRow("save_customer", "Save customer", "Customers", ["{{trigger.body.name}}", "{{trigger.body.email}}", "{{trigger.body.company}}"]),
        email("welcome_email", "Send welcome email", "{{trigger.body.email}}", "Welcome to Meridian Logistics", "Hi {{trigger.body.name}},\n\nThanks for registering. We will be in touch shortly."),
        slack("notify_sales", "Notify sales team", "New customer: {{trigger.body.name}} from {{trigger.body.company}}"),
        addRow("follow_up", "Create follow-up task", "Tasks", ["Call {{trigger.body.name}}", "{{trigger.body.email}}", "Open"]),
        slack("flag_invalid", "Flag invalid registration", "A registration arrived with no email address."),
      ],
      edges: [
        { from: "validate", to: "save_customer", when: "true" },
        { from: "validate", to: "flag_invalid", when: "false" },
        { from: "save_customer", to: "welcome_email", when: "success" },
        { from: "welcome_email", to: "notify_sales", when: "success" },
        { from: "notify_sales", to: "follow_up", when: "success" },
      ],
    },
  },
  {
    id: "follow-up",
    name: "Follow up after two days",
    category: "Sales",
    description: "Wait two days after a new lead arrives, then send a friendly follow-up email.",
    stepLabels: ["Delay", "Email"],
    definition: {
      steps: [
        { id: "wait", name: "Wait two days", type: "delay", config: { amount: 2, unit: "days" } },
        email("follow_up_email", "Send follow-up", "{{trigger.body.email}}", "Checking in", "Hi {{trigger.body.name}},\n\nDo you have any questions we can help with?"),
      ],
      edges: [{ from: "wait", to: "follow_up_email", when: "success" }],
    },
  },
  {
    id: "invoices",
    name: "Record paid invoices",
    category: "Finance",
    description: "Add each paid invoice to a finance sheet and email the receipt.",
    stepLabels: ["Save", "Email"],
    definition: {
      steps: [
        addRow("record_invoice", "Record invoice", "Invoices", ["{{trigger.body.invoice}}", "{{trigger.body.amount}}", "{{trigger.body.email}}"]),
        email("send_receipt", "Send receipt", "{{trigger.body.email}}", "Your receipt", "Thank you. We received your payment of {{trigger.body.amount}}."),
      ],
      edges: [{ from: "record_invoice", to: "send_receipt", when: "success" }],
    },
  },
  {
    id: "refunds",
    name: "Approve refund requests",
    category: "Finance",
    description: "Ask a person to approve each refund, then tell the team what was decided.",
    stepLabels: ["Approval", "Notify"],
    definition: {
      steps: [
        { id: "approve_refund", name: "Approve refund", type: "approval", config: { message: "Refund {{trigger.body.amount}} to {{trigger.body.email}}?", timeoutHours: 48 } },
        slack("refund_approved", "Announce approval", "Refund of {{trigger.body.amount}} approved."),
        slack("refund_rejected", "Announce rejection", "Refund of {{trigger.body.amount}} rejected."),
      ],
      edges: [
        { from: "approve_refund", to: "refund_approved", when: "approved" },
        { from: "approve_refund", to: "refund_rejected", when: "rejected" },
      ],
    },
  },
  {
    id: "tickets",
    name: "Sort support tickets",
    category: "Support",
    description: "Send urgent tickets to the on-call channel and log the rest in a sheet.",
    stepLabels: ["Priority", "Notify", "Save"],
    definition: {
      steps: [
        { id: "is_urgent", name: "Is it urgent?", type: "if", config: { left: "{{trigger.body.priority}}", operator: "equals", right: "urgent" } },
        slack("alert_on_call", "Alert on-call", "Urgent ticket: {{trigger.body.subject}}"),
        addRow("log_ticket", "Log ticket", "Tickets", ["{{trigger.body.subject}}", "{{trigger.body.priority}}"]),
      ],
      edges: [
        { from: "is_urgent", to: "alert_on_call", when: "true" },
        { from: "is_urgent", to: "log_ticket", when: "false" },
      ],
    },
  },
  {
    id: "announce",
    name: "Announce a list of items",
    category: "Operations",
    description: "Post one Slack message for every item in a list, and report any failure.",
    stepLabels: ["Loop", "Notify"],
    definition: {
      steps: [
        { id: "each_item", name: "Post each item", type: "loop", retry: RETRY, config: { items: "{{trigger.body.items}}", action: { type: "connector", config: { connector: "slack", action: "send_message", connectionId: "", params: { channel: "#all-flowbridge-demo", text: "{{loop.item}}" } } } } },
        slack("report_failure", "Report failure", "The list could not be posted."),
      ],
      edges: [{ from: "each_item", to: "report_failure", when: "error" }],
    },
  },
];

// Picks the first connection for each service, so that a template is ready to use where it can be.
export function withConnections(definition: Definition, connections: Connection[]): Definition {
  const connectionFor = (service: string) => connections.find((item) => item.connector === service && item.status === "active")?.id ?? "";

  return {
    edges: definition.edges,
    steps: definition.steps.map((step) => {
      if (step.type === "connector") return { ...step, config: { ...step.config, connectionId: connectionFor(step.config.connector) } };
      if (step.type === "loop" && step.config.action.type === "connector") {
        const action = { ...step.config.action, config: { ...step.config.action.config, connectionId: connectionFor(step.config.action.config.connector) } };
        return { ...step, config: { ...step.config, action } };
      }
      return step;
    }),
  };
}
