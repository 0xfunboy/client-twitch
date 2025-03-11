/*****************************************************************************************
 * refreshTokenHelper.ts
 *
 * Provides a function to refresh the Twitch token if needed, or always.
 * Uses the same logic as refreshAccessToken.ts, but wrapped so it won't crash your agent.
 *****************************************************************************************/

import fs from "fs/promises";
import path from "path";
import JSON5 from "json5";
import fetch, { Headers } from "node-fetch";
import { elizaLogger, IAgentRuntime } from "@elizaos/core";

// This interface describes the JSON returned by Twitch on refresh
interface TwitchRefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

const characterFilePath = path.resolve(
  process.cwd(),
  "eliza",
  "characters",
  "myTwitchBot.character.json"
);

async function loadCharacterConfig(filePath: string): Promise<any> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON5.parse(raw);
}

async function saveCharacterConfig(filePath: string, data: any): Promise<void> {
  const output = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, output, "utf8");
  elizaLogger.info(`Updated config saved to: ${filePath}`);
}

/**
 * Attempts to refresh the Twitch token. If it fails, logs an error but does NOT throw.
 */
export async function maybeRefreshToken(runtime: IAgentRuntime) {
  try {
    // 1) Load the JSON
    const config = await loadCharacterConfig(characterFilePath);
    const secrets = config?.settings?.secrets;
    if (!secrets) {
      elizaLogger.warn("[Twitch] No 'settings.secrets' found in character JSON. Skipping refresh.");
      return;
    }

    // 2) Pull out needed fields
    const clientId = secrets.TWITCH_CLIENT_ID;
    const clientSecret = secrets.TWITCH_CLIENT_SECRET;
    const refreshToken = secrets.TWITCH_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      elizaLogger.warn("[Twitch] Missing clientId/clientSecret/refreshToken. Skipping refresh.");
      return;
    }

    elizaLogger.info(`[Twitch] Attempting token refresh: clientId=${clientId}, refreshToken=${refreshToken}`);

    // 3) Make request
    const url = "https://id.twitch.tv/oauth2/token";
    const bodyParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body: bodyParams,
    });

    const json = (await res.json().catch(() => ({}))) as TwitchRefreshResponse;
    if (!res.ok) {
      elizaLogger.error("[Twitch] Failed to refresh token. Status =", res.status, "Response:", json);
      return; // do not crash
    }

    // 4) Expect new tokens
    if (!json.access_token || !json.refresh_token) {
      elizaLogger.error("[Twitch] Did not receive valid tokens in refresh response:", json);
      return;
    }

    elizaLogger.info(`[Twitch] Refresh successful. New token: ${json.access_token}, expires_in=${json.expires_in}`);

    // 5) Save new tokens to JSON
    secrets.TWITCH_OAUTH_TOKEN = json.access_token;
    secrets.TWITCH_REFRESH_TOKEN = json.refresh_token;

    await saveCharacterConfig(characterFilePath, config);

    elizaLogger.info("[Twitch] Twitch tokens updated successfully!");
  } catch (err) {
    elizaLogger.error("[Twitch] maybeRefreshToken error:", err);
    // do not throw, so agent continues
  }
}
