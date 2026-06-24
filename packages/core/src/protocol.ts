import type {
  ApplyIntentOutcome,
  CapabilityContract,
  ContextPacket,
  ContextPointer,
  ConversationAnchor,
  MutationIntent,
  OpenTagEvent,
  PermissionGrant,
  PolicyResolution,
  PolicyRule,
  PolicyScope,
  WorkItemReference,
  WorkThread
} from "./schema.js";

const CONTEXT_PACKET_STAGES = ["collect", "classify", "filter", "preserve", "summarize", "budget", "emit"] as const;
const POLICY_SCOPE_ORDER: PolicyScope[] = [
  "organization_default",
  "adapter_surface_default",
  "work_context_owner_container",
  "work_item_override",
  "primary_anchor_override"
];

export const DefaultCapabilityContracts = [
  {
    id: "reply_thread",
    semanticAction: "reply_thread",
    capabilityClass: "callback",
    requiresExplicitIntent: false,
    mayAutoApplyByPolicy: true,
    adapterTargets: ["github", "slack", "lark", "webhook"],
    requiredPermissionScopes: ["issue:comment", "chat:postMessage"]
  },
  {
    id: "attach_artifact",
    semanticAction: "attach_artifact",
    capabilityClass: "callback",
    requiresExplicitIntent: false,
    mayAutoApplyByPolicy: true,
    adapterTargets: ["github", "slack", "lark", "webhook"],
    requiredPermissionScopes: ["issue:comment", "chat:postMessage"]
  },
  {
    id: "create_pr",
    semanticAction: "create_pull_request",
    capabilityClass: "external_write",
    requiresExplicitIntent: true,
    mayAutoApplyByPolicy: true,
    adapterTargets: ["github"],
    requiredPermissionScopes: ["pr:create"],
    requiredExecutorConditions: ["isolated branch exists"]
  },
  {
    id: "set_status",
    semanticAction: "transition_status",
    capabilityClass: "external_write",
    requiresExplicitIntent: true,
    mayAutoApplyByPolicy: true,
    adapterTargets: ["github", "linear", "jira", "lark"],
    requiredPermissionScopes: ["repo:write"]
  },
  {
    id: "set_assignee",
    semanticAction: "set_assignee",
    capabilityClass: "external_write",
    requiresExplicitIntent: true,
    mayAutoApplyByPolicy: true,
    adapterTargets: ["github", "linear", "jira", "lark"],
    requiredPermissionScopes: ["repo:write"]
  },
  {
    id: "set_priority",
    semanticAction: "set_priority",
    capabilityClass: "external_write",
    requiresExplicitIntent: true,
    mayAutoApplyByPolicy: true,
    adapterTargets: ["linear", "jira", "lark"],
    requiredPermissionScopes: ["repo:write"]
  },
  {
    id: "set_labels",
    semanticAction: "set_labels",
    capabilityClass: "external_write",
    requiresExplicitIntent: true,
    mayAutoApplyByPolicy: true,
    adapterTargets: ["github", "linear", "jira", "lark"],
    requiredPermissionScopes: ["repo:write"]
  },
  {
    id: "request_review",
    semanticAction: "request_review",
    capabilityClass: "callback",
    requiresExplicitIntent: false,
    mayAutoApplyByPolicy: true,
    adapterTargets: ["github", "slack", "lark"],
    requiredPermissionScopes: ["issue:comment", "chat:postMessage"]
  }
] satisfies CapabilityContract[];

function firstContextUri(event: OpenTagEvent, kind: ContextPointer["kind"]): string | undefined {
  return event.context.find((pointer) => pointer.kind === kind)?.uri;
}

function stringMetadata(event: OpenTagEvent, key: string): string | undefined {
  const value = event.metadata[key];
  return typeof value === "string" ? value : undefined;
}

function numberMetadata(event: OpenTagEvent, key: string): number | undefined {
  const value = event.metadata[key];
  return typeof value === "number" ? value : undefined;
}

