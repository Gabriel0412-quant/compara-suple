import { execFileSync } from 'node:child_process'

const base = process.env.MUTATION_BASE ?? 'origin/main'
function changedRanges(file) {
  const diff = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', base, '--', file], { encoding: 'utf8' })
  const pattern = file.replace(/[\[\]]/g, bracket => bracket === '[' ? '[[]' : '[]]')
  return [...diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)]
  .filter(match => match[2] !== '0')
  .map(match => {
    const start = Number(match[1])
    const count = Number(match[2] ?? 1)
    return `${pattern}:${start}:0-${start + count}:0`
  })
}

const ingestRanges = changedRanges('lib/ml/ingest.ts')
const routeRanges = changedRanges('app/go/[offerId]/route.ts')
const eventosRanges = changedRanges('lib/eventos.ts')
const homeRanges = changedRanges('app/page.tsx')
const comparadorRanges = changedRanges('app/comparar/page.tsx')
const offersSectionRanges = changedRanges('components/product/OffersSection.tsx')

const config = {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['lib/affiliate.ts', 'lib/ml/offer-url.ts', 'lib/ml/affiliate-links.ts', 'lib/ml/affiliate-links-cli.ts', 'scripts/ml-affiliate-links.ts', ...ingestRanges, ...routeRanges, ...eventosRanges, ...homeRanges, ...comparadorRanges, ...offersSectionRanges],
  concurrency: 2,
  reporters: ['clear-text', 'json', 'html'],
  jsonReporter: { fileName: 'coverage/mutation/mutation.json' },
  htmlReporter: { fileName: 'coverage/mutation/index.html' },
  thresholds: { high: 100, low: 100, break: 100 },
  ignorePatterns: ['.next', 'coverage', 'playwright-report', 'test-results'],
}

export default config
