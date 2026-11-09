import { z } from "zod";
import { GOOGLE_IDENTITY_HOST, GOOGLE_IDENTITY_SCOPES, testGoogleConnection } from "./google-shared.ts";
import { defineAction, type Connector } from "./types.ts";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

const spreadsheetId = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Use the ID from the spreadsheet's address");
const range = z.string().min(1).default("Sheet1");

function valuesUrl(id: string, sheetRange: string): string {
  return `${API}/${id}/values/${encodeURIComponent(sheetRange)}`;
}

function toCell(value: unknown): unknown {
  return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
}

export const googleSheets: Connector = {
  id: "google_sheets",
  name: "Google Sheets",
  auth: {
    type: "oauth",
    provider: "google",
    scopes: [...GOOGLE_IDENTITY_SCOPES, "https://www.googleapis.com/auth/spreadsheets"],
  },
  allowedHosts: ["sheets.googleapis.com", GOOGLE_IDENTITY_HOST],
  test: testGoogleConnection,

  actions: {
    append_row: defineAction({
      description: "Add a row to the end of a sheet",
      input: z.object({ spreadsheetId, range, values: z.array(z.unknown()).min(1) }),
      async run({ request }, input) {
        const response = await request(`${valuesUrl(input.spreadsheetId, input.range)}:append?valueInputOption=USER_ENTERED`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ values: [input.values.map(toCell)] }),
        });
        return { updatedRange: response.updates.updatedRange, updatedRows: response.updates.updatedRows };
      },
    }),

    read_rows: defineAction({
      description: "Read the rows of a sheet",
      input: z.object({ spreadsheetId, range }),
      async run({ request }, input) {
        const response = await request(valuesUrl(input.spreadsheetId, input.range));
        return { range: response.range, rows: response.values ?? [] };
      },
    }),
  },
};
