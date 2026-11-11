// Error messages are free text, so similar failures are grouped under a plain reason for Analytics.
// The first rule that matches wins, so the more specific rules come first.
const RULES: { reason: string; pattern: RegExp }[] = [
  { reason: "Sending or usage limit reached", pattern: /rate.?limit|quota|status 429|too many requests|ratelimited/i },
  { reason: "Access expired or refused", pattern: /expired|connect it again|status 401|status 403|invalid_auth|not_authed|token_revoked|account_inactive|cannot be sent to/i },
  { reason: "Could not find what it needed", pattern: /not_found|not found|status 404|could not find|unable to parse range|no longer exists/i },
  { reason: "The service had a server error", pattern: /status 5\d\d/i },
  { reason: "Took too long to answer", pattern: /timeout|timed out|aborted/i },
  { reason: "Data was not accepted", pattern: /status 4\d\d|invalid|not a valid|expected|is not a list|required|✖/i },
];

export function failureReason(error: string | null): string {
  const found = RULES.find((rule) => rule.pattern.test(error ?? ""));
  return found ? found.reason : "Other errors";
}

export type FailedGroup = { app: string | null; error: string | null; failures: number };
export type FailureReason = { reason: string; failures: number; example: string | null };

// Adds up failures that share an app and a reason, most common first.
// appName turns an app ID into the name people see, or gives null for steps that use no app.
export function groupFailures(groups: FailedGroup[], appName: (app: string) => string, limit = 5): FailureReason[] {
  const totals = new Map<string, FailureReason>();
  for (const group of groups) {
    const reason = failureReason(group.error);
    const label = group.app ? `${appName(group.app)}: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : reason;
    const current = totals.get(label);
    if (current) current.failures += group.failures;
    else totals.set(label, { reason: label, failures: group.failures, example: group.error });
  }
  return [...totals.values()].sort((first, second) => second.failures - first.failures).slice(0, limit);
}
