import { describe, expect, it, vi } from "vitest";
import { handleIssueCommentCreated, handlePullRequestReviewCommentCreated } from "../src/app.js";

describe("GitHub Probot handler", () => {
  it("creates a dispatcher run for an opentag mention", async () => {
    const createRun = vi.fn(async () => ({ runId: "run_1" }));
    const postComment = vi.fn(async () => undefined);

    await handleIssueCommentCreated({
      payload: {
        comment: {
          id: 123,
          body: "@opentag fix this",
          html_url: "https://github.com/acme/demo/issues/1#issuecomment-123"
        },
        issue: {
          html_url: "https://github.com/acme/demo/issues/1",
          comments_url: "https://api.github.com/repos/acme/demo/issues/1/comments"
        },
        repository: {
          name: "demo",
          private: false,
          owner: { login: "acme" }
        },
        sender: {
          id: 42,
          login: "octocat"
        }
      },
      createRun,
      postComment,
      now: () => "2026-06-24T00:00:00.000Z"
    });

    expect(createRun).toHaveBeenCalledOnce();
    expect(postComment).toHaveBeenCalledWith("OpenTag picked this up. Run: `run_1`");
  });

  it("ignores comments without an opentag mention", async () => {
    const createRun = vi.fn(async () => ({ runId: "run_1" }));
    const postComment = vi.fn(async () => undefined);

    await handleIssueCommentCreated({
      payload: {
        comment: {
          id: 123,
          body: "plain comment",
          html_url: "https://github.com/acme/demo/issues/1#issuecomment-123"
        },
        issue: {
          html_url: "https://github.com/acme/demo/issues/1",
          comments_url: "https://api.github.com/repos/acme/demo/issues/1/comments"
        },
        repository: {
          name: "demo",
          private: false,
          owner: { login: "acme" }
        },
        sender: {
          id: 42,
          login: "octocat"
        }
      },
      createRun,
      postComment,
      now: () => "2026-06-24T00:00:00.000Z"
    });

    expect(createRun).not.toHaveBeenCalled();
    expect(postComment).not.toHaveBeenCalled();
  });

  it("does not post a local acknowledgement when dispatcher owns callbacks", async () => {
    const createRun = vi.fn(async () => ({ runId: "run_1" }));
    const postComment = vi.fn(async () => undefined);

    await handleIssueCommentCreated({
      payload: {
        comment: {
          id: 123,
          body: "@opentag fix this",
          html_url: "https://github.com/acme/demo/issues/1#issuecomment-123"
        },
        issue: {
          html_url: "https://github.com/acme/demo/issues/1",
          comments_url: "https://api.github.com/repos/acme/demo/issues/1/comments"
        },
        repository: {
          name: "demo",
          private: false,
          owner: { login: "acme" }
        },
        sender: {
          id: 42,
          login: "octocat"
        }
      },
      createRun,
      postComment,
      now: () => "2026-06-24T00:00:00.000Z",
      dispatcherOwnsCallbacks: true
    });

    expect(createRun).toHaveBeenCalledOnce();
    expect(postComment).not.toHaveBeenCalled();
  });

  it("creates a dispatcher run for an opentag PR review comment", async () => {
    const createRun = vi.fn(async () => ({ runId: "run_2" }));
    const postComment = vi.fn(async () => undefined);

    await handlePullRequestReviewCommentCreated({
      payload: {
        comment: {
          id: 456,
          body: "@opentag review this",
          html_url: "https://github.com/acme/demo/pull/2#discussion_r456"
        },
        pull_request: {
          html_url: "https://github.com/acme/demo/pull/2",
          number: 2
        },
        repository: {
          name: "demo",
          private: false,
          owner: { login: "acme" }
        },
        sender: {
          id: 42,
          login: "octocat"
        }
      },
      createRun,
      postComment,
      now: () => "2026-06-24T00:00:00.000Z"
    });

    expect(createRun).toHaveBeenCalledOnce();
    expect(postComment).toHaveBeenCalledWith("OpenTag picked this up. Run: `run_2`");
  });
});
