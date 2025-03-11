/**
 * Twitch Client Templates
 *
 * These templates are used by the Twitch client to generate context-aware messages.
 * Customize them as needed for your agent's personality.
 */

export const twitchShouldRespondTemplate = `
# About {{agentName}}:
{{bio}}

# Response Decision Examples:
User: Hey, are you there?
Agent: [RESPOND]
User: This is not interesting.
Agent: [IGNORE]

Instructions:
- Reply with [RESPOND] if the message is addressed to {{agentName}} or fits the context.
- Otherwise, reply with [IGNORE].

Recent Messages:
{{recentMessages}}
`;

export const twitchMessageHandlerTemplate = `
# Task: Generate a Twitch chat response for {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

Conversation History:
{{recentMessages}}

Guidelines:
- Generate a concise and engaging reply in-character.
- Keep the response short and clear.

Action: [RESPOND]
`;

export const twitchAutoPostTemplate = `
# Task: Generate an automatic Twitch post.
About {{agentName}}:
{{bio}}
{{lore}}

Guidelines:
- When no user input is detected, post a news update or RSS feed item.
- The message should be short (maximum 3 lines) and friendly.
- Include at most 1–2 emojis.

Post Content:
{{currentPost}}

Action: [NONE]
`;
