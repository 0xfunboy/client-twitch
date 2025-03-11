/*****************************************************************************************
 * environment.ts
 *
 * Validate the environment or character settings required to run the Twitch client:
 * - TWITCH_BOT_USER_ID
 * - TWITCH_BOT_USERNAME
 * - TWITCH_OAUTH_TOKEN
 * - TWITCH_CLIENT_ID
 * - TWITCH_CHANNEL_USER_ID
 *
 * Additional optional fields for team coordinator, auto-post config, aggregator, etc.
 *****************************************************************************************/

import { z } from "zod";
import type { IAgentRuntime } from "@elizaos/core";

export const twitchEnvSchema = z.object({
  TWITCH_BOT_USER_ID: z.string().min(1, "Twitch bot user ID is required"),
  TWITCH_BOT_USERNAME: z.string().min(1, "Twitch bot username is required"),
  TWITCH_OAUTH_TOKEN: z.string().min(1, "Twitch OAuth token is required"),
  TWITCH_CLIENT_ID: z.string().min(1, "Twitch Client ID is required"),
  TWITCH_CHANNEL_USER_ID: z.string().min(1, "Twitch channel user ID is required"),

  // Team config
  TEAM_AGENT_IDS: z.string().optional(),
  TEAM_LEADER_ID: z.string().optional(),
  TEAM_MEMBER_INTEREST_KEYWORDS: z.string().optional(),

  // Auto post config
  AUTOPOST_ENABLED: z.string().optional(),
  AUTOPOST_INACTIVITY_THRESHOLD: z.string().optional(),
  AUTOPOST_MIN_TIME_BETWEEN_POSTS: z.string().optional(),
  AUTOPOST_RSS_FEEDS: z.string().optional(),
});

export type TwitchConfig = z.infer<typeof twitchEnvSchema>;

/**
 * Reads from runtime.getSetting() or from process.env, ensuring everything is present.
 */
export async function validateTwitchConfig(
  runtime: IAgentRuntime
): Promise<TwitchConfig> {
  const config = {
    TWITCH_BOT_USER_ID:
      runtime.getSetting("TWITCH_BOT_USER_ID") || process.env.TWITCH_BOT_USER_ID,
    TWITCH_BOT_USERNAME:
      runtime.getSetting("TWITCH_BOT_USERNAME") || process.env.TWITCH_BOT_USERNAME,
    TWITCH_OAUTH_TOKEN:
      runtime.getSetting("TWITCH_OAUTH_TOKEN") || process.env.TWITCH_OAUTH_TOKEN,
    TWITCH_CLIENT_ID:
      runtime.getSetting("TWITCH_CLIENT_ID") || process.env.TWITCH_CLIENT_ID,
    TWITCH_CHANNEL_USER_ID:
      runtime.getSetting("TWITCH_CHANNEL_USER_ID") ||
      process.env.TWITCH_CHANNEL_USER_ID,

    TEAM_AGENT_IDS:
      runtime.getSetting("TEAM_AGENT_IDS") || process.env.TEAM_AGENT_IDS,
    TEAM_LEADER_ID:
      runtime.getSetting("TEAM_LEADER_ID") || process.env.TEAM_LEADER_ID,
    TEAM_MEMBER_INTEREST_KEYWORDS:
      runtime.getSetting("TEAM_MEMBER_INTEREST_KEYWORDS") ||
      process.env.TEAM_MEMBER_INTEREST_KEYWORDS,

    AUTOPOST_ENABLED:
      runtime.getSetting("AUTOPOST_ENABLED") || process.env.AUTOPOST_ENABLED,
    AUTOPOST_INACTIVITY_THRESHOLD:
      runtime.getSetting("AUTOPOST_INACTIVITY_THRESHOLD") ||
      process.env.AUTOPOST_INACTIVITY_THRESHOLD,
    AUTOPOST_MIN_TIME_BETWEEN_POSTS:
      runtime.getSetting("AUTOPOST_MIN_TIME_BETWEEN_POSTS") ||
      process.env.AUTOPOST_MIN_TIME_BETWEEN_POSTS,
    AUTOPOST_RSS_FEEDS:
      runtime.getSetting("AUTOPOST_RSS_FEEDS") || process.env.AUTOPOST_RSS_FEEDS,
  };

  const parsed = twitchEnvSchema.parse(config);
  return parsed;
}
