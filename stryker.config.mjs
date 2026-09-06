import { execFileSync } from 'node:child_process'

const base = process.env.MUTATION_BASE ?? 'origin/main'
const ingestDiff = execFileSync('git', [
  'diff', '--no-ext-diff', '--unified=0', base, '--', 'lib/ml/ingest.ts',
], { encoding: 'utf8' })
const ingestRanges = [...ingestDiff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)]
  .filter(match => match[2] !== '0')
  .map(match => {
    const start = Number(match[1])
    const count = Number(match[2] ?? 1)
    return `lib/ml/ingest.ts:${start}:0-${start + count}:0`
  })

const config = {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['lib/affiliate.ts', 'lib/ml/offer-url.ts', ...ingestRanges],
  concurrency: 2,
  reporters: ['clear-text', 'json', 'html'],
  jsonReporter: { fileName: 'coverage/mutation/mutation.json' },
  htmlReporter: { fileName: 'coverage/mutation/index.html' },
  thresholds: { high: 100, low: 100, break: 100 },
  ignorePatterns: ['.next', 'coverage', 'playwright-report', 'test-results'],
}

export default config
