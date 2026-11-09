import fs from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const WEB_BUILD = path.resolve(import.meta.dirname, "../../../web/dist");

// Serves the built React app from this same server, so that only one
// service has to run on a small laptop or a free host.
export function registerWebApp(app: FastifyInstance): void {
  if (!fs.existsSync(WEB_BUILD)) {
    app.log.warn("The web app has not been built yet. Run: npm run build");
    return;
  }

  // The public Home page is its own file, so the address "/" must not serve the React app.
  app.register(fastifyStatic, { root: WEB_BUILD, index: false });
  app.get("/", (_request, reply) => reply.sendFile("home.html"));

  // Addresses like /workflows/123 only exist inside the React app.
  app.setNotFoundHandler((request, reply) => {
    const isApiCall = request.url.startsWith("/api/") || request.url.startsWith("/hooks/");
    if (isApiCall || request.method !== "GET") return reply.status(404).send({ error: "Not found" });
    return reply.sendFile("index.html");
  });
}
