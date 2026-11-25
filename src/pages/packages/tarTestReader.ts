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

export function readTar(bytes: Uint8Array): ReadEntry[] {
  const entries: ReadEntry[] = []
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
    const size = parseInt(field(block, 124, 12), 8)
    const dataStart = offset + 512

    entries.push({
      path: prefix ? `${prefix}/${name}` : name,
      size,
      mode: parseInt(field(block, 100, 8), 8),
      mtime: parseInt(field(block, 136, 12), 8),
      typeflag: field(block, 156, 1),
      content: bytes.slice(dataStart, dataStart + size),
    })

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
