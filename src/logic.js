// QVAC Lyric Rhyme Helper — core logic.
// Suggests next lines that rhyme with the given line's ending AND fit the theme.

import { completion } from "@qvac/sdk";

function lastWord(line) {
  const cleaned = line.trim().replace(/[.,!?;:"']+$/g, "");
  const words = cleaned.split(/\s+/);
  return words[words.length - 1] || "";
}

// Deterministic, approximate rhyme check: compares the tail sound of two words
// using a crude phonetic simplification (strips silent-e, collapses vowels).
function rhymeKey(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return "";
  w = w.replace(/e$/, "");
  // Take the last 3 characters as an approximate rhyme tail; fall back to fewer.
  const tailLen = Math.min(3, w.length);
  let tail = w.slice(-tailLen);
  // Collapse common vowel spellings so "day"/"weigh" style near-matches still count loosely.
  tail = tail.replace(/[aeiouy]+/g, "V");
  return tail;
}

function rhymes(a, b) {
  const ka = rhymeKey(a);
  const kb = rhymeKey(b);
  if (!ka || !kb) return false;
  return ka === kb || ka.endsWith(kb) || kb.endsWith(ka);
}

function parseOptions(raw) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const options = [];
  for (const line of lines) {
    const m = line.match(/^(?:\d+[.)]\s*|[-*]\s*)?(.+)$/);
    if (!m) continue;
    let text = m[1].trim().replace(/^["']|["']$/g, "");
    if (text.length > 2 && text.length < 150) options.push(text);
  }
  return options;
}

export async function suggestNextLines(modelId, line) {
  const target = lastWord(line);

  const run = completion({
    modelId,
    history: [
      {
        role: "system",
        content: `You write song lyrics. Given one line of lyrics, suggest 5 possible NEXT lines that continue the song.

Each suggested line must end in a DIFFERENT word that RHYMES with the last word of the given line ("${target}") — never reuse "${target}" itself as the ending word — and must make sense thematically as a continuation of the given line.

Output ONLY a numbered list of exactly 5 lines, nothing else:
1. <line>
2. <line>
3. <line>
4. <line>
5. <line>`,
      },
      { role: "user", content: line },
    ],
    stream: true,
    completionOpts: { temperature: 0.85, maxTokens: 300 },
  });

  let text = "";
  for await (const token of run.tokenStream) text += token;

  let options = parseOptions(text);

  // Deterministically verify each option actually rhymes; keep genuinely-different
  // rhyming words first (reusing the exact same word isn't a useful suggestion),
  // then other rhymes, then non-rhymes as a last resort.
  const targetLower = target.toLowerCase().replace(/[^a-z]/g, "");
  const checked = options.map((opt) => {
    const optLastWord = lastWord(opt);
    const sameWord = optLastWord.toLowerCase().replace(/[^a-z]/g, "") === targetLower;
    return {
      line: opt,
      rhymes: rhymes(target, optLastWord),
      sameWord,
    };
  });

  const distinctRhymes = checked.filter((c) => c.rhymes && !c.sameWord);
  const sameWordRhymes = checked.filter((c) => c.rhymes && c.sameWord);
  const nonRhymes = checked.filter((c) => !c.rhymes);
  const finalOptions = [...distinctRhymes, ...sameWordRhymes, ...nonRhymes].slice(0, 5).map((c) => c.line);

  if (finalOptions.length === 0) {
    return { options: [], target, error: "Couldn't generate next lines — try a slightly longer or clearer line." };
  }

  return { options: finalOptions, target };
}
