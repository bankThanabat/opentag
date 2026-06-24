import { describe, expect, it } from "vitest";
import { createClaudeCodeExecutor } from "../src/claude-code.js";
import type { CommandRunner } from "../src/command.js";

describe("Claude Code executor", () => {
  it("creates an isolated branch, runs claude print mode, and reports changed files", async () => {
    const calls: { command: string; args: string[]; input?: string }[] = [];
    const runner: CommandRunner = {
      async run(command, args, options) {
        calls.push({ command, args, input: options?.input });
        if (command === "claude" && args.includes("--version")) {
          return { exitCode: 0, stdout: "1.0.0", stderr: "" };
        }
        if (command === "git" && args.join(" ") === "status --porcelain") {
          return calls.length < 4
            ? { exitCode: 0, stdout: "", stderr: "" }
            : {
                exitCode: 0,
                stdout:
                  calls.some((call) => call.command === "git" && call.args.join(" ") === "clean -fd -- .claude")
                    ? " M src/demo.ts\n?? test/demo.test.ts\n"
                    : "?? .claude/\n M src/demo.ts\n?? test/demo.test.ts\n",
                stderr: ""
              };
        }
        if (command === "git" && args[0] === "checkout") {
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (command === "git" && args.join(" ") === "clean -fd -- .claude") {
          return { exitCode: 0, stdout: "Removing .claude/\n", stderr: "" };
        }
        if (command === "claude" && args.includes("--print")) {
          return { exitCode: 0, stdout: "Implemented the requested Claude Code change.", stderr: "" };
        }
        return { exitCode: 1, stdout: "", stderr: `unexpected ${command} ${args.join(" ")}` };
      }
    };

    const executor = createClaudeCodeExecutor({
      runner,
      permissionMode: "acceptEdits",
      model: "sonnet"
    });
    await expect(
      executor.canRun({
        runId: "run_1",
        workspacePath: "/tmp/demo",
        command: { rawText: "fix this", intent: "fix", args: {} },
        context: []
      })
    ).resolves.toEqual({ ready: true });

    const events: string[] = [];
    const result = await executor.run(
      {
        runId: "run_1",
        workspacePath: "/tmp/demo",
        command: { rawText: "fix this", intent: "fix", args: {} },
        context: [{ kind: "github.issue", uri: "https://github.com/acme/demo/issues/1", visibility: "public" }]
      },
      {
        emit: async (event) => {
          events.push(event.type);
        }
      }
    );

    const claudePrintCall = calls.find((call) => call.command === "claude" && call.args.includes("--print"));
    expect(calls.some((call) => call.command === "git" && call.args.join(" ") === "checkout -B opentag/run_1")).toBe(true);
    expect(calls.some((call) => call.command === "git" && call.args.join(" ") === "clean -fd -- .claude")).toBe(true);
    expect(claudePrintCall?.args).toContain("--input-format");
    expect(claudePrintCall?.args).toContain("text");
    expect(claudePrintCall?.args).toContain("--output-format");
    expect(claudePrintCall?.args).toContain("--no-session-persistence");
    expect(claudePrintCall?.args).toContain("--permission-mode");
    expect(claudePrintCall?.args).toContain("acceptEdits");
    expect(claudePrintCall?.args).toContain("--model");
    expect(claudePrintCall?.args).toContain("sonnet");
    expect(claudePrintCall?.input).toContain("fix this");
    expect(events).toEqual(["executor.started", "executor.progress", "executor.progress", "executor.completed"]);
    expect(result.changedFiles).toEqual(["src/demo.ts", "test/demo.test.ts"]);
    expect(result.summary).toContain("Implemented the requested Claude Code change.");
    expect(result.suggestedChanges?.[0]).toMatchObject({
      proposalId: "proposal_run_1",
      sourceRunId: "run_1",
      intents: [
        { intentId: "proposal_run_1_link_branch", domain: "artifact_links", action: "link_artifact" },
        { intentId: "proposal_run_1_request_review", domain: "review", action: "request_review" }
      ]
    });
  });

  it("refuses to run when the workspace has uncommitted changes", async () => {
    const runner: CommandRunner = {
      async run(command, args) {
        if (command === "claude" && args.includes("--version")) {
          return { exitCode: 0, stdout: "1.0.0", stderr: "" };
        }
        if (command === "git" && args.join(" ") === "status --porcelain") {
          return { exitCode: 0, stdout: " M dirty.ts\n", stderr: "" };
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    };

    await expect(
      createClaudeCodeExecutor({ runner }).canRun({
        runId: "run_1",
        workspacePath: "/tmp/demo",
        command: { rawText: "fix this", intent: "fix", args: {} },
        context: []
      })
    ).resolves.toEqual({ ready: false, reason: "Workspace has uncommitted changes; refusing to run Claude Code executor." });
  });
});
