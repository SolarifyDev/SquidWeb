// A minimal ustar writer: regular files only, no dependencies. Used to pack a folder in the browser into the
// .tar.gz the built-in feed accepts. Directories need no entries of their own (extraction creates parents), so
// an empty directory is simply not represented.

export const BLOCK_SIZE = 512
const NAME_MAX = 100
const PREFIX_MAX = 155
// 11 octal digits: the largest size a ustar header can hold (8 GiB - 1). The feed's own limit is far lower.
export const MAX_ENTRY_BYTES = 0o77777777777

const encoder = new TextEncoder()

export interface TarSource {
  /** Path inside the archive: '/' separated, no leading slash. */
  path: string
  size: number
  read(): AsyncIterable<Uint8Array>
}

export class TarPathTooLongError extends Error {
  readonly path: string

  constructor(path: string) {
    super(
      `"${path}" is too long to pack: a path must fit in 100 bytes, or split at a "/" into a folder part of at most 155 bytes and a name of at most 100 bytes.`,
    )
    this.name = 'TarPathTooLongError'
    this.path = path
  }
}

export class TarEntryTooLargeError extends Error {
  constructor(path: string) {
    super(`"${path}" is larger than a tar entry can describe (8 GiB).`)
    this.name = 'TarEntryTooLargeError'
  }
}

export class TarSourceChangedError extends Error {
  constructor(path: string) {
    super(`"${path}" changed while it was being packed. Try again once it stops changing.`)
    this.name = 'TarSourceChangedError'
  }
}

/** Splits a path into the ustar name and prefix fields, or throws when no split fits. */
export function splitUstarPath(path: string): { name: Uint8Array; prefix: Uint8Array } {
  const bytes = encoder.encode(path)

  if (bytes.length === 0) throw new TarPathTooLongError(path)
  if (bytes.length <= NAME_MAX) return { name: bytes, prefix: new Uint8Array(0) }

  // The folder part is bytes[0, i) and the name bytes(i, end): i must be a '/', i <= 155 and the name <= 100.
  for (let i = Math.min(PREFIX_MAX, bytes.length - 2); i >= bytes.length - 1 - NAME_MAX && i > 0; i--) {
    if (bytes[i] === 0x2f) return { name: bytes.slice(i + 1), prefix: bytes.slice(0, i) }
  }

  throw new TarPathTooLongError(path)
}

function writeOctal(block: Uint8Array, offset: number, length: number, value: number) {
  // length - 1 digits followed by a NUL, zero padded: the classic ustar numeric field.
  const digits = value.toString(8).padStart(length - 1, '0')
  block.set(encoder.encode(digits), offset)
  block[offset + length - 1] = 0
}

// Headers are deterministic on purpose: mtime 0, uid/gid 0, no owner names and a fixed mode, so the same bytes always
// pack to the same archive and the server's content dedupe recognises an unchanged re-upload.
export function buildHeader(path: string, size: number): Uint8Array {
  if (size > MAX_ENTRY_BYTES) throw new TarEntryTooLargeError(path)

  const { name, prefix } = splitUstarPath(path)
  const block = new Uint8Array(BLOCK_SIZE)

  block.set(name, 0)
  writeOctal(block, 100, 8, 0o644)
  writeOctal(block, 108, 8, 0)
  writeOctal(block, 116, 8, 0)
  writeOctal(block, 124, 12, size)
  writeOctal(block, 136, 12, 0)
  block.fill(0x20, 148, 156) // the checksum is computed with its own field read as spaces
  block[156] = 0x30 // '0': regular file
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

function paddingFor(size: number) {
  const remainder = size % BLOCK_SIZE

  return remainder === 0 ? 0 : BLOCK_SIZE - remainder
}

/** Builds every header up front, so a path that cannot be packed fails before any file is read. */
export function buildAllHeaders(sources: TarSource[]): Uint8Array[] {
  return sources.map((source) => buildHeader(source.path, source.size))
}

export function tarTotalBytes(sources: TarSource[]) {
  return sources.reduce((sum, source) => sum + source.size, 0)
}

/** The archive as a sequence of chunks; `onBytes` is told how many content bytes have been written so far. */
export async function* tarChunks(sources: TarSource[], onBytes?: (done: number) => void): AsyncGenerator<Uint8Array> {
  const headers = buildAllHeaders(sources)
  let done = 0

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]
    let written = 0

    yield headers[i]

    for await (const chunk of source.read()) {
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

  // Two zero blocks mark the end of the archive.
  yield new Uint8Array(BLOCK_SIZE * 2)
}

/** Wraps the chunks in a stream that is read on demand, so a large folder is never held in memory by the writer. */
export function tarStream(sources: TarSource[], onBytes?: (done: number) => void): ReadableStream<Uint8Array> {
  const iterator = tarChunks(sources, onBytes)

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
