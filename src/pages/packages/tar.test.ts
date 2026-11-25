import { describe, expect, it } from 'vitest'
import { buildHeader, splitUstarPath, tarChunks, tarStream, TarPathTooLongError, TarSourceChangedError, type TarSource } from './tar'
import { collect, headerChecksumOk, readTar } from './tarTestReader'

const text = (value: string) => new TextEncoder().encode(value)
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

function source(path: string, content: string | Uint8Array, mtimeMs = 0): TarSource {
  const bytes = typeof content === 'string' ? text(content) : content

  return { path, size: bytes.length, mtimeMs, async *read() { yield bytes } }
}

describe('tar header', () => {
  it('fieldsAndChecksum_MatchHandComputedValues', () => {
    // "a.txt", 5 bytes, mtime 1700000000 s. The checksum is the sum of every header byte with the checksum field read as 8 spaces,
    // so it is rebuilt here field by field from the characters each field must hold.
    const block = buildHeader('a.txt', 5, 1_700_000_000_000)
    const octalSum = (value: string) => [...value].reduce((n, c) => n + c.charCodeAt(0), 0)

    const expected =
      octalSum('a.txt') +
      octalSum('0000644') + // mode
      octalSum('0000000') * 2 + // uid, gid
      octalSum('00000000005') + // size, 11 digits
      octalSum((1_700_000_000).toString(8).padStart(11, '0')) + // mtime in seconds
      0x30 + // typeflag '0'
      octalSum('ustar') +
      octalSum('00') +
      8 * 0x20

    expect(block.length).toBe(512)
    expect(new TextDecoder().decode(block.subarray(124, 135))).toBe('00000000005')
    expect(new TextDecoder().decode(block.subarray(148, 154))).toBe(expected.toString(8).padStart(6, '0'))
    expect(block[154]).toBe(0)
    expect(block[155]).toBe(0x20)
    expect(headerChecksumOk(block)).toBe(true)
  })

  it('knownGoodHeader_ForEmptyFile_HasTheHandComputedChecksum', () => {
    // name "x", size 0, mtime 0, mode 0644, no owner names. Hand sum: 'x' 120 + mode "0000644" (4*48+54+52+52=350) + uid and gid 2*(7*48)=672
    // + size 11*48=528 + mtime 528 + typeflag '0' 48 + "ustar" (117+115+116+97+114)=559 + "00" 96 + checksum field as spaces 8*32=256
    // = 3157 decimal = 0o6125.
    const block = buildHeader('x', 0, 0)

    expect(new TextDecoder().decode(block.subarray(148, 154))).toBe('006125')
  })

  it('belowTheLimit_UsesNameFieldOnly', () => {
    const { name, prefix } = splitUstarPath('a'.repeat(100))

    expect(name.length).toBe(100)
    expect(prefix.length).toBe(0)
  })

  it('longPath_SplitsAtASlashIntoPrefixAndName', () => {
    const folder = 'd'.repeat(60)
    const path = `${folder}/${folder}/${'f'.repeat(90)}`
    const { name, prefix } = splitUstarPath(path)

    expect(decode(prefix)).toBe(`${folder}/${folder}`)
    expect(decode(name)).toBe('f'.repeat(90))
  })

  it('longPath_RoundTripsThroughTheReader', async () => {
    const path = `${'d'.repeat(70)}/${'e'.repeat(70)}/${'f'.repeat(95)}.txt`
    const [entry] = readTar(await collect(tarChunks([source(path, 'x')])))

    expect(entry.path).toBe(path)
  })

  it('pathWithNoUsableSlash_Throws', () => {
    expect(() => splitUstarPath('n'.repeat(101))).toThrow(TarPathTooLongError)
  })

  it('nameOverOneHundredBytes_EvenWithAShortFolder_Throws', () => {
    expect(() => splitUstarPath(`dir/${'n'.repeat(101)}`)).toThrow(TarPathTooLongError)
  })

  it('folderPartOverOneFiftyFiveBytes_Throws', () => {
    expect(() => splitUstarPath(`${'d'.repeat(156)}/${'n'.repeat(10)}`)).toThrow(TarPathTooLongError)
  })

  it('lengthIsMeasuredInUtf8Bytes_NotCharacters', () => {
    // 40 three-byte characters = 120 bytes: over the name limit although only 40 characters long.
    expect(() => splitUstarPath('字'.repeat(40))).toThrow(TarPathTooLongError)
    expect(() => splitUstarPath('字'.repeat(33))).not.toThrow()
  })
})

describe('tar archive', () => {
  it('roundTrip_PreservesPathsContentAndPadding', async () => {
    const big = new Uint8Array(1500).map((_, i) => i % 251)
    const bytes = await collect(tarChunks([source('readme.md', 'hello'), source('src/app/big.bin', big), source('empty.txt', '')]))
    const entries = readTar(bytes)

    expect(bytes.length % 512).toBe(0)
    expect(entries.map((e) => e.path)).toEqual(['readme.md', 'src/app/big.bin', 'empty.txt'])
    expect(decode(entries[0].content)).toBe('hello')
    expect(entries[1].content).toEqual(big)
    expect(entries[2].size).toBe(0)
    expect(entries.every((e) => e.typeflag === '0' && e.mode === 0o644)).toBe(true)
  })

  it('mtime_IsWrittenInWholeSeconds', async () => {
    const [entry] = readTar(await collect(tarChunks([source('a', 'x', 1_700_000_000_999)])))

    expect(entry.mtime).toBe(1_700_000_000)
  })

  it('emptyList_IsJustTheTwoZeroBlocks', async () => {
    expect((await collect(tarChunks([]))).length).toBe(1024)
  })

  it('unpackablePath_FailsBeforeAnyFileIsRead', async () => {
    let read = false
    const good: TarSource = { path: 'ok.txt', size: 1, async *read() { read = true; yield text('x') } }

    await expect(collect(tarChunks([good, source('n'.repeat(101), 'x')]))).rejects.toThrow(TarPathTooLongError)
    expect(read).toBe(false)
  })

  it('fileThatGrowsWhileRead_IsReported', async () => {
    const growing: TarSource = { path: 'g.txt', size: 2, async *read() { yield text('abc') } }

    await expect(collect(tarChunks([growing]))).rejects.toThrow(TarSourceChangedError)
  })

  it('fileThatShrinksWhileRead_IsReported', async () => {
    const shrinking: TarSource = { path: 's.txt', size: 5, async *read() { yield text('ab') } }

    await expect(collect(tarChunks([shrinking]))).rejects.toThrow(TarSourceChangedError)
  })

  it('progress_ReportsCumulativeContentBytes', async () => {
    const seen: number[] = []

    await collect(tarChunks([source('a', 'aaaa'), source('b', 'bb')], (done) => seen.push(done)))

    expect(seen).toEqual([4, 6])
  })

  it('stream_YieldsTheSameBytesAsTheChunks', async () => {
    const sources = [source('a.txt', 'hello'), source('b/c.txt', 'world')]
    const direct = await collect(tarChunks(sources))
    const streamed = new Uint8Array(await new Response(tarStream(sources)).arrayBuffer())

    expect(streamed).toEqual(direct)
  })
})
