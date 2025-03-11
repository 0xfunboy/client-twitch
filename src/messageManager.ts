/*****************************************************************************************
 * messageManager.ts
 *
 * Handles Twitch chat message logic:
 *  - Creating Memory objects.
 *  - Generating responses via LLM prompts.
 *  - Managing auto-post when inactivity is detected.
 *  - Sending messages via the Twitch Helix API.
 *****************************************************************************************/

import { elizaLogger } from "@elizaos/core";
import {
  type IAgentRuntime,
  type Memory,
  type Content,
  type State,
  stringToUuid,
  getEmbeddingZeroVector,
  generateMessageResponse,
  ModelClass,
  composeContext,
  generateShouldRespond,
} from "@elizaos/core";
import {
  twitchShouldRespondTemplate,
  twitchMessageHandlerTemplate,
  twitchAutoPostTemplate,
} from "./templates";
import { fetchRandomFeedItem } from "./aggregator";
import { sendChatMessage } from "./twitchClient";

export interface InterestChatState {
  currentHandler?: string;
  lastMessageSent: number;
  messages: { userId: string; userName: string; content: Content }[];
  contextSimilarityThreshold?: number;
}

export class MessageManager {
  private runtime: IAgentRuntime;
  private interestChats: Record<string, InterestChatState> = {};
  private autoPostEnabled = false;
  private inactivityThreshold = 3600000; // default 1 hour
  private minTimeBetweenPosts = 7200000; // default 2 hours
  private lastAutoPostTime = 0;
  private rssFeeds: string[] = [];
  private lastActivity: Record<string, number> = {};

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.initAutoPostConfig();
    this.startAutoPostMonitor();
  }

  private initAutoPostConfig(): void {
    const autopostEnabled = this.runtime.getSetting("AUTOPOST_ENABLED");
    if (autopostEnabled === "true") {
      this.autoPostEnabled = true;
    }

    const inactivity = this.runtime.getSetting("AUTOPOST_INACTIVITY_THRESHOLD");
    if (inactivity) {
      const val = parseInt(inactivity, 10);
      if (!isNaN(val)) {
        this.inactivityThreshold = val;
      }
    }

    const minBetween = this.runtime.getSetting("AUTOPOST_MIN_TIME_BETWEEN_POSTS");
    if (minBetween) {
      const val = parseInt(minBetween, 10);
      if (!isNaN(val)) {
        this.minTimeBetweenPosts = val;
      }
    }

    const feeds = this.runtime.getSetting("AUTOPOST_RSS_FEEDS");
    if (feeds) {
      this.rssFeeds = feeds.split(",").map((f) => f.trim());
    }

    elizaLogger.info(
      `[Twitch] Auto-post config: enabled=${this.autoPostEnabled}, ` +
      `inactivityThreshold=${this.inactivityThreshold}, ` +
      `minTimeBetweenPosts=${this.minTimeBetweenPosts}, ` +
      `feeds=${this.rssFeeds.join(", ")}`
    );
  }

  private startAutoPostMonitor(): void {
    if (!this.autoPostEnabled) return;
    // Check auto-post every 10 minutes
    setInterval(() => {
      this.checkAutoPost().catch((err) => {
        elizaLogger.error("[Twitch] autoPostMonitor error:", err);
      });
    }, 10 * 60 * 1000);
  }

  private async checkAutoPost(): Promise<void> {
    if (!this.autoPostEnabled || !this.rssFeeds.length) return;

    const channelUserId = this.runtime.getSetting("TWITCH_CHANNEL_USER_ID");
    if (!channelUserId) return;

    const now = Date.now();
    const lastActivityTime = this.lastActivity[channelUserId] || 0;
    const timeSinceLastActivity = now - lastActivityTime;
    const timeSinceLastAutoPost = now - this.lastAutoPostTime;

    elizaLogger.debug(
      `[Twitch] checkAutoPost => timeSinceLastActivity=${timeSinceLastActivity}, ` +
      `timeSinceLastAutoPost=${timeSinceLastAutoPost}`
    );

    if (timeSinceLastActivity > this.inactivityThreshold &&
        timeSinceLastAutoPost > this.minTimeBetweenPosts) {
      elizaLogger.debug("[Twitch] Attempting auto-post from RSS aggregator...");
      const feedItem = await fetchRandomFeedItem(this.rssFeeds);
      if (!feedItem) {
        elizaLogger.warn("[Twitch] Auto-post aggregator returned no item.");
        return;
      }

      const roomId = stringToUuid(channelUserId + "-" + this.runtime.agentId);
      const memory: Memory = {
        id: stringToUuid(`autopost-${Date.now()}`),
        userId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        roomId,
        content: {
          text: `AUTO_POST_ENGAGEMENT: ${feedItem.title}\n${feedItem.link}`,
          source: "twitch",
        },
        embedding: getEmbeddingZeroVector(),
        createdAt: Date.now(),
      };

      // Compose state
      let state = await this.runtime.composeState(memory);
      state = await this.runtime.updateRecentMessageState(state);

      const context = composeContext({
        state,
        template: twitchAutoPostTemplate,
      });
      const responseContent = await generateMessageResponse({
        runtime: this.runtime,
        context,
        modelClass: ModelClass.LARGE,
      });

      if (responseContent?.text) {
        elizaLogger.info(`[Twitch] Auto-post: sending => "${responseContent.text}"`);
        await sendChatMessage(this.runtime, responseContent.text);

        const postedMem: Memory = {
          id: stringToUuid(`autopost-response-${Date.now()}`),
          agentId: this.runtime.agentId,
          userId: this.runtime.agentId,
          roomId,
          content: responseContent,
          createdAt: Date.now(),
          embedding: getEmbeddingZeroVector(),
        };

        await this.runtime.messageManager.createMemory(postedMem);
        state = await this.runtime.updateRecentMessageState(state);
        await this.runtime.evaluate(memory, state, true);
        this.lastAutoPostTime = now;
      }
    }
  }

  /**
   * Main entry for incoming messages from Twitch. We add logs at each step.
   */
  public async handleIncomingMessage(
    channelUserId: string,
    senderId: string,
    senderName: string,
    messageText: string
  ): Promise<Content | null> {
    elizaLogger.info(
      `[Twitch] Received message from ${senderName} (ID: ${senderId}) in channel ${channelUserId}: "${messageText}"`
    );
  
    try {
      // 1) Ignore messages from the bot itself to prevent self-triggered responses.
      const botUserId = this.runtime.getSetting("TWITCH_BOT_USER_ID");
      if (botUserId && senderId === botUserId) {
        elizaLogger.debug("[Twitch] Ignoring own message to prevent loop.");
        return null;
      }
  
      // 2) Update last activity timestamp.
      this.lastActivity[channelUserId] = Date.now();
  
      // 3) Ensure a chat state exists for the channel.
      if (!this.interestChats[channelUserId]) {
        this.interestChats[channelUserId] = {
          currentHandler: this.runtime.agentId,
          lastMessageSent: 0,
          messages: [],
        };
      }
      const chatState = this.interestChats[channelUserId];
  
      // 4) Create a Memory object for the incoming message.
      const userId = stringToUuid(senderId);
      const roomId = stringToUuid(`${channelUserId}-${this.runtime.agentId}`);
  
      await this.runtime.ensureConnection(userId, roomId, senderName, senderName, "twitch");
  
      const messageMem: Memory = {
        id: stringToUuid(`${roomId}-${Date.now()}`),
        agentId: this.runtime.agentId,
        userId,
        roomId,
        content: { text: messageText, source: "twitch" },
        createdAt: Date.now(),
        embedding: getEmbeddingZeroVector(),
      };
  
      await this.runtime.messageManager.createMemory(messageMem);
      chatState.messages.push({
        userId,
        userName: senderName,
        content: { text: messageText, source: "twitch" },
      });
      chatState.lastMessageSent = Date.now();
  
      // 5) Compose state and generate a response (only once per incoming message)
      let state = await this.runtime.composeState(messageMem);
      state = await this.runtime.updateRecentMessageState(state);
  
      // OPTIONAL: if you want to respond only on mentions, add your check here.
      // For now, we assume every message (that isn't from the bot) should be responded to.
  
      // 6) Generate a response using the message handler template.
      const context = composeContext({
        state,
        template: twitchMessageHandlerTemplate,
      });
      elizaLogger.debug("[Twitch] Generating response with context:", context);
  
      const responseContent = await generateMessageResponse({
        runtime: this.runtime,
        context,
        modelClass: ModelClass.LARGE,
      });
  
      if (!responseContent?.text) {
        elizaLogger.debug("[Twitch] No response text generated.");
        return null;
      }
  
      // 7) If the same response was already generated (for this message), skip to prevent loop.
      if ((chatState as any).lastResponse === responseContent.text) {
        elizaLogger.debug("[Twitch] Duplicate response detected; skipping sending.");
        return null;
      }
      // Save response to chat state to compare later.
      (chatState as any).lastResponse = responseContent.text;
  
      // 8) Send the chat message using the Helix API.
      elizaLogger.info(`[Twitch] Sending response: "${responseContent.text}"`);
      await sendChatMessage(this.runtime, responseContent.text);
  
      // 9) Save the agent's response in memory.
      const responseMem: Memory = {
        id: stringToUuid(`${roomId}-response-${Date.now()}`),
        agentId: this.runtime.agentId,
        userId: this.runtime.agentId,
        roomId,
        content: responseContent,
        createdAt: Date.now(),
        embedding: getEmbeddingZeroVector(),
      };
      await this.runtime.messageManager.createMemory(responseMem);
  
      // 10) Log that evaluation is complete (we do not call evaluate again to avoid loops).
      elizaLogger.info("[Twitch] Finished handling incoming message; response sent.");
      return responseContent;
    } catch (error) {
      elizaLogger.error("[Twitch] Error in handleIncomingMessage:", error);
      return null;
    }
  }

  private async shouldRespond(messageText: string, state: State): Promise<boolean> {
    const context = composeContext({
      state,
      template: twitchShouldRespondTemplate,
    });
    const decision = await generateShouldRespond({
      runtime: this.runtime,
      context,
      modelClass: ModelClass.SMALL,
    });
    return decision === "RESPOND";
  }
}
