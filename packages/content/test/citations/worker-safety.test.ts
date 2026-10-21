import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// The citations library must run in Cloudflare Workers, browsers and Bun:
// no runtime dependencies, no Node built-ins, no DOM, no ambient fetch.
const SRC = join(import.meta.dir, '../../src/citations')
const files = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

const FORBIDDEN = [
  /\brequire\(/g,
  /['"]node:[a-z/]+['"]/g,
  /\b(?:document|window|navigator|localStorage)\.\w+/g,
  /\bDOMParser\b|\bXMLHttpRequest\b/g,
  // fetch is always injected, never the global.
  /(?<![\w.])fetch\(/g,
]

describe('citations source is Worker-safe', () => {
  test.each(files)('%s', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8')
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!)
    expect(imports.filter((spec) => !/^\.\.?\//.test(spec))).toEqual([])
    expect(FORBIDDEN.flatMap((re) => source.match(re) ?? [])).toEqual([])
  })
})
