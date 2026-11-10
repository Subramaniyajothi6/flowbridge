import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeLogo, isValidLogo, logoAddresses } from "./app-logo.ts";

const tinyPng = `data:image/png;base64,${Buffer.from("not really a png").toString("base64")}`;

describe("custom app logos", () => {
  it("looks on the app's own host, then its main site", () => {
    assert.deepEqual(logoAddresses("https://api.github.com"), [
      "https://api.github.com/favicon.ico",
      "https://github.com/favicon.ico",
      "https://www.github.com/favicon.ico",
    ]);
  });

  it("does not repeat a host", () => {
    assert.deepEqual(logoAddresses("https://example.com/api"), ["https://example.com/favicon.ico", "https://www.example.com/favicon.ico"]);
  });

  it("accepts common image types", () => {
    assert.equal(isValidLogo(tinyPng), true);
    assert.equal(isValidLogo(tinyPng.replace("image/png", "image/x-icon")), true);
  });

  it("refuses SVG, because an SVG file can contain code", () => {
    assert.equal(isValidLogo(tinyPng.replace("image/png", "image/svg+xml")), false);
  });

  it("refuses anything that is not an image", () => {
    assert.equal(isValidLogo("data:text/html;base64,PGgxPmhpPC9oMT4="), false);
    assert.equal(isValidLogo("https://example.com/logo.png"), false);
  });

  it("refuses a logo over 100 KB", () => {
    assert.equal(isValidLogo(`data:image/png;base64,${Buffer.alloc(100_001).toString("base64")}`), false);
  });

  it("turns a stored logo back into an image", () => {
    assert.deepEqual(decodeLogo(tinyPng), { type: "image/png", bytes: Buffer.from("not really a png") });
  });
});
