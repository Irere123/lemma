// The Phase A clipboard corpus (lemma-editor-study/corpus). Not in the repo: the
// captures carry third-party content licensed for local research only.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Default: a lemma-editor-study checkout next to this repo.
export const CORPUS_ROOT =
  process.env.LEMMA_PASTE_CORPUS ?? join(import.meta.dir, '../../../../lemma-editor-study/corpus')

export type Fixture = { source: string; name: string; html: string; text: string }

export function loadCorpus(root = CORPUS_ROOT): Fixture[] {
  const clipboard = join(root, 'clipboard')
  if (!existsSync(clipboard)) return []
  const fixtures: Fixture[] = []
  for (const source of readdirSync(clipboard).sort()) {
    const dir = join(clipboard, source)
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.html')) continue
      const name = file.replace(/\.html$/, '')
      const textPath = join(dir, `${name}.txt`)
      fixtures.push({
        source,
        name,
        html: readFileSync(join(dir, file), 'utf8'),
        text: existsSync(textPath) ? readFileSync(textPath, 'utf8') : '',
      })
    }
  }
  const paper = join(root, 'paper', 'paper.html')
  if (existsSync(paper)) {
    fixtures.push({
      source: 'arxiv',
      name: 'paper-body',
      html: readFileSync(paper, 'utf8'),
      text: '',
    })
  }
  return fixtures
}
