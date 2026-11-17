import { describe, expect, it } from 'vitest';
import type { OctopusImportProjectList, OctopusImportProjectOption } from 'pages/apis/octopusImport';
import {
  NO_PROJECT_GROUP_NAME,
  fileSelectionRequest,
  filterProjects,
  groupProjects,
  groupState,
  initialSelection,
  setChosen,
  sameProjects,
} from './importProjectSelection';

const project = (id: string, name: string, projectGroupId: string | null): OctopusImportProjectOption => ({
  id, name, projectGroupId, isDisabled: false, previouslyImported: false,
});

const list = (selectedProjectIds: string[] | null = null): OctopusImportProjectList => ({
  groups: [{ id: 'ProjectGroups-1', name: 'Web apps' }, { id: 'ProjectGroups-2', name: 'Billing' }],
  projects: [
    project('Projects-1', 'Web', 'ProjectGroups-1'),
    project('Projects-2', 'Admin', 'ProjectGroups-1'),
    project('Projects-3', 'Invoices', 'ProjectGroups-2'),
    project('Projects-4', 'Orphan', 'ProjectGroups-99'),
    project('Projects-5', 'Loose', null),
  ],
  selectedProjectIds,
});

const ids = (projects: OctopusImportProjectOption[]) => projects.map(item => item.id);

describe('groupProjects', () => {
  it('bucketsByGroup_SortedByName_UnknownGroupsLastInNoProjectGroup', () => {
    const groups = groupProjects(list());

    expect(groups.map(group => group.name)).toEqual(['Billing', 'Web apps', NO_PROJECT_GROUP_NAME]);
    expect(ids(groups[1].projects)).toEqual(['Projects-2', 'Projects-1']);
    expect(ids(groups[2].projects)).toEqual(['Projects-5', 'Projects-4']);
  });

  it('groupsOnlyTheGivenProjects_DroppingEmptyGroups', () => {
    const source = list();

    const groups = groupProjects(source, [source.projects[2]]);

    expect(groups.map(group => group.name)).toEqual(['Billing']);
  });
});

describe('filterProjects', () => {
  it.each([
    ['', ['Projects-1', 'Projects-2', 'Projects-3', 'Projects-4', 'Projects-5']],
    ['  ', ['Projects-1', 'Projects-2', 'Projects-3', 'Projects-4', 'Projects-5']],
    ['inv', ['Projects-3']],
    ['WEB', ['Projects-1', 'Projects-2']],
    ['bill', ['Projects-3']],
    ['nothing', []],
  ])('matchesNameOrGroupName_IgnoringCase %j', (search, expected) => {
    expect(ids(filterProjects(list(), search))).toEqual(expected);
  });
});

describe('setChosen', () => {
  const projects = list().projects;

  it('ticksOnlyTheGivenProjects_KeepingOthersAndNoDuplicates', () => {
    expect(setChosen(['Projects-5', 'Projects-1'], projects.slice(0, 2), true)).toEqual(['Projects-5', 'Projects-1', 'Projects-2']);
  });

  it('unticksOnlyTheGivenProjects', () => {
    expect(setChosen(['Projects-1', 'Projects-2', 'Projects-3'], projects.slice(0, 2), false)).toEqual(['Projects-3']);
  });
});

describe('groupState', () => {
  const group = groupProjects(list())[1];

  it.each([
    [[], { chosen: 0, total: 2, checked: false, indeterminate: false }],
    [['Projects-1'], { chosen: 1, total: 2, checked: false, indeterminate: true }],
    [['Projects-1', 'Projects-2', 'Projects-3'], { chosen: 2, total: 2, checked: true, indeterminate: false }],
  ])('isTriState %j', (selected, expected) => {
    expect(groupState(group, new Set(selected))).toEqual(expected);
  });
});

describe('initialSelection', () => {
  it.each([
    [null, false, []],
    [null, true, ['Projects-1', 'Projects-2', 'Projects-3', 'Projects-4', 'Projects-5']],
    [['Projects-3', 'Projects-404'], true, ['Projects-3']],
    [['Projects-3'], false, ['Projects-3']],
  ])('sessionSelectionWins_ElseAllForAFileNoneForAServer %j %s', (selected, defaultAll, expected) => {
    expect(initialSelection(list(selected), defaultAll)).toEqual(expected);
  });
});

describe('fileSelectionRequest', () => {
  const every = ['Projects-1', 'Projects-2', 'Projects-3', 'Projects-4', 'Projects-5'];

  it('everyProjectTicked_NoSelectionYet_SendsNothing', () => {
    expect(fileSelectionRequest(list(), every)).toEqual({ send: false, projectIds: null });
  });

  it('everyProjectTicked_AfterASelection_ClearsItWithNull', () => {
    expect(fileSelectionRequest(list(['Projects-1']), every)).toEqual({ send: true, projectIds: null });
  });

  it('someTicked_SendsTheirIdsInListOrder', () => {
    expect(fileSelectionRequest(list(), ['Projects-3', 'Projects-1'])).toEqual({ send: true, projectIds: ['Projects-1', 'Projects-3'] });
  });
});

// A Config-as-Code project cannot be imported: select-all, a group tick and the starting selection leave it out.
describe('configAsCodeProjects', () => {
  const cacList = (selectedProjectIds: string[] | null = null): OctopusImportProjectList => ({
    ...list(selectedProjectIds),
    projects: [...list().projects.slice(0, 2), { ...project('Projects-9', 'Git', 'ProjectGroups-1'), isConfigAsCode: true }],
  });

  it('setChosen_TickingLeavesItOut_UntickingStillRemovesIt', () => {
    const projects = cacList().projects;

    expect(setChosen([], projects, true)).toEqual(['Projects-1', 'Projects-2']);
    expect(setChosen(['Projects-1', 'Projects-9'], projects, false)).toEqual([]);
  });

  it('groupState_CountsOnlyProjectsThatCanBeChosen', () => {
    const group = groupProjects(cacList())[0];

    expect(groupState(group, new Set(['Projects-1', 'Projects-2']))).toEqual({ chosen: 2, total: 2, checked: true, indeterminate: false });
  });

  it.each([
    [null, true, ['Projects-1', 'Projects-2']],
    [['Projects-1', 'Projects-9'], false, ['Projects-1']],
  ])('initialSelection_NeverStartsWithIt %j %s', (selected, defaultAll, expected) => {
    expect(initialSelection(cacList(selected), defaultAll)).toEqual(expected);
  });

  it('fileSelectionRequest_EveryImportableProjectTicked_IsTheWholeFile', () => {
    expect(fileSelectionRequest(cacList(), ['Projects-1', 'Projects-2'])).toEqual({ send: false, projectIds: null });
  });
});

describe('sameProjects', () => {
  it('sameProjects_IgnoresOrder_ButNotMembership', () => {
    expect(sameProjects(['Projects-1', 'Projects-2'], ['Projects-2', 'Projects-1'])).toBe(true);
    expect(sameProjects(['Projects-1'], ['Projects-1', 'Projects-2'])).toBe(false);
    expect(sameProjects(['Projects-1', 'Projects-2'], ['Projects-1'])).toBe(false);
    expect(sameProjects([], [])).toBe(true);
  });
});
