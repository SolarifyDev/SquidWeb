import {
  OctopusImportPreviewAction,
  type OctopusHistoryFetchProgress,
  type OctopusImportPreviewPlan,
  type OctopusImportPreviewResource,
} from 'pages/apis/octopusImport';

/** Deployment-history kinds. The server owns these rows: it re-plans them on validate. */
export const HISTORY_SOURCE_TYPES = ['Release', 'Deployment', 'ServerTask'];

export type PreviewActionBucket = 'create' | 'reuse' | 'alreadyImported' | 'update' | 'skip' | 'other';

export type PreviewActionCounts = Record<PreviewActionBucket, number>;

export interface ProjectPreviewSummary {
  projectSourceId: string;
  projectName: string;
  counts: PreviewActionCounts;
  newReleases: number;
  newDeployments: number;
}

export interface ListedPreviewResource {
  resource: OctopusImportPreviewResource;
  label: string | null;
}

const normalizeType = (sourceType: string) => sourceType.trim().toLowerCase();

const isOfType = (resource: OctopusImportPreviewResource, type: string) =>
  normalizeType(resource.sourceType) === type.toLowerCase();

export const isHistoryResource = (resource: OctopusImportPreviewResource) =>
  HISTORY_SOURCE_TYPES.some(type => isOfType(resource, type));

/** The plan to post to validate: history rows are dropped because the server merges its own. */
export const withoutHistoryRows = (plan: OctopusImportPreviewPlan): OctopusImportPreviewPlan => ({
  ...plan,
  resources: plan.resources.filter(resource => !isHistoryResource(resource)),
});

export const actionBucket = (action: OctopusImportPreviewAction): PreviewActionBucket => {
  switch (Number(action)) {
    case OctopusImportPreviewAction.Create:
      return 'create';
    case OctopusImportPreviewAction.ReuseExisting:
      return 'reuse';
    case OctopusImportPreviewAction.AlreadyImported:
      return 'alreadyImported';
    case OctopusImportPreviewAction.Update:
      return 'update';
    case OctopusImportPreviewAction.Skip:
      return 'skip';
    default:
      return 'other';
  }
};

const emptyCounts = (): PreviewActionCounts => ({
  create: 0,
  reuse: 0,
  alreadyImported: 0,
  update: 0,
  skip: 0,
  other: 0,
});

export const summarizeActions = (resources: OctopusImportPreviewResource[]): PreviewActionCounts =>
  resources.reduce((counts, resource) => {
    counts[actionBucket(resource.previewAction)] += 1;
    return counts;
  }, emptyCounts());

const writesHistory = (resource: OctopusImportPreviewResource, type: string) => {
  const bucket = actionBucket(resource.previewAction);
  return isOfType(resource, type) && (bucket === 'create' || bucket === 'update');
};

const projectNameOf = (resources: OctopusImportPreviewResource[], projectSourceId: string) =>
  resources.find(resource => isOfType(resource, 'Project') && resource.sourceId === projectSourceId)?.sourceName
  ?? projectSourceId;

/** One row per Octopus project, grouped by `ownerProjectSourceId`; shared resources are left out. */
export const summarizeByProject = (resources: OctopusImportPreviewResource[]): ProjectPreviewSummary[] => {
  const groups = new Map<string, OctopusImportPreviewResource[]>();

  for (const resource of resources) {
    const owner = resource.ownerProjectSourceId;
    if (!owner) continue;
    groups.set(owner, [...(groups.get(owner) ?? []), resource]);
  }

  return Array.from(groups, ([projectSourceId, owned]) => ({
    projectSourceId,
    projectName: projectNameOf(resources, projectSourceId),
    counts: summarizeActions(owned),
    newReleases: owned.filter(resource => writesHistory(resource, 'Release')).length,
    newDeployments: owned.filter(resource => writesHistory(resource, 'Deployment')).length,
  })).sort((left, right) => left.projectName.localeCompare(right.projectName));
};

/** True when confirming would write nothing: no resource is created or updated. */
export const isNothingNew = (resources: OctopusImportPreviewResource[]) =>
  !resources.some(resource => {
    const bucket = actionBucket(resource.previewAction);
    return bucket === 'create' || bucket === 'update';
  });

const LISTED_LABELS: Partial<Record<PreviewActionBucket, string | null>> = {
  create: null,
  reuse: null,
  alreadyImported: 'Already imported',
  update: 'Update',
};

/** Resources of one type shown in the preview lists, labelled when they were imported before. */
export const listedResources = (resources: OctopusImportPreviewResource[], type: string): ListedPreviewResource[] =>
  resources
    .filter(resource => isOfType(resource, type))
    .filter(resource => actionBucket(resource.previewAction) in LISTED_LABELS)
    .map(resource => ({ resource, label: LISTED_LABELS[actionBucket(resource.previewAction)] ?? null }));

/** Percent for the fetch progress bar; held below 100 until the server reports done. */
export const fetchProgressPercent = (progress: OctopusHistoryFetchProgress | null) => {
  if (!progress) return 0;
  if (progress.done) return 100;
  if (progress.projectCount <= 0) return 0;

  return Math.min(99, Math.floor((progress.projectIndex / progress.projectCount) * 100));
};
