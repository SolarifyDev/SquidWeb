import { useRef, useState } from 'react'
import { Alert, Button, Modal } from 'antd'
import {
  getRunbookApiErrorDetails,
  publishRunbook,
  type RunbookDto,
  type RunbookPublishedSnapshotDto,
} from 'pages/apis/runbook'
import { OUTLINE_BLUE_CLASS } from './RunbookPageShell'

interface RunbookPublishActionProps {
  runbook: RunbookDto
  onPublished: (snapshot: RunbookPublishedSnapshotDto) => void
}

export default function RunbookPublishAction({ runbook, onPublished }: RunbookPublishActionProps) {
  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const confirmPublish = async () => {
    if (inFlight.current) return

    inFlight.current = true
    setPublishing(true)
    setError(null)
    try {
      const snapshot = await publishRunbook({
        id: runbook.id,
        projectId: runbook.projectId,
        spaceId: runbook.spaceId,
      })
      onPublished(snapshot)
      setOpen(false)
    } catch (caught) {
      setError(getRunbookApiErrorDetails(caught).message)
    } finally {
      inFlight.current = false
      setPublishing(false)
    }
  }

  return (
    <>
      <Button className={OUTLINE_BLUE_CLASS} onClick={() => {
        setError(null)
        setOpen(true)
      }}>
        Publish draft…
      </Button>
      <Modal
        open={open}
        title="Publish Runbook draft?"
        okText="Publish"
        confirmLoading={publishing}
        okButtonProps={{ 'aria-label': 'Publish', disabled: publishing }}
        cancelButtonProps={{ disabled: publishing }}
        onOk={() => void confirmPublish()}
        onCancel={() => {
          if (!inFlight.current) setOpen(false)
        }}
        centered
      >
        <p>Create a new version from the saved draft of {runbook.name}.</p>
        {error ? <Alert type="error" showIcon message={error} /> : null}
      </Modal>
    </>
  )
}
