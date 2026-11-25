import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UploadPanel } from './UploadPanel'

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
    push.mockRejectedValue({ response: { status, data: { msg, code: status } } })
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
})
