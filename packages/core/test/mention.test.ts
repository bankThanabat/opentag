import { describe, expect, it } from "vitest";
import { parseOpenTagMention } from "../src/mention.js";

describe("parseOpenTagMention", () => {
  it("parses fix intent after @opentag", () => {
    expect(parseOpenTagMention("@opentag fix this flaky test")).toEqual({
      matched: true,
      rawText: "fix this flaky test",
      intent: "fix",
      args: {}
    });
  });

  it("ignores comments without an opentag mention", () => {
    expect(parseOpenTagMention("please fix this")).toEqual({ matched: false });
  });

  it("supports multiline comments", () => {
    expect(parseOpenTagMention("context\n@opentag review this PR\nthanks")).toEqual({
      matched: true,
      rawText: "review this PR",
      intent: "review",
      args: {}
    });
  });
});
