import type { PollCursor } from "./definition.ts";

// A busy feed cannot start an unlimited number of runs at once.
// Anything over this limit is picked up by the next check.
export const MAX_NEW_ITEMS_PER_POLL = 50;
const MINIMUM_REMEMBERED_IDS = 1000;

export type NewItem = { id: string; item: unknown };
export type PollPlan = { newItems: NewItem[]; nextCursor: PollCursor };

export function extractItems(body: unknown, itemsPath: string): unknown[] {
  let current = body;

  for (const part of itemsPath.split(".").filter(Boolean)) {
    const canContinue = current !== null && typeof current === "object" && Object.hasOwn(current, part);
    if (!canContinue) throw new Error(`Could not find "${itemsPath}" in the response`);
    current = (current as Record<string, unknown>)[part];
  }

  if (!Array.isArray(current)) throw new Error("The response does not contain a list of items");
  return current;
}

// Compares what came back with what has been seen, and decides what is new.
// The first check has nothing to compare with, so it only remembers the
// existing items. Otherwise turning on a poll would start a run for all of them.
export function planPoll(items: unknown[], itemIdField: string, cursor: PollCursor | null): PollPlan {
  const itemsById = new Map<string, unknown>();
  for (const item of items) itemsById.set(readItemId(item, itemIdField), item);
  const currentIds = [...itemsById.keys()];

  if (cursor === null) {
    return { newItems: [], nextCursor: { seenIds: limitIds(currentIds, currentIds.length) } };
  }

  const seen = new Set(cursor.seenIds);
  const unseenIds = currentIds.filter((id) => !seen.has(id));
  const newIds = unseenIds.slice(0, MAX_NEW_ITEMS_PER_POLL);
  const deferred = new Set(unseenIds.slice(MAX_NEW_ITEMS_PER_POLL));

  // Items that are still in the response stay at the front, so they are never forgotten.
  const handledIds = currentIds.filter((id) => !deferred.has(id));
  return {
    newItems: newIds.map((id) => ({ id, item: itemsById.get(id) })),
    nextCursor: { seenIds: limitIds([...handledIds, ...cursor.seenIds], handledIds.length) },
  };
}

function limitIds(ids: string[], currentCount: number): string[] {
  return [...new Set(ids)].slice(0, Math.max(MINIMUM_REMEMBERED_IDS, currentCount));
}

function readItemId(item: unknown, itemIdField: string): string {
  const id = item !== null && typeof item === "object" ? (item as Record<string, unknown>)[itemIdField] : undefined;
  if (typeof id !== "string" && typeof id !== "number") {
    throw new Error(`An item has no "${itemIdField}" field`);
  }
  return String(id);
}