export function workItemReferenceFromEvent(event: OpenTagEvent): WorkItemReference | undefined {
  const owner = stringMetadata(event, "owner");
  const repo = stringMetadata(event, "repo");
  if (!owner || !repo) return undefined;

  const issueNumber = numberMetadata(event, "issueNumber");
  if (event.source === "github" && issueNumber !== undefined) {
    return {
      provider: "github",
      kind: "issue",
      externalId: `${owner}/${repo}#${issueNumber}`,
      uri: firstContextUri(event, "github.issue") ?? `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
      ownerContainer: {
        provider: "github",
        id: `${owner}/${repo}`,
        uri: `https://github.com/${owner}/${repo}`
      }
    };
  }

  const pullRequestNumber = numberMetadata(event, "pullRequestNumber");
  if (event.source === "github" && pullRequestNumber !== undefined) {
    return {
      provider: "github",
      kind: "pull_request",
      externalId: `${owner}/${repo}#${pullRequestNumber}`,
      uri: firstContextUri(event, "github.pull_request") ?? `https://github.com/${owner}/${repo}/pull/${pullRequestNumber}`,
      ownerContainer: {
        provider: "github",
        id: `${owner}/${repo}`,
        uri: `https://github.com/${owner}/${repo}`
      }
    };
  }

  return undefined;
}

export function primaryConversationAnchorFromEvent(event: OpenTagEvent): ConversationAnchor {
  const slackThreadKey = event.callback.provider === "slack" ? event.callback.threadKey : undefined;
  return {
    provider: event.callback.provider,
    kind: event.callback.provider === "slack" ? "thread" : `${event.callback.provider}_thread`,
    externalId: event.callback.threadKey ?? event.callback.uri,
    uri:
      firstContextUri(event, "github.comment") ??
      firstContextUri(event, "url") ??
      event.callback.uri,
    controlPlane: true,
    canApprove: true,
    ...(slackThreadKey ? { threadKey: slackThreadKey } : {})
  };
}

export function workThreadFromEvent(event: OpenTagEvent): WorkThread | undefined {
  const workItemReference = workItemReferenceFromEvent(event);
  if (!workItemReference) return undefined;

  const primaryAnchor = primaryConversationAnchorFromEvent(event);
  return {
    id: `thread_${workItemReference.provider}_${workItemReference.externalId}_${primaryAnchor.externalId}`,
    workItemReference,
    primaryAnchor
  };
}

export function contextPacketFromEvent(event: OpenTagEvent, emittedAt = event.receivedAt): ContextPacket {
  const sourceUri = event.context[0]?.uri;
  const writeScopes = event.permissions
    .map((permission) => permission.scope)
    .filter((scope) => scope === "repo:write" || scope === "pr:create" || scope === "pr:update");

  const summary = event.command.rawText || `OpenTag ${event.command.intent} request`;
  return {
    summary,
    sourcePointers: event.context,
    facts: [
      {
        text: `Requested intent: ${event.command.intent}`,
        ...(sourceUri ? { sourceUri } : {})
      }
    ],
    risks:
      writeScopes.length > 0
        ? [`External write-capable scopes were requested: ${writeScopes.join(", ")}.`]
        : ["No external write-capable scopes were requested."],
    exclusions: ["Do not mutate external state unless an explicit capability and policy allow it."],
    mustPreserve: [summary],
    assembly: {
      stages: [...CONTEXT_PACKET_STAGES],
      emittedAt
    }
  };
}

export function protocolRunFieldsFromEvent(
  event: OpenTagEvent,
  emittedAt = event.receivedAt
): { thread?: WorkThread; contextPacket: ContextPacket } {
  const thread = workThreadFromEvent(event);
  const contextPacket = contextPacketFromEvent(event, emittedAt);
  return {
    ...(thread ? { thread } : {}),
    contextPacket
  };
}

