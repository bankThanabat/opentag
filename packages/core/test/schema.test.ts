import { describe, expect, it } from "vitest";
import { OpenTagEventSchema } from "../src/schema.js";

describe("OpenTagEventSchema", () => {
  it("accepts a valid GitHub event", () => {
    const parsed = OpenTagEventSchema.parse({
      id: "evt_1",
      source: "github",
      sourceEventId: "12345",
      receivedAt: "2026-06-24T00:00:00.000Z",
      actor: {
        provider: "github",
        providerUserId: "42",
        handle: "octocat"
      },
      target: {
        mention: "@opentag",
        agentId: "opentag"
      },
      command: {
        rawText: "fix this",
        intent: "fix",
        args: {}
      },
      context: [
        {
          kind: "github.issue",
          uri: "https://github.com/acme/demo/issues/1",
          visibility: "public"
        }
      ],
      permissions: [
        {
          scope: "issue:comment",
          reason: "reply to source thread"
        }
      ],
      callback: {
        provider: "github",
        uri: "https://api.github.com/repos/acme/demo/issues/1/comments"
      },
      metadata: {}
    });

    expect(parsed.source).toBe("github");
  });
});
