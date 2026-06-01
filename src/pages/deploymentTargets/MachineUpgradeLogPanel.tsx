import { useCallback, useState } from 'react'
import { Button, Empty, Spin } from 'antd'

import { getMachineUpgradeLog } from '../apis/machine'

interface Props {
  machineId: number
}

/**
 * Collapsible "Full upgrade log (raw)" panel. The Events tab above shows the
 * high-level per-phase timeline; this surfaces the raw Phase B log the agent
 * captured (the actual command output — apt/zip/SHA256/errors) for deep
 * debugging of a failed upgrade, without SSHing to the host.
 *
 * Lazy-loaded on first expand (the log can be up to 50 KB, tail-truncated by
 * the agent with an "earlier bytes truncated" marker at the head). Reads
 * GET /machines/{id}/upgrade-log.
 */
export default function MachineUpgradeLogPanel({ machineId }: Props) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMachineUpgradeLog(machineId)
      setLog(data?.log ?? '')
      setLoaded(true)
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load upgrade log')
    } finally {
      setLoading(false)
    }
  }, [machineId])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) void load()
  }

  return (
    <div className="mt-4 border border-gray-200 rounded-md bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 bg-transparent border-0 cursor-pointer p-0"
        >
          <span className="text-gray-400">{open ? '▾' : '▸'}</span>
          Full upgrade log (raw)
        </button>
        {open ? (
          <Button size="small" loading={loading} onClick={() => void load()}>
            Refresh
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3">
          {loading && !loaded ? (
            <div className="py-4 flex justify-center">
              <Spin />
            </div>
          ) : error ? (
            <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : !log ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No upgrade log captured yet" />
          ) : (
            <pre className="m-0 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border border-gray-100 bg-gray-50 p-3 font-mono text-xs text-gray-800">
              {log}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  )
}
