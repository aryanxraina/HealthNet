// Seeded random numbers, so every benchmark run sees exactly the same documents (mulberry32)
export const seededRandom = (seed) => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (low, high) => low + next() * (high - low);
  // Box-Muller normal, clamped to [low, high]
  const normal = (mean, sd, low, high) => {
    const z = Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
    return Math.min(high, Math.max(low, mean + sd * z));
  };
  const pick = (items) => items[Math.floor(next() * items.length)];
  const chance = (p) => next() < p;
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return { next, between, normal, pick, chance, shuffle };
};
