/**
 * sendHelixChatMessageFromCharacter.js
 *
 * This script reads from the same character JSON file (myTwitchBot.character.json)
 * that your other script uses (autoSubscribeFromCharacter.js).
 *
 * It then uses the new Helix Chat API to send a chat message.
 *
 * Requirements:
 *   1) Node.js
 *   2) pnpm add node-fetch json5  (or npm install)
 *   3) A user access token with the "chat:edit" scope
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import JSON5 from "json5";
import fetch from "node-fetch";

// ---------------------------------------------------------------------
// 1) Update the path to your "myTwitchBot.character.json"
// ---------------------------------------------------------------------
const characterFilePath = path.resolve(
  process.cwd(),
  "eliza",
  "characters",
  "myTwitchBot.character.json"
);

// ---------------------------------------------------------------------
// 2) Load the character config and secrets
// ---------------------------------------------------------------------
async function loadCharacterConfig(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    // JSON5 in case the file has trailing commas or comments
    const config = JSON5.parse(fileContent);
    return config;
  } catch (error) {
    console.error("Error reading character config:", error);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// 3) Main function: read secrets, call Helix Chat API
// ---------------------------------------------------------------------
async function main() {
  // Load from character JSON
  const character = await loadCharacterConfig(characterFilePath);

  // Extract the secrets
  const secrets = character.settings?.secrets || {};
  const TWITCH_BOT_USER_ID     = secrets.TWITCH_BOT_USER_ID;       // e.g. "12345"
  const TWITCH_BOT_USERNAME    = secrets.TWITCH_BOT_USERNAME;      // e.g. "myBot"
  const TWITCH_OAUTH_TOKEN     = secrets.TWITCH_OAUTH_TOKEN;       // e.g. "abc123..."
  const TWITCH_CLIENT_ID       = secrets.TWITCH_CLIENT_ID;         // e.g. "clientid"
  const TWITCH_CHANNEL_USER_ID = secrets.TWITCH_CHANNEL_USER_ID;   // e.g. "67890"

  if (
    !TWITCH_BOT_USER_ID ||
    !TWITCH_BOT_USERNAME ||
    !TWITCH_OAUTH_TOKEN ||
    !TWITCH_CLIENT_ID ||
    !TWITCH_CHANNEL_USER_ID
  ) {
    console.error("Missing one or more Twitch config values in the character file.");
    process.exit(1);
  }

  console.log("Loaded Twitch secrets from myTwitchBot.character.json:");
  console.log("  Bot User ID:", TWITCH_BOT_USER_ID);
  console.log("  Bot Username:", TWITCH_BOT_USERNAME);
  console.log("  Channel User ID:", TWITCH_CHANNEL_USER_ID);
  console.log("  (Token + ClientID are present but not printed)");

  // -------------------------------------------------------------------
  // Helix Chat API: POST /helix/chat/messages
  // https://dev.twitch.tv/docs/api/reference#send-chat-message
  // -------------------------------------------------------------------
  const url = "https://api.twitch.tv/helix/chat/messages";

  // The text you want to send in chat:
  const chatMessageText = "Hello from Helix Chat API! PogChamp";

  // Prepare body
  const requestBody = {
    broadcaster_id: TWITCH_CHANNEL_USER_ID, // The channel in which to send the message
    sender_id: TWITCH_BOT_USER_ID,          // The bot's user ID
    message: chatMessageText,
    // optionally: "reply_parent_message_id": "some-uuid" if replying
  };

  try {
    console.log("\nSending chat message via Helix Chat API...");
    console.log("Request body:", requestBody);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TWITCH_OAUTH_TOKEN}`, // user token w/ chat:edit
        "Client-Id": TWITCH_CLIENT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const json = await response.json();
    if (!response.ok) {
      console.error("Failed to send chat message:", json);
    } else {
      console.log("Success response:", JSON.stringify(json, null, 2));
      if (json.data?.[0]?.is_sent) {
        console.log("✅ Message was sent successfully!");
      } else {
        console.log("⚠️ Message was NOT sent. Possibly blocked by AutoMod or another reason.");
      }
    }
  } catch (err) {
    console.error("Error calling Helix Chat API:", err);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
});
