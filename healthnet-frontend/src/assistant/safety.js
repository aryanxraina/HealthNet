// Messages that need emergency help rather than an explanation. Checked on the device before anything
// is sent; the server repeats the check (FINAL YEAR PROJECT/assistant/safety.py, same patterns).

const EMERGENCIES = {
  selfHarm: [
    /\bkill(ing)? my ?self\b/i, /\bsuicid/i, /\bend (my|it all)\b.*\blife\b/i, /\bend it all\b/i,
    /\bself[- ]?harm/i, /\bhurt(ing)? my ?self\b/i, /\bwant to die\b/i, /\bdon'?t want to (live|be alive)\b/i,
    /\boverdos/i,
  ],
  // Described as happening, so "What is a heart attack risk score?" isn't caught
  heart: [/\bchest (pain|tightness|pressure)\b/i, /\bpain in my chest\b/i, /\bhaving a heart attack\b/i],
  stroke: [
    /\bstroke\b.*\b(now|happening|having)\b/i, /\b(having|having a) stroke\b/i, /\bface (is )?droop/i,
    /\bslurred speech\b/i, /\bcan'?t (move|feel) (my )?(arm|leg|face)\b/i, /\bsudden(ly)? numb/i,
  ],
  breathing: [/\bcan'?t breathe\b/i, /\bcannot breathe\b/i, /\bstruggling to breathe\b/i, /\bchoking\b/i],
  unconscious: [/\bunconscious\b/i, /\bpassed out\b/i, /\bnot breathing\b/i, /\bseizure\b/i],
};

// The first emergency code the text matches, or null
export const emergencyIn = (text) =>
  Object.entries(EMERGENCIES).find(([, patterns]) => patterns.some((pattern) => pattern.test(text)))?.[0] ?? null;
