/*****************************************************************************************
 * index.ts
 *
 * Main entry point for the Twitch plugin. Exports a "Client" that ElizaOS loads
 * when "twitch" is in the character's clients array.
 *
 * This version:
 *  - Fixes the “Object literal may only specify known properties” error by removing "stop".
 *  - Refreshes the Twitch token once on startup and every 3 hours automatically.
 *****************************************************************************************/

import { elizaLogger } from "@elizaos/core";
import type { Client, IAgentRuntime } from "@elizaos/core";
import { validateTwitchConfig } from "./environment";
import { maybeRefreshToken } from "./refreshTokenHelper";
import { TwitchClient } from "./twitchClient";

export const TwitchClientInterface: Client = {
  // Must include a `name` property to satisfy the Client interface.
  name: "twitch",

  /**
   * Initializes and starts the Twitch client.
   */
  start: async (runtime: IAgentRuntime) => {
    // 1) Validate required environment settings (token, client_id, etc.).
    await validateTwitchConfig(runtime);

    // 2) Attempt to refresh the token right now (won’t crash if it fails).
    await maybeRefreshToken(runtime);

    // 3) Also schedule a refresh every 3 hours (3 * 60 * 60 * 1000 ms).
    setInterval(() => {
      maybeRefreshToken(runtime).catch((err) => {
        elizaLogger.error("[Twitch] Periodic token refresh error:", err);
      });
    }, 3 * 60 * 60 * 1000);

    // 4) Instantiate and start the Twitch client.
    const twitchClient = new TwitchClient(runtime);
    await twitchClient.start();

    elizaLogger.success(`[Twitch] client successfully started for character ${runtime.character.name}`);
    return twitchClient;
  },
};

export default TwitchClientInterface;
