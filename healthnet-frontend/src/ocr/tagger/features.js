// Text features for the HealthNet Tagger: a port of FINAL YEAR PROJECT/training/tagger/features.py,
// checked against it by tagger.test.js. A name is lower-cased and reduced to letters and digits, then
// described by its character 2- to 4-grams (words padded with spaces) and its whole words.

const NGRAM_SIZES = [2, 3, 4];

export const normalise = (text) =>
  text
    .toLowerCase()
    // Dotted abbreviations first ("h.d.l." -> "hdl"), as the rule-based reader does
    .replace(/\b(?:[a-z]\.){2,}/g, (abbreviation) => abbreviation.replace(/\./g, ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// { feature: count } for one name
export const featureCounts = (text) => {
  const counts = {};
  const add = (name) => {
    counts[name] = (counts[name] || 0) + 1;
  };
  normalise(text)
    .split(' ')
    .filter(Boolean)
    .forEach((word) => {
      add(`w:${word}`);
      const padded = ` ${word} `;
      NGRAM_SIZES.forEach((size) => {
        for (let start = 0; start + size <= padded.length; start += 1) add(`c:${padded.slice(start, start + size)}`);
      });
    });
  return counts;
};
