import { OpenTagEventSchema, OpenTagRunSchema, type OpenTagEvent, type OpenTagRun } from "@opentag/core";
import type { ClaimedRun, DaemonClient } from "./daemon.js";

function assertOk(response: Response, action: string): void {
  if (!response.ok) {
    throw new Error(`${action} failed: ${response.status}`);
  }
}

export function createDispatcherClient(input: { dispatcherUrl: string; runnerId: string }): DaemonClient {
  const baseUrl = input.dispatcherUrl.replace(/\/$/, "");

  return {
    async claim(): Promise<ClaimedRun | null> {
      const response = await fetch(`${baseUrl}/v1/runners/${input.runnerId}/claim`, { method: "POST" });
      if (response.status === 204) return null;
      assertOk(response, "claim");
      const body = (await response.json()) as { run: OpenTagRun; event: OpenTagEvent };
      return {
        run: OpenTagRunSchema.parse(body.run),
        event: OpenTagEventSchema.parse(body.event)
      };
    },

    async markRunning(runId, executor) {
      const response = await fetch(`${baseUrl}/v1/runs/${runId}/running`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ executor })
      });
      assertOk(response, "markRunning");
    },

    async complete(runId, result) {
      const response = await fetch(`${baseUrl}/v1/runs/${runId}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result })
      });
      assertOk(response, "complete");
    }
  };
}
