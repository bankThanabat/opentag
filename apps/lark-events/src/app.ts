import type { OpenTagEvent } from "@opentag/core";
import { type LarkChannelBinding, normalizeLarkMessage } from "@opentag/lark";

export type LarkMention = { key?: string; id?: { open_id?: string }; name?: string };

/**
 * Shape of the `im.message.receive_v1` event payload delivered by
 * @larksuiteoapi/node-sdk's EventDispatcher. Only the fields OpenTag needs are
 * declared; everything is optional because the payload is external input.
 */
export type LarkInboundMessageEvent = {
  header?: {
    event_id?: string;
    event_type?: string;
    create_time?: string;
    tenant_key?: string;
    app_id?: string;
  };
  event?: {
    sender?: {
      sender_id?: { open_id?: string; user_id?: string; union_id?: string };
      sender_type?: string;
      tenant_key?: string;
    };
    message?: {
      message_id?: string;
      root_id?: string;
      parent_id?: string;
      chat_id?: string;
      chat_type?: string;
      message_type?: string;
      content?: string;
      mentions?: LarkMention[];
    };
  };
};

export type LarkMessageHandlerConfig = {
  agentId: string;
  botOpenId?: string;
  callbackUri?: string;
  resolveChannelBinding(input: { tenantKey: string; chatId: string }): Promise<LarkChannelBinding | null>;
  createRun(event: OpenTagEvent): Promise<{ runId: string }>;
  now?(): number;
};

export type LarkMessageHandlerOutcome = {
  status:
    | "created"
    | "ignored_non_text"
    | "ignored_invalid_payload"
    | "ignored_group_requires_bot_open_id"
    | "ignored_not_addressed"
    | "ignored_unbound_chat"
    | "ignored_empty_command";
  runId?: string;
  tenantKey?: string;
  chatId?: string;
};

function extractText(content: string | undefined): string {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text : "";
  } catch {
    return "";
  }
}

function mentionsBot(mentions: LarkMention[] | undefined, botOpenId: string): boolean {
  return (mentions ?? []).some((mention) => mention.id?.open_id === botOpenId);
}

/**
 * Build a handler for inbound Lark message events. The handler enforces that
 * group messages must @-mention the bot (only direct p2p chats are exempt),
 * resolves the channel binding, normalizes the message into an OpenTagEvent, and
 * creates a run. It is transport-agnostic so it can be unit-tested without a
 * live socket.
 */
export function createLarkMessageHandler(config: LarkMessageHandlerConfig) {
  return async function handleLarkMessage(data: LarkInboundMessageEvent): Promise<LarkMessageHandlerOutcome> {
    const message = data.event?.message;
    const header = data.header;
    if (!message || message.message_type !== "text") {
      return { status: "ignored_non_text" };
    }

    const tenantKey = header?.tenant_key ?? data.event?.sender?.tenant_key;
    const chatId = message.chat_id;
    const messageId = message.message_id;
    const eventId = header?.event_id;
    const senderOpenId = data.event?.sender?.sender_id?.open_id;
    if (!tenantKey || !chatId || !messageId || !eventId || !senderOpenId) {
      return { status: "ignored_invalid_payload" };
    }

    // Group messages must explicitly @-mention the bot before they can trigger a
    // (potentially write-capable) run. Direct p2p chats need no mention.
    const isDirect = message.chat_type === "p2p";
    if (!isDirect) {
      if (!config.botOpenId) {
        return { status: "ignored_group_requires_bot_open_id", tenantKey, chatId };
      }
      if (!mentionsBot(message.mentions, config.botOpenId)) {
        return { status: "ignored_not_addressed", tenantKey, chatId };
      }
    }

    const binding = await config.resolveChannelBinding({ tenantKey, chatId });
    if (!binding) {
      return { status: "ignored_unbound_chat", tenantKey, chatId };
    }

    const parsedTime = header?.create_time ? Number(header.create_time) : Number.NaN;
    const eventTimeMs = Number.isFinite(parsedTime) ? parsedTime : (config.now?.() ?? Date.now());

    const event = normalizeLarkMessage({
      tenantKey,
      chatId,
      chatType: message.chat_type ?? "group",
      senderOpenId,
      text: extractText(message.content),
      messageId,
      ...(message.root_id ? { rootId: message.root_id } : {}),
      eventId,
      eventTimeMs,
      agentId: config.agentId,
      ...(config.botOpenId ? { botOpenId: config.botOpenId } : {}),
      ...(config.callbackUri ? { callbackUri: config.callbackUri } : {}),
      binding
    });
    if (!event) {
      return { status: "ignored_empty_command" };
    }

    const { runId } = await config.createRun(event);
    return { status: "created", runId };
  };
}
