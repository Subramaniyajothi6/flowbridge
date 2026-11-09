import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // During development, requests for data go to the Fastify server.
    proxy: { "/api": "http://localhost:3000", "/hooks": "http://localhost:3000" },
  },
});
