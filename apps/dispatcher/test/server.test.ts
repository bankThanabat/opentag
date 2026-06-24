import { describe, expect, it } from "vitest";
import { createDispatcherApp } from "../src/server.js";

const validEvent = {
  id: "evt_1",
  source: "github",
  sourceEventId: "comment_1",
  receivedAt: "2026-06-24T00:00:00.000Z",
  actor: { provider: "github", providerUserId: "42", handle: "octocat" },
  target: { mention: "@opentag", agentId: "opentag" },
  command: { rawText: "fix this", intent: "fix", args: {} },
  context: [{ kind: "github.issue", uri: "https://github.com/acme/demo/issues/1", visibility: "public" }],
  permissions: [{ scope: "issue:comment", reason: "reply to source thread" }],
  callback: { provider: "github", uri: "https://api.github.com/repos/acme/demo/issues/1/comments" },
  metadata: { owner: "acme", repo: "demo" }
};

describe("dispatcher API", () => {
  it("creates and claims an echo run", async () => {
    const app = createDispatcherApp({ databasePath: ":memory:" });

    const runnerResponse = await app.request("/v1/runners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runnerId: "runner_1", name: "Local Runner" })
    });
    expect(runnerResponse.status).toBe(201);

    const createResponse = await app.request("/v1/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: "run_1", event: validEvent })
    });
    expect(createResponse.status).toBe(201);

    const claimResponse = await app.request("/v1/runners/runner_1/claim", { method: "POST" });
    expect(claimResponse.status).toBe(200);
    const claimed = await claimResponse.json();
    expect(claimed.run.id).toBe("run_1");
    expect(claimed.event.command.rawText).toBe("fix this");
  });

  it("stores completion results", async () => {
    const app = createDispatcherApp({ databasePath: ":memory:" });

    await app.request("/v1/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: "run_2", event: { ...validEvent, id: "evt_2", sourceEventId: "comment_2" } })
    });
    const completeResponse = await app.request("/v1/runs/run_2/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: { conclusion: "success", summary: "done" } })
    });
    expect(completeResponse.status).toBe(200);

    const getResponse = await app.request("/v1/runs/run_2");
    const stored = await getResponse.json();
    expect(stored.run.status).toBe("succeeded");
    expect(stored.run.result.summary).toBe("done");
  });
});
