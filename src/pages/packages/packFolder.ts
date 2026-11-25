import { tarStream, tarTotalBytes, buildAllHeaders, type TarSource } from './tar'

/** Directory names that are never packed, at any depth. */
export const EXCLUDED_DIRECTORIES = ['.git', 'node_modules']
/** File names that are never packed, at any depth. */
export const EXCLUDED_FILES = ['.DS_Store']

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

export function isExcludedDirectoryName(name: string) {
  return EXCLUDED_DIRECTORIES.includes(name)
}

export function isExcludedPath(segments: string[]) {
  const directories = segments.slice(0, -1)
  const fileName = segments[segments.length - 1]

  return directories.some(isExcludedDirectoryName) || EXCLUDED_FILES.includes(fileName)
}

export function folderNameOf(path: string) {
  return path.split('/').filter(Boolean)[0] ?? ''
}

/** Drops the folder's own name so entries are relative to it, and drops excluded entries. */
export function toTarSources(files: FolderFile[]): TarSource[] {
  const sources: TarSource[] = []

  for (const { path, file } of files) {
    const segments = path.split('/').filter(Boolean).slice(1)

    if (segments.length === 0 || isExcludedPath(segments)) continue

    sources.push({ path: segments.join('/'), size: file.size, mtimeMs: file.lastModified, read: () => readFile(file) })
  }

  return sources
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
export async function packFolder(files: FolderFile[], onProgress?: (progress: PackProgress) => void): Promise<PackedFolder> {
  if (!isGzipPackingSupported()) throw new Error('This browser cannot compress folders (CompressionStream is missing). Pack the folder into a .zip or .tar.gz and upload that instead.')

  const sources = toTarSources(files)

  if (sources.length === 0) throw new EmptyFolderError()

  buildAllHeaders(sources) // fail on an unpackable path before reading anything

  const totalBytes = tarTotalBytes(sources)
  const tar = tarStream(sources, (doneBytes) => onProgress?.({ doneBytes, totalBytes }))
  const gzipped = tar.pipeThrough(new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
  const blob = await new Response(gzipped).blob()

  onProgress?.({ doneBytes: totalBytes, totalBytes })

  return { blob, fileCount: sources.length, fileName: `${folderNameOf(files[0].path)}.tar.gz` }
}
