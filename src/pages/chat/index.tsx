import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Select, Switch, message } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  SyncOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useSpace } from 'contexts/SpaceContext'
import { getTargetTags, type TargetTagDto } from 'pages/apis/targetTag'
import {
  runOpenClawDirectChat,
  streamOpenClawDirectChat,
  type OpenClawChatMessageDto,
  type OpenClawDirectChatRequest,
  type OpenClawDirectChatStreamEvent,
} from 'pages/apis/openClawChat'

type ConversationRole = 'user' | 'assistant'
type AssistantStatus = 'running' | 'succeeded' | 'failed'

interface ConversationMessage {
  id: string
  role: ConversationRole
  content: string
  createdAt: number
  requestId?: string
  machineId?: number
  machineName?: string
  model?: string
  finishReason?: string
  error?: string
  status?: AssistantStatus
}

interface ChatSession {
  id: string
  sessionKey: string
  targetTags: string[]
  messages: ConversationMessage[]
  streamingMode: boolean
  model: string
  temperatureText: string
  maxTokensText: string
  responseFormat: string
  userText: string
  modelOverride: string
  agentId: string
  channel: string
  timeoutText: string
  systemPrompt: string
  createdAt: number
  updatedAt: number
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function makeSessionKey() {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function createSession(): ChatSession {
  const now = Date.now()
  return {
    id: makeId('chat-session'),
    sessionKey: makeSessionKey(),
    targetTags: [],
    messages: [],
    streamingMode: true,
    model: 'openclaw',
    temperatureText: '',
    maxTokensText: '',
    responseFormat: '',
    userText: '',
    modelOverride: '',
    agentId: '',
    channel: '',
    timeoutText: '120',
    systemPrompt: 'You are a helpful assistant.',
    createdAt: now,
    updatedAt: now,
  }
}

function getSessionTitle(session: ChatSession) {
  const firstUserMessage = session.messages.find((item) => item.role === 'user' && item.content.trim())
  if (!firstUserMessage) return session.sessionKey
  const content = firstUserMessage.content.trim()
  return content.length > 36 ? `${content.slice(0, 36)}...` : content
}

function formatSessionTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toRequestMessages(session: ChatSession, messages: ConversationMessage[]): OpenClawChatMessageDto[] {
  const requestMessages: OpenClawChatMessageDto[] = []

  const systemPrompt = session.systemPrompt.trim()
  if (systemPrompt) requestMessages.push({ role: 'system', content: systemPrompt })

  messages.forEach((message) => {
    const content = message.content.trim()
    if (!content) return

    if (message.role === 'user') {
      requestMessages.push({ role: 'user', content })
      return
    }

    if (message.role === 'assistant' && message.status !== 'failed') {
      requestMessages.push({ role: 'assistant', content })
    }
  })

  if (requestMessages.length <= 50) return requestMessages

  const hasSystemMessage = requestMessages[0]?.role === 'system'
  if (!hasSystemMessage) return requestMessages.slice(-50)
  return [requestMessages[0], ...requestMessages.slice(-49)]
}

function StatusBadge({ status }: { status: AssistantStatus | undefined }) {
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5">
        <ExclamationCircleOutlined /> Failed
      </span>
    )
  }

  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
        <SyncOutlined spin /> Running
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
      <CheckCircleOutlined /> Succeeded
    </span>
  )
}

