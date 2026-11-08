import type { IfConfig } from "../definition.ts";

export function runIfStep(config: IfConfig): { result: boolean } {
  return { result: compare(config) };
}

function compare({ left, operator, right }: IfConfig): boolean {
  switch (operator) {
    case "exists":
      return left !== null && left !== undefined;
    // Compared as text, so that the number 5 and the text "5" count as equal.
    case "equals":
      return String(left) === String(right);
    case "not_equals":
      return String(left) !== String(right);
    case "greater_than":
      return toNumber(left) > toNumber(right);
    case "less_than":
      return toNumber(left) < toNumber(right);
    case "contains":
      if (Array.isArray(left)) return left.some((item) => String(item) === String(right));
      return String(left).includes(String(right));
  }
}

function toNumber(value: unknown): number {
  const number = Number(value);
  if (value === null || value === "" || Number.isNaN(number)) {
    throw new Error(`Expected a number but got ${JSON.stringify(value)}`);
  }
  return number;
}
