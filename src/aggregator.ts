/*****************************************************************************************
 * aggregator.ts
 *
 * Simple aggregator that fetches from one or more RSS feeds and returns a random item.
 * You can expand this to do more advanced caching or scraping logic.
 *
 * Requires "rss-parser": pnpm add rss-parser
 *****************************************************************************************/

import Parser from "rss-parser";

const parser = new Parser();

export interface RssItem {
  title: string;
  link: string;
  contentSnippet?: string;
}

export async function fetchRandomFeedItem(feedUrls: string[]): Promise<RssItem | null> {
  // DEBUG LOG:
  console.debug("[Twitch] aggregator => fetchRandomFeedItem() called with feeds:", feedUrls);

  try {
    if (!feedUrls.length) return null;

    // Pick one feed at random
    const randomFeed = feedUrls[Math.floor(Math.random() * feedUrls.length)];
    console.debug("[Twitch] aggregator => randomFeed chosen:", randomFeed);

    const parsedFeed = await parser.parseURL(randomFeed);
    if (!parsedFeed.items || !parsedFeed.items.length) {
      return null;
    }

    // Pick a random item from that feed
    const item = parsedFeed.items[Math.floor(Math.random() * parsedFeed.items.length)];
    console.debug("[Twitch] aggregator => random RSS item:", item.title);

    return {
      title: item.title || "",
      link: item.link || "",
      contentSnippet: item.contentSnippet || "",
    };
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    return null;
  }
}
