import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datesFrom, resolveReferences } from "./references.ts";

describe("ready-made dates in a workflow", () => {
  const start = new Date("2026-11-12T10:30:00Z");
  const dates = datesFrom(start);

  it("counts from when the run started, as plain dates", () => {
    assert.equal(dates.today, "2026-11-12");
    assert.equal(dates.tomorrow, "2026-11-13");
    assert.equal(dates.in_3_days, "2026-11-15");
    assert.equal(dates.in_30_days, "2026-12-12");
    assert.equal(dates.now, "2026-11-12T10:30:00.000Z");
  });

  it("uses the day in the given time zone", () => {
    // 00:31 on 13 November in India is still 12 November in UTC.
    const lateNight = new Date("2026-11-12T19:01:00Z");
    assert.equal(datesFrom(lateNight).today, "2026-11-12");
    assert.equal(datesFrom(lateNight, "Asia/Kolkata").today, "2026-11-13");
    assert.equal(datesFrom(lateNight, "Asia/Kolkata").in_3_days, "2026-11-16");
  });

  it("crosses into the next month and year", () => {
    assert.equal(datesFrom(new Date("2026-12-30T08:00:00Z")).in_3_days, "2027-01-02");
  });

  it("can be used in a step like any other value", () => {
    const filled = resolveReferences({ due: "{{dates.in_3_days}}", note: "Opened {{dates.today}}" }, { trigger: {}, steps: {}, dates });
    assert.deepEqual(filled, { due: "2026-11-15", note: "Opened 2026-11-12" });
  });
});
