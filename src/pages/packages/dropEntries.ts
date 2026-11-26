import { isExcludedDirectoryName, isExcludedFileName, type FolderFile } from './packFolder'

export type DroppedContent =
  | { kind: 'archive'; file: File }
  | { kind: 'folder'; name: string; files: FolderFile[] }

export class UnsupportedDropError extends Error {
  constructor() {
    super('Drop a single .zip or .tar.gz file, or a single folder.')
    this.name = 'UnsupportedDropError'
  }
}

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

function fileOf(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

// readEntries returns at most ~100 entries per call, so it has to be called until it yields nothing.
async function readAllEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = directory.createReader()
  const all: FileSystemEntry[] = []

  for (;;) {
    const batch = await readBatch(reader)
    if (batch.length === 0) return all
    all.push(...batch)
  }
}

async function walk(entry: FileSystemEntry, out: FolderFile[], onProgress?: (found: number) => void): Promise<void> {
  const path = entry.fullPath.replace(/^\/+/, '')

  if (entry.isFile) {
    if (isExcludedFileName(entry.name)) return

    out.push({ path, file: await fileOf(entry as FileSystemFileEntry) })
    onProgress?.(out.length)
    return
  }

  // Skipped without descending: a node_modules or .git tree can hold hundreds of thousands of files.
  if (isExcludedDirectoryName(entry.name)) return

  for (const child of await readAllEntries(entry as FileSystemDirectoryEntry)) await walk(child, out, onProgress)
}

/** Reads a drop: one archive file, or one folder walked recursively. Entries must be taken before the first await. */
export async function readDrop(items: DataTransferItemList, onProgress?: (filesFound: number) => void): Promise<DroppedContent> {
  const entries = Array.from(items)
    .filter((item) => item.kind === 'file')
    .map((item) => ({ entry: item.webkitGetAsEntry?.() ?? null, file: item.getAsFile() }))

  if (entries.length !== 1) throw new UnsupportedDropError()

  const { entry, file } = entries[0]

  if (entry?.isDirectory) {
    const files: FolderFile[] = []
    await walk(entry, files, onProgress)
    return { kind: 'folder', name: entry.name, files }
  }

  if (!file) throw new UnsupportedDropError()

  return { kind: 'archive', file }
}

/** Files chosen with an <input webkitdirectory>: their relative paths already start with the folder's name. */
export function filesFromDirectoryInput(list: FileList): FolderFile[] {
  return Array.from(list).map((file) => ({ path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, file }))
}
