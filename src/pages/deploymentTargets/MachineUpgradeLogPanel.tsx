import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Empty, Spin } from 'antd'

import { getMachineUpgradeLog } from '../apis/machine'

interface Props {
  machineId: number
  /**
   * When an upgrade is actively streaming, the panel auto-opens and polls the raw
   * log so the operator sees the granular download / retry / SHA / extract detail
   * in real time (the structured Events timeline above is coarser).
   */
  active?: boolean
}

const POLL_MS = 3_000

/**
 * Collapsible "Full upgrade log (raw)" panel. Lazy-loaded on first expand, and —
 * while an upgrade is active — auto-opened and polled every {@link POLL_MS} so it
 * reflects the agent's log line-by-line as the upgrade runs. Reads
 * GET /machines/{id}/upgrade-log.
 */
export default function MachineUpgradeLogPanel({ machineId, active = false }: Props) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMachineUpgradeLog(machineId, { silentLoading: true })
      setLog(data?.log ?? '')
      setLoaded(true)
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load upgrade log')
    } finally {
      setLoading(false)
    }
  }, [machineId])

  // While an upgrade is active: auto-open + poll so the raw log is real-time.
  useEffect(() => {
    if (!active) return
    setOpen(true)
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [active, load])

  // When the active upgrade ends, do one final fetch so the last lines land.
  const prevActive = useRef(active)
  useEffect(() => {
    if (prevActive.current && !active && open) void load()
    prevActive.current = active
  }, [active, open, load])

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
          {active ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
              <span className="text-[10px] leading-none">●</span> Live
            </span>
          ) : null}
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
