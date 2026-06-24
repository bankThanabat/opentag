import { serve } from "@hono/node-server";
import { createGitHubCallbackSink } from "./callbacks.js";
import { createDispatcherApp } from "./server.js";

const port = Number(process.env.PORT ?? "3030");
const databasePath = process.env.OPENTAG_DATABASE_PATH ?? "opentag.db";

serve({
  fetch: createDispatcherApp({
    databasePath,
    callbackSink: createGitHubCallbackSink({
      ...(process.env.OPENTAG_GITHUB_TOKEN ? { token: process.env.OPENTAG_GITHUB_TOKEN } : {})
    })
  }).fetch,
  port
});

console.log(`OpenTag dispatcher listening on http://localhost:${port}`);
