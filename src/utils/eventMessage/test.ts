import { EventCategory, type EventDto } from 'pages/apis/events'
import { eventTone, formatEventMessage, parseEventReferences } from 'utils/eventMessage'

// The real server-side category templates (Squid.Message.Constants.Events.EventCategoryRegistry).
// Keeping them here makes these tests a client-side contract check: if a template's tokens
// change server-side, the generic renderer must still resolve them from references.
const TEMPLATES: Record<number, string> = {
  [EventCategory.DocumentCreated]: '{Document} was created',
  [EventCategory.DocumentModified]: '{Document} was modified',
  [EventCategory.DocumentDeleted]: '{Document} was deleted',
  [EventCategory.DeploymentQueued]: 'Deployed {Release} to {Environment}',
  [EventCategory.DeploymentStarted]: 'Deploy to {Environment} started for {Release}',
  [EventCategory.ManualInterventionRaised]: 'Deploy to {Environment} requires manual intervention for {Release}',
  [EventCategory.ManualInterventionSubmitted]: 'Manual intervention submitted for deploy to {Environment} for {Release}',
  [EventCategory.GuidedFailureRaised]: 'Deploy to {Environment} hit a guided failure for {Release}',
  [EventCategory.DeploymentResumed]: 'Deploy to {Environment} resumed for {Release}',
  [EventCategory.DeploymentSucceeded]: 'Deploy to {Environment} succeeded for {Release}',
  [EventCategory.DeploymentFailed]: 'Deploy to {Environment} failed for {Release}',
  [EventCategory.DeploymentCanceled]: 'Deploy to {Environment} canceled for {Release}',
}

function event(partial: Partial<EventDto>): EventDto {
  return {
    id: 1, category: EventCategory.DeploymentSucceeded, categoryName: 'Deployment succeeded',
    messageTemplate: '', referencesJson: '{}', spaceId: 1,
    projectId: null, releaseId: null, deploymentId: null, environmentId: null, machineId: null,
    serverTaskId: null, userId: null, username: 'system', establishedWith: 0,
    establishedWithName: 'Server', userAgent: null, occurred: '2026-06-03T00:00:00Z',
    ...partial,
  }
}

describe('parseEventReferences', () => {
  it('parses a flat deployment references object', () => {
    expect(parseEventReferences('{"project":"Checkout","release":"6.6.2","environment":"PRD"}'))
      .toEqual({ project: 'Checkout', release: '6.6.2', environment: 'PRD' })
  })

  it.each([null, undefined, '', '{}', 'not json', '[]', '[1,2]'])('returns {} for %s', (input) => {
    expect(parseEventReferences(input as string)).toEqual({})
  })

  it('coerces scalar values to strings and skips nested objects/nulls', () => {
    expect(parseEventReferences('{"count":3,"flag":true,"nested":{"a":1},"missing":null}'))
      .toEqual({ count: '3', flag: 'true' })
  })

  it('synthesizes a {document} composite from documentType + name', () => {
    expect(parseEventReferences('{"documentType":"Release","name":"6.6.2"}').document).toBe("Release '6.6.2'")
  })

  it('uses documentType alone when name is absent', () => {
    expect(parseEventReferences('{"documentType":"Project"}').document).toBe('Project')
  })
})

describe('formatEventMessage', () => {
  it('substitutes {Environment} and {Release} for a deployment event', () => {
    const msg = formatEventMessage(event({
      messageTemplate: TEMPLATES[EventCategory.DeploymentSucceeded],
      referencesJson: '{"project":"Checkout","release":"6.6.2","environment":"Production"}',
    }))
    expect(msg).toBe('Deploy to Production succeeded for 6.6.2')
  })

  it('resolves the {Document} composite for a document-created event', () => {
    const msg = formatEventMessage(event({
      category: EventCategory.DocumentCreated,
      messageTemplate: TEMPLATES[EventCategory.DocumentCreated],
      referencesJson: '{"documentType":"Release","name":"6.6.2"}',
    }))
    expect(msg).toBe("Release '6.6.2' was created")
  })

  it('every real template resolves with full references — no stray {tokens}', () => {
    const refs = '{"project":"Checkout","release":"6.6.2","environment":"Production","documentType":"Release","name":"6.6.2"}'
    for (const [category, template] of Object.entries(TEMPLATES)) {
      const msg = formatEventMessage(event({ category: Number(category), messageTemplate: template, referencesJson: refs }))
      expect(msg, `category ${category}`).not.toMatch(/\{[A-Za-z]+\}/)
    }
  })

  it('degrades an unresolved token to a humanized word, not a literal placeholder', () => {
    const msg = formatEventMessage(event({
      messageTemplate: TEMPLATES[EventCategory.DeploymentStarted],
      referencesJson: '{}',
    }))
    expect(msg).toBe('Deploy to environment started for release')
    expect(msg).not.toContain('{')
  })

  it('falls back to the category name when the template is empty', () => {
    expect(formatEventMessage(event({ messageTemplate: '', categoryName: 'Deployment succeeded' })))
      .toBe('Deployment succeeded')
  })
})

describe('eventTone', () => {
  it.each([
    [EventCategory.DeploymentSucceeded, 'success'],
    [EventCategory.DeploymentFailed, 'failure'],
    [EventCategory.ManualInterventionRaised, 'warning'],
    [EventCategory.GuidedFailureRaised, 'warning'],
    [EventCategory.DeploymentCanceled, 'neutral'],
    [EventCategory.DocumentDeleted, 'neutral'],
    [EventCategory.DeploymentStarted, 'info'],
    [EventCategory.DocumentCreated, 'info'],
  ])('maps category %i to tone %s', (category, tone) => {
    expect(eventTone(category)).toBe(tone)
  })
})
