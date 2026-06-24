import { describe, expect, it } from "vitest";
import { createDefaultCallbackPresentation } from "../src/presentation.js";

describe("default callback presentation", () => {
  it("keeps Slack progress audit-only while allowing GitHub progress delivery", () => {
    const presentation = createDefaultCallbackPresentation();

    expect(presentation.shouldDeliverProgress("slack")).toBe(false);
    expect(presentation.shouldDeliverProgress("github")).toBe(true);
  });

  it("renders GitHub and Slack with provider-specific markup", () => {
    const presentation = createDefaultCallbackPresentation();
    const result = {
      conclusion: "success" as const,
      summary: "done",
      verification: [{ command: "echo", outcome: "passed" as const }]
    };

    expect(presentation.acknowledgement({ provider: "github", runId: "run_1" })).toBe("OpenTag picked this up. Run: `run_1`");
    expect(presentation.acknowledgement({ provider: "slack", runId: "run_1" })).toBe("I picked this up: `run_1`");
    expect(presentation.final({ provider: "github", result })).toEqual({
      body: "OpenTag finished with **success**.\n\ndone\n\nVerification:\n- `echo`: passed"
    });
    expect(presentation.final({ provider: "slack", result })).toEqual({
      body: "Finished with *success*.\n\ndone\n\n*Verification*\n- `echo`: passed",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Finished with success.*\ndone"
          }
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Verification*\n- `echo`: passed"
          }
        }
      ]
    });
  });

  it("renders structured next actions by summary", () => {
    const presentation = createDefaultCallbackPresentation();
    const result = {
      conclusion: "needs_human" as const,
      summary: "Prepared a suggested change snapshot.",
      nextAction: {
        summary: "Approve intent_label_1 to add the bug label.",
        hint: {
          kind: "apply_suggested_changes" as const,
          targetId: "proposal_1",
          selectedIntentIds: ["intent_label_1"]
        }
      }
    };

    expect(presentation.final({ provider: "github", result }).body).toContain("Next action: Approve intent_label_1");
    expect(presentation.final({ provider: "slack", result }).body).toContain("*Next action*: Approve intent_label_1");
    expect(presentation.final({ provider: "slack", result }).blocks).toEqual([
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Finished with needs_human.*\nPrepared a suggested change snapshot."
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Next action*: Approve intent_label_1 to add the bug label."
        }
      }
    ]);
    expect(presentation.final({ provider: "github", result }).body).not.toContain("[object Object]");
  });
});
