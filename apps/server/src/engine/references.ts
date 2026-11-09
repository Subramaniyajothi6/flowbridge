// Replaces references such as {{steps.get_user.output.id}} with real values.
// References are only ever looked up as paths. They are never run as code.

export type ReferenceContext = {
  trigger: unknown;
  steps: Record<string, { output: unknown }>;
  // Only present while a Loop step is working on one item.
  loop?: { item: unknown; index: number };
};

export class MissingReferenceError extends Error {}

type MissingBehaviour = "error" | "undefined";

const WHOLE_REFERENCE = /^\{\{\s*([^{}]+?)\s*\}\}$/;
const ANY_REFERENCE = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function resolveReferences(
  value: unknown,
  context: ReferenceContext,
  whenMissing: MissingBehaviour = "error",
): unknown {
  if (typeof value === "string") return resolveString(value, context, whenMissing);
  if (Array.isArray(value)) return value.map((item) => resolveReferences(item, context, whenMissing));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveReferences(item, context, whenMissing)]),
    );
  }
  return value;
}

function resolveString(text: string, context: ReferenceContext, whenMissing: MissingBehaviour): unknown {
  // When the whole string is one reference, keep the original type, such as a number or object.
  const whole = text.match(WHOLE_REFERENCE);
  if (whole) return lookupPath(whole[1], context, whenMissing);

  return text.replace(ANY_REFERENCE, (_match, path: string) => {
    const found = lookupPath(path, context, whenMissing);
    if (found === null || found === undefined) return "";
    return typeof found === "object" ? JSON.stringify(found) : String(found);
  });
}

function lookupPath(path: string, context: ReferenceContext, whenMissing: MissingBehaviour): unknown {
  let current: unknown = context;

  for (const part of path.split(".")) {
    // Object.hasOwn stops a path from reaching built-ins like __proto__.
    const canContinue = current !== null && typeof current === "object" && Object.hasOwn(current, part);
    if (!canContinue) {
      if (whenMissing === "undefined") return undefined;
      throw new MissingReferenceError(`Could not find "${path}"`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
