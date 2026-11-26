// A minimal tar writer: regular files only, no dependencies. Used to pack a folder in the browser into the .tar.gz the
// built-in feed accepts. Paths that fit the ustar name/prefix fields are written as plain ustar; anything longer (and any
// entry of 8 GiB or more) gets a PAX extended header, which the server's .NET TarReader and bsdtar/GNU tar all read.
// Directories need no entries of their own (extraction creates parents), so an empty directory is not represented.

export const BLOCK_SIZE = 512
const NAME_MAX = 100
const PREFIX_MAX = 155
// 11 octal digits: the largest size a ustar header can hold (8 GiB - 1). Larger entries carry a PAX `size` record.
export const MAX_USTAR_ENTRY_BYTES = 0o77777777777

const TYPE_REGULAR = 0x30 // '0'
const TYPE_PAX = 0x78 // 'x'

const encoder = new TextEncoder()

export interface TarSource {
  /** Path inside the archive: '/' separated, no leading slash. */
  path: string
  size: number
  read(): AsyncIterable<Uint8Array>
}

export class TarSourceChangedError extends Error {
  constructor(path: string) {
    super(`"${path}" changed while it was being packed. Try again once it stops changing.`)
    this.name = 'TarSourceChangedError'
  }
}

export class TarCancelledError extends Error {
  constructor() {
    super('Packing was cancelled.')
    this.name = 'TarCancelledError'
  }
}

/** Splits a path into the ustar name and prefix fields, or returns null when no split fits (the path then needs PAX). */
export function splitUstarPath(path: string): { name: Uint8Array; prefix: Uint8Array } | null {
  const bytes = encoder.encode(path)

  if (bytes.length === 0) return null
  if (bytes.length <= NAME_MAX) return { name: bytes, prefix: new Uint8Array(0) }

  // The folder part is bytes[0, i) and the name bytes(i, end): i must be a '/', i <= 155 and the name <= 100.
  for (let i = Math.min(PREFIX_MAX, bytes.length - 2); i >= bytes.length - 1 - NAME_MAX && i > 0; i--) {
    if (bytes[i] === 0x2f) return { name: bytes.slice(i + 1), prefix: bytes.slice(0, i) }
  }

  return null
}

function writeOctal(block: Uint8Array, offset: number, length: number, value: number) {
  // length - 1 digits followed by a NUL, zero padded: the classic ustar numeric field.
  const digits = value.toString(8).padStart(length - 1, '0')
  block.set(encoder.encode(digits), offset)
  block[offset + length - 1] = 0
}

// Every header is written the same way for the same path and size: mtime 0, uid/gid 0, no owner names, a fixed mode.
function ustarBlock(name: Uint8Array, prefix: Uint8Array, size: number, typeflag: number): Uint8Array {
  const block = new Uint8Array(BLOCK_SIZE)

  block.set(name, 0)
  writeOctal(block, 100, 8, 0o644)
  writeOctal(block, 108, 8, 0)
  writeOctal(block, 116, 8, 0)
  writeOctal(block, 124, 12, size)
  writeOctal(block, 136, 12, 0)
  block.fill(0x20, 148, 156) // the checksum is computed with its own field read as spaces
  block[156] = typeflag
  block.set(encoder.encode('ustar'), 257)
  block[262] = 0
  block.set(encoder.encode('00'), 263)
  block.set(prefix, 345)

  const checksum = block.reduce((sum, byte) => sum + byte, 0)
  // Six octal digits, a NUL and a space: what GNU tar and the .NET reader both expect.
  block.set(encoder.encode(checksum.toString(8).padStart(6, '0')), 148)
  block[154] = 0
  block[155] = 0x20

  return block
}

/** One PAX record: `<length> <key>=<value>\n`, where the length counts the whole record, its own digits included. */
export function paxRecord(key: string, value: string): Uint8Array {
  const body = encoder.encode(` ${key}=${value}\n`)
  let length = body.length

  // The length includes its own digits, so grow it until it describes itself.
  while (String(length).length + body.length !== length) length = String(length).length + body.length

  return concat([encoder.encode(String(length)), body])
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0

  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }

  return out
}

function paddedTo512(data: Uint8Array) {
  const out = new Uint8Array(Math.ceil(data.length / BLOCK_SIZE) * BLOCK_SIZE)
  out.set(data)

  return out
}

// Cuts to `max` bytes without splitting a multi-byte UTF-8 character. Only a placeholder: readers use the PAX path.
function truncateUtf8(bytes: Uint8Array, max: number) {
  let end = Math.min(max, bytes.length)

  while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--

  return bytes.slice(0, end)
}

/** Everything written before an entry's content: an optional PAX header with its data, then the entry's own ustar header. */
export function buildEntryHeader(path: string, size: number): Uint8Array {
  if (path.length === 0) throw new Error('A tar entry needs a path.')

  const split = splitUstarPath(path)
  const oversized = size > MAX_USTAR_ENTRY_BYTES

  if (split && !oversized) return ustarBlock(split.name, split.prefix, size, TYPE_REGULAR)

  const records: Uint8Array[] = []

  if (!split) records.push(paxRecord('path', path))
  if (oversized) records.push(paxRecord('size', String(size)))

  const data = concat(records)
  const paxHeader = ustarBlock(encoder.encode('PaxHeaders.0/entry'), new Uint8Array(0), data.length, TYPE_PAX)
  const own = split ?? { name: truncateUtf8(encoder.encode(path), NAME_MAX), prefix: new Uint8Array(0) }

  return concat([paxHeader, paddedTo512(data), ustarBlock(own.name, own.prefix, oversized ? 0 : size, TYPE_REGULAR)])
}

function paddingFor(size: number) {
  const remainder = size % BLOCK_SIZE

  return remainder === 0 ? 0 : BLOCK_SIZE - remainder
}

export function buildAllHeaders(sources: TarSource[]): Uint8Array[] {
  return sources.map((source) => buildEntryHeader(source.path, source.size))
}

export function tarTotalBytes(sources: TarSource[]) {
  return sources.reduce((sum, source) => sum + source.size, 0)
}

/**
 * The archive as a sequence of chunks; `onBytes` is told how many content bytes have been written so far. The signal is
 * checked between chunks, so a cancel takes effect before the next piece of a file is read.
 */
export async function* tarChunks(sources: TarSource[], onBytes?: (done: number) => void, signal?: AbortSignal): AsyncGenerator<Uint8Array> {
  const headers = buildAllHeaders(sources)
  let done = 0

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]
    let written = 0

    if (signal?.aborted) throw new TarCancelledError()

    yield headers[i]

    for await (const chunk of source.read()) {
      if (signal?.aborted) throw new TarCancelledError()

      written += chunk.length
      if (written > source.size) throw new TarSourceChangedError(source.path)
      done += chunk.length
      yield chunk
      onBytes?.(done)
    }

    if (written !== source.size) throw new TarSourceChangedError(source.path)

    const padding = paddingFor(source.size)
    if (padding > 0) yield new Uint8Array(padding)
  }

  if (signal?.aborted) throw new TarCancelledError()

  // Two zero blocks mark the end of the archive.
  yield new Uint8Array(BLOCK_SIZE * 2)
}

/** Wraps the chunks in a stream that is read on demand, so a large folder is never held in memory by the writer. */
export function tarStream(sources: TarSource[], onBytes?: (done: number) => void, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const iterator = tarChunks(sources, onBytes, signal)

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next()
        if (next.done) controller.close()
        else controller.enqueue(next.value)
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return(undefined)
    },
  })
}
