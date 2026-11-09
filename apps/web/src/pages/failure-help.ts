type FailureHelp = { explanation: string; nextStep: string };

const FIX_AND_RUN_AGAIN = "open the workflow, correct this step, then use Retry from failed step.";
const RECONNECT = "connect the account again on the Integrations page, then use Retry from failed step.";
const TRY_LATER = "wait a few minutes, then use Retry from failed step.";

// Turns the messages services send back into plain language.
// Each pattern is a message we know about. Anything else is shown as it arrived.
const KNOWN_FAILURES: { pattern: RegExp; explanation: string; nextStep: string }[] = [
  { pattern: /channel_not_found/, explanation: "Slack could not find that channel. The name may be misspelled, or the channel may be private.", nextStep: FIX_AND_RUN_AGAIN },
  { pattern: /not_in_channel/, explanation: "The FlowBridge app has not been added to that Slack channel.", nextStep: "invite the app to the channel in Slack, then use Retry from failed step." },
  { pattern: /invalid_auth|token_revoked|token_expired|account_inactive|invalid_grant/, explanation: "The saved connection for this service no longer works.", nextStep: RECONNECT },
  { pattern: /status 40[13]\b/, explanation: "The server refused the request because it was not allowed to do this.", nextStep: FIX_AND_RUN_AGAIN },
  { pattern: /status 404\b/, explanation: "The server could not find the address this step called.", nextStep: FIX_AND_RUN_AGAIN },
  { pattern: /status 429\b|ratelimited|rate_limited/, explanation: "The service received too many requests and asked us to slow down.", nextStep: TRY_LATER },
  { pattern: /status 5\d\d\b/, explanation: "The server this step called had a problem of its own.", nextStep: TRY_LATER },
  { pattern: /timed? ?out/i, explanation: "The service took too long to answer.", nextStep: TRY_LATER },
];

export function explainFailure(error: string): FailureHelp {
  const known = KNOWN_FAILURES.find((failure) => failure.pattern.test(error));
  return known ?? { explanation: error, nextStep: FIX_AND_RUN_AGAIN };
}
