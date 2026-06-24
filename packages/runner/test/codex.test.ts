import { describe, expect, it } from "vitest";
import { createCodexExecutor } from "../src/codex.js";
import type { CommandRunner } from "../src/command.js";
import { branchNameForRun, commitChangedFiles, parseChangedFiles } from "../src/git.js";

describe("Codex executor", () => {
  it("creates an isolated branch, runs codex exec, and reports changed files", async () => {
    const calls: { command: string; args: string[]; input?: string }[] = [];
    const runner: CommandRunner = {
      async run(command, args, options) {
        calls.push({ command, args, input: options?.input });
        if (command === "codex" && args.includes("--version")) {
          return { exitCode: 0, stdout: "codex 1.0.0", stderr: "" };
        }
        if (command === "git" && args.join(" ") === "status --porcelain") {
          return calls.length < 4
            ? { exitCode: 0, stdout: "", stderr: "" }
            : {
                exitCode: 0,
                stdout:
                  calls.some((call) => call.command === "git" && call.args.join(" ") === "clean -fd -- .omx")
                    ? " M src/demo.ts\n?? test/demo.test.ts\n"
                    : "?? .omx/\n M src/demo.ts\n?? test/demo.test.ts\n",
                stderr: ""
              };
        }
        if (command === "git" && args[0] === "checkout") {
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (command === "git" && args.join(" ") === "clean -fd -- .omx") {
          return { exitCode: 0, stdout: "Removing .omx/\n", stderr: "" };
        }
        if (command === "codex" && args[0] === "exec") {
          return { exitCode: 0, stdout: "Implemented the requested fix.", stderr: "" };
        }
        return { exitCode: 1, stdout: "", stderr: `unexpected ${command} ${args.join(" ")}` };
      }
    };

    const executor = createCodexExecutor({ runner });
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
        context: [{ kind: "github.issue", uri: "https://github.com/acme/demo/issues/1", visibility: "public" }],
        baseBranch: "main"
      },
      {
        emit: async (event) => {
          events.push(event.type);
        }
      }
    );

    expect(calls.some((call) => call.command === "git" && call.args.join(" ") === "checkout -B opentag/run_1 main")).toBe(true);
    expect(calls.some((call) => call.command === "codex" && call.args[0] === "exec")).toBe(true);
    expect(calls.some((call) => call.command === "git" && call.args.join(" ") === "clean -fd -- .omx")).toBe(true);
    expect(calls.find((call) => call.command === "codex" && call.args[0] === "exec")?.args).toContain("--full-auto");
    expect(calls.find((call) => call.command === "codex" && call.args[0] === "exec")?.args).toContain("--ephemeral");
    expect(calls.find((call) => call.command === "codex" && call.args[0] === "exec")?.input).toContain("fix this");
    expect(events).toEqual(["executor.started", "executor.progress", "executor.progress", "executor.completed"]);
    expect(result.changedFiles).toEqual(["src/demo.ts", "test/demo.test.ts"]);
    expect(result.summary).toContain("Implemented the requested fix.");
    expect(result.artifacts?.[0]).toMatchObject({ kind: "patch", title: "Run branch", uri: "opentag/run_1" });
    expect(result.suggestedChanges?.[0]).toMatchObject({
      proposalId: "proposal_run_1",
      sourceRunId: "run_1",
      intents: [
        { intentId: "proposal_run_1_link_branch", domain: "artifact_links", action: "link_artifact" },
        { intentId: "proposal_run_1_request_review", domain: "review", action: "request_review" }
      ]
    });
    expect(result.nextAction).toMatchObject({
      summary: "Review the local branch and explicitly create a pull request if the proposal is acceptable.",
      hint: {
        kind: "create_pull_request",
        targetId: "proposal_run_1",
        selectedIntentIds: ["proposal_run_1_link_branch", "proposal_run_1_request_review"]
      }
    });
  });

  it("refuses to run when the workspace has uncommitted changes", async () => {
    const runner: CommandRunner = {
      async run(command, args) {
        if (command === "codex" && args.includes("--version")) {
          return { exitCode: 0, stdout: "codex 1.0.0", stderr: "" };
        }
        if (command === "git" && args.join(" ") === "status --porcelain") {
          return { exitCode: 0, stdout: " M dirty.ts\n", stderr: "" };
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    };

    await expect(
      createCodexExecutor({ runner }).canRun({
        runId: "run_1",
        workspacePath: "/tmp/demo",
        command: { rawText: "fix this", intent: "fix", args: {} },
        context: []
      })
    ).resolves.toEqual({ ready: false, reason: "Workspace has uncommitted changes; refusing to run Codex executor." });
  });
});

describe("git helpers", () => {
  it("parses porcelain changed files and filters internal artifacts", () => {
    expect(parseChangedFiles("?? .omx/\n M src/demo.ts\n?? test/demo.test.ts\n")).toEqual(["src/demo.ts", "test/demo.test.ts"]);
  });

  it("sanitizes branch names", () => {
    expect(branchNameForRun("run/with spaces")).toBe("opentag/run-with-spaces");
  });

  it("stages and commits selected changed files", async () => {
    const calls: string[] = [];
    const runner: CommandRunner = {
      async run(command, args) {
        calls.push(`${command} ${args.join(" ")}`);
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    };

    await commitChangedFiles({
      runner,
      workspacePath: "/tmp/demo",
      files: ["README.md", "src/demo.ts"],
      message: "OpenTag run run_1"
    });

    expect(calls).toEqual(["git add -- README.md src/demo.ts", "git commit -m OpenTag run run_1"]);
  });
});
