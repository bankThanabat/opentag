import type { OpenTagRunResult } from "@opentag/core";

export function renderAcknowledgement(runId: string): string {
  return `OpenTag picked this up. Run: \`${runId}\``;
}

export function renderFinalResult(result: OpenTagRunResult): string {
  const lines = [`OpenTag finished with **${result.conclusion}**.`, "", result.summary];

  if (result.verification?.length) {
    lines.push("", "Verification:");
    for (const check of result.verification) {
      lines.push(`- \`${check.command}\`: ${check.outcome}`);
    }
  }

  if (result.nextAction) {
    lines.push("", `Next action: ${result.nextAction}`);
  }

  return lines.join("\n");
}
