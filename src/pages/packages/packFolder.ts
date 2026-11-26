import { tarStream, tarTotalBytes, type TarSource } from './tar'

/** The largest package the server accepts (2 GiB): the same figure as BuiltInFeed.MaxPackageSizeBytes on the backend. */
export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024 * 1024

/** Directory names that are never packed, at any depth. Compared ignoring case. */
export const EXCLUDED_DIRECTORIES = ['.git', 'node_modules']
/** File names that are never packed, at any depth. Compared ignoring case. `.git` as a file is a worktree or submodule pointer. */
export const EXCLUDED_FILES = ['.ds_store', '.git']

export interface FolderFile {
  /** Path from the browser, starting with the folder's own name: `myapp/src/index.js`. */
  path: string
  file: File
}

export class EmptyFolderError extends Error {
  constructor() {
    super('Nothing to pack: the folder has no files once .git, node_modules and .DS_Store are left out.')
    this.name = 'EmptyFolderError'
  }
}

export class FolderTooLargeError extends Error {
  constructor(totalBytes: number) {
    super(`The folder holds ${(totalBytes / 1024 ** 3).toFixed(2)} GiB once excluded files are left out, over the 2 GiB package limit. Nothing was packed.`)
    this.name = 'FolderTooLargeError'
  }
}

export function isExcludedDirectoryName(name: string) {
  return EXCLUDED_DIRECTORIES.includes(name.toLowerCase())
}

export function isExcludedFileName(name: string) {
  return EXCLUDED_FILES.includes(name.toLowerCase())
}

export function isExcludedPath(segments: string[]) {
  const directories = segments.slice(0, -1)
  const fileName = segments[segments.length - 1]

  return directories.some(isExcludedDirectoryName) || isExcludedFileName(fileName)
}

export function folderNameOf(path: string) {
  return path.split('/').filter(Boolean)[0] ?? ''
}

/**
 * Drops the folder's own name so entries are relative to it, drops excluded entries, writes every path in Unicode NFC
 * (macOS can report decomposed names) and sorts by path (ordinal), so the same folder always packs in the same order.
 */
export function toTarSources(files: FolderFile[]): TarSource[] {
  const sources: TarSource[] = []

  for (const { path, file } of files) {
    const segments = path.split('/').filter(Boolean).slice(1)

    if (segments.length === 0 || isExcludedPath(segments)) continue

    sources.push({ path: segments.join('/').normalize('NFC'), size: file.size, read: () => readFile(file) })
  }

  return sources.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

/** How many of the chosen files will be packed, and how many are left out by the exclusion rules. */
export function countPackable(files: FolderFile[]) {
  const packed = toTarSources(files).length

  return { packed, skipped: files.length - packed }
}

// Bytes 4-9 of a gzip header are mtime, extra flags and the OS id. They are fixed to 0 / 0 / 255 (unknown) so the header
// does not vary. The deflate stream itself is the browser's own: output is only expected to repeat within one browser,
// so the server must not rely on the compressed bytes alone to recognise an unchanged package.
export function normaliseGzipHeader(blob: Blob): Promise<Blob> {
  return blob.slice(0, 10).arrayBuffer().then((buffer) => {
    const header = new Uint8Array(buffer)

    if (header.length < 10 || header[0] !== 0x1f || header[1] !== 0x8b || header[3] !== 0) return blob

    header.fill(0, 4, 9)
    header[9] = 255

    return new Blob([header, blob.slice(10)], { type: blob.type })
  })
}

async function* readFile(file: File): AsyncGenerator<Uint8Array> {
  if (typeof file.stream !== 'function') {
    yield new Uint8Array(await file.arrayBuffer())
    return
  }

  const reader = file.stream().getReader()

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export function isGzipPackingSupported() {
  return typeof CompressionStream === 'function' && typeof ReadableStream === 'function'
}

export interface PackProgress {
  doneBytes: number
  totalBytes: number
}

export interface PackedFolder {
  blob: Blob
  fileCount: number
  fileName: string
}

/**
 * Packs a folder into a .tar.gz. File contents are read, tarred and compressed as a stream; the compressed result is
 * gathered into a Blob (browsers back large Blobs with disk), which XMLHttpRequest can then upload with progress.
 */
export async function packFolder(files: FolderFile[], onProgress?: (progress: PackProgress) => void, signal?: AbortSignal): Promise<PackedFolder> {
  if (!isGzipPackingSupported()) throw new Error('This browser cannot compress folders (CompressionStream is missing). Pack the folder into a .zip or .tar.gz and upload that instead.')

  const sources = toTarSources(files)

  if (sources.length === 0) throw new EmptyFolderError()

  const totalBytes = tarTotalBytes(sources)

  if (totalBytes > MAX_PACKAGE_BYTES) throw new FolderTooLargeError(totalBytes)

  const tar = tarStream(sources, (doneBytes) => onProgress?.({ doneBytes, totalBytes }), signal)
  const gzipped = tar.pipeThrough(new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
  const blob = await normaliseGzipHeader(await new Response(gzipped).blob())

  onProgress?.({ doneBytes: totalBytes, totalBytes })

  return { blob, fileCount: sources.length, fileName: `${folderNameOf(files[0].path)}.tar.gz` }
}
