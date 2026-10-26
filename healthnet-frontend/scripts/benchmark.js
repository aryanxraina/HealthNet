// npm run benchmark: re-scores the report readers, records the new baseline and rewrites
// docs/benchmarks/lab-reports.md (see src/benchmark/labBenchmark.test.js)
const { spawnSync } = require('child_process');

const result = spawnSync('npx', ['react-scripts', 'test', '--watchAll=false', 'src/benchmark'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, BENCHMARK_UPDATE: '1', CI: 'true' },
});
process.exit(result.status ?? 1);