export function capabilityForMutationIntent(
  intent: MutationIntent,
  capabilities: readonly CapabilityContract[] = DefaultCapabilityContracts
): CapabilityContract | undefined {
  const capabilityId =
    intent.action === "create_pull_request"
      ? "create_pr"
      : intent.action === "request_review"
        ? "request_review"
        : intent.action === "link_artifact"
          ? "attach_artifact"
          : intent.domain === "status"
            ? "set_status"
            : intent.domain === "assignee"
              ? "set_assignee"
              : intent.domain === "priority"
                ? "set_priority"
                : intent.domain === "labels"
                  ? "set_labels"
                  : undefined;

  return capabilityId ? capabilities.find((capability) => capability.id === capabilityId) : undefined;
}

export function resolvePolicy(input: {
  capabilityId: string;
  rules: PolicyRule[];
  defaultDecision?: "allow" | "deny";
}): PolicyResolution {
  const matchingRules = input.rules.filter((rule) => !rule.capabilityId || rule.capabilityId === input.capabilityId);
  const sortedRules = [...matchingRules].sort((left, right) => {
    const scopeDelta = POLICY_SCOPE_ORDER.indexOf(right.scope) - POLICY_SCOPE_ORDER.indexOf(left.scope);
    if (scopeDelta !== 0) return scopeDelta;
    if (left.effect === right.effect) return 0;
    return left.effect === "deny" ? -1 : 1;
  });
  const winningRule = sortedRules[0];
  if (winningRule) {
    return {
      capabilityId: input.capabilityId,
      decision: winningRule.effect,
      resolvedBy: winningRule.scope,
      rules: matchingRules,
      reason: winningRule.reason
    };
  }

  return {
    capabilityId: input.capabilityId,
    decision: input.defaultDecision ?? "deny",
    resolvedBy: "organization_default",
    rules: [],
    reason: input.defaultDecision === "allow" ? "Allowed by default policy." : "Denied by default policy."
  };
}

export function permissionScopesAllowCapability(permissions: PermissionGrant[], capability: CapabilityContract): boolean {
  const grantedScopes = new Set(permissions.map((permission) => permission.scope));
  return capability.requiredPermissionScopes.some((scope) => grantedScopes.has(scope));
}

export function preflightMutationIntent(input: {
  intent: MutationIntent;
  permissions: PermissionGrant[];
  policyRules: PolicyRule[];
  capabilities?: readonly CapabilityContract[];
}): { capability?: CapabilityContract; policyResolution?: PolicyResolution; outcome: ApplyIntentOutcome } {
  const capability = capabilityForMutationIntent(input.intent, input.capabilities);
  if (!capability) {
    return {
      outcome: {
        intentId: input.intent.intentId,
        outcome: "unsupported",
        message: `No capability contract maps mutation action ${input.intent.action}.`
      }
    };
  }

  if (!permissionScopesAllowCapability(input.permissions, capability)) {
    return {
      capability,
      outcome: {
        intentId: input.intent.intentId,
        outcome: "unsupported",
        message: `Missing platform permission for capability ${capability.id}.`
      }
    };
  }

  const policyResolution = resolvePolicy({
    capabilityId: capability.id,
    rules: input.policyRules,
    defaultDecision: capability.capabilityClass === "external_write" ? "deny" : "allow"
  });
  if (policyResolution.decision === "deny") {
    return {
      capability,
      policyResolution,
      outcome: {
        intentId: input.intent.intentId,
        outcome: "unsupported",
        message: `OpenTag policy denied capability ${capability.id}: ${policyResolution.reason}`
      }
    };
  }

  return {
    capability,
    policyResolution,
    outcome: {
      intentId: input.intent.intentId,
      outcome: "skipped",
      message: `Preflight passed for ${capability.id}; adapter execution is not implemented in this protocol slice.`
    }
  };
}
