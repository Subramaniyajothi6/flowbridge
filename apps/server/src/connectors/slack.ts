import { z } from "zod";
import { defineAction, type Connector, type ConnectorRequest } from "./types.ts";

// Slack replies with status 200 even for errors, and reports them in the body.
async function callSlack(request: ConnectorRequest, method: string, body: object) {
  const response = await request(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Slack said: ${response.error}`);
  return response;
}

export const slack: Connector = {
  id: "slack",
  name: "Slack",
  auth: {
    type: "token",
    label: "Bot token",
    help: "Starts with xoxb-. Found under OAuth & Permissions in your Slack app.",
    pattern: /^xoxb-/,
    patternMessage: "A Slack bot token starts with xoxb-",
  },
  allowedHosts: ["slack.com"],

  async test({ request }) {
    const response = await callSlack(request, "auth.test", {});
    return { account: response.team };
  },

  actions: {
    send_message: defineAction({
      description: "Post a message to a channel",
      input: z.object({
        channel: z.string().min(1),
        text: z.coerce.string().min(1),
      }),
      async run({ request }, input) {
        const response = await callSlack(request, "chat.postMessage", input);
        return { channel: response.channel, timestamp: response.ts };
      },
    }),
  },
};
