import { parseOpenTagMention, type OpenTagEvent } from "@opentag/core";
import type { OpenTagCommand, PermissionGrant } from "@opentag/core";

export type GitHubIssueCommentInput = {
  id: string;
  commentBody: string;
  commentUrl: string;
  apiCommentsUrl: string;
  issueUrl: string;
  owner: string;
  repo: string;
  actorId: number;
  actorLogin: string;
  private: boolean;
  receivedAt: string;
};

export type GitHubPullRequestReviewCommentInput = {
  id: string;
  commentBody: string;
  commentUrl: string;
  pullRequestUrl: string;
  apiCommentsUrl: string;
  owner: string;
  repo: string;
  pullRequestNumber: number;
  actorId: number;
  actorLogin: string;
  private: boolean;
  receivedAt: string;
};

function permissionsForIntent(intent: OpenTagCommand["intent"]): PermissionGrant[] {
  const permissions: PermissionGrant[] = [
    {
      scope: "issue:comment",
      reason: "reply to the source GitHub thread"
    },
    {
      scope: "runner:local",
      reason: "execute the run on a paired local daemon"
    }
  ];
  if (intent === "fix" || intent === "run") {
    permissions.push(
      {
        scope: "repo:read",
        reason: "inspect the repository in the paired local checkout"
      },
      {
        scope: "repo:write",
        reason: "commit code changes on an isolated run branch"
      },
      {
        scope: "pr:create",
        reason: "open a pull request for completed code changes"
      }
    );
  }
  return permissions;
}

export function normalizeGitHubIssueComment(input: GitHubIssueCommentInput): OpenTagEvent | null {
  const mention = parseOpenTagMention(input.commentBody);
  if (!mention.matched) return null;

  return {
    id: `evt_github_comment_${input.id}`,
    source: "github",
    sourceEventId: input.id,
    receivedAt: input.receivedAt,
    actor: {
      provider: "github",
      providerUserId: String(input.actorId),
      handle: input.actorLogin
    },
    target: {
      mention: "@opentag",
      agentId: "opentag"
    },
    command: {
      rawText: mention.rawText,
      intent: mention.intent,
      args: mention.args
    },
    context: [
      {
        kind: "github.issue",
        uri: input.issueUrl,
        visibility: input.private ? "private" : "public"
      },
      {
        kind: "github.comment",
        uri: input.commentUrl,
        visibility: input.private ? "private" : "public"
      }
    ],
    permissions: permissionsForIntent(mention.intent),
    callback: {
      provider: "github",
      uri: input.apiCommentsUrl,
      threadKey: `${input.owner}/${input.repo}`
    },
    metadata: {
      owner: input.owner,
      repo: input.repo
    }
  };
}

export function normalizeGitHubPullRequestReviewComment(input: GitHubPullRequestReviewCommentInput): OpenTagEvent | null {
  const mention = parseOpenTagMention(input.commentBody);
  if (!mention.matched) return null;

  return {
    id: `evt_github_pr_review_comment_${input.id}`,
    source: "github",
    sourceEventId: input.id,
    receivedAt: input.receivedAt,
    actor: {
      provider: "github",
      providerUserId: String(input.actorId),
      handle: input.actorLogin
    },
    target: {
      mention: "@opentag",
      agentId: "opentag"
    },
    command: {
      rawText: mention.rawText,
      intent: mention.intent,
      args: mention.args
    },
    context: [
      {
        kind: "github.pull_request",
        uri: input.pullRequestUrl,
        visibility: input.private ? "private" : "public"
      },
      {
        kind: "github.comment",
        uri: input.commentUrl,
        visibility: input.private ? "private" : "public"
      }
    ],
    permissions: permissionsForIntent(mention.intent),
    callback: {
      provider: "github",
      uri: input.apiCommentsUrl,
      threadKey: `${input.owner}/${input.repo}#${input.pullRequestNumber}`
    },
    metadata: {
      owner: input.owner,
      repo: input.repo,
      pullRequestNumber: input.pullRequestNumber
    }
  };
}
