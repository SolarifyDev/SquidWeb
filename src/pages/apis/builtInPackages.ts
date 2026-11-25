import { get, post } from 'utils/request'

export const BUILT_IN_FEED_TYPE = 'BuiltIn'

export function isBuiltInFeedType(feedType: string | null | undefined) {
  return (feedType ?? '').toLowerCase() === BUILT_IN_FEED_TYPE.toLowerCase()
}

/** What inspection found in a package: computed facts only (a file list is not part of the wire contract). */
export interface PackageFacts {
  values: Record<string, string>
}

export interface BuiltInPackageDto {
  packageId: string
  versionCount: number
  lastPublishedDate: string
}

export interface BuiltInPackageVersionDto {
  id: number
  feedId: number
  packageId: string
  version: string
  fileExtension: string
  sizeBytes: number
  sha256: string
  publishedDate: string
  publishedBy: number
  source: string
  facts?: PackageFacts | null
}

export interface ListBuiltInPackagesData {
  feedId: number
  packages: BuiltInPackageDto[]
}

export interface RecipeCandidate {
  kind: string
  score: number
  reasons: string[]
}

export interface RecipeRecommendations {
  inspected: boolean
  facts?: PackageFacts | null
  selection: {
    candidates: RecipeCandidate[]
    requestedKind?: string | null
    unknownRecipe?: string | null
    validKinds: string[]
  }
}

export interface PackageVersionRule {
  feedId: number
  packageId: string
  versionTemplate: string
  isDefault: boolean
}

export interface PushBuiltInPackageData {
  package: BuiltInPackageVersionDto
  deduplicated: boolean
  replaced: boolean
}

export interface PushBuiltInPackageOptions {
  spaceId: number
  fileName: string
  packageId?: string
  /** Empty means the package's version rule decides; no version parameter is sent. */
  version?: string
  replace?: boolean
  onProgress?: (sentBytes: number, totalBytes: number) => void
}

const BASE = '/builtin-feed'

export function listBuiltInPackages(filter?: string) {
  return get<ListBuiltInPackagesData>(`${BASE}/packages`, { params: { take: 200, ...(filter ? { filter } : {}) } })
}

export function listBuiltInPackageVersions(packageId: string) {
  return get<{ versions: BuiltInPackageVersionDto[] }>(`${BASE}/packages/versions`, { params: { packageId } }).then((data) => data.versions)
}

export function getRecipeRecommendations(packageId: string, version: string) {
  return get<RecipeRecommendations>(`${BASE}/packages/version/recipes`, { params: { packageId, version } })
}

export function getPackageVersionRule(feedId: number, packageId: string) {
  return get<PackageVersionRule>('/package-version-rules', { params: { feedId, packageId } })
}

export function setPackageVersionRule(feedId: number, packageId: string, versionTemplate: string) {
  return post<PackageVersionRule>('/package-version-rules/set', { feedId, packageId, versionTemplate })
}

/** Builds the query of a push: optional values that are empty are left out, so the server falls back to its own rules. */
export function buildPushParams(options: PushBuiltInPackageOptions) {
  const packageId = options.packageId?.trim()
  const version = options.version?.trim()

  return {
    spaceId: options.spaceId,
    fileName: options.fileName,
    source: 'Upload',
    ...(packageId ? { packageId } : {}),
    ...(version ? { version } : {}),
    ...(options.replace ? { replace: true } : {}),
  }
}

/**
 * The request body is the file itself, not multipart. The space id travels in the query, so the helper's body
 * injection is skipped (it would otherwise try to spread the Blob), and the 15s default timeout is lifted for large files.
 */
export function pushBuiltInPackage(body: Blob, options: PushBuiltInPackageOptions) {
  return post<PushBuiltInPackageData>(`${BASE}/packages/push`, body, {
    params: buildPushParams(options),
    headers: { 'Content-Type': 'application/octet-stream' },
    timeout: 0,
    skipSpaceIdInjection: true,
    onUploadProgress: (event) => options.onProgress?.(event.loaded, event.total ?? body.size),
  })
}
