import { get } from 'utils/request'

// ── Deployment state ───────────────────────────────────────────────────────────

export type DeploymentState =
  | 'Pending'
  | 'Executing'
  | 'Success'
  | 'Failed'
  | 'Cancelling'
  | 'Cancelled'
  | 'TimedOut'

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ProgressionEnvironment {
  id: number
  name: string
}

export interface ProgressionRelease {
  id: number
  version: string
  createdDate: string   // ISO 8601
  channelId: number
}

export interface ProgressionChannel {
  id: number
  name: string
}

export interface ProgressionDeployment {
  deploymentId: number
  state: DeploymentState
  releaseVersion: string
  createdDate: string         // ISO 8601
  completedTime: string | null
  hasWarningsOrErrors: boolean
  isCurrent: boolean          // true = latest deployment for this env across all releases
}

export interface ReleaseProgression {
  release: ProgressionRelease
  channel: ProgressionChannel | null
  deployments: Record<number, ProgressionDeployment[]>  // environmentId → deployments (created desc)
  nextDeployments: number[]                             // environmentIds the release can be deployed to
}

export interface ProjectProgression {
  environments: ProgressionEnvironment[]
  channelEnvironments: Record<number, number[]>   // channelId → environmentId[]
  releases: ReleaseProgression[]                  // createdDate desc; recent window per channel + currently deployed releases
  channelReleaseCounts?: Record<number, number>   // channelId → total releases in that channel
}

// ── Display ─────────────────────────────────────────────────────────────────

// A finished deployment shows when it completed; one still running shows when it was created.
export function deploymentDisplayDate(deployment: { completedTime: string | null; createdDate: string }) {
  return deployment.completedTime ?? deployment.createdDate
}

// ── API ───────────────────────────────────────────────────────────────────────

export function getProjectProgression(projectId: number) {
  return get<ProjectProgression>(`/projects/${projectId}/progression`)
}
