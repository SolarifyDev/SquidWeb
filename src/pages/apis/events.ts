import { get } from 'utils/request'

/**
 * Audit-event category. Values mirror the server-side smallint enum
 * (Squid.Message.Enums.Events.EventCategory) and MUST NOT be renumbered.
 */
export enum EventCategory {
  DocumentCreated = 1,
  DocumentModified = 2,
  DocumentDeleted = 3,
  DeploymentQueued = 10,
  DeploymentStarted = 11,
  ManualInterventionRaised = 12,
  ManualInterventionSubmitted = 13,
  GuidedFailureRaised = 14,
  DeploymentResumed = 15,
  DeploymentSucceeded = 16,
  DeploymentFailed = 17,
  DeploymentCanceled = 18,
  DeploymentTimedOut = 19,
  ImportedOctopusEvent = 100,
}

/** One persisted audit event from GET /api/events/list. Mirrors the server EventDto. */
export interface EventDto {
  id: number
  category: number
  categoryName: string
  /** Sentence with {Token} placeholders resolved from referencesJson by the client. */
  messageTemplate: string
  /** jsonb-serialized structured reference args (e.g. {"release":"6.6.2","environment":"PRD"}). */
  referencesJson: string
  spaceId: number
  projectId: number | null
  releaseId: number | null
  deploymentId: number | null
  environmentId: number | null
  machineId: number | null
  serverTaskId: number | null
  userId: number | null
  username: string
  establishedWith: number
  establishedWithName: string
  userAgent: string | null
  occurred: string
}

export interface EventsPageDto {
  events: EventDto[]
  /** Pass as `beforeId` to fetch the next (older) page; null when there are no more. */
  nextCursor: number | null
  hasMore: boolean
}

export interface GetEventsParams {
  projectId?: number
  releaseId?: number
  deploymentId?: number
  environmentId?: number
  machineId?: number
  /** Keyset cursor — return events older than this id. Omit for the newest page. */
  beforeId?: number
  take?: number
}

/**
 * Reads the persisted audit-event feed, keyset-paginated newest-first. SpaceId is
 * resolved server-side from the X-Space-Id header (injected by the request layer),
 * so only the document filters are passed here.
 */
export function getEvents(params: GetEventsParams) {
  return get<EventsPageDto>('/events/list', { params })
}
