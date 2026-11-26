// A deliberately independent, tiny ustar reader for tests: it checks what the writer produced by parsing it back.
const decoder = new TextDecoder()

export interface ReadEntry {
  path: string
  size: number
  mode: number
  mtime: number
  typeflag: string
  content: Uint8Array
}

function field(block: Uint8Array, start: number, length: number) {
  const slice = block.subarray(start, start + length)
  const end = slice.indexOf(0)

  return decoder.decode(end === -1 ? slice : slice.subarray(0, end))
}

export function headerChecksumOk(block: Uint8Array) {
  const stored = parseInt(field(block, 148, 8).trim(), 8)
  let sum = 0

  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : block[i]

  return stored === sum
}

/** Parses PAX records (`<len> <key>=<value>\n`) on their own, without the writer's helpers. */
export function parsePax(data: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {}
  let at = 0

  while (at < data.length) {
    const space = data.indexOf(0x20, at)
    const length = parseInt(decoder.decode(data.subarray(at, space)), 10)

    if (space === -1 || !(length > 0)) throw new Error('bad pax record')
    if (data[at + length - 1] !== 0x0a) throw new Error('pax record does not end with a newline')

    const body = decoder.decode(data.subarray(space + 1, at + length - 1))
    const eq = body.indexOf('=')

    out[body.slice(0, eq)] = body.slice(eq + 1)
    at += length
  }

  return out
}

export function readTar(bytes: Uint8Array): ReadEntry[] {
  const entries: ReadEntry[] = []
  let pax: Record<string, string> = {}
  let offset = 0

  for (;;) {
    const block = bytes.subarray(offset, offset + 512)

    if (block.length < 512) throw new Error('archive ends without the two zero blocks')
    if (block.every((b) => b === 0)) {
      if (!bytes.subarray(offset + 512, offset + 1024).every((b) => b === 0) || bytes.length !== offset + 1024) throw new Error('bad end of archive')
      return entries
    }

    if (!headerChecksumOk(block)) throw new Error(`bad checksum at ${offset}`)
    if (field(block, 257, 6) !== 'ustar') throw new Error('missing ustar magic')

    const prefix = field(block, 345, 155)
    const name = field(block, 0, 100)
    const headerSize = parseInt(field(block, 124, 12), 8)
    const dataStart = offset + 512

    if (field(block, 156, 1) === 'x') {
      pax = parsePax(bytes.subarray(dataStart, dataStart + headerSize))
      offset = dataStart + Math.ceil(headerSize / 512) * 512
      continue
    }

    const size = pax.size ? parseInt(pax.size, 10) : headerSize

    entries.push({
      path: pax.path ?? (prefix ? `${prefix}/${name}` : name),
      size,
      mode: parseInt(field(block, 100, 8), 8),
      mtime: parseInt(field(block, 136, 12), 8),
      typeflag: field(block, 156, 1),
      content: bytes.slice(dataStart, dataStart + size),
    })

    pax = {}
    offset = dataStart + Math.ceil(size / 512) * 512
  }
}

export async function collect(chunks: AsyncIterable<Uint8Array>) {
  const parts: Uint8Array[] = []

  for await (const chunk of chunks) parts.push(chunk)

  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0

  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }

  return out
}
