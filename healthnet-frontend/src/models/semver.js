// Compares "major.minor.patch" versions: negative if a < b, 0 if equal, positive if a > b
export const compareVersions = (a, b) => {
  const parts = (version) => String(version).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const difference = (x[i] || 0) - (y[i] || 0);
    if (difference) return difference;
  }
  return 0;
};
