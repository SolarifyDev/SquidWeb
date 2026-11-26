import { describe, expect, it, vi } from 'vitest'
import { filesFromDirectoryInput, readDrop, UnsupportedDropError } from './dropEntries'

const fileEntry = (fullPath: string) => {
  const name = fullPath.split('/').pop()!

  return { isFile: true, isDirectory: false, name, fullPath: `/${fullPath}`, file: (ok: (f: File) => void) => ok(new File(['x'], name)) }
}

// readEntries hands back at most `batchSize` entries per call and an empty batch when done, like the real API.
function dirEntry(fullPath: string, children: unknown[], batchSize = 2) {
  const name = fullPath.split('/').pop()!
  const createReader = vi.fn(() => {
    let at = 0

    return {
      readEntries: (ok: (batch: unknown[]) => void) => {
        ok(children.slice(at, at + batchSize))
        at += batchSize
      },
    }
  })

  return { isFile: false, isDirectory: true, name, fullPath: `/${fullPath}`, createReader }
}

const item = (entry: unknown, file: File | null = null, kind = 'file') => ({ kind, webkitGetAsEntry: () => entry, getAsFile: () => file })
const items = (...list: unknown[]) => list as unknown as DataTransferItemList

describe('readDrop', () => {
  it('readsEveryEntryOfADirectory_AcrossRepeatedReadEntriesBatches', async () => {
    const root = dirEntry('site', ['a', 'b', 'c', 'd', 'e'].map((n) => fileEntry(`site/${n}.txt`)), 2)

    const dropped = await readDrop(items(item(root)))

    expect(dropped.kind).toBe('folder')
    if (dropped.kind === 'folder') expect(dropped.files.map((f) => f.path)).toEqual(['site/a.txt', 'site/b.txt', 'site/c.txt', 'site/d.txt', 'site/e.txt'])
  })

  it('walksSubdirectories_WithPathsStartingAtTheFolderName', async () => {
    const root = dirEntry('site', [dirEntry('site/css', [fileEntry('site/css/a.css')]), fileEntry('site/index.html')])

    const dropped = await readDrop(items(item(root)))

    expect(dropped).toMatchObject({ kind: 'folder', name: 'site' })
    if (dropped.kind === 'folder') expect(dropped.files.map((f) => f.path).sort()).toEqual(['site/css/a.css', 'site/index.html'])
  })

  it('skipsExcludedDirectoriesWithoutDescendingIntoThem', async () => {
    const nodeModules = dirEntry('site/node_modules', [fileEntry('site/node_modules/x.js')])
    const git = dirEntry('site/.GIT', [fileEntry('site/.GIT/HEAD')])
    const root = dirEntry('site', [nodeModules, git, fileEntry('site/index.html')])

    const dropped = await readDrop(items(item(root)))

    expect(nodeModules.createReader).not.toHaveBeenCalled()
    expect(git.createReader).not.toHaveBeenCalled()
    if (dropped.kind === 'folder') expect(dropped.files.map((f) => f.path)).toEqual(['site/index.html'])
  })

  it('skipsDsStoreAndAGitFile_IgnoringCase', async () => {
    const root = dirEntry('site', [fileEntry('site/.DS_Store'), fileEntry('site/.ds_store'), fileEntry('site/sub/.git'), fileEntry('site/keep.txt')], 10)

    const dropped = await readDrop(items(item(root)))

    if (dropped.kind === 'folder') expect(dropped.files.map((f) => f.path)).toEqual(['site/keep.txt'])
  })

  it('reportsHowManyFilesWereFoundSoFar', async () => {
    const root = dirEntry('site', [fileEntry('site/a'), fileEntry('site/b'), fileEntry('site/c')], 10)
    const seen: number[] = []

    await readDrop(items(item(root)), (found) => seen.push(found))

    expect(seen).toEqual([1, 2, 3])
  })

  it('aSingleFile_IsAnArchive', async () => {
    const file = new File(['PK'], 'a.zip')

    expect(await readDrop(items(item(fileEntry('a.zip'), file)))).toEqual({ kind: 'archive', file })
  })

  it('aFileWithoutAnEntryApi_IsStillAnArchive', async () => {
    const file = new File(['PK'], 'a.zip')

    expect(await readDrop(items({ kind: 'file', getAsFile: () => file }))).toEqual({ kind: 'archive', file })
  })

  it('moreThanOneItem_IsRefused', async () => {
    await expect(readDrop(items(item(dirEntry('a', [])), item(dirEntry('b', []))))).rejects.toThrow(UnsupportedDropError)
  })

  it('nothingDropped_IsRefused', async () => {
    await expect(readDrop(items())).rejects.toThrow(UnsupportedDropError)
  })

  it('nonFileItemsAreIgnored_SoDroppedTextPlusOneFolderStillWorks', async () => {
    const dropped = await readDrop(items(item(null, null, 'string'), item(dirEntry('site', [fileEntry('site/a')]))))

    expect(dropped.kind).toBe('folder')
  })

  it('aFileEntryThatCannotBeRead_IsRefused', async () => {
    await expect(readDrop(items(item(fileEntry('a.zip'), null)))).rejects.toThrow(UnsupportedDropError)
  })
})

describe('filesFromDirectoryInput', () => {
  it('usesTheRelativePathTheBrowserGives', () => {
    const file = Object.defineProperty(new File(['x'], 'a.txt'), 'webkitRelativePath', { value: 'site/sub/a.txt' })

    expect(filesFromDirectoryInput([file] as unknown as FileList)[0].path).toBe('site/sub/a.txt')
  })
})
