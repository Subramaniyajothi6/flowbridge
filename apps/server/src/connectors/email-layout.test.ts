import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderEmail } from "./email-layout.ts";
import { buildRawEmail, gmail } from "./gmail.ts";

const decode = (raw: string) => Buffer.from(raw, "base64url").toString("utf8");

describe("designed emails", () => {
  it("shows the brand, heading, highlight and button", () => {
    const html = renderEmail({ heading: "We are on it", body: "Hello", brand: "Meridian Support", highlight: "Your reference is SCRUM-12", buttonText: "Open ticket", buttonUrl: "https://example.com/SCRUM-12" });
    assert.match(html, /Meridian Support/);
    assert.match(html, /<h1[^>]*>We are on it<\/h1>/);
    assert.match(html, /Your reference is SCRUM-12/);
    assert.match(html, /href="https:\/\/example.com\/SCRUM-12"/);
  });

  it("turns the body's simple rules into headings, lists and a table", () => {
    const html = renderEmail({ heading: "H", body: "## Your ticket\nReference: SCRUM-12\nOrder: ORD-1\n\n## Next\n1. Look\n2. Reply\n\n- one\n- two\n\nJust a sentence." });
    assert.match(html, /<h2[^>]*>Your ticket<\/h2><table/);
    assert.match(html, />Reference<\/td><td[^>]*>SCRUM-12</);
    assert.match(html, /<ol[^>]*><li[^>]*>Look<\/li><li[^>]*>Reply<\/li><\/ol>/);
    assert.match(html, /<ul[^>]*><li[^>]*>one<\/li>/);
    assert.match(html, /<p[^>]*>Just a sentence.<\/p>/);
  });

  it("escapes text a customer typed, so it cannot add HTML", () => {
    const html = renderEmail({ heading: "<b>x</b>", body: "<script>alert(1)</script>", highlight: '"><img src=x>' });
    assert.equal(html.includes("<script>"), false);
    assert.equal(html.includes("<img"), false);
    assert.match(html, /&lt;script&gt;/);
  });

  it("only allows web and email links as a button", () => {
    assert.equal(renderEmail({ heading: "H", body: "b", buttonText: "Go", buttonUrl: "javascript:alert(1)" }).includes("javascript:"), false);
    assert.match(renderEmail({ heading: "H", body: "b", buttonText: "Mail", buttonUrl: "mailto:help@example.com" }), /href="mailto:help@example.com"/);
  });
});

describe("sending a designed email through Gmail", () => {
  it("keeps a plain email exactly as before", () => {
    assert.match(decode(buildRawEmail("a@b.co", "Hi", "Text")), /Content-Type: text\/plain; charset=UTF-8/);
    assert.equal(decode(buildRawEmail("a@b.co", "Hi", "Text")).includes("multipart"), false);
  });

  it("sends both a plain and a designed version", () => {
    const message = decode(buildRawEmail("a@b.co", "Hi", "Text", "<p>Text</p>"));
    assert.match(message, /Content-Type: multipart\/alternative; boundary="flowbridge-/);
    assert.match(message, /Content-Type: text\/plain/);
    assert.match(message, /Content-Type: text\/html/);
  });

  it("signs every designed email with Powered by FlowBridge, under the customer's brand", () => {
    const html = renderEmail({ heading: "We are on it", body: "Hello", brand: "Meridian Logistics", footer: "Reference SCRUM-1." });
    assert.match(html, /Powered by <span[^>]*>FlowBridge<\/span>/);
    assert.ok(html.indexOf("Meridian Logistics") < html.indexOf("Powered by"), "the customer's brand comes first");
    assert.ok(html.indexOf("Reference SCRUM-1.") < html.indexOf("Powered by"), "the signature sits under the footer");
  });

  it("draws the branded header style: dark band, tagline, facts as figures, priority as a label", () => {
    const html = renderEmail({
      style: "branded_header",
      heading: "We are looking into your delayed shipment",
      tagline: "Request received",
      brand: "Meridian Logistics",
      facts: "Reference: SCRUM-15\nOrder: ML-48213\nPriority: High\nnot a fact line",
      highlight: "Our shipment is late.",
      body: "Hi Asha,\n\nThanks for letting us know.",
      footer: "Reply with SCRUM-15.",
    });
    assert.match(html, /background:#18181B;padding:28px/);
    assert.match(html, /Request received/);
    assert.match(html, /font-size:18px;font-weight:700;color:#18181B">SCRUM-15/);
    assert.match(html, /background:#FFF1E8;color:#AB4109[^>]*>High</);
    assert.equal(html.includes("not a fact line"), false);
    assert.match(html, /Powered by <span[^>]*>FlowBridge<\/span>/);
  });

  it("keeps the clean card as the default, with the tagline and facts in it", () => {
    const html = renderEmail({ heading: "H", body: "b", tagline: "Request received", facts: "Reference: SCRUM-15" });
    assert.equal(html.includes("background:#18181B;padding:28px"), false);
    assert.match(html, /Request received/);
    assert.match(html, /SCRUM-15/);
  });

  it("accepts the design fields on the Send email step", () => {
    const parsed = gmail.actions.send_email.input.safeParse({ to: "a@b.co", subject: "Hi", body: "b", heading: "H", brand: "B", highlight: "x", buttonText: "Go", buttonUrl: "https://example.com", footer: "f" });
    assert.equal(parsed.success, true);
  });
});
