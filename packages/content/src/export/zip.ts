// A minimal ZIP writer (PKZIP 2.0: no ZIP64, no encryption), enough for EPUB
// and OOXML packages. Runs anywhere CompressionStream does: browsers, Workers
// and Bun. Entries are written in the order given, which EPUB depends on: its
// `mimetype` must come first, stored uncompressed.

export type ZipEntry = {
  /** Forward slashes, no leading slash. */
  path: string
  data: Uint8Array | string
  /** Store without compression (the EPUB `mimetype`, already-compressed images). */
  store?: boolean
}

export type ZipOptions = {
  /**
   * Timestamp for every entry. Read in UTC with DOS's 2-second resolution, so a
   * fixed date gives byte-identical archives. Default: now.
   */
  date?: Date
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date): { time: number; date: number } {
  // DOS dates cover 1980–2107.
  const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107)
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  }
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let length = 0
  for (const chunk of chunks) length += chunk.length
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  // Write and read at the same time: awaiting the write first can stall on
  // backpressure once the output buffer fills.
  const written = writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close())
  const read = (async () => {
    const chunks: Uint8Array[] = []
    const reader = stream.readable.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return concatBytes(chunks)
      chunks.push(value)
    }
  })()
  const [, out] = await Promise.all([written, read])
  return out
}

function checkPath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
    throw new Error(`Invalid zip entry path: ${JSON.stringify(path)}`)
  }
}

const UTF8_FLAG = 0x0800
const LOCAL_HEADER = 30
const CENTRAL_HEADER = 46
const END_RECORD = 22

export async function createZip(
  entries: ZipEntry[],
  options: ZipOptions = {}
): Promise<Uint8Array> {
  const stamp = dosDateTime(options.date ?? new Date())
  const encoder = new TextEncoder()
  const seen = new Set<string>()
  for (const entry of entries) {
    checkPath(entry.path)
    if (seen.has(entry.path)) throw new Error(`Duplicate zip entry: ${entry.path}`)
    seen.add(entry.path)
  }
  if (entries.length > 0xffff) throw new Error('Too many zip entries (ZIP64 is not supported)')

  const files = await Promise.all(
    entries.map(async (entry) => {
      const raw = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data
      let method = 0
      let payload = raw
      if (!entry.store && raw.length > 0) {
        const deflated = await deflateRaw(raw)
        // Incompressible data (or a tiny file) is smaller stored.
        if (deflated.length < raw.length) {
          method = 8
          payload = deflated
        }
      }
      return {
        name: encoder.encode(entry.path),
        crc: crc32(raw),
        size: raw.length,
        method,
        payload,
      }
    })
  )

  let localSize = 0
  let centralSize = 0
  for (const file of files) {
    localSize += LOCAL_HEADER + file.name.length + file.payload.length
    centralSize += CENTRAL_HEADER + file.name.length
  }
  if (localSize + centralSize > 0xffffffff) {
    throw new Error('Archive too large (ZIP64 is not supported)')
  }

  const out = new Uint8Array(localSize + centralSize + END_RECORD)
  const view = new DataView(out.buffer)
  let offset = 0
  const u16 = (value: number) => {
    view.setUint16(offset, value, true)
    offset += 2
  }
  const u32 = (value: number) => {
    view.setUint32(offset, value, true)
    offset += 4
  }
  const bytes = (value: Uint8Array) => {
    out.set(value, offset)
    offset += value.length
  }

  const offsets: number[] = []
  for (const file of files) {
    offsets.push(offset)
    u32(0x04034b50)
    u16(file.method === 8 ? 20 : 10) // version needed to extract
    u16(UTF8_FLAG)
    u16(file.method)
    u16(stamp.time)
    u16(stamp.date)
    u32(file.crc)
    u32(file.payload.length)
    u32(file.size)
    u16(file.name.length)
    u16(0) // no extra field (EPUB requires none on `mimetype`)
    bytes(file.name)
    bytes(file.payload)
  }

  const centralStart = offset
  files.forEach((file, index) => {
    u32(0x02014b50)
    u16(20) // version made by: MS-DOS, spec 2.0
    u16(file.method === 8 ? 20 : 10)
    u16(UTF8_FLAG)
    u16(file.method)
    u16(stamp.time)
    u16(stamp.date)
    u32(file.crc)
    u32(file.payload.length)
    u32(file.size)
    u16(file.name.length)
    u16(0) // extra field
    u16(0) // comment
    u16(0) // disk number
    u16(0) // internal attributes
    u32(0) // external attributes
    u32(offsets[index] ?? 0)
    bytes(file.name)
  })

  const centralLength = offset - centralStart
  u32(0x06054b50)
  u16(0) // this disk
  u16(0) // disk with the central directory
  u16(files.length)
  u16(files.length)
  u32(centralLength)
  u32(centralStart)
  u16(0) // comment length
  return out
}
