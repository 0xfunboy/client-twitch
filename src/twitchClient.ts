/*****************************************************************************************
 * twitchClient.ts
 *
 * Manages:
 *   - OAuth token validation
 *   - Opening a WebSocket to EventSub
 *   - Subscribing to channel.chat.message
 *   - Handling inbound chat messages (via WebSocket notifications)
 *   - Sending chat messages via Helix Chat
 *****************************************************************************************/

import { elizaLogger } from "@elizaos/core";
import type { IAgentRuntime } from "@elizaos/core";
import WebSocket from "ws";
import fetch, { Headers } from "node-fetch";
import { MessageManager } from "./messageManager";

/**
 * sendChatMessage:
 *  - Uses the new Helix Chat endpoint:
 *    POST https://api.twitch.tv/helix/chat/messages?broadcaster_id=...&moderator_id=...
 *  - Body = { "message": "some text" }
 *  - If botUserId == channelUserId, we skip moderator_id (bot is broadcaster).
 */
export async function sendChatMessage(runtime: IAgentRuntime, chatMessage: string): Promise<void> {
  const token = runtime.getSetting("TWITCH_OAUTH_TOKEN");
  const clientId = runtime.getSetting("TWITCH_CLIENT_ID");
  const botUserId = runtime.getSetting("TWITCH_BOT_USER_ID");
  const channelUserId = runtime.getSetting("TWITCH_CHANNEL_USER_ID");

  if (!token || !clientId || !botUserId || !channelUserId) {
    throw new Error("[Twitch] Missing credentials for sendChatMessage");
  }

  // If the bot is the broadcaster, no moderator param is needed:
  const isBroadcaster = (botUserId === channelUserId);

  // Build the Helix Chat endpoint with the required query params:
  let url = `https://api.twitch.tv/helix/chat/messages?broadcaster_id=${channelUserId}`;
  if (!isBroadcaster) {
    url += `&moderator_id=${botUserId}`;
  }

  // Body must be { "message": "Hello world" }
  const body = { message: chatMessage };

  const res = await fetch(url, {
    method: "POST",
    headers: new Headers({
      Authorization: `Bearer ${token}`,
      "Client-Id": clientId,
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    elizaLogger.error("[Twitch] Failed to send chat message. Status:", res.status, "Data:", data);
  } else {
    elizaLogger.info(`[Twitch] Sent chat message => ${chatMessage}`);
  }
}

export class TwitchClient {
  private runtime: IAgentRuntime;
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private messageManager: MessageManager;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.messageManager = new MessageManager(runtime);
  }

  /**
   * Start the Twitch client: validate token, open WebSocket, handle events.
   */
  public async start(): Promise<TwitchClient> {
    await this.validateToken();

    // Connect to the Twitch EventSub WebSocket
    this.ws = new WebSocket("wss://eventsub.wss.twitch.tv/ws");

    this.ws.on("open", () => {
      elizaLogger.info("[Twitch] WebSocket connection opened");
    });

    // Add explicit type annotations to avoid "implicitly has any" errors
    this.ws.on("error", (err: unknown) => {
      elizaLogger.error("[Twitch] WebSocket error:", err);
    });

    this.ws.on("message", (data: Buffer) => {
      this.handleWebSocketMessage(data.toString());
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      elizaLogger.warn(`[Twitch] WebSocket closed. code=${code}, reason=${reason.toString()}`);
      this.ws = null;
    });

    return this;
  }

  /**
   * Stop the Twitch client by closing the WebSocket connection.
   */
  public async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      elizaLogger.info("[Twitch] Client stopped – WebSocket closed");
    }
  }

  /**
   * Validate the OAuth token via Twitch's /oauth2/validate endpoint.
   */
  private async validateToken(): Promise<void> {
    const token = this.runtime.getSetting("TWITCH_OAUTH_TOKEN");
    if (!token) {
      throw new Error("Missing TWITCH_OAUTH_TOKEN");
    }

    const url = "https://id.twitch.tv/oauth2/validate";
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `OAuth ${token}` },
    });

    if (res.status !== 200) {
      const data = await res.json().catch(() => ({}));
      elizaLogger.error("[Twitch] Token validation failed. Status:", res.status, data);
      throw new Error("Twitch token invalid");
    }

    elizaLogger.info("[Twitch] OAuth token validated");
  }

  /**
   * Handle incoming WebSocket messages from Twitch EventSub.
   */
  private handleWebSocketMessage(raw: string): void {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      elizaLogger.error("[Twitch] WebSocket message parse error:", err);
      return;
    }

    const msgType = data.metadata?.message_type;
    switch (msgType) {
      case "session_welcome":
        this.sessionId = data.payload.session.id;
        elizaLogger.info(`[Twitch] Received session_welcome. session_id=${this.sessionId}`);
        this.subscribeToChannelChatMessage().catch((error) => {
          elizaLogger.error("[Twitch] subscribeToChannelChatMessage error:", error);
        });
        break;

      case "session_keepalive":
        // Keepalive, do nothing
        break;

      case "notification":
        this.handleNotification(data).catch((err) => {
          elizaLogger.error("[Twitch] handleNotification error:", err);
        });
        break;

      default:
        elizaLogger.info("[Twitch] Received message_type:", msgType);
        break;
    }
  }

  /**
   * Subscribe to "channel.chat.message" so we receive chat messages for this channel.
   */
  private async subscribeToChannelChatMessage(): Promise<void> {
    if (!this.sessionId) return;

    const token = this.runtime.getSetting("TWITCH_OAUTH_TOKEN");
    const clientId = this.runtime.getSetting("TWITCH_CLIENT_ID");
    const channelUserId = this.runtime.getSetting("TWITCH_CHANNEL_USER_ID");
    const botUserId = this.runtime.getSetting("TWITCH_BOT_USER_ID");

    if (!token || !clientId || !channelUserId || !botUserId) {
      throw new Error("Missing environment for subscribeToChannelChatMessage");
    }

    const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
    const body = {
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: channelUserId,
        user_id: botUserId,
      },
      transport: {
        method: "websocket",
        session_id: this.sessionId,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // For a successful subscription, Twitch returns status=202 + JSON.
    if (res.status !== 202) {
      const data: any = await res.json().catch(() => ({}));
      elizaLogger.error("[Twitch] Failed to subscribe to channel.chat.message. Status:", res.status, data);
      throw new Error("subscribeToChannelChatMessage failed");
    } else {
      const data: any = await res.json().catch(() => ({}));
      elizaLogger.info(`[Twitch] Subscribed to channel.chat.message => id=${data.data?.[0]?.id}`);
    }
  }

  /**
   * Process inbound "notification" messages (i.e. actual chat events).
   */
  private async handleNotification(data: any): Promise<void> {
    const subscriptionType = data.metadata?.subscription_type;
    if (subscriptionType === "channel.chat.message") {
      const evt = data.payload.event;
      const channelUserId = evt.broadcaster_user_id;
      const senderId = evt.chatter_user_id;
      const senderName = evt.chatter_user_login;
      const text = evt.message?.text || "";

      await this.messageManager.handleIncomingMessage(channelUserId, senderId, senderName, text);
    }
  }
}
