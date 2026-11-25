import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Alert, Button, Checkbox, Input, Progress } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { getPackageVersionRule, pushBuiltInPackage } from 'pages/apis/builtInPackages'
import { filesFromDirectoryInput, readDrop, type DroppedContent } from './dropEntries'
import { countPackable, folderNameOf, packFolder, type FolderFile } from './packFolder'
import {
  describePushFailure,
  describePushResult,
  formatBytes,
  isSupportedArchiveName,
  suggestPackageId,
  type UploadFailure,
  type UploadOutcome,
} from './packageUi'

type Chosen = { kind: 'archive'; file: File } | { kind: 'folder'; name: string; files: FolderFile[] }

interface UploadPanelProps {
  canEdit: boolean
  feedId: number | null
  spaceId: number
  /** Called after a push that stored (or deduplicated) a version, so the lists can refresh. */
  onUploaded: () => void
}

function describeFolder(name: string, files: FolderFile[]) {
  const { packed, skipped } = countPackable(files)
  const skippedText = skipped > 0 ? `, ${skipped} skipped: .git, node_modules, .DS_Store` : ''

  return `Folder ${name} (${packed} ${packed === 1 ? 'file' : 'files'}${skippedText}; packed to .tar.gz on upload)`
}

type Phase = 'idle' | 'packing' | 'uploading'

const directoryInputProps = { webkitdirectory: '', directory: '' } as Record<string, string>

export function UploadPanel({ canEdit, feedId, spaceId, onUploaded }: UploadPanelProps) {
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [packageId, setPackageId] = useState('')
  const [version, setVersion] = useState('')
  const [replace, setReplace] = useState(false)
  const [rule, setRule] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [percent, setPercent] = useState(0)
  const [outcome, setOutcome] = useState<UploadOutcome | null>(null)
  const [failure, setFailure] = useState<UploadFailure | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  const trimmedId = packageId.trim()

  useEffect(() => {
    setRule(null)
    if (feedId == null || !trimmedId) return

    let cancelled = false
    const timer = setTimeout(() => {
      getPackageVersionRule(feedId, trimmedId)
        .then((result) => !cancelled && setRule(result.versionTemplate))
        .catch(() => undefined)
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [feedId, trimmedId])

  if (!canEdit) return null

  const choose = (next: Chosen) => {
    setOutcome(null)
    setFailure(null)

    if (next.kind === 'archive' && !isSupportedArchiveName(next.file.name)) {
      setChosen(null)
      setFailure({ title: 'Unsupported format', detail: `"${next.file.name}" is not a .zip, .tar.gz or .tgz file. To upload a folder, drop the folder itself or use "Choose folder".` })
      return
    }

    setChosen(next)
    setPackageId(suggestPackageId(next.kind === 'archive' ? next.file.name : next.name))
  }

  const chooseDropped = (content: DroppedContent) => choose(content)

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)

    try {
      chooseDropped(await readDrop(event.dataTransfer.items))
    } catch (error) {
      setFailure({ title: 'Cannot use what was dropped', detail: error instanceof Error ? error.message : 'Drop a .zip, .tar.gz or a folder.' })
    }
  }

  const upload = async () => {
    if (!chosen) return

    setOutcome(null)
    setFailure(null)
    setPercent(0)

    try {
      const { body, fileName } = await prepareBody(chosen)

      setPhase('uploading')
      setPercent(0)

      const result = await pushBuiltInPackage(body, {
        spaceId,
        fileName,
        packageId,
        version,
        replace,
        onProgress: (sent, total) => setPercent(total > 0 ? Math.round((sent / total) * 100) : 0),
      })

      setOutcome(describePushResult(result))
      setChosen(null)
      setVersion('')
      setReplace(false)
      onUploaded()
    } catch (error) {
      setFailure(describePushFailure(error))
    } finally {
      setPhase('idle')
    }
  }

  const prepareBody = async (content: Chosen): Promise<{ body: Blob; fileName: string }> => {
    if (content.kind === 'archive') return { body: content.file, fileName: content.file.name }

    setPhase('packing')

    const packed = await packFolder(content.files, ({ doneBytes, totalBytes }) => setPercent(totalBytes > 0 ? Math.round((doneBytes / totalBytes) * 100) : 100))

    return { body: packed.blob, fileName: packed.fileName }
  }

  const busy = phase !== 'idle'
  const summary = chosen ? (chosen.kind === 'archive' ? `${chosen.file.name} (${formatBytes(chosen.file.size)})` : describeFolder(chosen.name, chosen.files)) : null

  return (
    <div data-testid="upload-panel" className="rounded border border-gray-200 bg-white p-4">
      <div
        data-testid="drop-zone"
        className={`mb-3 rounded border-2 border-dashed p-6 text-center ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => void handleDrop(event)}
      >
        <InboxOutlined className="text-3xl text-gray-400" />
        <div className="mt-1 text-sm text-gray-600">Drop a .zip, .tar.gz or .tgz file, or a folder, here</div>
        <div className="mt-3 flex justify-center gap-2">
          <Button disabled={busy} onClick={() => fileInput.current?.click()}>
            Choose file
          </Button>
          <Button disabled={busy} onClick={() => folderInput.current?.click()}>
            Choose folder
          </Button>
        </div>
        <input
          ref={fileInput}
          data-testid="file-input"
          type="file"
          accept=".zip,.tar.gz,.tgz"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) choose({ kind: 'archive', file })
            event.target.value = ''
          }}
        />
        <input
          ref={folderInput}
          data-testid="folder-input"
          type="file"
          hidden
          {...directoryInputProps}
          onChange={(event) => {
            const list = event.target.files
            if (list && list.length > 0) {
              const files = filesFromDirectoryInput(list)
              choose({ kind: 'folder', name: folderNameOf(files[0].path), files })
            }
            event.target.value = ''
          }}
        />
      </div>

      {chosen && (
        <div className="space-y-3">
          <div className="text-sm text-gray-700">{summary}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Package id</span>
              <Input aria-label="Package id" value={packageId} disabled={busy} onChange={(event) => setPackageId(event.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Version (optional)</span>
              <Input aria-label="Version" value={version} disabled={busy} placeholder="Leave empty to use the version rule" onChange={(event) => setVersion(event.target.value)} />
              {!version.trim() && rule && (
                <span data-testid="effective-rule" className="mt-1 block text-xs text-gray-500">
                  Version rule: <code>{rule}</code>
                </span>
              )}
            </label>
          </div>
          {version.trim() && (
            <Checkbox checked={replace} disabled={busy} onChange={(event) => setReplace(event.target.checked)}>
              Replace this version if it already exists (not allowed when a release uses it)
            </Checkbox>
          )}
          {busy && (
            <div data-testid="upload-progress">
              <div className="mb-1 text-xs text-gray-500">{phase === 'packing' ? 'Packing folder...' : 'Uploading...'}</div>
              <Progress percent={percent} size="small" />
            </div>
          )}
          <Button type="primary" disabled={busy} onClick={() => void upload()}>
            Upload
          </Button>
        </div>
      )}

      {outcome && <Alert className="mt-3" type={outcome.tone} showIcon message={outcome.title} description={outcome.detail} />}
      {failure && <Alert className="mt-3" type="error" showIcon message={failure.title} description={failure.detail} />}
    </div>
  )
}
