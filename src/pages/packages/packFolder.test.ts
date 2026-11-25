import { describe, expect, it } from 'vitest'
import { EmptyFolderError, FolderTooLargeError, MAX_PACKAGE_BYTES, countPackable, folderNameOf, isExcludedPath, normaliseGzipHeader, packFolder, toTarSources, type FolderFile } from './packFolder'
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
    [['.ds_store'], true],
    [['src', '.GIT', 'HEAD'], true],
    [['Node_Modules', 'a.js'], true],
    [['sub', '.git'], true], // a .git FILE: a worktree or submodule pointer
    [['.Git'], true],
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

  it('aPathThatDoesNotFitUstar_IsPackedWithAPaxHeader', async () => {
    const long = `${'d'.repeat(80)}/${'e'.repeat(80)}/${'n'.repeat(120)}.txt`
    const entries = readTar(await gunzip((await packFolder([file(`s/${long}`)])).blob))

    expect(entries.map((e) => e.path)).toEqual([long])
  })

  it('pathsAreWrittenInNfc_WhateverTheBrowserReported', async () => {
    const nfd = 'cafe\u0301.txt'
    const entries = readTar(await gunzip((await packFolder([file(`s/${nfd}`)])).blob))

    expect(nfd.normalize('NFC')).not.toBe(nfd)
    expect(entries[0].path).toBe('caf\u00e9.txt')
  })

  it('aFolderOverTheServerLimit_IsRefusedBeforeAnythingIsRead', async () => {
    let read = false
    const huge = { size: MAX_PACKAGE_BYTES + 1, lastModified: 0, stream: () => { read = true; return new Blob([]).stream() }, arrayBuffer: () => { read = true; return Promise.resolve(new ArrayBuffer(0)) } } as unknown as File

    await expect(packFolder([{ path: 's/big.bin', file: huge }])).rejects.toThrow(FolderTooLargeError)
    expect(read).toBe(false)
  })

  it('exactlyTheLimit_IsAllowedThrough', async () => {
    const edge = { size: MAX_PACKAGE_BYTES, lastModified: 0 } as unknown as File

    expect(toTarSources([{ path: 's/edge.bin', file: edge }])).toHaveLength(1)
  })

  it('theLimitMatchesTheBackendConstant', () => {
    expect(MAX_PACKAGE_BYTES).toBe(2 * 1024 * 1024 * 1024)
  })

  it('cancelMidPack_Rejects', async () => {
    const controller = new AbortController()

    await expect(packFolder([file('s/a', 'aaaa'), file('s/b', 'bbbb')], ({ doneBytes }) => doneBytes >= 4 && controller.abort(), controller.signal)).rejects.toThrow('cancelled')
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

describe('normaliseGzipHeader', () => {
  const gzipLike = (flg: number, bytes = 20) => {
    const data = new Uint8Array(bytes).fill(7)

    data.set([0x1f, 0x8b, 8, flg, 1, 2, 3, 4, 2, 3])

    return new Blob([data])
  }

  it('fixesMtimeFlagsAndOsBytes_AndKeepsTheRest', async () => {
    const out = new Uint8Array(await (await normaliseGzipHeader(gzipLike(0))).arrayBuffer())

    expect([...out.subarray(0, 10)]).toEqual([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 255])
    expect(out.length).toBe(20)
    expect(out[15]).toBe(7)
  })

  it('aHeaderWithOptionalFields_IsLeftAlone', async () => {
    const blob = gzipLike(0x08) // FNAME set: the header is longer than 10 bytes

    expect(await normaliseGzipHeader(blob)).toBe(blob)
  })

  it('notGzip_IsLeftAlone', async () => {
    const blob = new Blob([new Uint8Array(20).fill(1)])

    expect(await normaliseGzipHeader(blob)).toBe(blob)
  })

  it('tooShort_IsLeftAlone', async () => {
    const blob = new Blob([new Uint8Array([0x1f, 0x8b])])

    expect(await normaliseGzipHeader(blob)).toBe(blob)
  })
})
