import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { AutoComplete, Input, Radio, Select, message } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import {
  createDeploymentStep,
  getTargetRoles,
  updateDeploymentStep,
  type DeploymentActionDto,
  type DeploymentActionPropertyDto,
  type DeploymentStepDto,
  type DeploymentStepPropertyDto,
} from 'pages/apis/deploymentProcess'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { StepConditionsSection, type StepConditionsValue, type StepEnvironmentMode } from '../shared/StepConditionsSection'
import { TargetTagSelect } from '../shared/TargetTagSelect'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'
const TARGET_ROLE_PROPERTY_NAMES = ['Squid.Action.TargetRoles', 'TargetRoles'] as const
const OPENCLAW_PROPERTY_PREFIX = 'Squid.Action.OpenClaw.'

const OpenClawActionTypes = {
  invokeTool: 'Squid.OpenClaw.InvokeTool',
  chatCompletion: 'Squid.OpenClaw.ChatCompletion',
  runAgent: 'Squid.OpenClaw.RunAgent',
  wake: 'Squid.OpenClaw.Wake',
  waitSession: 'Squid.OpenClaw.WaitSession',
  assert: 'Squid.OpenClaw.Assert',
  fetchResult: 'Squid.OpenClaw.FetchResult',
} as const

type OpenClawActionType = (typeof OpenClawActionTypes)[keyof typeof OpenClawActionTypes]
type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'
type ChatInputMode = 'simple' | 'advanced'
type AssertOperator =
  | 'equals'
  | 'equalsIgnoreCase'
  | 'contains'
  | 'matches'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'

interface OpenClawActionDefinition {
  defaultStepName: string
  stepTypeLabel: string
  description: string
}

const OpenClawActionDefinitions: Record<OpenClawActionType, OpenClawActionDefinition> = {
  'Squid.OpenClaw.InvokeTool': {
    defaultStepName: 'Invoke OpenClaw Tool',
    stepTypeLabel: 'OpenClaw Invoke Tool',
    description: 'Call an OpenClaw tool through gateway /tools/invoke.',
  },
  'Squid.OpenClaw.ChatCompletion': {
    defaultStepName: 'OpenClaw Chat Completion',
    stepTypeLabel: 'OpenClaw Chat Completion',
    description: 'Run OpenClaw chat completion using prompt or messages JSON.',
  },
  'Squid.OpenClaw.RunAgent': {
    defaultStepName: 'Run OpenClaw Agent',
    stepTypeLabel: 'OpenClaw Run Agent',
    description: 'Send a command to an isolated OpenClaw agent via /hooks/agent.',
  },
  'Squid.OpenClaw.Wake': {
    defaultStepName: 'Wake OpenClaw Session',
    stepTypeLabel: 'OpenClaw Wake Session',
    description: 'Wake a session using OpenClaw hooks /hooks/wake.',
  },
  'Squid.OpenClaw.WaitSession': {
    defaultStepName: 'Wait OpenClaw Session',
    stepTypeLabel: 'OpenClaw Wait Session',
    description: 'Poll OpenClaw session status via sessions_list until complete.',
  },
  'Squid.OpenClaw.Assert': {
    defaultStepName: 'Assert OpenClaw Result',
    stepTypeLabel: 'OpenClaw Assert',
    description: 'Assert values from OpenClaw output variables.',
  },
  'Squid.OpenClaw.FetchResult': {
    defaultStepName: 'Fetch OpenClaw Result',
    stepTypeLabel: 'OpenClaw Fetch Result',
    description: 'Extract JSON fields from OpenClaw outputs into variables.',
  },
}

const OpenClawProperties = {
  tool: 'Squid.Action.OpenClaw.Tool',
  toolAction: 'Squid.Action.OpenClaw.ToolAction',
  argsJson: 'Squid.Action.OpenClaw.ArgsJson',
  prompt: 'Squid.Action.OpenClaw.Prompt',
  systemPrompt: 'Squid.Action.OpenClaw.SystemPrompt',
  messagesJson: 'Squid.Action.OpenClaw.MessagesJson',
  model: 'Squid.Action.OpenClaw.Model',
  sessionKey: 'Squid.Action.OpenClaw.SessionKey',
  timeoutSeconds: 'Squid.Action.OpenClaw.TimeoutSeconds',
  user: 'Squid.Action.OpenClaw.User',
  message: 'Squid.Action.OpenClaw.Message',
  agentId: 'Squid.Action.OpenClaw.AgentId',
  wakeMode: 'Squid.Action.OpenClaw.WakeMode',
  deliver: 'Squid.Action.OpenClaw.Deliver',
  channel: 'Squid.Action.OpenClaw.Channel',
  to: 'Squid.Action.OpenClaw.To',
  wakeText: 'Squid.Action.OpenClaw.WakeText',
  successPattern: 'Squid.Action.OpenClaw.SuccessPattern',
  failPattern: 'Squid.Action.OpenClaw.FailPattern',
  maxWaitSeconds: 'Squid.Action.OpenClaw.MaxWaitSeconds',
  pollSeconds: 'Squid.Action.OpenClaw.PollSeconds',
  jsonPath: 'Squid.Action.OpenClaw.JsonPath',
  operator: 'Squid.Action.OpenClaw.Operator',
  expected: 'Squid.Action.OpenClaw.Expected',
  sourceVariable: 'Squid.Action.OpenClaw.SourceVariable',
  fieldMappings: 'Squid.Action.OpenClaw.FieldMappings',
} as const

interface InvokeToolPreset {
  group: string
  value: string
  description: string
  exampleArgs: string
}

