import type { ApplyIntentOutcome, MutationIntent } from "@opentag/core";
import type { FetchLike } from "./pull-request.js";

export type GitHubIssueMutationTarget = {
  token: string;
  owner: string;
  repo: string;
  issueNumber: number;
};

function labelFromIntent(intent: MutationIntent): string | undefined {
  const value = intent.params?.["label"];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function labelsFromIntent(intent: MutationIntent): string[] | undefined {
  const value = intent.params?.["labels"];
  if (!Array.isArray(value)) return undefined;
  const labels = value.filter((label): label is string => typeof label === "string" && label.length > 0);
  return labels.length > 0 ? labels : undefined;
}

function assigneeFromIntent(intent: MutationIntent): string | undefined {
  const value = intent.params?.["assignee"];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function assigneesFromIntent(intent: MutationIntent): string[] | undefined {
  const value = intent.params?.["assignees"];
  if (!Array.isArray(value)) return undefined;
  const assignees = value.filter((assignee): assignee is string => typeof assignee === "string" && assignee.length > 0);
  return assignees.length > 0 ? assignees : undefined;
}

async function githubJson(input: {
  target: GitHubIssueMutationTarget;
  fetchImpl: FetchLike;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
}): Promise<string | undefined> {
  const response = await input.fetchImpl(`https://api.github.com/repos/${input.target.owner}/${input.target.repo}${input.path}`, {
    method: input.method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${input.target.token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {})
  });

  if (!response.ok) {
    throw new Error(`${input.method} ${input.path} failed: ${response.status} ${await response.text()}`);
  }
  return `https://github.com/${input.target.owner}/${input.target.repo}/issues/${input.target.issueNumber}`;
}

export async function applyGitHubIssueMutationIntent(input: {
  target: GitHubIssueMutationTarget;
  intent: MutationIntent;
  fetchImpl?: FetchLike;
}): Promise<ApplyIntentOutcome> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    if (input.intent.domain === "status") {
      return {
        intentId: input.intent.intentId,
        outcome: "unsupported",
        message: "GitHub status writes require an explicit Project field or label mapping policy."
      };
    }
    if (input.intent.domain === "priority") {
      return {
        intentId: input.intent.intentId,
        outcome: "unsupported",
        message: "GitHub priority writes require an explicit label or Project field mapping policy."
      };
    }
    if (input.intent.domain !== "labels" && input.intent.domain !== "assignee") {
      return {
        intentId: input.intent.intentId,
        outcome: "unsupported",
        message: `GitHub apply supports labels and assignee only, not ${input.intent.domain}.`
      };
    }

    if (input.intent.domain === "assignee") {
      if (input.intent.action === "set_assignee") {
        const assignee = assigneeFromIntent(input.intent);
        if (!assignee) {
          return { intentId: input.intent.intentId, outcome: "failed", message: "set_assignee requires params.assignee." };
        }
        const externalUri = await githubJson({
          target: input.target,
          fetchImpl,
          method: "PATCH",
          path: `/issues/${input.target.issueNumber}`,
          body: { assignees: [assignee] }
        });
        return { intentId: input.intent.intentId, outcome: "applied", externalUri };
      }

      if (input.intent.action === "set_assignees") {
        const assignees = assigneesFromIntent(input.intent);
        if (!assignees) {
          return { intentId: input.intent.intentId, outcome: "failed", message: "set_assignees requires params.assignees." };
        }
        const externalUri = await githubJson({
          target: input.target,
          fetchImpl,
          method: "PATCH",
          path: `/issues/${input.target.issueNumber}`,
          body: { assignees }
        });
        return { intentId: input.intent.intentId, outcome: "applied", externalUri };
      }

      if (input.intent.action === "add_assignee") {
        const assignee = assigneeFromIntent(input.intent);
        if (!assignee) {
          return { intentId: input.intent.intentId, outcome: "failed", message: "add_assignee requires params.assignee." };
        }
        const externalUri = await githubJson({
          target: input.target,
          fetchImpl,
          method: "POST",
          path: `/issues/${input.target.issueNumber}/assignees`,
          body: { assignees: [assignee] }
        });
        return { intentId: input.intent.intentId, outcome: "applied", externalUri };
      }

      if (input.intent.action === "remove_assignee") {
        const assignee = assigneeFromIntent(input.intent);
        if (!assignee) {
          return { intentId: input.intent.intentId, outcome: "failed", message: "remove_assignee requires params.assignee." };
        }
        const externalUri = await githubJson({
          target: input.target,
          fetchImpl,
          method: "DELETE",
          path: `/issues/${input.target.issueNumber}/assignees`,
          body: { assignees: [assignee] }
        });
        return { intentId: input.intent.intentId, outcome: "applied", externalUri };
      }

      return {
        intentId: input.intent.intentId,
        outcome: "unsupported",
        message: `GitHub apply does not support assignee action ${input.intent.action}.`
      };
    }

    if (input.intent.action === "add_label") {
      const label = labelFromIntent(input.intent);
      if (!label) {
        return { intentId: input.intent.intentId, outcome: "failed", message: "add_label requires params.label." };
      }
      const externalUri = await githubJson({
        target: input.target,
        fetchImpl,
        method: "POST",
        path: `/issues/${input.target.issueNumber}/labels`,
        body: { labels: [label] }
      });
      return { intentId: input.intent.intentId, outcome: "applied", externalUri };
    }

    if (input.intent.action === "remove_label") {
      const label = labelFromIntent(input.intent);
      if (!label) {
        return { intentId: input.intent.intentId, outcome: "failed", message: "remove_label requires params.label." };
      }
      const externalUri = await githubJson({
        target: input.target,
        fetchImpl,
        method: "DELETE",
        path: `/issues/${input.target.issueNumber}/labels/${encodeURIComponent(label)}`
      });
      return { intentId: input.intent.intentId, outcome: "applied", externalUri };
    }

    if (input.intent.action === "set_labels") {
      const labels = labelsFromIntent(input.intent);
      if (!labels) {
        return { intentId: input.intent.intentId, outcome: "failed", message: "set_labels requires params.labels." };
      }
      const externalUri = await githubJson({
        target: input.target,
        fetchImpl,
        method: "PUT",
        path: `/issues/${input.target.issueNumber}/labels`,
        body: { labels }
      });
      return { intentId: input.intent.intentId, outcome: "applied", externalUri };
    }

    return {
      intentId: input.intent.intentId,
      outcome: "unsupported",
      message: `GitHub apply does not support labels action ${input.intent.action}.`
    };
  } catch (error) {
    return {
      intentId: input.intent.intentId,
      outcome: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function applyGitHubIssueMutationIntents(input: {
  target: GitHubIssueMutationTarget;
  intents: MutationIntent[];
  fetchImpl?: FetchLike;
}): Promise<ApplyIntentOutcome[]> {
  const outcomes: ApplyIntentOutcome[] = [];
  for (const intent of input.intents) {
    outcomes.push(await applyGitHubIssueMutationIntent({ target: input.target, intent, ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}) }));
  }
  return outcomes;
}
