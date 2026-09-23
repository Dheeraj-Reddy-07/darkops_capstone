/**
 * A small, randomized "thinking" delay for the deterministic chat assistants.
 *
 * The customer chatbot and executive copilot both compute answers from local
 * data essentially instantly, which feels unnatural. Awaiting this before
 * responding gives a brief, human-feeling pause without being sluggish. Both
 * assistants use the same range so the experience is consistent.
 */
export function thinkingDelay(minMs = 700, maxMs = 1500): Promise<void> {
  const ms = Math.round(minMs + Math.random() * Math.max(0, maxMs - minMs));
  return new Promise((resolve) => setTimeout(resolve, ms));
}
