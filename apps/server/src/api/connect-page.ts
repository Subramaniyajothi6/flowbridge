import type { FastifyInstance } from "fastify";

// A simple page for adding connections until the real interface is built.
// Secrets are typed here, and go straight to this server.
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FlowBridge connections</title>
<style>
  :root { --ink:#18181B; --muted:#52525B; --line:#E4E4E7; --bg:#FAFAFA; --card:#FFF; --orange:#C94C0A; --orange-hover:#AB4109; --error:#BE123C; --ok:#166534; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 Manrope,system-ui,"Segoe UI",Arial,sans-serif; }
  main { max-width:760px; margin:0 auto; padding:40px 16px 64px; }
  h1 { font-size:28px; letter-spacing:-.02em; margin:0 0 4px; }
  h2 { font-size:17px; margin:0; }
  p { margin:0; color:var(--muted); }
  section { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:18px; margin-top:14px; }
  form { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
  input { flex:1 1 220px; min-width:0; height:40px; padding:0 12px; border:1px solid var(--line); border-radius:10px; font:inherit; }
  button, a.button { display:inline-flex; align-items:center; height:40px; padding:0 16px; border:0; border-radius:20px; background:var(--orange); color:#FFF; font:inherit; font-weight:600; text-decoration:none; cursor:pointer; }
  button:hover, a.button:hover { background:var(--orange-hover); }
  button.plain { background:transparent; color:var(--ink); border:1px solid var(--line); height:32px; padding:0 12px; }
  button.plain:hover { background:var(--line); }
  .row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding-top:10px; margin-top:10px; border-top:1px solid var(--line); }
  .row span { flex:1 1 200px; min-width:0; overflow-wrap:anywhere; }
  .help { font-size:13px; margin-top:2px; }
  #message { min-height:22px; margin-top:12px; font-weight:600; }
  .error { color:var(--error); } .ok { color:var(--ok); }
</style>
</head>
<body>
<main>
  <h1>Connections</h1>
  <p>Connect the services your workflows use. Secrets are encrypted before they are stored.</p>
  <div id="message" role="status"></div>
  <div id="list"></div>
</main>
<script>
const list = document.getElementById("list");
const message = document.getElementById("message");

function show(text, isError) {
  message.textContent = text;
  message.className = isError ? "error" : "ok";
}

function element(tag, props, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

async function api(path, options) {
  const response = await fetch(path, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body && body.error ? body.error : "Something went wrong");
  return body;
}

function connectionRow(connection) {
  const label = connection.name + (connection.account ? " (" + connection.account + ")" : "") +
    (connection.status === "needs_reconnect" ? " - expired, please connect again" : "");
  const test = element("button", { className: "plain", textContent: "Test", type: "button" });
  test.onclick = async () => {
    const result = await api("/api/connections/" + connection.id + "/test", { method: "POST" });
    if (result.ok) show("Working: " + result.account); else show(result.error, true);
  };
  const remove = element("button", { className: "plain", textContent: "Remove", type: "button" });
  remove.onclick = async () => {
    await api("/api/connections/" + connection.id, { method: "DELETE" });
    show("Connection removed");
    load();
  };
  const id = element("span", { className: "help", textContent: "ID: " + connection.id });
  return element("div", { className: "row" }, element("span", { textContent: label }), id, test, remove);
}

function tokenForm(connector) {
  const input = element("input", { type: "password", placeholder: connector.tokenLabel, autocomplete: "off", required: true });
  input.setAttribute("aria-label", connector.tokenLabel);
  const form = element("form", {}, input, element("button", { textContent: "Connect" }));
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connector: connector.id, token: input.value }),
      });
      input.value = "";
      show("Connected: " + result.account);
      load();
    } catch (error) { show(error.message, true); }
  };
  return form;
}

function oauthControl(connector) {
  if (!connector.configured) {
    return element("p", { className: "help", textContent: "Add the Google client ID and secret to the .env file first." });
  }
  const link = element("a", { className: "button", textContent: "Connect with Google" });
  link.href = "/api/connections/oauth/" + connector.id + "/start";
  return element("form", {}, link);
}

async function load() {
  const [available, existing] = await Promise.all([api("/api/connectors"), api("/api/connections")]);
  list.replaceChildren(...available.map((connector) => {
    const card = element("section", {}, element("h2", { textContent: connector.name }));
    if (connector.tokenHelp) card.append(element("p", { className: "help", textContent: connector.tokenHelp }));
    card.append(connector.authType === "token" ? tokenForm(connector) : oauthControl(connector));
    card.append(...existing.filter((item) => item.connector === connector.id).map(connectionRow));
    return card;
  }));
}

const params = new URLSearchParams(location.search);
if (params.get("error")) show(params.get("error"), true);
if (params.get("connected")) show("Connected");
load().catch((error) => show(error.message, true));
</script>
</body>
</html>`;

export function registerConnectPage(app: FastifyInstance): void {
  app.get("/connect", async (_request, reply) => reply.type("text/html; charset=utf-8").send(PAGE));
}