const InvokeToolPresets: InvokeToolPreset[] = [
  { group: 'Execution', value: 'exec', description: 'Run shell commands', exampleArgs: '{"command":"echo hello","workdir":"/workspace","timeout":30}' },
  { group: 'Execution', value: 'code_execution', description: 'Run code in sandbox', exampleArgs: '{"code":"print(\\"hello\\")","language":"python"}' },
  { group: 'Web', value: 'web_search', description: 'Search the web', exampleArgs: '{"query":"openclaw"}' },
  { group: 'Web', value: 'web_fetch', description: 'Fetch URL content', exampleArgs: '{"url":"https://example.com"}' },
  { group: 'Web', value: 'browser', description: 'Browser operation', exampleArgs: '{"url":"https://example.com","action":"screenshot"}' },
  { group: 'Sessions', value: 'sessions_list', description: 'List sessions', exampleArgs: '{"limit":10}' },
  { group: 'Sessions', value: 'sessions_history', description: 'Get session history', exampleArgs: '{"sessionKey":"main"}' },
  { group: 'Sessions', value: 'sessions_send', description: 'Send message to session', exampleArgs: '{"target":"main","message":"hello"}' },
  { group: 'Sessions', value: 'agents_list', description: 'List agents', exampleArgs: '{}' },
  { group: 'Files', value: 'read', description: 'Read file', exampleArgs: '{"path":"README.md"}' },
  { group: 'Files', value: 'write', description: 'Write file', exampleArgs: '{"path":"output.txt","content":"hello"}' },
  { group: 'Files', value: 'edit', description: 'Edit file content', exampleArgs: '{"path":"file.txt","find":"old","replace":"new"}' },
  { group: 'Files', value: 'grep', description: 'Search in files', exampleArgs: '{"pattern":"TODO","path":"src"}' },
  { group: 'Communication', value: 'message', description: 'Send communication message', exampleArgs: '{"to":"team-channel","content":"hello"}' },
  { group: 'Media', value: 'image', description: 'Generate image', exampleArgs: '{"prompt":"a red lobster"}' },
  { group: 'Media', value: 'tts', description: 'Text to speech', exampleArgs: '{"text":"hello world"}' },
]

const InvokeToolPresetMap = new Map<string, InvokeToolPreset>(
  InvokeToolPresets.map((item) => [item.value.toLowerCase(), item]),
)

function normalizeInvokeTool(tool: string): string {
  return tool.trim().toLowerCase()
}

interface OpenClawActionEditorProps extends StepEditorProps {
  actionType: OpenClawActionType
}

function getActionProperty(action: DeploymentActionDto | undefined, name: string): string {
  if (!action) return ''
  return action.properties.find((property) => property.propertyName === name)?.propertyValue ?? ''
}

function getStepProperty(stepProperties: DeploymentStepPropertyDto[] | undefined, names: readonly string[]): string {
  if (!stepProperties) return ''
  for (const name of names) {
    const value = stepProperties.find((property) => property.propertyName === name)?.propertyValue
    if (value != null) return value
  }
  return ''
}

function normalizeBoolean(value: string | undefined): boolean {
  if (!value?.trim()) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function validateJsonIfProvided(value: string): boolean {
  if (!value.trim()) return true
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  runCondition: string,
  conditionExpression: string,
  targetTags: string[],
): DeploymentStepPropertyDto[] {
  const filtered = (existingStepProperties ?? []).filter(
    (property) => property.propertyName !== STEP_CONDITION_EXPRESSION_PROPERTY
      && !TARGET_ROLE_PROPERTY_NAMES.includes(property.propertyName as (typeof TARGET_ROLE_PROPERTY_NAMES)[number]),
  )
  const next: DeploymentStepPropertyDto[] = [...filtered]

  if (targetTags.length > 0) {
    next.push({
      id: 0,
      stepId,
      propertyName: TARGET_ROLE_PROPERTY_NAMES[0],
      propertyValue: targetTags.join(','),
    })
  }

  if (runCondition === 'Variable' && conditionExpression.trim()) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_CONDITION_EXPRESSION_PROPERTY,
      propertyValue: conditionExpression.trim(),
    })
  }

  return next
}

function pushActionProperty(
  list: DeploymentActionPropertyDto[],
  actionId: number,
  propertyName: string,
  propertyValue: string,
  allowEmpty = false,
) {
  if (!allowEmpty && propertyValue.trim() === '') return
  list.push({ id: 0, actionId, propertyName, propertyValue })
}

