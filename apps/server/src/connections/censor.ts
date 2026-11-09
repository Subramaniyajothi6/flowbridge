// Step inputs and outputs are saved and shown to users, so values that look
// like secrets are replaced before saving. "PageToken" is left alone because
// it is only a position in a list.
const SECRET_FIELD = /authorization|cookie|password|passwd|secret|(?<!page)token|api[-_]?key|private[-_]?key/i;

export const HIDDEN = "[hidden]";

export function censorSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(censorSecrets);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, SECRET_FIELD.test(key) ? HIDDEN : censorSecrets(item)]),
  );
}
