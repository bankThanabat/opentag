import { describe, expect, it } from "vitest";
import { createGitHubCallbackSink } from "../src/callbacks.js";

describe("createGitHubCallbackSink", () => {
  it("posts GitHub callback messages to the callback URI", async () => {
    const requests: { url: string; body: unknown; authorization: string | null }[] = [];
    const sink = createGitHubCallbackSink({
      token: "ghs_test",
      fetchImpl: (async (url, init) => {
        requests.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
          authorization: new Headers(init?.headers).get("authorization")
        });
        return Response.json({ id: 1 });
      }) as typeof fetch
    });

    await sink.deliver({
      runId: "run_1",
      kind: "final",
      provider: "github",
      uri: "https://api.github.com/repos/acme/demo/issues/1/comments",
      body: "done"
    });

    expect(requests).toEqual([
      {
        url: "https://api.github.com/repos/acme/demo/issues/1/comments",
        authorization: "Bearer ghs_test",
        body: { body: "done" }
      }
    ]);
  });

  it("ignores non-GitHub callback messages", async () => {
    const sink = createGitHubCallbackSink({
      token: "ghs_test",
      fetchImpl: (async () => {
        throw new Error("should not call fetch");
      }) as typeof fetch
    });

    await expect(
      sink.deliver({
        runId: "run_1",
        kind: "final",
        provider: "webhook",
        uri: "https://example.com/callback",
        body: "done"
      })
    ).resolves.toBeUndefined();
  });
});
