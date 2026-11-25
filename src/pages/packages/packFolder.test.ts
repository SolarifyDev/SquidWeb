import { describe, expect, it } from 'vitest'
import { EmptyFolderError, folderNameOf, isExcludedPath, packFolder, toTarSources, type FolderFile } from './packFolder'
import { readTar } from './tarTestReader'

const file = (path: string, content = 'x'): FolderFile => ({ path, file: new File([content], path.split('/').pop() ?? 'f') })

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

    expect(sources.map((s) => s.path)).toEqual(['index.html', 'src/app.js', '.gitignore'])
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
    expect(entries.map((e) => e.path)).toEqual(['index.html', 'css/a.css'])
    expect(new TextDecoder().decode(entries[0].content)).toBe('<h1>hi</h1>')
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
})
