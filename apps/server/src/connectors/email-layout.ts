// Turns an email's text into a designed HTML email: a brand bar, a large heading, a highlighted
// box with an optional button, then the body and a footer. Built with tables and inline styles,
// because that is what email programs such as Gmail and Outlook display reliably.
//
// The body is written as plain text, with a few simple rules:
//   a blank line starts a new paragraph
//   "## What happens next" is a section heading
//   "- item" lines make a bulleted list, "1. item" lines a numbered list
//   a paragraph made only of "Label: value" lines becomes a small table
//
// Every piece of text is escaped, so a value a customer typed can never add HTML to the email.

export type EmailStyle = "clean_card" | "branded_header";

export type EmailLayout = {
  heading: string;
  body: string;
  // "clean_card" is a white card. "branded_header" opens with a dark band holding the brand, tagline and heading.
  style?: EmailStyle;
  brand?: string;
  // A short line above the heading, such as "Request received".
  tagline?: string;
  // "Label: value" lines, one per line, shown as large figures, such as "Reference: SCRUM-15".
  facts?: string;
  highlight?: string;
  buttonText?: string;
  buttonUrl?: string;
  footer?: string;
};

const BRAND_ORANGE = "#C94C0A";
const INK = "#18181B";
const MUTED = "#52525B";
const LINE = "#E4E4E7";
const PAGE = "#F4F4F5";
const BOX = "#F4F4F5";
const FONT = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Every designed email is signed by the platform that sent it, under the customer's own brand.
export const POWERED_BY = "Powered by FlowBridge";

function poweredBy(): string {
  return (
    `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:14px auto 0"><tr>` +
    `<td style="width:16px;height:16px;border-radius:4px;background:${BRAND_ORANGE};color:#ffffff;${FONT};font-size:10px;font-weight:700;text-align:center;vertical-align:middle;line-height:16px">F</td>` +
    `<td style="padding-left:6px;${FONT};font-size:12px;color:${MUTED}">Powered by <span style="font-weight:700;color:${INK}">FlowBridge</span></td>` +
    `</tr></table>`
  );
}

export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const LIST_ITEM = /^\s*-\s+(.*)$/;
const NUMBERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;
const LABEL_VALUE = /^\s*([^:]{1,40}):\s+(.+)$/;

function paragraph(lines: string[]): string {
  return `<p style="margin:0 0 16px;${FONT};font-size:15px;line-height:24px;color:${INK}">${lines.map((line) => escapeHtml(line.trim())).join("<br>")}</p>`;
}

function list(lines: string[], pattern: RegExp, tag: "ul" | "ol"): string {
  const items = lines.map((line) => `<li style="margin:0 0 6px">${escapeHtml((line.match(pattern) as RegExpMatchArray)[1])}</li>`).join("");
  return `<${tag} style="margin:0 0 16px;padding-left:22px;${FONT};font-size:15px;line-height:24px;color:${INK}">${items}</${tag}>`;
}

