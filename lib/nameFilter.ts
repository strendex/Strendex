// Offline display-name moderation. No external API.
// Shared by the client (instant feedback) and /api/submit (canonical gate).
//
// Policy (per project owner): block ONLY unambiguous slurs and hardcore
// profanity. Err toward letting real names through — we would rather miss an
// edge case than reject someone whose name happens to contain a flagged
// substring (e.g. "Dick", "Scunthorpe"). Do NOT add words that are also real
// names or common words to these lists.

// Matched as whole words only (after normalization). Safe to be a little
// broader here because embedding inside an innocent name won't trigger.
const WHOLE_WORD_BANNED: string[] = [
  "fuck",
  "shit",
  "cunt",
  "bastard",
  "whore",
  "slut",
];

// Unambiguous slurs — matched anywhere in the normalized string so that
// separator/leet evasion ("n i g g e r", "f4gg0t") is still caught. Only put
// terms here that cannot appear inside a legitimate name.
const SUBSTRING_BANNED: string[] = [
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "kike",
  "chink",
  "spic",
  "wetback",
  "tranny",
  "coon",
];

// Lowercase and fold common leetspeak so "f4gg0t" -> "faggot".
function foldLeet(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t");
}

// Strip everything but letters, collapsing "f.u.c.k" / "f u c k" -> "fuck".
function collapse(raw: string): string {
  return foldLeet(raw).replace(/[^a-z]/g, "");
}

/**
 * Returns the first banned word found in `name`, or null if the name is clean.
 */
export function findBannedWord(name: string): string | null {
  if (!name) return null;

  // Whole-word pass: tokenize on non-letters, fold leet per token.
  const tokens = foldLeet(name)
    .split(/[^a-z]+/)
    .filter(Boolean);
  for (const word of WHOLE_WORD_BANNED) {
    if (tokens.includes(word)) return word;
  }

  // Substring pass: only the unambiguous slur list, against the collapsed string.
  const collapsed = collapse(name);
  for (const word of SUBSTRING_BANNED) {
    if (collapsed.includes(word)) return word;
  }

  return null;
}
