import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from 'utils/request'
import { UploadPanel } from './UploadPanel'
import { readTar } from './tarTestReader'

const push = vi.fn()
const getRule = vi.fn()

vi.mock('pages/apis/builtInPackages', async (importActual) => ({
  ...(await importActual<typeof import('pages/apis/builtInPackages')>()),
  pushBuiltInPackage: (...args: unknown[]) => push(...args),
  getPackageVersionRule: (...args: unknown[]) => getRule(...args),
}))

const stored = (version: string) => ({ id: 1, feedId: 7, packageId: 'Acme.Web', version, fileExtension: '.zip', sizeBytes: 3, sha256: 'ab', publishedDate: '', publishedBy: 1, source: 'upload' })

function pick(testId: string, files: File[]) {
  const input = screen.getByTestId(testId) as HTMLInputElement

  Object.defineProperty(input, 'files', { value: files, configurable: true })
  fireEvent.change(input)
}

const zip = () => new File(['PK'], 'Acme.Web.1.2.3.zip')

function renderPanel(props: Partial<React.ComponentProps<typeof UploadPanel>> = {}) {
  return render(<UploadPanel canEdit feedId={7} spaceId={3} onUploaded={vi.fn()} {...props} />)
}

describe('UploadPanel', () => {
  beforeEach(() => {
    push.mockReset()
    getRule.mockReset().mockResolvedValue({ feedId: 7, packageId: 'Acme.Web', versionTemplate: '1.0.{counter}', isDefault: true })
  })

  it('withoutFeedEdit_ShowsNoUpload', () => {
    const { container } = renderPanel({ canEdit: false })

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Upload')).toBeNull()
  })

  it('choosingAFile_PrefillsThePackageIdAndShowsTheEffectiveRule', async () => {
    renderPanel()

    pick('file-input', [zip()])

    expect(screen.getByLabelText('Package id')).toHaveValue('Acme.Web')
    expect(await screen.findByTestId('effective-rule')).toHaveTextContent('1.0.{counter}')
    expect(getRule).toHaveBeenCalledWith(7, 'Acme.Web')
  })

  it('emptyVersion_IsHandedOverEmpty_SoNoVersionParamIsSent', async () => {
    push.mockResolvedValue({ package: stored('1.0.4'), deduplicated: false, replaced: false })
    renderPanel()
    pick('file-input', [zip()])

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    expect(await screen.findByText('Published version 1.0.4')).toBeInTheDocument()
    expect(push.mock.calls[0][1]).toMatchObject({ spaceId: 3, fileName: 'Acme.Web.1.2.3.zip', packageId: 'Acme.Web', version: '' })
  })

  it('typedVersion_IsSent', async () => {
    push.mockResolvedValue({ package: stored('2.0.0'), deduplicated: false, replaced: false })
    renderPanel()
    pick('file-input', [zip()])

    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '2.0.0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await screen.findByText('Published version 2.0.0')
    expect(push.mock.calls[0][1]).toMatchObject({ version: '2.0.0' })
  })

  it('deduplicated_SaysUnchangedWithTheExistingVersion_AndRefreshesTheList', async () => {
    const onUploaded = vi.fn()
    push.mockResolvedValue({ package: stored('1.0.3'), deduplicated: true, replaced: false })
    renderPanel({ onUploaded })
    pick('file-input', [zip()])

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    expect(await screen.findByText('Unchanged — same content as version 1.0.3')).toBeInTheDocument()
    expect(onUploaded).toHaveBeenCalled()
  })

  it.each([
    [409, "Version '1.0.3' of package 'Acme.Web' already exists", 'Version conflict'],
    [409, "Version '1.0.3' of package 'Acme.Web' is used by a release and cannot be replaced", 'Version conflict'],
    [413, 'The package is larger than the 2 GiB limit', 'Package too large'],
    [400, 'Only .zip and .tar.gz packages are accepted', 'Package rejected'],
    [400, 'The archive holds an unsafe entry: ../evil', 'Package rejected'],
  ])('refusal%i_ShowsTheServersMessage: %s', async (status, msg, title) => {
    const onUploaded = vi.fn()
    push.mockRejectedValue(new ApiError(msg, status, 200))
    renderPanel({ onUploaded })
    pick('file-input', [zip()])

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    expect(await screen.findByText(msg)).toBeInTheDocument()
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('aFileThatIsNotAnArchive_IsRefusedBeforeUpload', () => {
    renderPanel()

    pick('file-input', [new File(['x'], 'notes.txt')])

    expect(screen.getByText(/is not a .zip, .tar.gz or .tgz file/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull()
  })

  it('chosenFolder_IsPackedToTarGz_AndUploadedUnderTheFolderName', async () => {
    push.mockResolvedValue({ package: stored('1.0.1'), deduplicated: false, replaced: false })
    renderPanel()
    const file = (relative: string) => Object.defineProperty(new File(['x'], relative.split('/').pop()!), 'webkitRelativePath', { value: relative })

    pick('folder-input', [file('site/index.html'), file('site/node_modules/a/b.js'), file('site/.git/HEAD')])

    expect(screen.getByLabelText('Package id')).toHaveValue('site')
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await screen.findByText('Published version 1.0.1')
    const [body, options] = push.mock.calls[0]

    expect(options.fileName).toBe('site.tar.gz')
    expect(body.size).toBeGreaterThan(0)
  })

  it('folderSummary_CountsOnlyPackedFiles_AndSaysHowManyWereSkipped', () => {
    renderPanel()
    const file = (relative: string) => Object.defineProperty(new File(['x'], relative.split('/').pop()!), 'webkitRelativePath', { value: relative })

    pick('folder-input', [file('demo/a.txt'), file('demo/b.txt'), file('demo/.DS_Store'), file('demo/node_modules/x.js'), file('demo/.git/HEAD')])

    expect(screen.getByText(/Folder demo \(2 files, 3 skipped/)).toBeInTheDocument()
  })

  describe('secret-like files in a folder', () => {
    const file = (relative: string) => Object.defineProperty(new File(['x'], relative.split('/').pop()!), 'webkitRelativePath', { value: relative })
    const tarPaths = async (body: Blob) => {
      const stream = body.stream().pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)

      return readTar(new Uint8Array(await new Response(stream).arrayBuffer())).map((entry) => entry.path)
    }

    it('areListedInANotice_AndLeftOutOfTheUpload', async () => {
      push.mockResolvedValue({ package: stored('1.0.1'), deduplicated: false, replaced: false })
      renderPanel()

      pick('folder-input', [file('site/index.html'), file('site/.env'), file('site/.aws/credentials'), file('site/.env.example')])

      const notice = screen.getByTestId('withheld-notice')
      expect(notice).toHaveTextContent('left out of the package')
      expect(notice).toHaveTextContent('.env')
      expect(notice).toHaveTextContent('.aws/credentials')
      expect(notice).not.toHaveTextContent('.env.example')
      expect(screen.getByRole('checkbox', { name: 'Include these files anyway' })).not.toBeChecked()

      fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
      await screen.findByText('Published version 1.0.1')

      expect(await tarPaths(push.mock.calls[0][0])).toEqual(['.env.example', 'index.html'])
    })

    it('canBeIncludedDeliberately', async () => {
      push.mockResolvedValue({ package: stored('1.0.1'), deduplicated: false, replaced: false })
      renderPanel()

      pick('folder-input', [file('site/index.html'), file('site/.env')])
      fireEvent.click(screen.getByRole('checkbox', { name: 'Include these files anyway' }))

      expect(screen.getByTestId('withheld-notice')).toHaveTextContent('are included in the package')
      expect(screen.getByText(/Folder site \(2 files/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
      await screen.findByText('Published version 1.0.1')

      expect(await tarPaths(push.mock.calls[0][0])).toEqual(['.env', 'index.html'])
    })

    it('choosingAnotherFolder_ResetsTheInclusion', () => {
      renderPanel()

      pick('folder-input', [file('site/index.html'), file('site/.env')])
      fireEvent.click(screen.getByRole('checkbox', { name: 'Include these files anyway' }))
      pick('folder-input', [file('other/index.html'), file('other/.npmrc')])

      expect(screen.getByRole('checkbox', { name: 'Include these files anyway' })).not.toBeChecked()
    })

    it('listsOnlyTheFirstFewAndCountsTheRest', () => {
      renderPanel()

      pick('folder-input', [file('site/index.html'), ...Array.from({ length: 11 }, (_, i) => file(`site/k${String(i).padStart(2, '0')}.key`))])

      expect(screen.getByTestId('withheld-notice')).toHaveTextContent('and 3 more')
    })

    it('noNoticeWhenThereAreNone', () => {
      renderPanel()

      pick('folder-input', [file('site/index.html'), file('site/.env.example')])

      expect(screen.queryByTestId('withheld-notice')).toBeNull()
    })
  })

  it('anEmptyFolder_ShowsAClearError', async () => {
    renderPanel()
    const only = Object.defineProperty(new File(['x'], 'HEAD'), 'webkitRelativePath', { value: 'site/.git/HEAD' })

    pick('folder-input', [only])
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    expect(await screen.findByText(/Nothing to pack/)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('replaceCheckbox_AppearsOnlyWithATypedVersion', async () => {
    renderPanel()
    pick('file-input', [zip()])

    expect(screen.queryByText(/Replace this version/)).toBeNull()

    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0.3' } })

    await waitFor(() => expect(screen.getByText(/Replace this version/)).toBeInTheDocument())
  })

  it('replace_IsNotSentOnceTheVersionIsCleared', async () => {
    push.mockResolvedValue({ package: stored('1.0.4'), deduplicated: false, replaced: false })
    renderPanel()
    pick('file-input', [zip()])

    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0.3' } })
    fireEvent.click(await screen.findByLabelText(/Replace this version/))
    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '' } })

    expect(screen.queryByLabelText(/Replace this version/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await screen.findByText('Published version 1.0.4')

    expect(push.mock.calls[0][1]).toMatchObject({ version: '', replace: false })
  })

  it('replace_IsSentWithATypedVersion_AndResetWhenAnotherFileIsChosen', async () => {
    push.mockResolvedValue({ package: stored('1.0.3'), deduplicated: false, replaced: true })
    renderPanel()
    pick('file-input', [zip()])
    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0.3' } })
    fireEvent.click(await screen.findByLabelText(/Replace this version/))
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await screen.findByText('Replaced version 1.0.3')

    expect(push.mock.calls[0][1]).toMatchObject({ version: '1.0.3', replace: true })

    pick('file-input', [zip()])
    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0.5' } })

    expect(await screen.findByLabelText(/Replace this version/)).not.toBeChecked()
  })

  it('choosingAnotherFile_ClearsATickedReplace', async () => {
    renderPanel()
    pick('file-input', [zip()])
    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0.3' } })
    fireEvent.click(await screen.findByLabelText(/Replace this version/))

    pick('file-input', [new File(['PK'], 'Other.1.0.0.zip')])

    expect(screen.getByLabelText(/Replace this version/)).not.toBeChecked()
  })

  it('fixedPackageId_IsPrefilledReadOnly_AndNeverReplacedByTheFileName', async () => {
    push.mockResolvedValue({ package: stored('1.0.4'), deduplicated: false, replaced: false })
    renderPanel({ fixedPackageId: 'Acme.Web' })

    pick('file-input', [new File(['PK'], 'something-else.zip')])

    expect(screen.getByLabelText('Package id')).toHaveValue('Acme.Web')
    expect(screen.getByLabelText('Package id')).toHaveAttribute('readonly')

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await screen.findByText('Published version 1.0.4')

    expect(push.mock.calls[0][1]).toMatchObject({ packageId: 'Acme.Web', fileName: 'something-else.zip' })
  })

  it('cancel_AbortsTheUpload_AndShowsItWasCancelled', async () => {
    const onUploaded = vi.fn()
    push.mockImplementation((_body, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('canceled')))))
    renderPanel({ onUploaded })
    pick('file-input', [zip()])

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    expect(push.mock.calls[0][1].signal.aborted).toBe(true)
    expect(onUploaded).not.toHaveBeenCalled()
    expect(document.querySelector('.ant-alert-error')).toBeNull()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled()
  })

  it('unmountedMidUpload_AbortsAndNeverCallsBack', async () => {
    const onUploaded = vi.fn()
    let finish: (value: unknown) => void = () => undefined
    push.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = renderPanel({ onUploaded })
    pick('file-input', [zip()])
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(push).toHaveBeenCalled())

    unmount()
    await act(async () => finish({ package: stored('1.0.4'), deduplicated: false, replaced: false }))

    expect(push.mock.calls[0][1].signal.aborted).toBe(true)
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('aFolderOverTheServerLimit_IsRefusedBeforePacking', async () => {
    renderPanel()
    const big = Object.defineProperty(new File(['x'], 'big.bin'), 'size', { value: 3 * 1024 ** 3 })

    pick('folder-input', [Object.defineProperty(big, 'webkitRelativePath', { value: 'site/big.bin' })])
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    expect(await screen.findByText(/over the 2 GiB package limit/)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('droppingAFolder_ShowsHowManyFilesWereFoundWhileItIsWalked', async () => {
    renderPanel()
    let release: () => void = () => undefined
    const quick = { isFile: true, isDirectory: false, name: 'a.txt', fullPath: '/site/a.txt', file: (ok: (f: File) => void) => ok(new File(['x'], 'a.txt')) }
    const slow = { isFile: true, isDirectory: false, name: 'b.txt', fullPath: '/site/b.txt', file: (ok: (f: File) => void) => { release = () => ok(new File(['x'], 'b.txt')) } }
    let handed = false
    const root = {
      isFile: false, isDirectory: true, name: 'site', fullPath: '/site',
      createReader: () => ({ readEntries: (ok: (batch: unknown[]) => void) => { ok(handed ? [] : [quick, slow]); handed = true } }),
    }

    fireEvent.drop(screen.getByTestId('drop-zone'), { dataTransfer: { items: [{ kind: 'file', webkitGetAsEntry: () => root, getAsFile: () => null }] } })

    expect(await screen.findByTestId('scan-progress')).toHaveTextContent('1 file found')

    await act(async () => release())

    expect(await screen.findByText(/Folder site \(2 files/)).toBeInTheDocument()
    expect(screen.queryByTestId('scan-progress')).toBeNull()
  })
})
