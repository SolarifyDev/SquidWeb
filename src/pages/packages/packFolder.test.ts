import { describe, expect, it } from 'vitest'
import { EmptyFolderError, countPackable, folderNameOf, isExcludedPath, packFolder, toTarSources, type FolderFile } from './packFolder'
import { readTar } from './tarTestReader'

const file = (path: string, content = 'x', lastModified = 0): FolderFile => ({ path, file: new File([content], path.split('/').pop() ?? 'f', { lastModified }) })

const sha = async (blob: Blob) => Buffer.from(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())).toString('hex')

async function gunzip(blob: Blob) {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)

  return new Uint8Array(await new Response(stream).arrayBuffer())
}

describe('folder rules', () => {
  it.each([
    [['.git', 'config'], true],
    [['src', '.git', 'HEAD'], true],
    [['node_modules', 'left-pad', 'index.js'], true],
    [['web', 'node_modules', 'x.js'], true],
    [['.DS_Store'], true],
    [['src', '.DS_Store'], true],
    [['src', 'index.js'], false],
    [['.gitignore'], false],
    [['.github', 'workflows', 'ci.yml'], false],
    [['my_node_modules', 'a.js'], false],
    [['src', 'node_modules.md'], false],
  ])('isExcludedPath(%j) = %s', (segments, excluded) => {
    expect(isExcludedPath(segments as string[])).toBe(excluded)
  })

  it('stripsTheFolderNameAndDropsExcludedEntries', () => {
    const sources = toTarSources([
      file('myapp/index.html'),
      file('myapp/src/app.js'),
      file('myapp/.git/config'),
      file('myapp/node_modules/dep/index.js'),
      file('myapp/src/.DS_Store'),
      file('myapp/.gitignore'),
    ])

    expect(sources.map((s) => s.path)).toEqual(['.gitignore', 'index.html', 'src/app.js'])
  })

  it('folderNameIsTheFirstSegment', () => {
    expect(folderNameOf('myapp/src/app.js')).toBe('myapp')
  })
})

describe('packFolder', () => {
  it('producesAGzippedTarWithRelativePaths', async () => {
    const packed = await packFolder([file('site/index.html', '<h1>hi</h1>'), file('site/css/a.css', 'body{}'), file('site/.git/HEAD', 'ref'), file('site/node_modules/x/y.js', 'z')])
    const entries = readTar(await gunzip(packed.blob))

    expect(packed.fileName).toBe('site.tar.gz')
    expect(packed.fileCount).toBe(2)
    expect(entries.map((e) => e.path)).toEqual(['css/a.css', 'index.html'])
    expect(new TextDecoder().decode(entries[1].content)).toBe('<h1>hi</h1>')
  })

  it('startsWithTheGzipMagicTheServerDetects', async () => {
    const packed = await packFolder([file('site/a.txt')])
    const head = new Uint8Array(await packed.blob.slice(0, 2).arrayBuffer())

    expect([...head]).toEqual([0x1f, 0x8b])
  })

  it('reportsProgressUpToTheTotal', async () => {
    const seen: number[] = []

    await packFolder([file('s/a', 'aaaa'), file('s/b', 'bb')], ({ doneBytes, totalBytes }) => {
      expect(totalBytes).toBe(6)
      seen.push(doneBytes)
    })

    expect(seen.at(-1)).toBe(6)
  })

  it('aFolderOfOnlyExcludedFiles_IsRefused', async () => {
    await expect(packFolder([file('s/.git/HEAD'), file('s/.DS_Store')])).rejects.toThrow(EmptyFolderError)
  })

  it('aPathThatCannotFit_IsRefusedWithAClearMessage', async () => {
    await expect(packFolder([file(`s/${'n'.repeat(120)}.txt`)])).rejects.toThrow(/too long to pack/)
  })

  it('sameFilesWithDifferentMtimesAndOrder_PackToIdenticalBytes', async () => {
    const a = await packFolder([file('s/b.txt', 'bb', 1000), file('s/a/x.txt', 'xx', 2000), file('s/c.txt', 'cc', 3000)])
    const b = await packFolder([file('s/c.txt', 'cc', 9_000_000), file('s/b.txt', 'bb', 8_000_000), file('s/a/x.txt', 'xx', 7_000_000)])

    expect(await sha(a.blob)).toBe(await sha(b.blob))
  })

  it('gzipHeaderMtimeAndOsBytes_AreFixed', async () => {
    const packed = await packFolder([file('s/a.txt')])
    const head = new Uint8Array(await packed.blob.slice(0, 10).arrayBuffer())

    expect([...head.subarray(4, 10)]).toEqual([0, 0, 0, 0, 0, 255])
    expect(readTar(await gunzip(packed.blob)).length).toBe(1)
  })

  it('entriesAreSortedByPathOrdinal', () => {
    expect(toTarSources([file('s/b'), file('s/B'), file('s/a/z'), file('s/a')]).map((x) => x.path)).toEqual(['B', 'a', 'a/z', 'b'])
  })

  it('countPackable_CountsOnlyWhatWillBePacked', () => {
    expect(countPackable([file('d/a'), file('d/.DS_Store'), file('d/node_modules/x/y.js'), file('d/.git/HEAD'), file('d/b')])).toEqual({ packed: 2, skipped: 3 })
  })
})
