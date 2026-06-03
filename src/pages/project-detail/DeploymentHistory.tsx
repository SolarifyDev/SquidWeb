import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DownOutlined } from '@ant-design/icons'
import { getEvents, type EventDto } from 'pages/apis/events'
import { eventTone, formatEventMessage, parseEventReferences, type EventTone } from 'utils/eventMessage'

interface DeploymentHistoryProps {
  releaseId: number
  releaseVersion: string
  projectName: string
  basePath: string
}

const PAGE_SIZE = 30

const TONE_DOT: Record<EventTone, string> = {
  success: '#00874d',
  failure: '#ef4444',
  warning: '#f97316',
  neutral: '#6b7280',
  info: '#3b82f6',
}

function formatHistoryDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  })
}

export default function DeploymentHistory({ releaseId, releaseVersion, projectName, basePath }: DeploymentHistoryProps) {
  const [events, setEvents] = useState<EventDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!Number.isFinite(releaseId)) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setEvents([])
    setCursor(null)
    setHasMore(false)
    setExpanded({})

    getEvents({ releaseId, take: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return
        setEvents(page.events ?? [])
        setCursor(page.nextCursor ?? null)
        setHasMore(Boolean(page.hasMore))
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load deployment history')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [releaseId])

  function loadMore() {
    if (loading || cursor == null) return

    setLoading(true)
    getEvents({ releaseId, take: PAGE_SIZE, beforeId: cursor })
      .then((page) => {
        setEvents((previous) => [...previous, ...(page.events ?? [])])
        setCursor(page.nextCursor ?? null)
        setHasMore(Boolean(page.hasMore))
      })
      .catch((err) => setError(err?.message || 'Failed to load deployment history'))
      .finally(() => setLoading(false))
  }

  function toggle(key: string) {
    setExpanded((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  const releasePath = `${basePath}/releases/${encodeURIComponent(releaseVersion)}?releaseId=${releaseId}`

  return (
    <div className="border border-slate-200 border-t-0 rounded-b-lg bg-white mb-6">
      {error ? (
        <div className="px-5 py-5 text-sm text-red-600">{error}</div>
      ) : events.length === 0 && !loading ? (
        <div className="px-5 py-5 text-sm text-slate-500">No history available for this release.</div>
      ) : (
        <ul className="list-none m-0 p-0">
          {events.map((event, index) => {
            const key = String(event.id)
            const isExpanded = Boolean(expanded[key])
            const references = parseEventReferences(event.referencesJson)
            const actor = event.username || 'system'
            const deploymentPath = event.deploymentId != null
              ? `${basePath}/releases/${encodeURIComponent(releaseVersion)}/deployments/${event.deploymentId}`
              : null

            return (
              <li key={key} className={index === events.length - 1 ? '' : 'border-b border-slate-200'}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  className="grid cursor-pointer grid-cols-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 md:grid-cols-[47%_33%_16%_36px]"
                  onClick={() => toggle(key)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    toggle(key)
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: TONE_DOT[eventTone(event.category)] }}
                    />
                    <span className="min-w-0 break-words">{formatEventMessage(event)}</span>
                  </div>

                  <div className="whitespace-nowrap text-sm text-slate-500 md:text-left">
                    {formatHistoryDateTime(event.occurred)}
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-sm text-slate-600" title={event.establishedWithName}>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                      {actor.charAt(0).toUpperCase()}
                    </span>
                    <span>{actor}</span>
                  </div>

                  <div className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500">
                    <DownOutlined className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  </div>
                </div>

                {isExpanded ? (
                  <div className="px-4 pb-3">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <p className="m-0">Event: {event.categoryName}</p>
                      <p className="m-0 mt-1">Established with: {event.establishedWithName || 'Server'}</p>
                      {event.userAgent ? <p className="m-0 mt-1 break-all">User agent: {event.userAgent}</p> : null}
                      {Object.keys(references).length > 0 ? (
                        <p className="m-0 mt-1 break-words">
                          References: {Object.entries(references).map(([k, v]) => `${k}=${v}`).join(', ')}
                        </p>
                      ) : null}
                      <p className="m-0 mt-2 flex flex-wrap gap-3">
                        {deploymentPath ? (
                          <Link to={deploymentPath} className="text-squid-blue hover:underline">View deployment</Link>
                        ) : null}
                        <Link to={releasePath} className="text-squid-blue hover:underline">View release</Link>
                        <Link to={basePath} className="text-squid-blue hover:underline">{projectName}</Link>
                      </p>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {hasMore ? (
        <div className="border-t border-slate-200 px-4 py-3 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={loadMore}
            className="text-sm text-squid-blue hover:underline disabled:cursor-default disabled:text-slate-400"
          >
            {loading ? 'Loading…' : 'Load older events'}
          </button>
        </div>
      ) : loading && events.length > 0 ? (
        <div className="px-4 py-3 text-center text-sm text-slate-400">Loading…</div>
      ) : null}
    </div>
  )
}
