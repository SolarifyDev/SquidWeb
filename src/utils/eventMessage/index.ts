import { EventCategory, type EventDto } from 'pages/apis/events'

export type EventTone = 'success' | 'failure' | 'warning' | 'info' | 'neutral'

/**
 * Parse the server's jsonb `referencesJson` into a flat string map, tolerating
 * malformed/empty JSON (returns {}). Nested objects/arrays are ignored — references
 * are flat scalar args. Synthesizes a `document` composite for document-audit events,
 * whose references carry `documentType` + `name` rather than a single `document` field,
 * so the "{Document} was created/modified/deleted" templates resolve generically.
 */
export function parseEventReferences(referencesJson: string | null | undefined): Record<string, string> {
  if (!referencesJson) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(referencesJson)
  } catch {
    return {}
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

  const refs: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value == null || typeof value === 'object') continue
    refs[key] = String(value)
  }

  if (refs.document == null && refs.documentType != null) {
    refs.document = refs.name ? `${refs.documentType} '${refs.name}'` : refs.documentType
  }

  return refs
}

/**
 * Render an event's message by substituting {Token} placeholders in its category
 * message template with the matching reference value. Generic across every category —
 * there is no per-category branching. Token lookup is case-insensitive (templates use
 * {PascalCase}; reference keys are camelCase). An unresolved token degrades to a
 * humanized word so the sentence still reads; an empty template falls back to the
 * category display name.
 */
export function formatEventMessage(
  event: Pick<EventDto, 'messageTemplate' | 'categoryName' | 'referencesJson'>,
): string {
  const template = event.messageTemplate?.trim()
  if (!template) return event.categoryName ?? ''

  const refs = parseEventReferences(event.referencesJson)

  return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    const value = resolveToken(refs, token)
    return value != null && value !== '' ? value : humanizeToken(token)
  })
}

function resolveToken(refs: Record<string, string>, token: string): string | undefined {
  const camel = token.charAt(0).toLowerCase() + token.slice(1)
  return refs[token] ?? refs[camel] ?? refs[token.toLowerCase()]
}

function humanizeToken(token: string): string {
  return token.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

/** Coarse tone for the row's status dot/badge, derived generically from the category. */
export function eventTone(category: number): EventTone {
  switch (category) {
    case EventCategory.DeploymentSucceeded:
      return 'success'
    case EventCategory.DeploymentFailed:
      return 'failure'
    case EventCategory.ManualInterventionRaised:
    case EventCategory.GuidedFailureRaised:
    // A timed-out deployment is paused + resumable (awaiting operator action),
    // not a terminal failure — group it with the other "needs attention" states.
    case EventCategory.DeploymentTimedOut:
      return 'warning'
    case EventCategory.DeploymentCanceled:
    case EventCategory.DocumentDeleted:
      return 'neutral'
    default:
      return 'info'
  }
}
