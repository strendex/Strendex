// Offline display-name moderation. No external API.
// Shared by the client (instant feedback) and /api/submit (canonical gate).
//
// Policy (per project owner): block clear profanity and unambiguous slurs only.
// Err toward letting real names through — we would rather miss an edge case
// than reject someone whose name merely CONTAINS a flagged fragment. So:
//   "Dick", "Scunthorpe", "assassin", "class", "Matt", "Cockburn", "Spicer"
// must all pass.
//
// Three tiers, by how safe a word is to match loosely:
//   1. SUBSTRING_BANNED   — match inside a larger word (catches "Fucker",
//      "Fucking", "Shithead"). Only words that are NOT a fragment of any
//      common name/word go here.
//   2. WHOLE_WORD_BANNED  — match only as a standalone token. For words that
//      ARE fragments of innocent names/words ("ass" in "class", "cunt" in
//      "Scunthorpe", "cock" in "Cockburn", "spic" in "Spicer").
//   3. SLUR_COLLAPSE      — match against the fully collapsed string so that
//      separator/leet evasion ("n i g g e r", "f4gg0t") is still caught.
//      Reserved for distinctive slurs unlikely to collide with real names.

// Matched inside any single token. Catches morphological variants.
// Do NOT add anything here that is a substring of a common name or word.
const SUBSTRING_BANNED: string[] = [
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "whore",
  "slut",
  "asshole",
  "dickhead",
  "dumbass",
  "jackass",
  "douche",
  "twat",
  "wank",
  "retard",
];

// Matched only as a whole standalone token (after normalization). These are
// fragments of legitimate names/words, so substring-matching them would cause
// false positives ("class", "assassin", "Scunthorpe", "Cockburn", "Spicer").
const WHOLE_WORD_BANNED: string[] = [
  "ass",
  "cunt",
  "cock",
  "piss",
  "pussy",
  "fag",
  "spic",
  "coon",
  "chink",
  "kike",
  "wop",
  "dago",
];

// Distinctive slurs — matched anywhere in the collapsed string so that
// separator/leet evasion is caught. Only terms that cannot realistically
// appear inside a legitimate name go here.
const SLUR_COLLAPSE: string[] = [
  "nigger",
  "nigga",
  "faggot",
  "tranny",
  "wetback",
  "beaner",
  "raghead",
  "gook",
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

  // Per-token pass: tokenize on non-letters, fold leet per token. Checking each
  // token in isolation lets us match profanity inside a word ("fucker") without
  // gluing innocent adjacent tokens together into a false positive.
  const tokens = foldLeet(name)
    .split(/[^a-z]+/)
    .filter(Boolean);

  for (const token of tokens) {
    for (const word of WHOLE_WORD_BANNED) {
      if (token === word) return word;
    }
    for (const word of SUBSTRING_BANNED) {
      if (token.includes(word)) return word;
    }
  }

  // Collapsed pass: distinctive slurs only, against the fully stripped string,
  // to defeat separator/leet evasion ("n i g g e r", "f4gg0t").
  const collapsed = collapse(name);
  for (const word of SLUR_COLLAPSE) {
    if (collapsed.includes(word)) return word;
  }

  return null;
}
