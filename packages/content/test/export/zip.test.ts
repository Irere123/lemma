import { describe, expect, test } from 'bun:test'

import { crc32, createZip } from '../../src/export'
import { rawEntries, unzip, utf8 } from './helpers'

const encoder = new TextEncoder()

// Random bytes don't compress, so the writer must fall back to storing them.
const noise = (length: number) => {
  const out = new Uint8Array(length)
  let seed = 7
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    out[i] = seed >>> 24
  }
  return out
}

describe('crc32', () => {
  test('matches the standard check values', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array(0))).toBe(0)
    expect(crc32(encoder.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
  })
})

describe('createZip', () => {
  const text = 'It was a dark and stormy night. '.repeat(200)
  const entries = [
    { path: 'mimetype', data: 'application/epub+zip', store: true },
    { path: 'text/story.txt', data: text },
    { path: 'bin/noise.bin', data: noise(4096) },
    { path: 'empty.txt', data: '' },
    { path: 'naïve/café.txt', data: 'Unicode names' },
  ]

  test('round-trips through fflate', async () => {
    const zip = await createZip(entries)
    const files = unzip(zip)
    expect(Object.keys(files).sort()).toEqual(entries.map((entry) => entry.path).sort())
    expect(utf8(files['text/story.txt'])).toBe(text)
    expect(files['bin/noise.bin']).toEqual(noise(4096))
    expect(files['empty.txt']?.length).toBe(0)
    expect(utf8(files['naïve/café.txt'])).toBe('Unicode names')
  })

  test('keeps entry order, stores or deflates, and records correct CRCs and sizes', async () => {
    const zip = await createZip(entries)
    const raw = rawEntries(zip)
    expect(raw.map((entry) => entry.name)).toEqual(entries.map((entry) => entry.path))

    const byName = Object.fromEntries(raw.map((entry) => [entry.name, entry]))
    expect(byName.mimetype?.method).toBe(0)
    expect(byName['text/story.txt']?.method).toBe(8)
    expect(byName['text/story.txt']?.compressedSize).toBeLessThan(text.length / 10)
    expect(byName['bin/noise.bin']?.method).toBe(0) // incompressible: stored

    for (const entry of entries) {
      const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data
      const header = byName[entry.path]
      expect(header?.crc).toBe(crc32(data))
      expect(header?.size).toBe(data.length)
      expect((header?.flags ?? 0) & 0x0800).toBe(0x0800) // UTF-8 names
    }
  })

  test('writes the EPUB mimetype first, stored, with no extra field', async () => {
    const zip = await createZip(entries)
    const first = rawEntries(zip)[0]
    expect(first?.name).toBe('mimetype')
    expect(first?.method).toBe(0)
    expect(first?.extraLength).toBe(0)
    // The OCF signature readers sniff: "mimetype" then the type at byte 38.
    expect(new TextDecoder().decode(zip.subarray(30, 38))).toBe('mimetype')
    expect(new TextDecoder().decode(zip.subarray(38, 58))).toBe('application/epub+zip')
  })

  test('has a central directory and end record that agree with the entries', async () => {
    const zip = await createZip(entries)
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    const end = zip.length - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(entries.length)
    const size = view.getUint32(end + 12, true)
    const offset = view.getUint32(end + 16, true)
    expect(offset + size).toBe(end)
    let at = offset
    for (const entry of entries) {
      expect(view.getUint32(at, true)).toBe(0x02014b50)
      const nameLength = view.getUint16(at + 28, true)
      expect(new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength))).toBe(entry.path)
      at += 46 + nameLength
    }
    expect(at).toBe(end)
  })

  test('a fixed date gives byte-identical archives and the right DOS timestamp', async () => {
    const date = new Date('2026-10-21T09:30:42Z')
    const a = await createZip(entries, { date })
    const b = await createZip(entries, { date })
    expect(a).toEqual(b)
    const view = new DataView(a.buffer, a.byteOffset, a.byteLength)
    const time = view.getUint16(10, true)
    const day = view.getUint16(12, true)
    expect([time >> 11, (time >> 5) & 63, (time & 31) * 2]).toEqual([9, 30, 42])
    expect([(day >> 9) + 1980, (day >> 5) & 15, day & 31]).toEqual([2026, 10, 21])
  })

  test('rejects duplicate and unsafe paths', async () => {
    await expect(
      createZip([
        { path: 'a', data: '1' },
        { path: 'a', data: '2' },
      ])
    ).rejects.toThrow(/Duplicate/)
    await expect(createZip([{ path: '../evil', data: '' }])).rejects.toThrow(/Invalid/)
    await expect(createZip([{ path: '/abs', data: '' }])).rejects.toThrow(/Invalid/)
  })
})
