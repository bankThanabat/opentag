import type { OpenTagRunResult } from "@opentag/core";

export function createExecutorRunResult(input: {
  executorName: string;
  runId: string;
  branchName: string;
  output: string;
  changedFiles: string[];
  verificationCommand: string;
}): OpenTagRunResult {
  const proposalId = `proposal_${input.runId}`;
  const suggestedChanges =
    input.changedFiles.length > 0
      ? [
          {
            proposalId,
            createdAt: new Date().toISOString(),
            sourceRunId: input.runId,
            summary: `${input.executorName} changed ${input.changedFiles.length} file(s) on branch ${input.branchName}.`,
            intents: [
              {
                intentId: `${proposalId}_link_branch`,
                domain: "artifact_links" as const,
                action: "link_artifact",
                summary: `Link the run branch ${input.branchName} to the work item.`,
                params: { title: "Run branch", uri: input.branchName }
              },
              {
                intentId: `${proposalId}_request_review`,
                domain: "review" as const,
                action: "request_review",
                summary: "Request human review of the generated code changes.",
                params: { changedFiles: input.changedFiles }
              }
            ],
            preconditions: ["The local branch was generated from the checkout state available to the runner."]
          }
        ]
      : undefined;

  return {
    conclusion: "success",
    summary: input.output.slice(-4000),
    changedFiles: input.changedFiles,
    artifacts: [{ kind: input.changedFiles.length > 0 ? "patch" : "audit_trail", title: "Run branch", uri: input.branchName }],
    ...(suggestedChanges ? { suggestedChanges } : {}),
    verification: [
      {
        command: input.verificationCommand,
        outcome: "passed",
        excerpt: input.output.slice(-1000)
      }
    ],
    nextAction:
      input.changedFiles.length > 0
        ? {
            summary: "Review the local branch and explicitly create a pull request if the proposal is acceptable.",
            hint: {
              kind: "create_pull_request",
              targetId: proposalId,
              selectedIntentIds: [`${proposalId}_link_branch`, `${proposalId}_request_review`]
            }
          }
        : {
            summary: "No file changes were detected.",
            hint: { kind: "none" }
          }
  };
}