function buildActionProperties(
  actionType: OpenClawActionType,
  existingAction: DeploymentActionDto | undefined,
  values: {
    tool: string
    toolAction: string
    argsJson: string
    prompt: string
    systemPrompt: string
    messagesJson: string
    model: string
    sessionKey: string
    timeoutSeconds: string
    user: string
    messageBody: string
    agentId: string
    wakeMode: string
    deliver: string
    channel: string
    to: string
    wakeText: string
    successPattern: string
    failPattern: string
    maxWaitSeconds: string
    pollSeconds: string
    jsonPath: string
    assertOperator: AssertOperator
    expected: string
    sourceVariable: string
    fieldMappings: string
  },
): DeploymentActionPropertyDto[] {
  const preserved = (existingAction?.properties ?? []).filter(
    (property) => !property.propertyName.startsWith(OPENCLAW_PROPERTY_PREFIX),
  )
  const actionId = existingAction?.id ?? 0
  const next: DeploymentActionPropertyDto[] = [...preserved]

  if (actionType === OpenClawActionTypes.invokeTool) {
    pushActionProperty(next, actionId, OpenClawProperties.tool, values.tool)
    pushActionProperty(next, actionId, OpenClawProperties.toolAction, values.toolAction)
    pushActionProperty(next, actionId, OpenClawProperties.argsJson, values.argsJson)
    pushActionProperty(next, actionId, OpenClawProperties.sessionKey, values.sessionKey)
    pushActionProperty(next, actionId, OpenClawProperties.timeoutSeconds, values.timeoutSeconds)
    return next
  }

  if (actionType === OpenClawActionTypes.chatCompletion) {
    pushActionProperty(next, actionId, OpenClawProperties.prompt, values.prompt)
    pushActionProperty(next, actionId, OpenClawProperties.systemPrompt, values.systemPrompt)
    pushActionProperty(next, actionId, OpenClawProperties.messagesJson, values.messagesJson)
    pushActionProperty(next, actionId, OpenClawProperties.model, values.model)
    pushActionProperty(next, actionId, OpenClawProperties.agentId, values.agentId)
    pushActionProperty(next, actionId, OpenClawProperties.sessionKey, values.sessionKey)
    pushActionProperty(next, actionId, OpenClawProperties.channel, values.channel)
    pushActionProperty(next, actionId, OpenClawProperties.user, values.user)
    pushActionProperty(next, actionId, OpenClawProperties.timeoutSeconds, values.timeoutSeconds)
    return next
  }

  if (actionType === OpenClawActionTypes.runAgent) {
    pushActionProperty(next, actionId, OpenClawProperties.message, values.messageBody)
    pushActionProperty(next, actionId, OpenClawProperties.agentId, values.agentId)
    pushActionProperty(next, actionId, OpenClawProperties.sessionKey, values.sessionKey)
    pushActionProperty(next, actionId, OpenClawProperties.wakeMode, values.wakeMode)
    pushActionProperty(next, actionId, OpenClawProperties.deliver, values.deliver)
    pushActionProperty(next, actionId, OpenClawProperties.channel, values.channel)
    pushActionProperty(next, actionId, OpenClawProperties.to, values.to)
    pushActionProperty(next, actionId, OpenClawProperties.timeoutSeconds, values.timeoutSeconds)
    return next
  }

  if (actionType === OpenClawActionTypes.wake) {
    pushActionProperty(next, actionId, OpenClawProperties.wakeText, values.wakeText)
    pushActionProperty(next, actionId, OpenClawProperties.wakeMode, values.wakeMode)
    pushActionProperty(next, actionId, OpenClawProperties.timeoutSeconds, values.timeoutSeconds)
    return next
  }

  if (actionType === OpenClawActionTypes.waitSession) {
    pushActionProperty(next, actionId, OpenClawProperties.sessionKey, values.sessionKey)
    pushActionProperty(next, actionId, OpenClawProperties.successPattern, values.successPattern)
    pushActionProperty(next, actionId, OpenClawProperties.failPattern, values.failPattern)
    pushActionProperty(next, actionId, OpenClawProperties.maxWaitSeconds, values.maxWaitSeconds)
    pushActionProperty(next, actionId, OpenClawProperties.pollSeconds, values.pollSeconds)
    return next
  }

  if (actionType === OpenClawActionTypes.assert) {
    pushActionProperty(next, actionId, OpenClawProperties.jsonPath, values.jsonPath)
    pushActionProperty(next, actionId, OpenClawProperties.operator, values.assertOperator)
    pushActionProperty(next, actionId, OpenClawProperties.expected, values.expected)
    pushActionProperty(next, actionId, OpenClawProperties.sourceVariable, values.sourceVariable)
    return next
  }

  pushActionProperty(next, actionId, OpenClawProperties.sourceVariable, values.sourceVariable)
  pushActionProperty(next, actionId, OpenClawProperties.fieldMappings, values.fieldMappings)
  return next
}

