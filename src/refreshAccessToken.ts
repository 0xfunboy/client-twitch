/*****************************************************************************************
 * refreshAccessToken.ts
 *
 * A standalone script that:
 *  1. Loads your myTwitchBot.character.json file.
 *  2. Reads TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_REFRESH_TOKEN, etc.
 *  3. Calls the Twitch OAuth endpoint with grant_type=refresh_token.
 *  4. Updates TWITCH_OAUTH_TOKEN and TWITCH_REFRESH_TOKEN in the JSON.
 *  5. Saves the file back to disk.
 *
 * Usage:
 *   pnpm exec tsx src/refreshAccessToken.ts
 *
 * Adjust paths if needed for your environment.
 *****************************************************************************************/

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fetch, { Headers } from "node-fetch";
import JSON5 from "json5";

// Determine __dirname for the current module.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Adjust the path to your character file.
// Our project structure is assumed as:
//   /home/funboy/eliza/
//       ├─ characters/
//       │    └─ myTwitchBot.character.json
//       └─ packages/
//            └─ client-twitch/
//                 └─ src/
//                      └─ refreshAccessToken.ts
// To reach the characters folder from __dirname, we need to go up three levels.
const characterFilePath = path.resolve(__dirname, "../../../characters/myTwitchBot.character.json");

/**
 * Loads and parses the character configuration file.
 * Uses JSON5 to allow comments and trailing commas.
 */
async function loadCharacterConfig(filePath: string): Promise<any> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON5.parse(raw);
  } catch (error) {
    console.error("Error reading character config:", error);
    process.exit(1);
  }
}

/**
 * Saves the given data as JSON (without trailing commas) to the specified file.
 */
async function saveCharacterConfig(filePath: string, data: any): Promise<void> {
  try {
    const output = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, output, "utf8");
    console.log(`Updated config saved to: ${filePath}`);
  } catch (error) {
    console.error("Error saving character config:", error);
    process.exit(1);
  }
}

/**
 * Refreshes the Twitch OAuth token using the refresh token flow.
 * Updates the configuration file with the new access and refresh tokens.
 */
async function refreshAccessToken(): Promise<void> {
  // Load the configuration file.
  const config = await loadCharacterConfig(characterFilePath);
  if (!config?.settings?.secrets) {
    throw new Error("No 'settings.secrets' found in character JSON.");
  }

  const secrets = config.settings.secrets;

  // Extract needed fields.
  const clientId = secrets.TWITCH_CLIENT_ID;
  const clientSecret = secrets.TWITCH_CLIENT_SECRET; // Ensure this key exists in your JSON.
  const refreshToken = secrets.TWITCH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing one of TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, or TWITCH_REFRESH_TOKEN in the JSON."
    );
  }

  console.log("Attempting to refresh token with these fields:");
  console.log("  clientId =", clientId);
  // For security, do not print clientSecret.
  console.log("  refreshToken =", refreshToken);

  // Build the refresh POST request.
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

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Failed to refresh token. Status =", res.status);
    console.error("Response:", json);
    throw new Error("Refresh token request failed.");
  }

  // Extract the new tokens and expiry.
  const newAccessToken = json.access_token;
  const newRefreshToken = json.refresh_token;
  const expiresIn = json.expires_in;

  if (!newAccessToken || !newRefreshToken) {
    throw new Error("Did not receive new access_token or refresh_token from Twitch.");
  }

  console.log("Refresh successful. New tokens:");
  console.log("  access_token =", newAccessToken);
  console.log("  refresh_token =", newRefreshToken);
  console.log("  expires_in =", expiresIn);

  // Update the configuration in memory.
  secrets.TWITCH_OAUTH_TOKEN = newAccessToken;
  secrets.TWITCH_REFRESH_TOKEN = newRefreshToken;

  // Write the updated configuration back to disk.
  await saveCharacterConfig(characterFilePath, config);

  console.log("Twitch tokens updated successfully!");
}

// Kick off the refresh process.
refreshAccessToken().catch((err) => {
  console.error("Error in refreshAccessToken:", err);
  process.exit(1);
});
