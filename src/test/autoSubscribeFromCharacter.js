/**
 * autoSubscribeFromCharacter.js
 *
 * This script reads Twitch connection parameters from the character JSON file,
 * opens a WebSocket connection to Twitch EventSub, captures the session ID, and
 * automatically sends a POST request to create a subscription for channel.chat.message.
 *
 * Requirements:
 *  - Node.js
 *  - Install dependencies: pnpm add node-fetch ws json5
 *
 * Adjust file paths if needed.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";
import fetch from "node-fetch";
import JSON5 from "json5";

// --- Configuration ---

// Update the path to point to the correct location of your character file.
const characterFilePath = path.resolve(
  process.cwd(),
  "eliza",
  "characters",
  "myTwitchBot.character.json"
);

// Function to load the character configuration
async function loadCharacterConfig(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    // Using JSON5.parse in case the JSON file contains comments or trailing commas
    const config = JSON5.parse(fileContent);
    return config;
  } catch (error) {
    console.error("Error reading character config:", error);
    process.exit(1);
  }
}

// --- Main Script ---

async function main() {
  // Load character configuration
  const character = await loadCharacterConfig(characterFilePath);

  // Extract required Twitch secrets from character.settings.secrets
  const secrets = character.settings?.secrets || {};
  const TWITCH_BOT_USER_ID = secrets.TWITCH_BOT_USER_ID; // e.g., "1275714066"
  const TWITCH_BOT_USERNAME = secrets.TWITCH_BOT_USERNAME; // e.g., "air3"
  const TWITCH_OAUTH_TOKEN = secrets.TWITCH_OAUTH_TOKEN; // e.g., "cpsjd94s3emke0eyvsw456jumfctzr"
  const TWITCH_CLIENT_ID = secrets.TWITCH_CLIENT_ID;       // e.g., "zhh7yyt42d0s0fzn08oz65mot70bx7"
  const TWITCH_CHANNEL_USER_ID = secrets.TWITCH_CHANNEL_USER_ID; // e.g., "1276896937"

  if (
    !TWITCH_BOT_USER_ID ||
    !TWITCH_BOT_USERNAME ||
    !TWITCH_OAUTH_TOKEN ||
    !TWITCH_CLIENT_ID ||
    !TWITCH_CHANNEL_USER_ID
  ) {
    console.error("Missing one or more Twitch configuration values in the character file.");
    process.exit(1);
  }

  console.log("Loaded Twitch configuration:");
  console.log("Bot User ID:", TWITCH_BOT_USER_ID);
  console.log("Bot Username:", TWITCH_BOT_USERNAME);
  console.log("Channel User ID:", TWITCH_CHANNEL_USER_ID);

  // Connect to Twitch EventSub WebSocket
  const wsUrl = "wss://eventsub.wss.twitch.tv/ws";
  const ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    console.log("WebSocket connection opened. Waiting for session_welcome...");
  });

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data);
      if (
        message.metadata &&
        message.metadata.message_type === "session_welcome"
      ) {
        const sessionId = message.payload.session.id;
        console.log("Session Welcome received!");
        console.log("Session ID:", sessionId);

        // Create the subscription
        const subscriptionBody = {
          type: "channel.chat.message",
          version: "1",
          condition: {
            broadcaster_user_id: TWITCH_CHANNEL_USER_ID,
            user_id: TWITCH_BOT_USER_ID, // Use the bot's user id
          },
          transport: {
            method: "websocket",
            session_id: sessionId,
          },
        };

        console.log("Sending subscription request with body:");
        console.log(JSON.stringify(subscriptionBody, null, 2));

        const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TWITCH_OAUTH_TOKEN}`,
            "Client-Id": TWITCH_CLIENT_ID,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(subscriptionBody),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error("Subscription failed:", result);
        } else {
          console.log("Subscription created successfully:", result);
        }
      } else {
        console.log("Received message:", data.toString());
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  ws.on("close", (code, reason) => {
    console.log(`WebSocket closed: code=${code}, reason=${reason}`);
  });
}

main();
