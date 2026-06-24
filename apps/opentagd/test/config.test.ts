import { afterEach, describe, expect, it } from "vitest";
import { loadConfigFromEnv } from "../src/config.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("opentagd config", () => {
  it("rejects invalid Claude Code permission modes", () => {
    delete process.env.OPENTAG_CONFIG_PATH;
    process.env.OPENTAG_REPO_OWNER = "acme";
    process.env.OPENTAG_REPO_NAME = "demo";
    process.env.OPENTAG_WORKSPACE_PATH = "/tmp/demo";
    process.env.OPENTAG_CLAUDE_PERMISSION_MODE = "typo";

    expect(() => loadConfigFromEnv()).toThrow("Invalid OPENTAG_CLAUDE_PERMISSION_MODE: typo");
  });
});
