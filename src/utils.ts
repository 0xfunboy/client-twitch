/**
 * utils.ts
 *
 * Utility functions for text similarity.
 */

export function cosineSimilarity(text1: string, text2: string): number {
  const preprocess = (t: string) =>
    t.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  const words1 = preprocess(text1).split(" ");
  const words2 = preprocess(text2).split(" ");

  const freq1: Record<string, number> = {};
  const freq2: Record<string, number> = {};

  for (const w of words1) {
    freq1[w] = (freq1[w] || 0) + 1;
  }
  for (const w of words2) {
    freq2[w] = (freq2[w] || 0) + 1;
  }

  const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
  let dot = 0, mag1 = 0, mag2 = 0;

  for (const w of allWords) {
    const val1 = freq1[w] || 0;
    const val2 = freq2[w] || 0;
    dot += val1 * val2;
    mag1 += val1 * val1;
    mag2 += val2 * val2;
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
}
