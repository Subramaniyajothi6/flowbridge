import { z } from "zod";
import { defineAction, type ActionContext, type Connector } from "./types.ts";

const API = "https://api.stripe.com/v1";

// Stripe expects form data rather than JSON, and has its own protection
// against repeats: the same Idempotency-Key returns the original result.
function postToStripe({ request, idempotencyKey }: ActionContext, path: string, fields: Record<string, unknown>) {
  const form = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) form.set(name, String(value));
  }

  return request(`${API}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "idempotency-key": idempotencyKey,
    },
    body: form.toString(),
  });
}

export const stripe: Connector = {
  id: "stripe",
  name: "Stripe (test mode)",
  auth: {
    type: "token",
    label: "Test secret key",
    help: "Starts with sk_test_. Found under Developers, API keys, in Stripe test mode.",
    // Only test keys are accepted, so a workflow can never move real money.
    pattern: /^(sk|rk)_test_/,
    patternMessage: "Only Stripe test keys are accepted. They start with sk_test_",
  },
  allowedHosts: ["api.stripe.com"],

  async test({ request }) {
    await request(`${API}/balance`);
    return { account: "Stripe test account" };
  },

  actions: {
    create_customer: defineAction({
      description: "Create a customer",
      input: z.object({
        email: z.email().optional(),
        name: z.coerce.string().optional(),
        description: z.coerce.string().optional(),
      }),
      run: (context, input) => postToStripe(context, "/customers", input),
    }),

    create_payment_intent: defineAction({
      description: "Create a payment for an amount in the smallest currency unit, such as paise",
      input: z.object({
        amount: z.coerce.number().int().positive(),
        currency: z.string().length(3),
        customerId: z.string().optional(),
        description: z.coerce.string().optional(),
      }),
      run: (context, { customerId, ...input }) =>
        postToStripe(context, "/payment_intents", {
          ...input,
          customer: customerId,
          "automatic_payment_methods[enabled]": true,
        }),
    }),

    list_customers: defineAction({
      description: "List recent customers",
      input: z.object({ limit: z.coerce.number().int().min(1).max(100).default(10) }),
      run: ({ request }, { limit }) => request(`${API}/customers?limit=${limit}`),
    }),
  },
};