function labelTable(lines: string[]): string {
  const rows = lines
    .map((line) => {
      const [, label, value] = line.match(LABEL_VALUE) as RegExpMatchArray;
      return `<tr><td width="130" style="width:130px;padding:8px 12px 8px 0;border-bottom:1px solid ${LINE};${FONT};font-size:14px;color:${MUTED};white-space:nowrap;vertical-align:top">${escapeHtml(label.trim())}</td><td style="padding:8px 0;border-bottom:1px solid ${LINE};${FONT};font-size:14px;font-weight:600;color:${INK}">${escapeHtml(value.trim())}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse">${rows}</table>`;
}

// One block of text, between blank lines, as HTML.
function block(text: string): string {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return "";

  const first = lines[0].trim();
  if (first.startsWith("## ")) {
    const heading = `<h2 style="margin:8px 0 10px;${FONT};font-size:16px;line-height:22px;font-weight:700;color:${INK}">${escapeHtml(first.slice(3))}</h2>`;
    return heading + block(lines.slice(1).join("\n"));
  }
  if (lines.every((line) => LIST_ITEM.test(line))) return list(lines, LIST_ITEM, "ul");
  if (lines.every((line) => NUMBERED_ITEM.test(line))) return list(lines, NUMBERED_ITEM, "ol");
  if (lines.every((line) => LABEL_VALUE.test(line))) return labelTable(lines);
  return paragraph(lines);
}

// Only web and email links can be a button, so a link can never run script.
function isSafeLink(url: string): boolean {
  return /^https:\/\/\S+$/i.test(url) || /^mailto:\S+$/i.test(url);
}

function button(text: string, url: string, filled: boolean): string {
  const colours = filled ? `background:${BRAND_ORANGE};color:#ffffff;border:1px solid ${BRAND_ORANGE}` : `background:#ffffff;color:${BRAND_ORANGE};border:1px solid ${BRAND_ORANGE}`;
  return `<a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 20px;border-radius:999px;${colours};${FONT};font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(text)}</a>`;
}

// The facts field: "Label: value" lines, at most four, ignoring anything else.
function parseFacts(text: string | undefined): { label: string; value: string }[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.match(LABEL_VALUE))
    .filter((match): match is RegExpMatchArray => match !== null && match[2].trim() !== "")
    .slice(0, 4)
    .map((match) => ({ label: match[1].trim(), value: match[2].trim() }));
}

// Priority and status read best as a small coloured label rather than a large figure.
function isLabelLike(label: string): boolean {
  return /priority|status|urgency/i.test(label);
}

function documentStart(title: string, page: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>` +
    `<body style="margin:0;padding:0;background:${page}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${page}"><tr><td align="center" style="padding:24px 12px">`
  );
}

function brandMark(brand: string, nameColour: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
    `<td style="width:28px;height:28px;border-radius:8px;background:${BRAND_ORANGE};color:#ffffff;${FONT};font-size:14px;font-weight:700;line-height:28px;text-align:center">${escapeHtml(brand.charAt(0).toUpperCase())}</td>` +
    `<td style="padding-left:10px;${FONT};font-size:15px;font-weight:700;color:${nameColour}">${escapeHtml(brand)}</td></tr></table>`
  );
}

// Design B: a dark band with the brand, tagline and heading, the key facts as large figures,
// then the message, a quoted highlight, a button and a footer band. Approved on 2026-11-13.
function renderBrandedHeader(layout: EmailLayout, hasButton: boolean): string {
  const brand = layout.brand?.trim();
  const facts = parseFacts(layout.facts);
  const quiet = "#71717A";

  const header =
    `<tr><td style="background:${INK};padding:28px 28px 30px">` +
    (brand ? brandMark(brand, "#ffffff") : "") +
    (layout.tagline?.trim() ? `<p style="margin:${brand ? "26px" : "0"} 0 6px;${FONT};font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#F4A26B">${escapeHtml(layout.tagline.trim())}</p>` : "") +
    `<h1 style="margin:${brand && !layout.tagline?.trim() ? "22px 0 0" : "0"};${FONT};font-size:26px;line-height:33px;font-weight:700;color:#ffffff">${escapeHtml(layout.heading)}</h1>` +
    `</td></tr>`;

  const factsRow = facts.length > 0
    ? `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #EEEEEE"><tr>` +
      facts
        .map((fact) => {
          const value = isLabelLike(fact.label)
            ? `<span style="display:inline-block;margin-top:4px;padding:3px 10px;border-radius:999px;background:#FFF1E8;color:#AB4109;${FONT};font-size:12px;font-weight:700">${escapeHtml(fact.value)}</span>`
            : `<span style="${FONT};font-size:18px;font-weight:700;color:${INK}">${escapeHtml(fact.value)}</span>`;
          return `<td style="padding:18px 8px 18px 0;${FONT};font-size:12px;color:${quiet};vertical-align:top">${escapeHtml(fact.label)}<br>${value}</td>`;
        })
        .join("") +
      `</tr></table></td></tr>`
    : "";

  const quote = layout.highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="padding:14px 16px;border-left:3px solid ${BRAND_ORANGE};background:#FAFAFA;${FONT};font-size:14px;line-height:22px;font-style:italic;color:#3F3F46">${escapeHtml(layout.highlight)}</td></tr></table>`
    : "";
  const action = hasButton ? `<p style="margin:4px 0 22px;text-align:center">${button(layout.buttonText as string, layout.buttonUrl as string, true)}</p>` : "";
  const body = layout.body.replaceAll("\r\n", "\n").split(/\n\s*\n/).map(block).join("");
  const footer = layout.footer
    ? `<tr><td style="padding:16px 28px;background:#FAFAFA;border-top:1px solid #EEEEEE;${FONT};font-size:12px;line-height:19px;color:${quiet}">${escapeHtml(layout.footer)}</td></tr>`
    : "";

  return (
    documentStart(layout.heading, "#F4F1EE") +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">` +
    header +
    factsRow +
    `<tr><td style="padding:24px 28px 6px">${quote}${body}${action}</td></tr>` +
    footer +
    `</table>` +
    poweredBy() +
    `</td></tr></table></body></html>`
  );
}