const OpenClawActionEditorInternal = forwardRef<StepEditorHandle, OpenClawActionEditorProps>(
  function OpenClawActionEditorInternal({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange, actionType }, ref) {
    const action = step?.actions[0]
    const actionDefinition = OpenClawActionDefinitions[actionType]
    const includeEnvironments = action?.environments ?? []
    const excludeEnvironments = action?.excludedEnvironments ?? []
    const initialEnvironmentMode: StepEnvironmentMode = excludeEnvironments.length > 0
      ? 'exclude'
      : includeEnvironments.length > 0
        ? 'include'
        : 'all'

    const [stepName, setStepName] = useState(step?.name ?? actionDefinition.defaultStepName)
    const [targetTags, setTargetTags] = useState<string[]>(step ? getTargetRoles(step) : [])
    const [startTrigger, setStartTrigger] = useState<StartTriggerMode>(
      step?.startTrigger === 'StartWithPrevious' ? 'StartWithPrevious' : 'StartAfterPrevious',
    )
    const [conditions, setConditions] = useState<StepConditionsValue>({
      environmentMode: initialEnvironmentMode,
      environmentIds: initialEnvironmentMode === 'exclude' ? excludeEnvironments : includeEnvironments,
      channelIds: action?.channels ?? [],
      runCondition: step?.condition ?? 'Success',
      conditionExpression: getStepProperty(step?.properties, [STEP_CONDITION_EXPRESSION_PROPERTY]),
      packageRequirement: step?.packageRequirement ?? 'LetSquidDecide',
      required: step?.isRequired ?? false,
      disabled: step?.isDisabled ?? false,
    })

    const initialTool = getActionProperty(action, OpenClawProperties.tool)
    const initialArgsJson = getActionProperty(action, OpenClawProperties.argsJson)

    const [tool, setTool] = useState(initialTool)
    const [toolAction, setToolAction] = useState(getActionProperty(action, OpenClawProperties.toolAction) || 'json')
    const [argsJson, setArgsJson] = useState(initialArgsJson)
    const initialMessagesJson = getActionProperty(action, OpenClawProperties.messagesJson)
    const defaultSessionKey = actionType === OpenClawActionTypes.invokeTool || actionType === OpenClawActionTypes.chatCompletion
      ? 'main'
      : ''
    const [chatInputMode, setChatInputMode] = useState<ChatInputMode>(initialMessagesJson.trim() ? 'advanced' : 'simple')
    const [prompt, setPrompt] = useState(getActionProperty(action, OpenClawProperties.prompt))
    const [systemPrompt, setSystemPrompt] = useState(getActionProperty(action, OpenClawProperties.systemPrompt))
    const [messagesJson, setMessagesJson] = useState(initialMessagesJson)
    const [model, setModel] = useState(getActionProperty(action, OpenClawProperties.model))
    const [sessionKey, setSessionKey] = useState(getActionProperty(action, OpenClawProperties.sessionKey) || defaultSessionKey)
    const [timeoutSeconds, setTimeoutSeconds] = useState(getActionProperty(action, OpenClawProperties.timeoutSeconds) || '30')
    const [chatUser, setChatUser] = useState(getActionProperty(action, OpenClawProperties.user))
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const [invokeFieldErrors, setInvokeFieldErrors] = useState<Record<string, string>>({})
    const [chatFieldErrors, setChatFieldErrors] = useState<Record<string, string>>({})
    const [messageBody, setMessageBody] = useState(getActionProperty(action, OpenClawProperties.message))
    const [agentId, setAgentId] = useState(getActionProperty(action, OpenClawProperties.agentId))
    const [wakeMode, setWakeMode] = useState(
      getActionProperty(action, OpenClawProperties.wakeMode) || (actionType === OpenClawActionTypes.wake ? 'now' : ''),
    )
    const [deliver, setDeliver] = useState(getActionProperty(action, OpenClawProperties.deliver))
    const [channel, setChannel] = useState(getActionProperty(action, OpenClawProperties.channel))
    const [to, setTo] = useState(getActionProperty(action, OpenClawProperties.to))
    const [wakeText, setWakeText] = useState(getActionProperty(action, OpenClawProperties.wakeText))
    const [successPattern, setSuccessPattern] = useState(getActionProperty(action, OpenClawProperties.successPattern))
    const [failPattern, setFailPattern] = useState(getActionProperty(action, OpenClawProperties.failPattern))
    const [maxWaitSeconds, setMaxWaitSeconds] = useState(getActionProperty(action, OpenClawProperties.maxWaitSeconds) || '120')
    const [pollSeconds, setPollSeconds] = useState(getActionProperty(action, OpenClawProperties.pollSeconds) || '5')
    const [jsonPath, setJsonPath] = useState(getActionProperty(action, OpenClawProperties.jsonPath))
    const [assertOperator, setAssertOperator] = useState<AssertOperator>(
      (getActionProperty(action, OpenClawProperties.operator) as AssertOperator) || 'equals',
    )
    const [expected, setExpected] = useState(getActionProperty(action, OpenClawProperties.expected))
    const [sourceVariable, setSourceVariable] = useState(getActionProperty(action, OpenClawProperties.sourceVariable) || 'OpenClaw.ResultJson')
    const [fieldMappings, setFieldMappings] = useState(getActionProperty(action, OpenClawProperties.fieldMappings))

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      if (targetTags.length === 0) {
        message.warning('Target tags are required')
        return
      }

      setInvokeFieldErrors({})
      setChatFieldErrors({})
      const invokeToolAction = toolAction.trim() || 'json'
      let computedChatPrompt = ''
      let computedChatSystemPrompt = ''
      let computedChatMessagesJson = ''

      let computedInvokeArgsJson = ''

      if (actionType === OpenClawActionTypes.invokeTool) {
        const nextInvokeErrors: Record<string, string> = {}
        const setInvokeError = (key: string, value: string) => {
          if (!nextInvokeErrors[key]) nextInvokeErrors[key] = value
        }

        if (!tool.trim()) {
          setInvokeError('tool', 'Tool is required')
        }

        const parsedTimeout = parsePositiveInteger(timeoutSeconds)
        if (parsedTimeout == null || parsedTimeout > 300) {
          setInvokeError('timeoutSeconds', 'Timeout must be an integer between 1 and 300 seconds')
        }

        if (!validateJsonIfProvided(argsJson)) {
          setInvokeError('argsJson', 'Arguments JSON must be valid JSON')
        }
        computedInvokeArgsJson = argsJson.trim()

        if (Object.keys(nextInvokeErrors).length > 0) {
          setInvokeFieldErrors(nextInvokeErrors)
          message.warning('Please fix highlighted OpenClaw fields')
          return
        }
      }

      if (actionType === OpenClawActionTypes.chatCompletion) {
        const nextChatErrors: Record<string, string> = {}
        const setChatError = (key: string, value: string) => {
          if (!nextChatErrors[key]) nextChatErrors[key] = value
        }
        const parsedTimeout = parsePositiveInteger(timeoutSeconds)
        if (parsedTimeout == null || parsedTimeout > 300) {
          setChatError('timeoutSeconds', 'Timeout must be an integer between 1 and 300 seconds')
        }

        if (chatInputMode === 'advanced') {
          if (!messagesJson.trim()) {
            setChatError('messagesJson', 'Messages JSON is required in advanced mode')
          } else {
            try {
              const parsed = JSON.parse(messagesJson)
              if (!Array.isArray(parsed)) {
                setChatError('messagesJson', 'Messages JSON must be a JSON array')
              }
            } catch {
              setChatError('messagesJson', 'Messages JSON must be valid JSON')
            }
          }
          computedChatMessagesJson = messagesJson.trim()
          computedChatPrompt = ''
          computedChatSystemPrompt = ''
        } else {
          if (!prompt.trim()) setChatError('prompt', 'Prompt is required in simple mode')
          computedChatPrompt = prompt.trim()
          computedChatSystemPrompt = systemPrompt.trim()
          computedChatMessagesJson = ''
        }

        if (Object.keys(nextChatErrors).length > 0) {
          setChatFieldErrors(nextChatErrors)
          message.warning('Please fix highlighted OpenClaw fields')
          return
        }
      }

      const invokeArgsJson = actionType === OpenClawActionTypes.invokeTool
        ? computedInvokeArgsJson
        : ''

      if (actionType === OpenClawActionTypes.invokeTool && !tool.trim()) {
        message.warning('Tool is required')
        return
      }

      if (actionType === OpenClawActionTypes.runAgent && !messageBody.trim()) {
        message.warning('Message is required')
        return
      }

      if (
        (actionType === OpenClawActionTypes.runAgent
          || actionType === OpenClawActionTypes.wake)
        && parsePositiveInteger(timeoutSeconds) == null
      ) {
        message.warning('Timeout seconds must be a positive integer')
        return
      }

      if (actionType === OpenClawActionTypes.waitSession) {
        if (parsePositiveInteger(maxWaitSeconds) == null) {
          message.warning('Max wait seconds must be a positive integer')
          return
        }
        if (parsePositiveInteger(pollSeconds) == null) {
          message.warning('Poll seconds must be a positive integer')
          return
        }
      }

      if (actionType === OpenClawActionTypes.assert && !jsonPath.trim()) {
        message.warning('Json path is required')
        return
      }

      if (actionType === OpenClawActionTypes.fetchResult && fieldMappings.trim()) {
        try {
          const parsed = JSON.parse(fieldMappings)
          if (!Array.isArray(parsed)) {
            message.warning('Field mappings must be a JSON array')
            return
          }
        } catch {
          message.warning('Field mappings must be valid JSON')
          return
        }
      }

      const actionProperties = buildActionProperties(actionType, action, {
        tool,
        toolAction: invokeToolAction,
        argsJson: invokeArgsJson,
        prompt: computedChatPrompt,
        systemPrompt: computedChatSystemPrompt,
        messagesJson: computedChatMessagesJson,
        model: model.trim(),
        sessionKey,
        timeoutSeconds,
        user: chatUser.trim(),
        messageBody,
        agentId,
        wakeMode,
        deliver,
        channel,
        to,
        wakeText,
        successPattern,
        failPattern,
        maxWaitSeconds,
        pollSeconds,
        jsonPath,
        assertOperator,
        expected,
        sourceVariable,
        fieldMappings,
      })

      const stepProperties = buildStepProperties(
        step?.properties,
        step?.id ?? 0,
        conditions.runCondition,
        conditions.conditionExpression,
        targetTags,
      )

      const actionEnvironments = conditions.environmentMode === 'include' ? conditions.environmentIds : []
      const actionExcludedEnvironments = conditions.environmentMode === 'exclude' ? conditions.environmentIds : []

      const nextAction: DeploymentActionDto = {
        id: action?.id ?? 0,
        stepId: step?.id ?? 0,
        actionOrder: action?.actionOrder ?? 0,
        name: normalizedStepName,
        actionType,
        workerPoolId: action?.workerPoolId ?? null,
        isDisabled: conditions.disabled,
        isRequired: conditions.required,
        canBeUsedForProjectVersioning: action?.canBeUsedForProjectVersioning ?? false,
        createdAt: action?.createdAt ?? new Date().toISOString(),
        properties: actionProperties,
        environments: actionEnvironments,
        excludedEnvironments: actionExcludedEnvironments,
        channels: conditions.channelIds,
      }

      const nextStep: DeploymentStepDto = {
        id: step?.id ?? 0,
        processId,
        stepOrder: step?.stepOrder ?? 0,
        name: normalizedStepName,
        stepType: step?.stepType ?? 'Action',
        condition: conditions.runCondition,
        startTrigger,
        packageRequirement: conditions.packageRequirement,
        isDisabled: conditions.disabled,
        isRequired: conditions.required,
        createdAt: step?.createdAt ?? new Date().toISOString(),
        properties: stepProperties,
        actions: [nextAction],
      }

      try {
        const saved = step
          ? await updateDeploymentStep({ id: step.id, step: nextStep })
          : await createDeploymentStep({ processId, step: nextStep })
        message.success(step ? 'Step updated' : 'Step created')
        onSave(saved)
      } catch {
        message.error('Failed to save step')
      }
    }

    useImperativeHandle(ref, () => ({ save: handleSave }), [
      stepName,
      targetTags,
      startTrigger,
      conditions,
      tool,
      toolAction,
      argsJson,
      chatInputMode,
      prompt,
      systemPrompt,
      messagesJson,
      model,
      sessionKey,
      timeoutSeconds,
      chatUser,
      messageBody,
      agentId,
      wakeMode,
      deliver,
      channel,
      to,
      wakeText,
      successPattern,
      failPattern,
      maxWaitSeconds,
      pollSeconds,
      jsonPath,
      assertOperator,
      expected,
      sourceVariable,
      fieldMappings,
      step,
      processId,
      actionType,
    ])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${actionType}/logo`
    const displayName = stepName.trim() || actionDefinition.defaultStepName
    const normalizedInvokeTool = normalizeInvokeTool(tool)
    const selectedInvokePreset = normalizedInvokeTool ? InvokeToolPresetMap.get(normalizedInvokeTool) : undefined
    const invokeToolOptions = InvokeToolPresets.map((preset) => ({
      value: preset.value,
      label: (
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-slate-700">[{preset.group}] {preset.value}</span>
          <span className="text-xs text-slate-400">{preset.description}</span>
        </div>
      ),
    }))

    const copyOutputVariable = async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        message.success('Output variable copied')
      } catch {
        message.error('Failed to copy output variable')
      }
    }

    const renderInvokeError = (key: string) => {
      const text = invokeFieldErrors[key]
      if (!text) return null
      return <p className="mt-1 mb-0 text-xs text-red-600">{text}</p>
    }

    const renderChatError = (key: string) => {
      const text = chatFieldErrors[key]
      if (!text) return null
      return <p className="mt-1 mb-0 text-xs text-red-600">{text}</p>
    }

    const renderRawJsonEditor = (
      value: string,
      onChange: (nextValue: string) => void,
      placeholder: string,
      height = '220px',
      hasError = false,
    ) => (
      <div className={`rounded-md border bg-white overflow-hidden ${hasError ? 'border-red-500' : 'border-slate-300'}`}>
        <CodeMirror
          value={value}
          onChange={(nextValue) => onChange(nextValue)}
          extensions={[json()]}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            indentOnInput: true,
          }}
          placeholder={placeholder}
          height={height}
          className="openclaw-json-codemirror"
        />
      </div>
    )

    const renderActionSection = () => {
      if (actionType === OpenClawActionTypes.invokeTool) {
        const argsPlaceholder = selectedInvokePreset?.exampleArgs || '{"command":"echo hello","timeout":30}'
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tool *</label>
              <AutoComplete
                size="small"
                className="w-full"
                value={tool}
                options={invokeToolOptions}
                onSelect={(value) => setTool(String(value))}
                onChange={(value) => setTool(String(value))}
                filterOption={false}
                placeholder="Select tool (or type custom plugin tool)"
              />
              <p className="mt-3 mb-0 text-xs leading-5 text-slate-500">Choose a known tool or type a custom tool name.</p>
              {renderInvokeError('tool')}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Session key</label>
              <Input
                size="small"
                value={sessionKey}
                onChange={(event) => setSessionKey(event.target.value)}
                placeholder="main"
              />
              <p className="mt-2 mb-0 text-xs text-slate-500">Default is <code>main</code>. Keep empty to inherit endpoint default.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Timeout (seconds)</label>
              <Input
                size="small"
                status={invokeFieldErrors.timeoutSeconds ? 'error' : ''}
                value={timeoutSeconds}
                onChange={(event) => setTimeoutSeconds(event.target.value)}
                placeholder="30"
              />
              {renderInvokeError('timeoutSeconds')}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Arguments (JSON)</label>
              {renderRawJsonEditor(
                argsJson,
                setArgsJson,
                argsPlaceholder,
                '260px',
                !!invokeFieldErrors.argsJson,
              )}
              {renderInvokeError('argsJson')}
              <p className="mt-2 mb-0 text-xs leading-5 text-slate-500">Supports variable replacement such as <code>{'#{Namespace}'}</code> in JSON values.</p>
            </div>

            {selectedInvokePreset && (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Selected:</span> [{selectedInvokePreset.group}] {selectedInvokePreset.value} - {selectedInvokePreset.description}
                <br />
                <span className="font-medium text-slate-700">Example args:</span> <code>{selectedInvokePreset.exampleArgs}</code>
              </div>
            )}

            <div className="rounded border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100"
              >
                <span>Advanced</span>
                <span>{advancedOpen ? 'Hide' : 'Show'}</span>
              </button>
              {advancedOpen && (
                <div className="p-3 space-y-3 bg-white">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Action</label>
                    <Input size="small" value={toolAction} onChange={(event) => setToolAction(event.target.value)} placeholder="json" />
                    <p className="mt-2 mb-0 text-xs text-slate-500">Default is <code>json</code>. Only change this when your tool requires it.</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Outputs</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyOutputVariable('#{OpenClaw.Ok}')}
                  className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                >
                  #{'{'}OpenClaw.Ok{'}'}
                </button>
                <button
                  type="button"
                  onClick={() => void copyOutputVariable('#{OpenClaw.ResultJson}')}
                  className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                >
                  #{'{'}OpenClaw.ResultJson{'}'}
                </button>
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              If execution returns <code>OpenClaw.Ok=False</code> with <code>tool execution failed</code>, check OpenClaw server logs.
              <br />
              Suggested command: <code>openclaw logs --follow</code>
            </div>
          </>
        )
      }

      if (actionType === OpenClawActionTypes.chatCompletion) {
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Input mode</label>
              <Radio.Group
                value={chatInputMode}
                onChange={(event) => setChatInputMode(event.target.value as ChatInputMode)}
                className="flex flex-col gap-2"
              >
                <Radio value="simple"><span className="text-sm">Simple mode (Prompt + System Prompt)</span></Radio>
                <Radio value="advanced"><span className="text-sm">Advanced mode (Messages JSON)</span></Radio>
              </Radio.Group>
            </div>

            {chatInputMode === 'simple' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prompt *</label>
                  <Input.TextArea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    autoSize={{ minRows: 3, maxRows: 10 }}
                    placeholder="Summarize the deployment result in Chinese."
                    status={chatFieldErrors.prompt ? 'error' : ''}
                  />
                  {renderChatError('prompt')}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">System Prompt</label>
                  <Input.TextArea
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    autoSize={{ minRows: 2, maxRows: 8 }}
                    placeholder="You are a release assistant. Respond briefly in Chinese."
                  />
                </div>
              </>
            )}

            {chatInputMode === 'advanced' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Messages JSON *</label>
                {renderRawJsonEditor(
                  messagesJson,
                  setMessagesJson,
                  '[{"role":"system","content":"You are a deploy reviewer"},{"role":"user","content":"Review this release"}]',
                  '260px',
                  !!chatFieldErrors.messagesJson,
                )}
                {renderChatError('messagesJson')}
                <p className="mt-2 mb-0 text-xs leading-5 text-slate-500">Use a JSON array of chat messages. Supports variables like <code>{'#{Squid.Release.Number}'}</code>.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Model override</label>
                <Input
                  size="small"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="anthropic/claude-sonnet-4-20250514"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Agent ID</label>
                <Input
                  size="small"
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  placeholder="devops-assistant"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Session key</label>
                <Input
                  size="small"
                  value={sessionKey}
                  onChange={(event) => setSessionKey(event.target.value)}
                  placeholder="main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
                <Input
                  size="small"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                  placeholder="slack / web"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">User</label>
                <Input
                  size="small"
                  value={chatUser}
                  onChange={(event) => setChatUser(event.target.value)}
                  placeholder="user id"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Timeout (seconds)</label>
                <Input
                  size="small"
                  status={chatFieldErrors.timeoutSeconds ? 'error' : ''}
                  value={timeoutSeconds}
                  onChange={(event) => setTimeoutSeconds(event.target.value)}
                  placeholder="30"
                />
                {renderChatError('timeoutSeconds')}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Outputs</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyOutputVariable('#{OpenClaw.Ok}')}
                  className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                >
                  #{'{'}OpenClaw.Ok{'}'}
                </button>
                <button
                  type="button"
                  onClick={() => void copyOutputVariable('#{OpenClaw.ChatResponse}')}
                  className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                >
                  #{'{'}OpenClaw.ChatResponse{'}'}
                </button>
                <button
                  type="button"
                  onClick={() => void copyOutputVariable('#{OpenClaw.ChatModel}')}
                  className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                >
                  #{'{'}OpenClaw.ChatModel{'}'}
                </button>
                <button
                  type="button"
                  onClick={() => void copyOutputVariable('#{OpenClaw.ChatFinishReason}')}
                  className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                >
                  #{'{'}OpenClaw.ChatFinishReason{'}'}
                </button>
              </div>
            </div>
          </>
        )
      }

      if (actionType === OpenClawActionTypes.runAgent) {
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Message</label>
              <Input.TextArea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                autoSize={{ minRows: 3, maxRows: 10 }}
                placeholder="Send instruction to agent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Agent ID</label>
              <Input size="small" value={agentId} onChange={(event) => setAgentId(event.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Session key</label>
              <Input size="small" value={sessionKey} onChange={(event) => setSessionKey(event.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Wake mode</label>
              <Select
                size="small"
                className="w-full"
                value={wakeMode}
                onChange={(value) => setWakeMode(String(value))}
                options={[
                  { label: '(empty)', value: '' },
                  { label: 'now', value: 'now' },
                  { label: 'next-heartbeat', value: 'next-heartbeat' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Deliver</label>
              <Select
                size="small"
                className="w-full"
                value={deliver}
                onChange={(value) => setDeliver(String(value))}
                options={[
                  { label: '(empty)', value: '' },
                  { label: 'true', value: 'true' },
                  { label: 'false', value: 'false' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
              <Input size="small" value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="last / discord / telegram" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <Input size="small" value={to} onChange={(event) => setTo(event.target.value)} placeholder="+15551234567" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Timeout seconds</label>
              <Input size="small" value={timeoutSeconds} onChange={(event) => setTimeoutSeconds(event.target.value)} placeholder="30" />
            </div>
            <p className="text-xs text-slate-500 m-0">Outputs: OpenClaw.Accepted</p>
          </>
        )
      }

      if (actionType === OpenClawActionTypes.wake) {
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Wake text</label>
              <Input.TextArea
                value={wakeText}
                onChange={(event) => setWakeText(event.target.value)}
                autoSize={{ minRows: 3, maxRows: 8 }}
                placeholder="Optional system event text"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Wake mode</label>
              <Select
                size="small"
                className="w-full"
                value={wakeMode}
                onChange={(value) => setWakeMode(String(value))}
                options={[
                  { label: 'now', value: 'now' },
                  { label: 'next-heartbeat', value: 'next-heartbeat' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Timeout seconds</label>
              <Input size="small" value={timeoutSeconds} onChange={(event) => setTimeoutSeconds(event.target.value)} placeholder="30" />
            </div>
            <p className="text-xs text-slate-500 m-0">Outputs: OpenClaw.Accepted</p>
          </>
        )
      }

      if (actionType === OpenClawActionTypes.waitSession) {
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Session key</label>
              <Input size="small" value={sessionKey} onChange={(event) => setSessionKey(event.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Success pattern</label>
              <Input size="small" value={successPattern} onChange={(event) => setSuccessPattern(event.target.value)} placeholder="Regex pattern" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fail pattern</label>
              <Input size="small" value={failPattern} onChange={(event) => setFailPattern(event.target.value)} placeholder="Regex pattern" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max wait seconds</label>
              <Input size="small" value={maxWaitSeconds} onChange={(event) => setMaxWaitSeconds(event.target.value)} placeholder="120" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Poll seconds</label>
              <Input size="small" value={pollSeconds} onChange={(event) => setPollSeconds(event.target.value)} placeholder="5" />
            </div>
            <p className="text-xs text-slate-500 m-0">Outputs: OpenClaw.Status, OpenClaw.Summary</p>
          </>
        )
      }

      if (actionType === OpenClawActionTypes.assert) {
        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Json path</label>
              <Input size="small" value={jsonPath} onChange={(event) => setJsonPath(event.target.value)} placeholder="$.status" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Operator</label>
              <Select
                size="small"
                className="w-full"
                value={assertOperator}
                onChange={(value) => setAssertOperator(value as AssertOperator)}
                options={[
                  { label: 'equals', value: 'equals' },
                  { label: 'equalsIgnoreCase', value: 'equalsIgnoreCase' },
                  { label: 'contains', value: 'contains' },
                  { label: 'matches', value: 'matches' },
                  { label: 'notEquals', value: 'notEquals' },
                  { label: 'greaterThan', value: 'greaterThan' },
                  { label: 'lessThan', value: 'lessThan' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expected</label>
              <Input size="small" value={expected} onChange={(event) => setExpected(event.target.value)} placeholder="Expected value" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Source variable</label>
              <Input size="small" value={sourceVariable} onChange={(event) => setSourceVariable(event.target.value)} placeholder="OpenClaw.ResultJson" />
            </div>
            <p className="text-xs text-slate-500 m-0">Assertion pass means step success; assertion failure means step failed.</p>
          </>
        )
      }

      return (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Source variable</label>
            <Input size="small" value={sourceVariable} onChange={(event) => setSourceVariable(event.target.value)} placeholder="OpenClaw.ResultJson" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Field mappings (JSON array)</label>
            <Input.TextArea
              value={fieldMappings}
              onChange={(event) => setFieldMappings(event.target.value)}
              autoSize={{ minRows: 4, maxRows: 14 }}
              placeholder={'[\n  {"jsonPath":"$.result.sessionId","outputName":"MySessionId"}\n]'}
            />
          </div>
          <p className="text-xs text-slate-500 m-0">Extract fields and publish output variables for later steps.</p>
        </>
      )
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
              <img
                src={logoUrl}
                alt="Logo"
                className="h-full w-full object-contain"
                onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs leading-tight text-slate-400">{actionDefinition.stepTypeLabel}</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null ? <span className="text-sm font-medium text-slate-400">{stepIndex + 1}.</span> : null}
                <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100" aria-label="More Step Actions">
              <MoreOutlined style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <CollapsibleSection title="Step Name" subtitle="A short, memorable, unique name for this step." defaultOpen>
            <label className="mb-1 block text-xs font-medium text-slate-600">Step name</label>
            <Input
              size="small"
              value={stepName}
              onChange={(event) => setStepName(event.target.value)}
              placeholder={actionDefinition.defaultStepName}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Target Tags" subtitle="This step will run on OpenClaw deployment targets with matching tags." defaultOpen>
            <TargetTagSelect value={targetTags} onChange={setTargetTags} placeholder="Runs on targets with tags (type to add new)" />
            <div className="text-xs text-slate-500">You need at least one tag to select matching OpenClaw targets.</div>
          </CollapsibleSection>

          <CollapsibleSection title="OpenClaw Action" subtitle={actionDefinition.description} defaultOpen>
            {renderActionSection()}
          </CollapsibleSection>

          <StepConditionsSection
            projectId={projectId}
            hidePackageRequirement
            afterRunCondition={(
              <CollapsibleSection title="Start Trigger" subtitle="Control whether this step waits for previous steps to complete." defaultOpen>
                <Radio.Group
                  value={startTrigger}
                  onChange={(event) => setStartTrigger(event.target.value as StartTriggerMode)}
                  className="flex flex-col gap-2"
                >
                  <Radio value="StartWithPrevious">
                    <span className="text-sm">Run in parallel with the previous step</span>
                  </Radio>
                  <Radio value="StartAfterPrevious">
                    <span className="text-sm">Wait for all previous steps to complete, then start</span>
                  </Radio>
                </Radio.Group>
              </CollapsibleSection>
            )}
            value={conditions}
            onChange={setConditions}
          />
        </div>
        <style>{`
          .openclaw-json-codemirror .cm-editor {
            border: 0 !important;
            outline: none !important;
          }
          .openclaw-json-codemirror .cm-scroller {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            line-height: 1.5 !important;
          }
          .openclaw-json-codemirror .cm-content {
            font-size: 14px !important;
            padding: 8px 12px !important;
          }
          .openclaw-json-codemirror .cm-gutters {
            border-right: 1px solid #cbd5e1 !important;
            background: #f8fafc !important;
          }
          .openclaw-json-codemirror .cm-focused {
            outline: none !important;
          }
        `}</style>
      </div>
    )
  },
)

function createOpenClawActionEditor(actionType: OpenClawActionType) {
  return forwardRef<StepEditorHandle, StepEditorProps>(function OpenClawActionEditor(props, ref) {
    return <OpenClawActionEditorInternal {...props} ref={ref} actionType={actionType} />
  })
}

export const OpenClawInvokeToolEditor = createOpenClawActionEditor(OpenClawActionTypes.invokeTool)
export const OpenClawChatCompletionEditor = createOpenClawActionEditor(OpenClawActionTypes.chatCompletion)
export const OpenClawRunAgentEditor = createOpenClawActionEditor(OpenClawActionTypes.runAgent)
export const OpenClawWakeEditor = createOpenClawActionEditor(OpenClawActionTypes.wake)
export const OpenClawWaitSessionEditor = createOpenClawActionEditor(OpenClawActionTypes.waitSession)
export const OpenClawAssertEditor = createOpenClawActionEditor(OpenClawActionTypes.assert)
export const OpenClawFetchResultEditor = createOpenClawActionEditor(OpenClawActionTypes.fetchResult)
