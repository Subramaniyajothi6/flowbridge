import { CronExpressionParser } from "cron-parser";
import { z } from "zod";

const MINIMUM_POLL_SECONDS = 60;

export const scheduleConfigSchema = z
  .object({
    // Standard five-part cron, such as "0 9 * * 1" for 9:00 every Monday.
    cron: z.string().min(1),
    timezone: z.string().default("UTC"),
  })
  .superRefine((config, context) => {
    if (config.cron.trim().split(/\s+/).length !== 5) {
      context.addIssue({ code: "custom", message: "Use a cron expression with five parts" });
      return;
    }
    try {
      nextCronTime(config, new Date());
    } catch {
      context.addIssue({ code: "custom", message: "The cron expression or timezone is not valid" });
    }
  });

export const pollConfigSchema = z.object({
  url: z.url(),
  headers: z.record(z.string(), z.string()).default({}),
  // Where the list sits in the response, such as "data.orders". Empty means the response is the list.
  itemsPath: z.string().default(""),
  // The field that identifies an item, such as "id".
  itemIdField: z.string().min(1),
  intervalSeconds: z.number().int().min(MINIMUM_POLL_SECONDS).default(300),
});

export const createTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("schedule"), config: scheduleConfigSchema }),
  z.object({ type: z.literal("poll"), config: pollConfigSchema }),
]);

export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;
export type PollConfig = z.infer<typeof pollConfigSchema>;
export type PollCursor = { seenIds: string[] };

export function nextCronTime(config: ScheduleConfig, after: Date): Date {
  return CronExpressionParser.parse(config.cron, { tz: config.timezone, currentDate: after }).next().toDate();
}

export function nextPollTime(config: PollConfig, after: Date): Date {
  return new Date(after.getTime() + config.intervalSeconds * 1000);
}
