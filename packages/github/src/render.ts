import type { OpenTagRunResult } from "@opentag/core";

function nextActionSummary(result: OpenTagRunResult): string | undefined {
  if (!result.nextAction) return undefined;
  if (typeof result.nextAction === "string") return result.nextAction;
  return result.nextAction.summary;
}

export function renderAcknowledgement(runId: string): string {
  return `OpenTag picked this up. Run: \`${runId}\``;
}

export function renderProgress(input: { runId: string; message: string }): string {
  return `OpenTag progress for \`${input.runId}\`: ${input.message}`;
}

export function renderFinalResult(result: OpenTagRunResult): string {
  const lines = [`OpenTag finished with **${result.conclusion}**.`, "", result.summary];

  if (result.verification?.length) {
    lines.push("", "Verification:");
    for (const check of result.verification) {
      lines.push(`- \`${check.command}\`: ${check.outcome}`);
    }
  }

  const nextAction = nextActionSummary(result);
  if (nextAction) {
    lines.push("", `Next action: ${nextAction}`);
  }

  return lines.join("\n");
}
