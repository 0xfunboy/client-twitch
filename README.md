# ElizaOS Experimental Client-Twitch Plugin

The **ElizaOS Client-Twitch Plugin** enables your ElizaOS agent to interact with Twitch chat. It supports reading chat messages via EventSub WebSockets, sending chat messages through the Twitch Helix Chat API, and handling auto-post features (e.g. posting news from RSS feeds). This custom plugin is fully integrated into the ElizaOS runtime and is designed to work 24/7 with automatic token refresh and detailed logging for debugging.

> **Note:** This plugin requires that your Twitch bot account is a moderator (or has the appropriate permissions) on the target channel.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Character JSON File](#character-json-file)
  - [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Running the Plugin](#running-the-plugin)
  - [Automatic Token Refresh](#automatic-token-refresh)
- [Logging and Debugging](#logging-and-debugging)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The ElizaOS Client-Twitch Plugin is designed to integrate Twitch chat functionality into your agent. It allows your agent to:
- **Read chat messages:** Automatically subscribe to the `channel.chat.message` EventSub events via WebSocket.
- **Send chat messages:** Use the Twitch Helix Chat API to post messages and announcements.
- **Auto-post content:** Automatically post updates (for example, RSS feed items) when chat activity is low.
- **Token management:** Automatically refresh OAuth tokens before they expire to ensure continuous operation.

---

## Features

- **WebSocket-based EventSub integration:** Listens for chat messages and other events from Twitch.
- **Helix Chat API support:** Sends regular chat messages and announcements.
- **Automatic token refresh:** A separate module/script refreshes OAuth tokens using the Twitch refresh token.
- **Detailed logging:** Logs all key events and errors to assist with debugging.
- **Customizable templates:** Provides templates for chat response, auto-posting, and response decisions.
- **Integrated auto-post configuration:** Reads RSS feeds and posts aggregator items during periods of inactivity.

---

## Installation

1. **Clone or Install the Plugin:**

   If using a monorepo managed by PNPM (as with ElizaOS), add the client-twitch package:
   ```bash
   pnpm add @elizaos/client-twitch
   ```

2. **Install Required Dependencies:**

   The plugin depends on a few packages. From within the client-twitch package directory, run:
   ```bash
   pnpm install
   ```

   Make sure you have the following packages installed:
   - `node-fetch`
   - `ws`
   - `json5`
   - `rss-parser` (for the auto-post feature)

3. **Build the Package:**

   Build the plugin using tsup:
   ```bash
   pnpm run build
   ```

---

## Configuration

### Character JSON File

Create or update your character configuration file (e.g., `myTwitchBot.character.json`) with the required Twitch settings. Example:

```json
{
  "name": "MyTwitchBot",
  "clients": ["twitch"],
  "modelProvider": "ollama",
  "settings": {
    "ragKnowledge": true,
    "model": "deepseek-r1:14",
    "serverUrl": "http://localhost:11434",
    "secrets": {
      "TWITCH_BOT_USER_ID": "YOUR_CHANNEL_ID",
      "TWITCH_BOT_USERNAME": "TWITCH_BOT_ACCOUNT_USERNAME",
      "TWITCH_OAUTH_TOKEN": "YOUR_USER_ACCESS_TOKEN",
      "TWITCH_CLIENT_ID": "YOUR_CLIENT_ID",
      "TWITCH_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
      "TWITCH_CHANNEL_USER_ID": "BROADCASTER_CHANNEL_ID",
      "TWITCH_REFRESH_TOKEN": "YOUR_REFRESH_TOKEN"
    },
    "voice": {
      "model": "en_US-hfc_female-medium"
    }
  },
  "discord": {  "... optional discord settings ..."  },
  "plugins": [
    "@elizaos/client-twitch"
  ],
  "bio": [
    "I am XXX Agent, the heart of the ElizaOS ecosystem.",
    "I merge AI with real-time data for actionable insights."
  ],
  "lore": [
    "Built as an AI-driven chat bot to interact on Twitch.",
    "I keep it real with data and analytics."
  ]
}
```

> **Important:** Replace placeholder values with your actual tokens and secrets. The plugin will automatically use these values for authentication and token refresh.

### Environment Variables

The plugin can also read configuration from environment variables. You can set these in your deployment environment if preferred:
- `TWITCH_BOT_USER_ID`
- `TWITCH_BOT_USERNAME`
- `TWITCH_OAUTH_TOKEN`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_CHANNEL_USER_ID`
- `TWITCH_REFRESH_TOKEN`
- Plus additional settings for auto-post configuration and team coordination

---

## Usage

### Running the Plugin

The plugin is loaded automatically by ElizaOS when `twitch` is specified in the character’s clients array. To run your agent (with the Twitch client integrated), simply start your ElizaOS agent as usual:
```bash
pnpm start --character="path/to/myTwitchBot.character.json"
```

### Automatic Token Refresh

A separate module `refreshAccessToken.ts` is provided to automatically refresh your Twitch OAuth token. This module should be integrated into your agent startup process so that tokens are updated at regular intervals (e.g., every 3 hours) before they expire.

**To run the token refresh script manually:**
```bash
pnpm exec tsx src/refreshAccessToken.ts
```

**Integration in agent startup:**

In your main agent `index.ts`, import and run the token refresh function before starting the Twitch client. For example:

```typescript
import { refreshAccessToken } from "@elizaos/client-twitch/src/refreshAccessToken";

// Refresh the Twitch token before starting the agent.
try {
  await refreshAccessToken();
} catch (error) {
  // Log the error but do not crash the agent.
  console.error("Warning: Failed to refresh Twitch token:", error);
  // Optionally, implement a delay or fallback behavior here.
}
```

This ensures that the latest tokens are used for each API call.

---

## Logging and Debugging

The plugin uses the ElizaOS logger (`elizaLogger`) for detailed output. Key log messages include:
- Connection events (WebSocket open, session welcome, subscription confirmation)
- Token validation and refresh status
- Auto-post configuration and execution details
- LLM responses from the OpenAI model

You can adjust the logging level in your ElizaOS configuration to show more detailed logs during debugging.

---

## Troubleshooting

- **Token Issues:**  
  - Verify that your Twitch tokens (access and refresh) have the required scopes:
    - `user:read:chat`
    - `user:write:chat`
    - `chat:edit`
    - `user:bot`
  - Use the `/oauth2/validate` endpoint to confirm token details.

- **Subscription Failures:**  
  - Ensure that the bot’s user ID and the broadcaster's user ID are correctly set in your configuration.
  - Make sure your bot account is a moderator or has the required permissions in the target channel.
  - Check that your WebSocket session is valid and that the subscription request uses the correct session ID.

- **Looping or Repeated LLM Calls:**  
  - The plugin logs every call to the LLM (OpenAI) model. Review the logs to see if the conversation history or context is causing repeated calls.
  - Ensure your templates (for response decisions and message generation) are correctly formatted to avoid misinterpretation.

- **Auto-Post Failures:**  
  - Confirm that your RSS feed URLs are reachable.
  - Check that auto-post settings (inactivity threshold, minimum time between posts) are correctly configured.

---

## Contributing

Contributions are welcome! Please open issues or pull requests in the repository with your suggested improvements or bug fixes. Ensure that you include tests and documentation updates as needed.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*For further assistance or questions, please refer to the ElizaOS documentation or contact the development team.*