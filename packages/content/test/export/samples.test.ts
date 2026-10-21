import { expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { buildDocx, buildEpub } from '../../src/export'
import { book, cover, fetchImage, MODIFIED } from './fixture'

// Writes the fixture book in every format so it can be opened by hand in
// Apple Books, Word, Google Docs or LibreOffice (or fed to epubcheck).
const OUT = process.env.LEMMA_EXPORT_SAMPLES ?? '/tmp/lemma-export-samples'

test('writes sample exports', async () => {
  await mkdir(OUT, { recursive: true })
  const samples: [string, Uint8Array][] = [
    [
      'harbour-ledger.epub',
      await buildEpub({ ...book, cover }, { fetchImage, modified: MODIFIED }),
    ],
    ['harbour-ledger-remote-images.epub', await buildEpub(book, { modified: MODIFIED })],
    ['harbour-ledger-manuscript.docx', await buildDocx(book, { fetchImage, modified: MODIFIED })],
    [
      'harbour-ledger-document.docx',
      await buildDocx(book, { format: 'document', fetchImage, modified: MODIFIED }),
    ],
  ]
  for (const [name, data] of samples) {
    await writeFile(join(OUT, name), data)
    expect(data.length).toBeGreaterThan(1000)
  }
})
