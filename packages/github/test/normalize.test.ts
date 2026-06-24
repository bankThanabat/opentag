import { describe, expect, it } from "vitest";
import { normalizeGitHubIssueComment, normalizeGitHubPullRequestReviewComment } from "../src/normalize.js";

describe("normalizeGitHubIssueComment", () => {
  it("normalizes an @opentag GitHub issue comment", () => {
    const event = normalizeGitHubIssueComment({
      id: "123",
      commentBody: "@opentag fix this",
      commentUrl: "https://github.com/acme/demo/issues/1#issuecomment-123",
      apiCommentsUrl: "https://api.github.com/repos/acme/demo/issues/1/comments",
      issueUrl: "https://github.com/acme/demo/issues/1",
      issueNumber: 1,
      owner: "acme",
      repo: "demo",
      actorId: 42,
      actorLogin: "octocat",
      private: false,
      receivedAt: "2026-06-24T00:00:00.000Z",
      installationId: 99
    });

    expect(event?.source).toBe("github");
    expect(event?.command.intent).toBe("fix");
    expect(event?.permissions.map((permission) => permission.scope)).toContain("pr:create");
    expect(event?.metadata).toMatchObject({ owner: "acme", repo: "demo", issueNumber: 1, installationId: 99 });
  });

  it("normalizes an @opentag pull request review comment", () => {
    const event = normalizeGitHubPullRequestReviewComment({
      id: "456",
      commentBody: "@opentag review this change",
      commentUrl: "https://github.com/acme/demo/pull/2#discussion_r456",
      pullRequestUrl: "https://github.com/acme/demo/pull/2",
      apiCommentsUrl: "https://api.github.com/repos/acme/demo/issues/2/comments",
      owner: "acme",
      repo: "demo",
      pullRequestNumber: 2,
      actorId: 42,
      actorLogin: "octocat",
      private: false,
      receivedAt: "2026-06-24T00:00:00.000Z",
      installationId: 77
    });

    expect(event?.id).toBe("evt_github_pr_review_comment_456");
    expect(event?.context[0]?.kind).toBe("github.pull_request");
    expect(event?.callback.threadKey).toBe("acme/demo#2");
    expect(event?.metadata).toMatchObject({ pullRequestNumber: 2, installationId: 77 });
  });
});
