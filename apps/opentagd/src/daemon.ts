import type { OpenTagEvent, OpenTagRun, OpenTagRunResult } from "@opentag/core";
import type { ExecutorAdapter } from "@opentag/runner";

export type ClaimedRun = {
  run: OpenTagRun;
  event: OpenTagEvent;
};

export type DaemonClient = {
  claim(): Promise<ClaimedRun | null>;
  markRunning(runId: string, executor: string): Promise<void>;
  progress(runId: string, input: { type: string; message: string; at: string }): Promise<void>;
  complete(runId: string, result: OpenTagRunResult): Promise<void>;
};

export async function runOneDaemonIteration(input: {
  runnerId: string;
  workspacePath: string;
  executor: ExecutorAdapter;
  client: DaemonClient;
}): Promise<boolean> {
  const claimed = await input.client.claim();
  if (!claimed) return false;

  const readiness = await input.executor.canRun({
    runId: claimed.run.id,
    workspacePath: input.workspacePath,
    command: claimed.event.command,
    context: claimed.event.context
  });
  if (!readiness.ready) {
    await input.client.complete(claimed.run.id, {
      conclusion: "needs_human",
      summary: readiness.reason ?? `${input.executor.displayName} is not ready`
    });
    return true;
  }

  await input.client.markRunning(claimed.run.id, input.executor.id);
  const result = await input.executor.run(
    {
      runId: claimed.run.id,
      workspacePath: input.workspacePath,
      command: claimed.event.command,
      context: claimed.event.context
    },
    {
      emit: async (event) => {
        console.log(`[${event.type}] ${event.message}`);
        await input.client.progress(claimed.run.id, {
          type: event.type,
          message: event.message,
          at: event.at
        });
      }
    }
  );
  await input.client.complete(claimed.run.id, result);
  return true;
}