const OpenClawDirectChatPage: React.FC = () => {
  const { space } = useSpace()
  const [loadingTags, setLoadingTags] = useState(false)
  const [availableTags, setAvailableTags] = useState<TargetTagDto[]>([])

  const [sessions, setSessions] = useState<ChatSession[]>(() => [createSession()])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [inputText, setInputText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const streamAbortRef = useRef<AbortController | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null,
    [activeSessionId, sessions],
  )

  const targetTagOptions = useMemo(
    () => availableTags.map((tag) => ({ label: tag.name, value: tag.name })),
    [availableTags],
  )

  const summary = useMemo(() => {
    if (!activeSession) return { success: 0, failed: 0, running: 0 }

    const assistantMessages = activeSession.messages.filter((item) => item.role === 'assistant')
    return {
      success: assistantMessages.filter((item) => item.status === 'succeeded').length,
      failed: assistantMessages.filter((item) => item.status === 'failed').length,
      running: assistantMessages.filter((item) => item.status === 'running').length,
    }
  }, [activeSession])

  const activeMessageCount = activeSession?.messages.length ?? 0

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id)
    }
  }, [activeSessionId, sessions])

  useEffect(() => {
    let cancelled = false
    setLoadingTags(true)

    getTargetTags()
      .then((response) => {
        if (cancelled) return
        const tags = (response.targetTags ?? []).filter((tag) => tag.spaceId === space.id)
        tags.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
        setAvailableTags(tags)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to load target tags', error)
        message.warning('Failed to load target tags.')
        setAvailableTags([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTags(false)
      })

    return () => {
      cancelled = true
    }
  }, [space.id])

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!viewportRef.current) return
    viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' })
  }, [activeSessionId, activeMessageCount])

  const updateSession = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((previous) => previous.map((session) => (session.id === sessionId ? updater(session) : session)))
  }

  const updateActiveSession = (patch: Partial<ChatSession>) => {
    if (!activeSession) return
    updateSession(activeSession.id, (session) => ({ ...session, ...patch, updatedAt: Date.now() }))
  }

  const createNewSession = () => {
    const session = createSession()
    setSessions((previous) => [session, ...previous])
    setActiveSessionId(session.id)
    setInputText('')
  }

  const stopStreaming = () => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
  }

  const addAssistantMessages = (sessionId: string, messages: ConversationMessage[]) => {
    updateSession(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, ...messages],
      updatedAt: Date.now(),
    }))
  }

  const appendErrorMessage = (sessionId: string, requestId: string, text: string) => {
    addAssistantMessages(sessionId, [
      {
        id: makeId('assistant-message'),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        requestId,
        machineName: 'OpenClaw',
        error: text,
        status: 'failed',
      },
    ])
  }

  const upsertStreamEvent = (sessionId: string, requestId: string, event: OpenClawDirectChatStreamEvent) => {
    updateSession(sessionId, (session) => {
      const messages = [...session.messages]
      const machineId = Number.isFinite(event.machineId as number) ? Number(event.machineId) : undefined
      const machineName = (event.machineName ?? '').trim() || (machineId !== undefined ? `Machine #${machineId}` : 'OpenClaw')
      const existingIndex = messages.findIndex(
        (item) => {
          if (item.role !== 'assistant') return false
          if (item.requestId !== requestId) return false
          if (machineId !== undefined) return item.machineId === machineId
          return item.machineId === undefined && item.machineName === machineName
        },
      )

      const delta = event.delta || ''
      const status: AssistantStatus = event.error ? 'failed' : event.finishReason ? 'succeeded' : 'running'

      if (existingIndex < 0) {
        messages.push({
          id: makeId('assistant-message'),
          role: 'assistant',
          content: delta,
          createdAt: Date.now(),
          requestId,
          machineId,
          machineName,
          model: event.model || '',
          finishReason: event.finishReason || '',
          error: event.error || '',
          status,
        })
      } else {
        const current = messages[existingIndex]
        messages[existingIndex] = {
          ...current,
          machineName,
          content: `${current.content}${delta}`,
          model: event.model || current.model,
          finishReason: event.finishReason || current.finishReason,
          error: event.error || current.error,
          status,
        }
      }

      return {
        ...session,
        messages,
        updatedAt: Date.now(),
      }
    })
  }

  const finalizeRunningMessages = (sessionId: string, requestId: string) => {
    updateSession(sessionId, (session) => ({
      ...session,
      messages: session.messages.map((item) => {
        if (item.role !== 'assistant') return item
        if (item.requestId !== requestId) return item
        if (item.status !== 'running') return item
        return { ...item, status: 'succeeded' }
      }),
      updatedAt: Date.now(),
    }))
  }

  const buildRequest = (session: ChatSession, messages: ConversationMessage[]): OpenClawDirectChatRequest | null => {
    const timeout = Number(session.timeoutText)
    if (!Number.isFinite(timeout) || timeout <= 0) {
      message.warning('Timeout must be a positive number.')
      return null
    }

    const temperatureRaw = session.temperatureText.trim()
    const temperature = temperatureRaw ? Number(temperatureRaw) : NaN
    if (temperatureRaw && !Number.isFinite(temperature)) {
      message.warning('Temperature must be a valid number.')
      return null
    }

    const maxTokensRaw = session.maxTokensText.trim()
    const maxTokens = maxTokensRaw ? Number(maxTokensRaw) : NaN
    if (maxTokensRaw && (!Number.isFinite(maxTokens) || maxTokens <= 0)) {
      message.warning('Max tokens must be a positive number.')
      return null
    }

    const requestMessages = toRequestMessages(session, messages)
    if (requestMessages.filter((item) => item.role === 'user').length === 0) {
      message.warning('Please provide at least one user message.')
      return null
    }

    const request: OpenClawDirectChatRequest = {
      spaceId: space.id,
      targetTags: session.targetTags.length > 0 ? session.targetTags : null,
      messages: requestMessages,
      model: session.model.trim() || 'openclaw',
      stream: session.streamingMode,
      sessionKey: session.sessionKey.trim() || null,
      timeoutSeconds: Math.floor(timeout),
    }

    if (temperatureRaw) request.temperature = temperature
    if (maxTokensRaw) request.maxTokens = Math.floor(maxTokens)
    if (session.responseFormat.trim()) request.responseFormat = session.responseFormat.trim()
    if (session.userText.trim()) request.user = session.userText.trim()
    if (session.modelOverride.trim()) request.modelOverride = session.modelOverride.trim()
    if (session.agentId.trim()) request.agentId = session.agentId.trim()
    if (session.channel.trim()) request.channel = session.channel.trim()

    return request
  }

  const submitPrompt = async () => {
    if (!activeSession || submitting) return

    const content = inputText.trim()
    if (!content) {
      message.warning('Please enter a message.')
      return
    }

    const requestId = makeId('request')
    const userMessage: ConversationMessage = {
      id: makeId('user-message'),
      role: 'user',
      content,
      createdAt: Date.now(),
      requestId,
    }

    const sessionId = activeSession.id
    const nextMessages = [...activeSession.messages, userMessage]
    const request = buildRequest(activeSession, nextMessages)
    if (!request) return

    setInputText('')
    setSubmitting(true)

    updateSession(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, userMessage],
      updatedAt: Date.now(),
    }))

    try {
      if (activeSession.streamingMode) {
        let hasStreamEvents = false
        const controller = new AbortController()
        streamAbortRef.current = controller

        await streamOpenClawDirectChat(request, {
          signal: controller.signal,
          onEvent: (event) => {
            hasStreamEvents = true
            upsertStreamEvent(sessionId, requestId, event)
          },
        })

        streamAbortRef.current = null

        if (!hasStreamEvents) {
          appendErrorMessage(sessionId, requestId, 'No targets matched, or no target produced output.')
        } else {
          finalizeRunningMessages(sessionId, requestId)
        }
      } else {
        const response = await runOpenClawDirectChat(request)
        const results = response.results ?? []

        if (results.length === 0) {
          appendErrorMessage(sessionId, requestId, 'No targets matched, or no target produced output.')
        } else {
          const assistantMessages = results.map((result, index): ConversationMessage => {
            const succeeded = Boolean(result.succeeded)
            return {
              id: makeId('assistant-message'),
              role: 'assistant',
              content: succeeded ? result.content || '' : '',
              createdAt: Date.now() + index,
              requestId,
              machineId: result.machineId,
              machineName: result.machineName || `Machine #${result.machineId}`,
              model: result.model || '',
              finishReason: result.finishReason || '',
              error: succeeded ? '' : result.error || 'Request failed',
              status: succeeded ? 'succeeded' : 'failed',
            }
          })
          addAssistantMessages(sessionId, assistantMessages)
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        appendErrorMessage(sessionId, requestId, 'Streaming stopped.')
      } else {
        appendErrorMessage(sessionId, requestId, error?.message || 'Failed to execute OpenClaw chat.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!activeSession) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No session available.
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-132px)] flex items-center py-6">
      <div className="w-full max-w-[1700px] mx-auto">
        <div className="h-[84vh] max-h-[920px] min-h-[700px] flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <aside className="w-[320px] bg-white text-slate-700 border-r border-slate-200 flex flex-col">
            <div className="p-3 border-b border-slate-200">
            <Button type="primary" block icon={<PlusOutlined />} onClick={createNewSession} disabled={submitting}>
              New Chat
            </Button>
          </div>

            <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Session History</div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
              {sessions.map((session) => {
                const active = session.id === activeSession.id
                const title = getSessionTitle(session)
                const preview = session.messages[session.messages.length - 1]?.content || 'No messages yet'

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setActiveSessionId(session.id)}
                    disabled={submitting && !active}
                    className={[
                      'w-full text-left rounded-lg px-3 py-2 border transition',
                      active
                        ? 'bg-slate-100 border-slate-200 shadow-sm'
                        : 'bg-transparent border-transparent hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="text-[11px] text-slate-500 truncate">{session.sessionKey}</div>
                    <div className="text-sm font-medium text-slate-800 truncate mt-0.5">{title}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{preview}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{formatSessionTime(session.updatedAt)}</div>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="flex-1 min-w-0 flex">
            <main className="flex-1 min-w-0 h-full bg-white overflow-hidden flex flex-col">
              <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="w-full px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{activeSession.sessionKey}</div>
                      <div className="text-xs text-slate-500">
                        {activeSession.targetTags.length > 0 ? `${activeSession.targetTags.length} tags selected` : 'All enabled OpenClaw targets'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
                        <CheckCircleOutlined /> {summary.success}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5">
                        <ExclamationCircleOutlined /> {summary.failed}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
                        <SyncOutlined spin={summary.running > 0} /> {summary.running}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div ref={viewportRef} className="flex-1 overflow-y-auto">
                <div className="w-full px-6 py-6 space-y-4">
                  {activeSession.messages.length === 0 ? (
                    <div className="h-[280px] rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400">
                      <RobotOutlined className="text-2xl mb-2" />
                      <div className="text-sm">Start chatting with OpenClaw targets.</div>
                    </div>
                  ) : null}

                  {activeSession.messages.map((item) => {
                    if (item.role === 'user') {
                      return (
                        <div key={item.id} className="flex justify-end">
                          <div className="max-w-[76%] rounded-2xl rounded-br-md bg-slate-900 text-white px-4 py-3 shadow-sm">
                            <div className="text-[11px] text-slate-300 mb-1 inline-flex items-center gap-1">
                              <UserOutlined /> You
                            </div>
                            <div className="text-sm whitespace-pre-wrap break-words">{item.content}</div>
                          </div>
                        </div>
                      )
                    }

                    const failed = item.status === 'failed'

                    return (
                      <div key={item.id} className="flex justify-start">
                        <div className="flex items-start gap-3 max-w-[90%]">
                          <div className="h-8 w-8 shrink-0 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 mt-1">
                            <RobotOutlined />
                          </div>

                          <div
                            className={[
                              'rounded-2xl rounded-bl-md border px-4 py-3 shadow-sm',
                              failed ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200',
                            ].join(' ')}
                          >
                            <div className="flex items-center gap-2 mb-2 text-[11px]">
                              <span className="font-semibold text-slate-700">{item.machineName || 'OpenClaw'}</span>
                              <StatusBadge status={item.status} />
                            </div>

                            {failed ? (
                              <div className="text-sm text-rose-700 whitespace-pre-wrap break-words">{item.error || 'Request failed'}</div>
                            ) : (
                              <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                                {item.content || ''}
                                {item.status === 'running' && !item.content ? <span className="text-slate-400">Receiving tokens...</span> : null}
                              </div>
                            )}

                            <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                              {item.model ? <span>Model: {item.model}</span> : null}
                              {item.finishReason ? <span>Finish: {item.finishReason}</span> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white">
                <div className="w-full px-6 py-4">
                  <div className="bg-white px-1 py-1">
                    <Input.TextArea
                      value={inputText}
                      onChange={(event) => setInputText(event.target.value)}
                      autoSize={{ minRows: 1, maxRows: 6 }}
                      bordered={false}
                      placeholder="Message OpenClaw..."
                      onPressEnter={(event) => {
                        if (event.shiftKey) return
                        event.preventDefault()
                        void submitPrompt()
                      }}
                      disabled={submitting}
                    />

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-500">Enter to send, Shift + Enter for newline</div>

                      <div className="flex items-center gap-2">
                        {submitting && activeSession.streamingMode ? (
                          <Button onClick={stopStreaming} icon={<StopOutlined />}>
                            Stop
                          </Button>
                        ) : null}
                        <Button type="primary" icon={<SendOutlined />} onClick={() => void submitPrompt()} loading={submitting} disabled={!inputText.trim()}>
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>

            <aside className="w-[380px] border-l border-slate-200 bg-white flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide inline-flex items-center gap-1">
                  <SettingOutlined /> Parameters
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Routing</div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Target Tags</label>
                    <Select
                      mode="multiple"
                      allowClear
                      size="large"
                      className="w-full"
                      value={activeSession.targetTags}
                      onChange={(value) => updateActiveSession({ targetTags: value })}
                      options={targetTagOptions}
                      placeholder={loadingTags ? 'Loading tags...' : 'Target tags'}
                      loading={loadingTags}
                      maxTagCount={2}
                      maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <TagsOutlined />
                      <span>Streaming</span>
                    </span>
                    <Switch checked={activeSession.streamingMode} onChange={(checked) => updateActiveSession({ streamingMode: checked })} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Session & Model</div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Session Key</label>
                    <Input value={activeSession.sessionKey} onChange={(event) => updateActiveSession({ sessionKey: event.target.value })} placeholder="session key" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Model</label>
                    <Input value={activeSession.model} onChange={(event) => updateActiveSession({ model: event.target.value })} placeholder="openclaw" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Timeout (seconds)</label>
                    <Input value={activeSession.timeoutText} onChange={(event) => updateActiveSession({ timeoutText: event.target.value })} placeholder="120" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Temperature</label>
                    <Input value={activeSession.temperatureText} onChange={(event) => updateActiveSession({ temperatureText: event.target.value })} placeholder="0.7" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Max Tokens</label>
                    <Input value={activeSession.maxTokensText} onChange={(event) => updateActiveSession({ maxTokensText: event.target.value })} placeholder="1024" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Response Format</label>
                    <Input value={activeSession.responseFormat} onChange={(event) => updateActiveSession({ responseFormat: event.target.value })} placeholder="text / json_object" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Headers & Context</div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">User</label>
                    <Input value={activeSession.userText} onChange={(event) => updateActiveSession({ userText: event.target.value })} placeholder="admin" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Model Override</label>
                    <Input value={activeSession.modelOverride} onChange={(event) => updateActiveSession({ modelOverride: event.target.value })} placeholder="openai/gpt-4" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Agent ID</label>
                    <Input value={activeSession.agentId} onChange={(event) => updateActiveSession({ agentId: event.target.value })} placeholder="research" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Channel</label>
                    <Input value={activeSession.channel} onChange={(event) => updateActiveSession({ channel: event.target.value })} placeholder="slack" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">System Prompt</label>
                    <Input.TextArea value={activeSession.systemPrompt} onChange={(event) => updateActiveSession({ systemPrompt: event.target.value })} rows={4} placeholder="You are a helpful assistant." />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OpenClawDirectChatPage
