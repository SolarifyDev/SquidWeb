import { describe, expect, it } from 'vitest'
import { buildEntryHeader, paxRecord, splitUstarPath, tarChunks, tarStream, TarCancelledError, TarSourceChangedError, type TarSource } from './tar'
import { collect, headerChecksumOk, parsePax, readTar } from './tarTestReader'

const text = (value: string) => new TextEncoder().encode(value)
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

function source(path: string, content: string | Uint8Array): TarSource {
  const bytes = typeof content === 'string' ? text(content) : content

  return { path, size: bytes.length, async *read() { yield bytes } }
}

describe('tar header', () => {
  it('fieldsAndChecksum_MatchHandComputedValues', () => {
    // "a.txt", 5 bytes, mtime 0. The checksum is the sum of every header byte with the checksum field read as 8 spaces,
    // so it is rebuilt here field by field from the characters each field must hold.
    const block = buildEntryHeader('a.txt', 5)
    const octalSum = (value: string) => [...value].reduce((n, c) => n + c.charCodeAt(0), 0)

    const expected =
      octalSum('a.txt') +
      octalSum('0000644') + // mode
      octalSum('0000000') * 2 + // uid, gid
      octalSum('00000000005') + // size, 11 digits
      octalSum('00000000000') + // mtime 0
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
    const block = buildEntryHeader('x', 0)

    expect(new TextDecoder().decode(block.subarray(148, 154))).toBe('006125')
  })

  it('belowTheLimit_UsesNameFieldOnly', () => {
    const split = splitUstarPath('a'.repeat(100))!

    expect(split.name.length).toBe(100)
    expect(split.prefix.length).toBe(0)
  })

  it('longPath_SplitsAtASlashIntoPrefixAndName', () => {
    const folder = 'd'.repeat(60)
    const path = `${folder}/${folder}/${'f'.repeat(90)}`
    const { name, prefix } = splitUstarPath(path)!

    expect(decode(prefix)).toBe(`${folder}/${folder}`)
    expect(decode(name)).toBe('f'.repeat(90))
  })

  it('prefixOfExactly155Bytes_StillFitsUstar_And156DoesNot', () => {
    expect(decode(splitUstarPath(`${'d'.repeat(155)}/${'n'.repeat(10)}`)!.prefix)).toBe('d'.repeat(155))
    expect(splitUstarPath(`${'d'.repeat(156)}/${'n'.repeat(10)}`)).toBeNull()
  })

  it('nameOfExactly100Bytes_FitsAfterTheSlash_And101DoesNot', () => {
    expect(decode(splitUstarPath(`dir/${'n'.repeat(100)}`)!.name)).toBe('n'.repeat(100))
    expect(splitUstarPath(`dir/${'n'.repeat(101)}`)).toBeNull()
  })

  it('lengthIsMeasuredInUtf8Bytes_NotCharacters', () => {
    // 40 three-byte characters = 120 bytes: over the name limit although only 40 characters long.
    expect(splitUstarPath('字'.repeat(40))).toBeNull()
    expect(splitUstarPath('字'.repeat(33))).not.toBeNull()
  })

  it('splitInTheMiddleOfNonAsciiPath_KeepsEveryCharacterIntact', async () => {
    const path = `${'字'.repeat(40)}/${'é'.repeat(10)}/${'f'.repeat(60)}.txt`
    const split = splitUstarPath(path)!

    expect(decode(split.prefix)).toBe(`${'字'.repeat(40)}/${'é'.repeat(10)}`)
    expect(decode(split.name)).toBe(`${'f'.repeat(60)}.txt`)
    expect(readTar(await collect(tarChunks([source(path, 'x')])))[0].path).toBe(path)
  })
})

describe('tar PAX', () => {
  it.each([
    ['noSlashOver100Bytes', 'n'.repeat(101)],
    ['prefixOver155Bytes', `${'d'.repeat(156)}/${'n'.repeat(10)}`],
    ['deepPublishTree', Array.from({ length: 14 }, (_, i) => `level${i}-${'x'.repeat(14)}`).join('/') + '/index.html'],
    ['longNonAscii', `${'目录'.repeat(30)}/${'文件'.repeat(40)}.txt`],
  ])('%s_IsWrittenWithAPaxPathRecord_AndReadsBack', async (_, path) => {
    const bytes = await collect(tarChunks([source(path, 'content'), source('short.txt', 'x')]))
    const entries = readTar(bytes)

    expect(entries.map((e) => e.path)).toEqual([path, 'short.txt'])
    expect(decode(entries[0].content)).toBe('content')
  })

  it('paxRecordLengthCountsItself', () => {
    for (const value of ['a', 'a'.repeat(86), 'a'.repeat(87), 'a'.repeat(95), 'a'.repeat(96), 'a'.repeat(995), 'a'.repeat(996)]) {
      const record = paxRecord('path', value)

      expect(parseInt(decode(record), 10)).toBe(record.length)
      expect(parsePax(record)).toEqual({ path: value })
    }
  })

  it('entryOf8GiBOrMore_CarriesAPaxSizeRecordInsteadOfThrowing', () => {
    const bytes = buildEntryHeader('big.iso', 9_000_000_000)
    const paxSize = parseInt(decode(bytes.subarray(124, 135)), 8)

    expect(bytes.length).toBe(512 * 3)
    expect(bytes[156]).toBe(0x78)
    expect(parsePax(bytes.subarray(512, 512 + paxSize))).toEqual({ size: '9000000000' })
    expect(headerChecksumOk(bytes.subarray(0, 512))).toBe(true)
    expect(headerChecksumOk(bytes.subarray(1024, 1536))).toBe(true)
    expect(bytes[1024 + 156]).toBe(0x30)
  })

  it('placeholderNameInTheUstarHeader_NeverCutsACharacterInHalf', () => {
    const bytes = buildEntryHeader('字'.repeat(60), 1)
    const name = bytes.subarray(1024, 1124)
    const end = name.indexOf(0)

    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(name.subarray(0, end === -1 ? 100 : end))).not.toThrow()
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

  it('headers_AreDeterministic_NoTimeNoOwnerFixedMode', async () => {
    const [entry] = readTar(await collect(tarChunks([source('a', 'x')])))
    const header = buildEntryHeader('a', 1)
    const field = (start: number, end: number) => new TextDecoder().decode(header.subarray(start, end)).replace(/\0+$/, '')

    expect(entry.mtime).toBe(0)
    expect(entry.mode).toBe(0o644)
    expect(field(108, 124)).toBe('0000000\u00000000000')
    expect(header.subarray(265, 329).every((b) => b === 0)).toBe(true)
  })

  it('emptyList_IsJustTheTwoZeroBlocks', async () => {
    expect((await collect(tarChunks([]))).length).toBe(1024)
  })

  it('aborted_StopsBetweenChunks', async () => {
    const controller = new AbortController()
    const chunks: TarSource = { path: 'a', size: 3, async *read() { yield text('a'); controller.abort(); yield text('b'); yield text('c') } }

    await expect(collect(tarChunks([chunks], undefined, controller.signal))).rejects.toThrow(TarCancelledError)
  })

  it('alreadyAborted_ReadsNothing', async () => {
    let read = false
    const controller = new AbortController()
    const never: TarSource = { path: 'a', size: 1, async *read() { read = true; yield text('a') } }

    controller.abort()

    await expect(collect(tarChunks([never], undefined, controller.signal))).rejects.toThrow(TarCancelledError)
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
