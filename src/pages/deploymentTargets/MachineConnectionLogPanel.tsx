import { useCallback, useEffect, useState } from 'react'
import { Button, Empty, Spin, Tag } from 'antd'

import {
  getMachineConnectionLog,
  type MachineConnectionLogEntry,
} from '../apis/machine'

interface Props {
  machineId: number
}

// Map Halibut connection event types to a tag colour so failures stand out.
function typeColor(type: string): string {
  switch (type) {
    case 'Error':
    case 'ErrorInInitialisation':
    case 'ErrorInIdentify':
    case 'ClientDenied':
      return 'red'
    case 'SecurityNegotiation':
    case 'Security':
      return 'blue'
    case 'OpeningNewConnection':
    case 'ListenerAcceptedClient':
      return 'green'
    default:
      return 'default'
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/**
 * Shows the machine's real Halibut connection log — the transport-level events
 * the server recorded for this agent's endpoint (connection opened, TLS/security
 * negotiation, message exchange, listener accept, errors). The genuine "why is
 * this agent connected / why did it fail", versus the health-check summary above.
 *
 * Read-only, in-memory recent-events buffer on the server (not persisted across
 * server restarts) — refreshable on demand.
 */
export default function MachineConnectionLogPanel({ machineId }: Props) {
  const [entries, setEntries] = useState<MachineConnectionLogEntry[]>([])
  const [endpoint, setEndpoint] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMachineConnectionLog(machineId)
      setEntries(data?.entries ?? [])
      setEndpoint(data?.endpoint ?? '')
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load connection log')
    } finally {
      setLoading(false)
    }
  }, [machineId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mt-4 border border-gray-200 rounded-md bg-white p-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-semibold text-gray-900 m-0">Connection log</h2>
        <Button size="small" loading={loading} onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="text-xs text-gray-500 mb-4">
        Real Halibut transport events recorded by the server{endpoint ? <> for <span className="font-mono">{endpoint}</span></> : null}. Most recent first refresh; in-memory on the server.
      </div>

      {loading && entries.length === 0 ? (
        <div className="py-6 flex justify-center">
          <Spin />
        </div>
      ) : error ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : entries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No connection events recorded yet" />
      ) : (
        <div className="divide-y divide-gray-100">
          {entries.map((entry, i) => (
            <div key={i} className="py-2 flex items-start gap-3">
              <span className="text-xs text-gray-400 font-mono whitespace-nowrap pt-0.5 w-40 shrink-0">
                {formatTime(entry.occurredAt)}
              </span>
              <Tag color={typeColor(entry.type)} className="shrink-0">
                {entry.type}
              </Tag>
              <div className="min-w-0">
                <div className="text-sm text-gray-800 break-words">{entry.message}</div>
                {entry.error ? (
                  <div className="text-sm text-rose-700 break-words mt-0.5">{entry.error}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
