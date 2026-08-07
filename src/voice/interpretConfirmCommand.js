const CANCEL_WORDS = new Set([
  "cancel",
  "discard",
  "don't",
  "dont",
  "no",
  "nope",
  "not",
  "reject",
  "stop",
]);

const REPEAT_WORDS = new Set(["again", "pardon", "repeat", "what"]);
const CONFIRM_WORDS = new Set(["accept", "confirm", "ok", "okay", "yeah", "yep", "yes"]);
const CONFIRM_PHRASES = new Set(["do it", "go"]);

function normalizedWords(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .match(/[a-z']+/g) || [];
}

export function interpretConfirmCommand(raw) {
  const words = normalizedWords(raw);
  if (words.length === 0) return "UNKNOWN";

  // A cancellation must always win over an affirmative word in the same utterance.
  if (words.some((word) => CANCEL_WORDS.has(word))) return "CANCEL";
  if (words.some((word) => REPEAT_WORDS.has(word))) return "REPEAT";
  if (words.some((word) => CONFIRM_WORDS.has(word))) return "CONFIRM";
  if (CONFIRM_PHRASES.has(words.join(" "))) return "CONFIRM";
  return "UNKNOWN";
}
