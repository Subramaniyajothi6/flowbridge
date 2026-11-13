import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasPermission } from "../auth/permissions.ts";
import { canReceiveEmail, defaultPreference, localTime, NOTIFICATION_EVENTS } from "./events.ts";

describe("notification settings", () => {
  it("start with the design's choices", () => {
    assert.deepEqual(defaultPreference("fail"), { email: true, inApp: true });
    assert.deepEqual(defaultPreference("digest"), { email: true, inApp: false });
    assert.deepEqual(defaultPreference("review"), { email: false, inApp: true });
    assert.deepEqual(defaultPreference("invite"), { email: false, inApp: false });
  });

  it("show each role only the rows that apply to it", () => {
    const rowsFor = (role: "administrator" | "workflow_builder" | "business_user") => NOTIFICATION_EVENTS.filter((item) => hasPermission(role, item.who)).map((item) => item.event);
    assert.deepEqual(rowsFor("administrator"), ["fail", "digest", "token", "review", "invite"]);
    assert.deepEqual(rowsFor("workflow_builder"), ["fail", "digest", "token", "review"]);
    assert.deepEqual(rowsFor("business_user"), ["digest"]);
  });

  it("know which addresses can never receive email", () => {
    assert.equal(canReceiveEmail("jonah@meridianlogistics.example"), false);
    assert.equal(canReceiveEmail("someone@example.com"), false);
    assert.equal(canReceiveEmail("a.real.person@gmail.com"), true);
  });

  it("work out 09:00 in each person's own time zone", () => {
    const moment = new Date("2026-11-12T03:45:00Z");
    assert.deepEqual(localTime(moment, "Asia/Kolkata"), { hour: 9, date: "2026-11-12" });
    assert.deepEqual(localTime(moment, "Europe/London"), { hour: 3, date: "2026-11-12" });
    assert.deepEqual(localTime(moment, "America/New_York"), { hour: 22, date: "2026-11-11" });
  });
});