export function renderEmail(layout: EmailLayout): string {
  const hasButton = Boolean(layout.buttonText && layout.buttonUrl && isSafeLink(layout.buttonUrl));
  if (layout.style === "branded_header") return renderBrandedHeader(layout, hasButton);
  const brand = layout.brand?.trim();

  const brandBar = brand
    ? `<tr><td style="padding:20px 28px;border-bottom:1px solid ${LINE}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
      `<td style="width:28px;height:28px;border-radius:7px;background:${BRAND_ORANGE};color:#ffffff;${FONT};font-size:14px;font-weight:700;text-align:center;vertical-align:middle">${escapeHtml(brand.charAt(0).toUpperCase())}</td>` +
      `<td style="padding-left:10px;${FONT};font-size:15px;font-weight:700;color:${INK}">${escapeHtml(brand)}</td></tr></table></td></tr>`
    : "";

  const highlightBox = layout.highlight || hasButton
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td style="padding:18px 20px;background:${BOX};border-radius:10px">` +
      (layout.highlight ? `<p style="margin:0 0 ${hasButton ? "14px" : "0"};${FONT};font-size:15px;line-height:22px;font-weight:600;color:${INK}">${escapeHtml(layout.highlight)}</p>` : "") +
      (hasButton ? button(layout.buttonText as string, layout.buttonUrl as string, true) : "") +
      `</td></tr></table>`
    : "";

  const body = layout.body.replaceAll("\r\n", "\n").split(/\n\s*\n/).map(block).join("");
  const bottomButton = hasButton ? `<p style="margin:8px 0 0;text-align:center">${button(layout.buttonText as string, layout.buttonUrl as string, false)}</p>` : "";
  const footer = layout.footer ? `<p style="margin:16px 0 0;${FONT};font-size:12px;line-height:18px;color:${MUTED};text-align:center">${escapeHtml(layout.footer)}</p>` : "";

  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(layout.heading)}</title></head>` +
    `<body style="margin:0;padding:0;background:${PAGE}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:14px">` +
    brandBar +
    `<tr><td style="padding:28px 28px 24px">` +
    (layout.tagline?.trim() ? `<p style="margin:0 0 6px;${FONT};font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${BRAND_ORANGE}">${escapeHtml(layout.tagline.trim())}</p>` : "") +
    `<h1 style="margin:0 0 20px;${FONT};font-size:24px;line-height:31px;font-weight:700;color:${INK}">${escapeHtml(layout.heading)}</h1>` +
    highlightBox +
    (parseFacts(layout.facts).length > 0 ? labelTable(parseFacts(layout.facts).map((fact) => `${fact.label}: ${fact.value}`)) : "") +
    body +
    bottomButton +
    `</td></tr></table>` +
    footer +
    poweredBy() +
    `</td></tr></table></body></html>`
  );
}
