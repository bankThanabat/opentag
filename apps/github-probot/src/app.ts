import { normalizeGitHubIssueComment, renderAcknowledgement } from "@opentag/github";
import type { Probot } from "probot";

type IssueCommentPayload = {
  comment: { id: number; body: string; html_url: string };
  issue: { html_url: string; comments_url: string };
  repository: { name: string; private: boolean; owner: { login: string } };
  sender: { id: number; login: string };
};

export async function handleIssueCommentCreated(input: {
  payload: IssueCommentPayload;
  createRun(event: unknown): Promise<{ runId: string }>;
  postComment(body: string): Promise<void>;
  now(): string;
}): Promise<void> {
  const event = normalizeGitHubIssueComment({
    id: String(input.payload.comment.id),
    commentBody: input.payload.comment.body,
    commentUrl: input.payload.comment.html_url,
    apiCommentsUrl: input.payload.issue.comments_url,
    issueUrl: input.payload.issue.html_url,
    owner: input.payload.repository.owner.login,
    repo: input.payload.repository.name,
    actorId: input.payload.sender.id,
    actorLogin: input.payload.sender.login,
    private: input.payload.repository.private,
    receivedAt: input.now()
  });

  if (!event) return;

  const { runId } = await input.createRun(event);
  await input.postComment(renderAcknowledgement(runId));
}

export function createOpenTagProbotApp(app: Probot): void {
  app.on("issue_comment.created", async (context) => {
    await handleIssueCommentCreated({
      payload: context.payload as IssueCommentPayload,
      createRun: async (event) => {
        const dispatcherUrl = process.env.OPENTAG_DISPATCHER_URL;
        const runId = `run_${Date.now()}`;
        if (!dispatcherUrl) {
          context.log.warn({ runId, event }, "OPENTAG_DISPATCHER_URL is not set; run was not dispatched");
          return { runId };
        }
        const response = await fetch(`${dispatcherUrl.replace(/\/$/, "")}/v1/runs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ runId, event })
        });
        if (!response.ok) {
          throw new Error(`dispatcher create run failed: ${response.status}`);
        }
        return { runId };
      },
      postComment: async (body) => {
        await context.octokit.rest.issues.createComment(context.issue({ body }));
      },
      now: () => new Date().toISOString()
    });
  });
}
