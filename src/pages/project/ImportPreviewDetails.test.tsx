import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as previewSummary from './importPreviewSummary';
import {
  OctopusImportChoiceReason,
  OctopusImportPreviewAction,
  OctopusImportProjectDestinationState,
  OctopusImportRequiredInputKind,
  OctopusImportResourceOutcomeState,
  type OctopusImportChangeCounts,
  type OctopusImportPreviewPlan,
  type OctopusImportPreviewResource,
} from 'pages/apis/octopusImport';
import {
  FillPairingConfirmation,
  ImportPreviewOverview,
  LegacyPreviewOverview,
  MissingSecretsAfterImport,
  WithheldSecretsPanel,
} from './ImportPreviewDetails';

// Pass-through spies: the derived lists are counted, never changed.
vi.mock('./importPreviewSummary', async importOriginal => {
  const actual = await importOriginal<typeof import('./importPreviewSummary')>();
  return { ...actual, choiceGroups: vi.fn(actual.choiceGroups), withheldSecrets: vi.fn(actual.withheldSecrets) };
});

const counts = (overrides: Partial<OctopusImportChangeCounts> = {}): OctopusImportChangeCounts => {
  const value = { alreadyImported: 0, reused: 0, create: 0, update: 0, fill: 0, skip: 0, unsupported: 0, blocked: 0, ...overrides };
  const incremental = value.create + value.update + value.fill + value.reused;
  return { ...value, total: incremental + value.alreadyImported + value.skip + value.unsupported + value.blocked, incremental };
};

const resource = (sourceType: string, sourceId: string, previewAction: OctopusImportPreviewAction, owner: string | null): OctopusImportPreviewResource => ({
  sourceId, sourceType, sourceName: sourceId, previewAction, outcomeState: OctopusImportResourceOutcomeState.Pending,
  destinationId: null, ownerProjectSourceId: owner, requiredInputs: [], diagnostics: [],
});

const renderInRouter = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

const plan = (): OctopusImportPreviewPlan => ({
  generatedAt: '',
  resources: [
    {
      ...resource('Feed', 'Feeds-1', OctopusImportPreviewAction.FillMissingSecret, null),
      sourceName: 'Docker Hub',
      fillDestination: { ownerKind: 'Feed', ownerId: 7, ownerName: 'Docker Hub', variableSetId: null },
      changes: [{ field: 'Password', oldValue: null, newValue: null, valueHidden: true, description: 'Filled from the export file.' }],
    },
    {
      ...resource('Release', 'Releases-1', OctopusImportPreviewAction.Update, 'Projects-1'),
      changes: [{ field: 'ReleaseNotes', oldValue: 'old notes', newValue: 'new notes', valueHidden: false, description: null }],
    },
    { ...resource('ServerTask', 'ServerTasks-9', OctopusImportPreviewAction.Skip, 'Projects-1'), skipReason: { code: 'runbook', message: 'Runbook runs are not imported.' } },
  ],
  requiredInputs: [],
  diagnostics: [],
  hasBlockers: false,
  summary: {
    isUpToDate: false,
    counts: counts({ alreadyImported: 4, update: 1, fill: 1, reused: 2, skip: 1, unsupported: 2, blocked: 1 }),
    kinds: [{ kind: 'Release', counts: counts({ update: 1 }) }],
    projects: [{
      sourceId: 'Projects-1', sourceName: 'Web', counts: counts({ alreadyImported: 4, update: 1, skip: 1 }), isUpToDate: false,
      kinds: [{ kind: 'Release', counts: counts({ alreadyImported: 2, update: 1 }) }],
      destination: { state: OctopusImportProjectDestinationState.NotImported, projectId: null, projectName: null, projectSlug: null },
    }],
    space: { counts: counts({ fill: 1, reused: 2 }), kinds: [{ kind: 'Feed', counts: counts({ fill: 1 }) }], isUpToDate: false },
    skipReasons: [],
  },
});

describe('ImportPreviewOverview', () => {
  it('countsEveryOutcome_IncludingSkipsAndBlocked', () => {
    renderInRouter(<ImportPreviewOverview plan={plan()} spaceSlug="Spaces-1" />);

    expect(screen.getByTestId('summary-tile-reused')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-tile-skip')).toHaveTextContent('3');
    expect(screen.getByTestId('summary-tile-blocked')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-incremental')).toHaveTextContent('This import changes 4 resources');
    expect(screen.queryByTestId('preview-up-to-date')).not.toBeInTheDocument();
  });

  it('listsSpaceResourcesAsTheirOwnRow_AndAProjectThatIsNotImported', () => {
    renderInRouter(<ImportPreviewOverview plan={plan()} spaceSlug="Spaces-1" />);

    const rows = within(screen.getByTestId('preview-projects')).getAllByRole('row');
    expect(rows.some(row => row.textContent?.includes('Space resources (no project)') && row.textContent.includes('This Squid space'))).toBe(true);
    expect(rows.some(row => row.textContent?.includes('Web') && row.textContent.includes('Not imported'))).toBe(true);
  });

  it('expandsAProject_ToItsKindsChangesAndSkips', () => {
    renderInRouter(<ImportPreviewOverview plan={plan()} spaceSlug="Spaces-1" />);

    fireEvent.click(within(screen.getByTestId('preview-projects')).getAllByRole('button', { name: /expand row/i })[0]);

    const detail = screen.getByTestId('group-detail-Projects-1');
    expect(within(detail).getByTestId('changes-Release-Releases-1')).toHaveTextContent(/ReleaseNotes.*old notes.*new notes/);
    expect(detail).toHaveTextContent('ServerTask ServerTasks-9: Runbook runs are not imported.');
  });

  it('expandsTheSpaceRow_ToASecretFill_ShowingNoValue', () => {
    renderInRouter(<ImportPreviewOverview plan={plan()} spaceSlug="Spaces-1" />);

    fireEvent.click(within(screen.getByTestId('preview-projects')).getAllByRole('button', { name: /expand row/i })[1]);

    const changes = screen.getByTestId('changes-Feed-Feeds-1');
    expect(changes).toHaveTextContent('Password');
    expect(within(changes).getAllByText('secret, not shown')).toHaveLength(2);
    expect(within(screen.getByTestId('secret-fills')).getByRole('link', { name: 'feed "Docker Hub"' }))
      .toHaveAttribute('href', '/Spaces-1/external/feeds');
  });

  it('collapsesRowsOutsideTheChosenProjectsIntoOneRow_ListedOnlyWhenExpanded', () => {
    const scoped = plan();
    scoped.resources.push(
      { ...resource('Project', 'Projects-2', OctopusImportPreviewAction.Skip, 'Projects-2'), sourceName: 'Api', skipReason: { code: 'octopus.preview.project_not_chosen', message: 'Not chosen for this import.' } },
      { ...resource('Lifecycle', 'Lifecycles-2', OctopusImportPreviewAction.Skip, null), sourceName: 'Slow', skipReason: { code: 'octopus.preview.not_used_by_chosen_projects', message: 'Not used by the chosen projects, so it is not imported.' } },
    );
    renderInRouter(<ImportPreviewOverview plan={scoped} spaceSlug="Spaces-1" />);

    const table = screen.getByTestId('preview-projects');
    const notChosenRows = within(table).getAllByRole('row').filter(row => row.textContent?.includes('Not used by the chosen projects'));
    expect(notChosenRows).toHaveLength(1);
    expect(within(notChosenRows[0]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['', 'Not used by the chosen projects', 'Not imported', '0', '2']);
    expect(within(table).queryByText(/Lifecycle Slow/)).not.toBeInTheDocument();
    expect(within(table).queryByText('Api')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-tile-notChosen')).toHaveTextContent('2');

    fireEvent.click(within(notChosenRows[0]).getByRole('button', { name: /expand row/i }));

    const list = screen.getByTestId('not-chosen-resources');
    expect(within(list).getByText(/Lifecycle Slow: Not used by the chosen projects/)).toBeInTheDocument();
    expect(within(list).getByText(/Project Api: Not chosen for this import/)).toBeInTheDocument();
  });

  it('leavesSharedResourcesNoChosenProjectUsesOutOfTheSpaceRowsKindTable', () => {
    const scoped = plan();
    scoped.resources.push(
      { ...resource('Lifecycle', 'Lifecycles-2', OctopusImportPreviewAction.Skip, null), skipReason: { code: 'octopus.preview.not_used_by_chosen_projects', message: 'Not used.' } },
      { ...resource('Lifecycle', 'Lifecycles-3', OctopusImportPreviewAction.Skip, null), skipReason: { code: 'octopus.preview.not_used_by_chosen_projects', message: 'Not used.' } },
      { ...resource('Environment', 'Environments-2', OctopusImportPreviewAction.Skip, null), skipReason: { code: 'octopus.preview.not_used_by_chosen_projects', message: 'Not used.' } },
    );
    scoped.summary!.space = {
      counts: counts({ fill: 1, reused: 2, skip: 3 }),
      kinds: [
        { kind: 'Feed', counts: counts({ fill: 1 }) },
        { kind: 'Lifecycle', counts: counts({ reused: 2, skip: 2 }) },
        { kind: 'Environment', counts: counts({ skip: 1 }) },
      ],
      isUpToDate: false,
    };
    renderInRouter(<ImportPreviewOverview plan={scoped} spaceSlug="Spaces-1" />);

    const table = screen.getByTestId('preview-projects');
    const spaceRow = within(table).getAllByRole('row').find(row => row.textContent?.includes('Space resources (no project)'))!;
    expect(within(spaceRow).getAllByRole('cell').map(cell => cell.textContent).slice(-1)).toEqual(['0']);

    fireEvent.click(within(spaceRow).getByRole('button', { name: /expand row/i }));

    const kindRows = within(within(screen.getByTestId('group-detail-__space__')).getAllByRole('table')[0]).getAllByRole('row').filter(row => row.hasAttribute('data-row-key')).map(row => within(row).getAllByRole('cell').map(cell => cell.textContent));
    expect(kindRows.map(cells => cells[0])).toEqual(['Feed', 'Lifecycle']);
    expect(kindRows.every(cells => cells[6] === '0')).toBe(true);
  });

  it('showsTheByProjectTableWithFourColumns_TheOtherCountsInTheExpandedRow', () => {
    renderInRouter(<ImportPreviewOverview plan={plan()} spaceSlug="Spaces-1" />);

    const table = screen.getByTestId('preview-projects');
    expect(within(table).getAllByRole('columnheader').map(header => header.textContent).filter(Boolean))
      .toEqual(['Octopus project', 'Lands on', 'Create', 'Skip']);

    fireEvent.click(within(table).getAllByRole('button', { name: /expand row/i })[0]);

    expect(within(screen.getByTestId('group-detail-Projects-1')).getAllByRole('columnheader').slice(0, 8).map(header => header.textContent))
      .toEqual(['Kind', 'Already in Squid', 'Create', 'Update', 'Fill secret', 'Link existing', 'Skip', 'Blocked']);
  });

  it('keepsANonZeroBlockedCount_InTheHeadlineTiles_AndOnTheProjectRow', () => {
    const blocked = plan();
    blocked.summary!.projects[0].counts = counts({ alreadyImported: 4, blocked: 2 });
    renderInRouter(<ImportPreviewOverview plan={blocked} spaceSlug="Spaces-1" />);

    const tile = screen.getByTestId('summary-tile-blocked');
    expect(within(screen.getByTestId('summary-tile-details')).queryByTestId('summary-tile-blocked')).not.toBeInTheDocument();
    expect(tile).toHaveTextContent('1');
    expect(within(screen.getByTestId('preview-projects')).getByText('2 blocked')).toBeInTheDocument();
  });

  it('foldsAZeroBlockedCount_IntoTheDetails', () => {
    const clean = plan();
    clean.summary!.counts = counts({ create: 1 });
    renderInRouter(<ImportPreviewOverview plan={clean} spaceSlug="Spaces-1" />);

    expect(within(screen.getByTestId('summary-tile-details')).getByTestId('summary-tile-blocked')).toHaveTextContent('0');
  });

  it('saysHowManyProjectsWereNotChosen_AndOffersToChangeThem', () => {
    const scoped = plan();
    scoped.summary!.notChosenProjectCount = 3;
    const onChangeProjects = vi.fn();
    renderInRouter(<ImportPreviewOverview plan={scoped} spaceSlug="Spaces-1" onChangeProjects={onChangeProjects} />);

    expect(screen.getByTestId('project-scope')).toHaveTextContent('3 projects were not chosen and are not imported.');

    fireEvent.click(screen.getByRole('button', { name: 'Change projects' }));

    expect(onChangeProjects).toHaveBeenCalledTimes(1);
  });

  it('saysHowManyConfigAsCodeProjectsAreNotImported', () => {
    const scoped = plan();
    scoped.summary!.configAsCodeProjectCount = 2;
    renderInRouter(<ImportPreviewOverview plan={scoped} spaceSlug="Spaces-1" />);

    expect(screen.getByTestId('project-scope-config-as-code')).toHaveTextContent('2 projects are version-controlled (Config as Code) in Octopus and are not imported: Squid does not import Config-as-Code projects.');
  });

  it('showsNoProjectScope_ForAWholeSpacePlanWithoutAChangeHandler', () => {
    renderInRouter(<ImportPreviewOverview plan={plan()} spaceSlug="Spaces-1" />);

    expect(screen.queryByTestId('project-scope')).not.toBeInTheDocument();
    expect(screen.queryByText('Not used by the chosen projects')).not.toBeInTheDocument();
  });

  it('rendersNothing_ForAPlanWithoutSummary', () => {
    const { container } = renderInRouter(<ImportPreviewOverview plan={{ ...plan(), summary: null }} spaceSlug="Spaces-1" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('secrets panels', () => {
  it('withheldPanel_RendersNothing_WhenNoSecretIsWithheld', () => {
    const { container } = renderInRouter(<WithheldSecretsPanel resources={plan().resources} onFillFromFile={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('missingAfterImport_LinksEachSecret_AndSaysHowToFillIt', () => {
    const onFill = vi.fn();
    renderInRouter(
      <MissingSecretsAfterImport
        spaceSlug="Spaces-1"
        onFillFromFile={onFill}
        missing={[
          {
            kind: OctopusImportRequiredInputKind.SensitiveVariableValue, name: 'Api.Key', ownerName: 'Shared', ownerKind: 'LibraryVariableSet',
            field: 'Value', scopeSummary: null, destinationId: 3, destinationOwnerId: 12, fillable: true,
          },
          {
            kind: OctopusImportRequiredInputKind.AccountSecret, name: 'Azure', ownerName: null, ownerKind: null,
            field: 'Password', scopeSummary: null, destinationId: 4, destinationOwnerId: null, fillable: false,
          },
        ]}
      />,
    );

    const panel = screen.getByTestId('missing-secrets-after-import');
    expect(within(panel).getByRole('link', { name: 'Api.Key' })).toHaveAttribute('href', '/Spaces-1/library/variables/LibraryVariableSets-12');
    expect(within(panel).getByRole('link', { name: 'Azure' })).toHaveAttribute('href', '/Spaces-1/infrastructure/accounts');
    expect(panel).toHaveTextContent('From the export file');
    expect(panel).toHaveTextContent('Set it in Squid');

    fireEvent.click(within(panel).getByRole('button', { name: 'Fill from export file' }));
    expect(onFill).toHaveBeenCalledTimes(1);
  });

  // The export file fills only sensitive variables and feed passwords: account keys and certificate private keys are set in Squid,
  // so the panels offer the file (and say it fills them) only when at least one listed secret is fillable.
  it.each([[true], [false]])('missingAfterImport_OffersTheExportFileOnlyWhenItCanFillSomething fillable=%s', fillable => {
    renderInRouter(
      <MissingSecretsAfterImport
        spaceSlug="Spaces-1"
        onFillFromFile={vi.fn()}
        missing={[{
          kind: fillable ? OctopusImportRequiredInputKind.SensitiveVariableValue : OctopusImportRequiredInputKind.AccountSecret, name: 'Secret', ownerName: null, ownerKind: null,
          field: 'Password', scopeSummary: null, destinationId: 4, destinationOwnerId: null, fillable,
        }]}
      />,
    );

    const panel = screen.getByTestId('missing-secrets-after-import');
    expect(within(panel).queryByRole('button', { name: 'Fill from export file' }) !== null).toBe(fillable);
    expect(panel.textContent?.includes('Importing the Octopus export file')).toBe(fillable);
    if (!fillable) expect(panel).toHaveTextContent('Set them in Squid');
  });

  it.each([[true], [false]])('withheldPanel_OffersTheExportFileOnlyWhenItCanFillSomething fillable=%s', fillable => {
    const created: OctopusImportPreviewResource = {
      ...resource('Certificate', 'Certificates-1', OctopusImportPreviewAction.Create, null),
      requiredInputs: [{
        kind: OctopusImportRequiredInputKind.CertificatePrivateKey, inputKey: 'key', sourceId: 'Certificates-1', sourceType: 'Certificate', name: 'Web cert',
        fieldName: 'PrivateKey', valueType: 'Sensitive', hasSourceValue: false, isRequired: false, fillable, withheldByServer: true, sourceScopes: {},
      }],
    };

    renderInRouter(<WithheldSecretsPanel resources={[created]} onFillFromFile={vi.fn()} />);

    const panel = screen.getByTestId('withheld-secrets');
    expect(within(panel).queryByRole('button', { name: 'Fill from export file' }) !== null).toBe(fillable);
    expect(panel.textContent?.includes('Importing the Octopus export file')).toBe(fillable);
  });

  it('missingAfterImport_NamesTheFirstSecretAndCountsTheRest_InOneLine', () => {
    const missing = ['Db.Password', 'Api.Key', 'Smtp.Password'].map(name => ({
      kind: OctopusImportRequiredInputKind.SensitiveVariableValue, name, ownerName: 'Web', ownerKind: 'Project',
      field: 'Value', scopeSummary: null, destinationId: 1, destinationOwnerId: 2, fillable: true,
    }));
    renderInRouter(<MissingSecretsAfterImport spaceSlug="Spaces-1" onFillFromFile={vi.fn()} missing={missing} />);

    const panel = screen.getByTestId('missing-secrets-after-import');
    expect(panel.querySelector('.ant-alert-message')).toHaveTextContent('Import completed; 3 secret values are still missing: Db.Password +2 more.');
    expect(within(panel).getAllByRole('button').map(button => button.textContent)).toEqual(['Fill from export file']);
    expect(panel.querySelector('details')).not.toHaveAttribute('open');
    expect(within(panel).getByRole('link', { name: 'Smtp.Password' })).toBeInTheDocument();
  });

  it('withheldPanel_NamesTheFirstSecretAndCountsTheRest_TheListBehindADisclosure', () => {
    const created: OctopusImportPreviewResource = {
      ...resource('Feed', 'Feeds-1', OctopusImportPreviewAction.Create, null),
      sourceName: 'ACR',
      requiredInputs: ['Password', 'Token'].map(fieldName => ({
        kind: OctopusImportRequiredInputKind.FeedPassword, inputKey: fieldName, sourceId: 'Feeds-1', sourceType: 'Feed', name: `ACR ${fieldName}`,
        fieldName, valueType: 'Sensitive', hasSourceValue: false, isRequired: false, fillable: true, withheldByServer: true, sourceScopes: {},
      })),
    };

    renderInRouter(<WithheldSecretsPanel resources={[created]} onFillFromFile={vi.fn()} />);

    const panel = screen.getByTestId('withheld-secrets');
    expect(panel.querySelector('.ant-alert-message')).toHaveTextContent('2 secret values will be imported as missing: ACR Password +1 more.');
    expect(panel.querySelector('details')).toHaveTextContent('ACR Token');
  });

  it('pairingCheckbox_ReportsTheConfirmation', () => {
    const onChange = vi.fn();
    render(
      <FillPairingConfirmation
        confirmed={false}
        onChange={onChange}
        pairing={{
          required: true, confirmed: false, installationId: null, serverHost: null, octopusSpaceId: null, octopusVersion: null,
          fileExportSourceId: null, recordedExportSourceId: null, matchingStructureIds: 1,
        }}
      />,
    );

    expect(screen.getByTestId('fill-pairing')).toHaveTextContent('Server: unknown');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('pairingOfAServerSource_NamesTheServer_NotAnExportFile', () => {
    render(
      <FillPairingConfirmation
        confirmed={false}
        onChange={vi.fn()}
        linksEarlierImport
        pairing={{
          required: true, confirmed: false, installationId: null, serverHost: null, octopusSpaceId: null, octopusVersion: null,
          sourceInstallationId: 'inst-x', sourceServerHost: 'octopus-x.example.com', sourceOctopusSpaceId: 'Spaces-2',
          fileExportSourceId: null, recordedExportSourceId: 'ABC123', matchingStructureIds: 1,
        }}
      />,
    );

    const pairing = screen.getByTestId('fill-pairing');
    expect(pairing).toHaveTextContent('This Octopus server would link to what an earlier import created in this space');
    expect(pairing).toHaveTextContent('1 matching step, action or phase id tie');
    expect(pairing).toHaveTextContent('This source: Server: octopus-x.example.com, Space: Spaces-2, Installation: inst-x');
    expect(pairing).toHaveTextContent('Export file fingerprint: ABC123');
    expect(screen.getByRole('checkbox', { name: 'This is the same Octopus server this space was imported from' })).toBeInTheDocument();
  });
});

const choiceRow = (
  sourceType: string,
  sourceId: string,
  reason: OctopusImportChoiceReason,
  selected: boolean,
  followsSourceId: string | null = null,
): OctopusImportPreviewResource => ({
  ...resource(sourceType, sourceId, selected ? OctopusImportPreviewAction.Create : OctopusImportPreviewAction.Skip, 'Projects-1'),
  sourceName: `${sourceId} name`,
  choice: { reason, selected, defaultSelected: selected, followsSourceId, ownerName: sourceType === 'Channel' ? null : "Deployment process of 'Web'" },
});

const choicesPlan = (): OctopusImportPreviewPlan => ({
  ...plan(),
  resources: [
    ...plan().resources,
    choiceRow('DeploymentStep', 'Steps-2', OctopusImportChoiceReason.DeletedInSquid, false),
    choiceRow('Channel', 'Channels-4', OctopusImportChoiceReason.DeletedInSquid, true),
    choiceRow('DeploymentStep', 'Steps-7', OctopusImportChoiceReason.AddedInOctopus, false),
    choiceRow('DeploymentAction', 'Actions-71', OctopusImportChoiceReason.AddedInOctopus, false, 'Steps-7'),
    choiceRow('DeploymentAction', 'Actions-72', OctopusImportChoiceReason.AddedInOctopus, false, 'Steps-7'),
    choiceRow('LifecyclePhase', 'Phases-3', OctopusImportChoiceReason.AddedInOctopus, false),
  ],
});

// The header checkbox comes first, then one per row in order.
const checkboxesOf = (testId: string) => within(screen.getByTestId(testId)).getAllByRole('checkbox');

describe('ImportPreviewOverview choices', () => {
  it('hidesThePanel_WithoutChoices', () => {
    renderInRouter(<ImportPreviewOverview plan={plan()} spaceSlug="Spaces-1" onChoiceChange={vi.fn()} />);

    expect(screen.queryByTestId('preview-choices')).not.toBeInTheDocument();
  });

  it('showsBothGroups_WithTheirCopy_AndTheFooter', () => {
    renderInRouter(<ImportPreviewOverview plan={choicesPlan()} spaceSlug="Spaces-1" onChoiceChange={vi.fn()} />);

    const deleted = screen.getByTestId('choices-deleted');
    const added = screen.getByTestId('choices-added');
    expect(deleted).toHaveTextContent('Deleted in Squid');
    expect(deleted).toHaveTextContent('They stay deleted unless you tick them.');
    expect(added).toHaveTextContent('Added in Octopus since the last import');
    expect(added).toHaveTextContent('nothing already in Squid is overwritten');
    expect(screen.getByTestId('choices-footer')).toHaveTextContent('Unticked items are not remembered: the next import offers them again.');
    expect(screen.queryByTestId('choices-pending')).not.toBeInTheDocument();
  });

  it('listsRootsOnly_WithKindFollowersOwnerAndProject', () => {
    renderInRouter(<ImportPreviewOverview plan={choicesPlan()} spaceSlug="Spaces-1" onChoiceChange={vi.fn()} />);

    const added = screen.getByTestId('choices-added');
    const step = within(added).getByText('Steps-7 name').closest('tr') as HTMLElement;
    expect(step).toHaveTextContent('Step');
    expect(step).toHaveTextContent('+2 actions');
    expect(step).toHaveTextContent("Deployment process of 'Web'");
    expect(step).toHaveTextContent('Web');
    expect(within(added).getByText('Phases-3 name').closest('tr')).toHaveTextContent('Lifecycle phase');
    expect(within(added).queryByText('Actions-71 name')).not.toBeInTheDocument();
  });

  it('checkboxesReflectTheSelection', () => {
    renderInRouter(<ImportPreviewOverview plan={choicesPlan()} spaceSlug="Spaces-1" onChoiceChange={vi.fn()} />);

    const [, step, channel] = checkboxesOf('choices-deleted');
    expect(step).not.toBeChecked();
    expect(channel).toBeChecked();
    expect(checkboxesOf('choices-added').slice(1).every(box => !(box as HTMLInputElement).checked)).toBe(true);
  });

  it('tickingARow_ReportsThatRowOnly', () => {
    const onChoiceChange = vi.fn();
    renderInRouter(<ImportPreviewOverview plan={choicesPlan()} spaceSlug="Spaces-1" onChoiceChange={onChoiceChange} />);

    fireEvent.click(checkboxesOf('choices-added')[1]);

    expect(onChoiceChange).toHaveBeenCalledWith(['Steps-7'], true);
  });

  it('selectAll_SelectsOnlyItsOwnGroup', () => {
    const onChoiceChange = vi.fn();
    renderInRouter(<ImportPreviewOverview plan={choicesPlan()} spaceSlug="Spaces-1" onChoiceChange={onChoiceChange} />);

    fireEvent.click(checkboxesOf('choices-added')[0]);

    expect(onChoiceChange).toHaveBeenCalledTimes(1);
    expect(onChoiceChange).toHaveBeenCalledWith(['Steps-7', 'Phases-3'], true);
  });

  // Only declined offers left: up to date, but the banner never claims the offered items are in Squid.
  it.each([
    [false, 'Everything this source contains is already in Squid; importing again would change nothing.'],
    [true, 'already in Squid, except the items offered below; importing again changes nothing unless you tick one of them.'],
  ])('upToDateBanner_NamesTheOffersLeft(withOffers=%s)', (withOffers, says) => {
    const base = withOffers ? choicesPlan() : plan();
    const upToDate = { ...base, summary: { ...base.summary!, isUpToDate: true } };

    renderInRouter(<ImportPreviewOverview plan={upToDate} spaceSlug="Spaces-1" onChoiceChange={vi.fn()} />);

    expect(screen.getByTestId('preview-up-to-date')).toHaveTextContent(says);
  });

  it('showsThePendingNotice_AndDisablesTheTicks_WhenAsked', () => {
    renderInRouter(<ImportPreviewOverview plan={choicesPlan()} spaceSlug="Spaces-1" onChoiceChange={vi.fn()} choicesPending choicesDisabled />);

    expect(screen.getByTestId('choices-pending')).toHaveTextContent('update the preview to see the new counts before importing.');
    expect(checkboxesOf('choices-deleted').slice(1).every(box => (box as HTMLInputElement).disabled)).toBe(true);
  });
});

describe('LegacyPreviewOverview', () => {
  const legacyResources = (): OctopusImportPreviewResource[] => [
    { ...resource('Project', 'Projects-1', OctopusImportPreviewAction.Create, 'Projects-1'), sourceName: 'Web' },
    resource('Release', 'Releases-1', OctopusImportPreviewAction.Create, 'Projects-1'),
    resource('Release', 'Releases-2', OctopusImportPreviewAction.AlreadyImported, 'Projects-1'),
    resource('Environment', 'Environments-1', OctopusImportPreviewAction.ReuseExisting, null),
    resource('Lifecycle', 'Lifecycles-1', OctopusImportPreviewAction.Blocked, null),
    { ...resource('Lifecycle', 'Lifecycles-2', OctopusImportPreviewAction.Skip, null), sourceName: 'Slow', skipReason: { code: 'octopus.preview.not_used_by_chosen_projects', message: 'Not used.' } },
  ];

  it('usesTheSameFourTiles_WithABlockedCountKeptInView', () => {
    renderInRouter(<LegacyPreviewOverview resources={legacyResources()} spaceSlug="Spaces-1" />);

    expect(screen.getByTestId('import-tile-create')).toHaveTextContent('2');
    expect(screen.getByTestId('import-tile-alreadyImported')).toHaveTextContent('1');
    expect(screen.getByTestId('import-tile-update')).toHaveTextContent('0');
    expect(screen.getByTestId('import-tile-notChosen')).toHaveTextContent('1');
    expect(screen.getByTestId('import-tile-blocked')).toHaveTextContent('1');
  });

  it('showsTheFourColumnByProjectTable_WithTheNotChosenRowCollapsed', () => {
    renderInRouter(<LegacyPreviewOverview resources={legacyResources()} spaceSlug="Spaces-1" />);

    const table = screen.getByTestId('preview-projects');
    expect(within(table).getAllByRole('columnheader').map(header => header.textContent).filter(Boolean))
      .toEqual(['Octopus project', 'Lands on', 'Create', 'Skip']);
    const cells = (name: string) => within(within(table).getAllByRole('row').find(row => row.textContent?.includes(name))!).getAllByRole('cell').map(cell => cell.textContent);
    expect(cells('Web')).toEqual(['', 'Web', 'Not reported', '2', '0']);
    expect(cells('Space resources (no project)')).toEqual(['', 'Space resources (no project)1 blocked', 'This Squid space', '0', '0']);
    expect(cells('Not used by the chosen projects')).toEqual(['', 'Not used by the chosen projects', 'Not imported', '0', '1']);
  });
});

// A project with thousands of history rows: an expanded row, a list or a table shows one page, never every row at once.
describe('large previews', () => {
  const many = <T,>(count: number, make: (index: number) => T) => Array.from({ length: count }, (_, index) => make(index));

  const largePlan = (resources: OctopusImportPreviewResource[], projectCount = 1): OctopusImportPreviewPlan => {
    const base = plan();
    const projects = many(projectCount, index => index).map(index => ({
      ...base.summary!.projects[0], sourceId: `Projects-${index + 1}`, sourceName: `Project ${String(index + 1).padStart(4, '0')}`,
    }));
    return { ...base, resources, summary: { ...base.summary!, projects } };
  };

  const expandFirstProject = () =>
    fireEvent.click(within(screen.getByTestId('preview-projects')).getAllByRole('button', { name: /expand row/i })[0]);

  it('expandedProject_ShowsTheFirstFiftyChanges_AndShowAllListsEveryOne', () => {
    const updates = many(120, index => ({
      ...resource('Release', `Releases-${index}`, OctopusImportPreviewAction.Update, 'Projects-1'),
      changes: [{ field: 'ReleaseNotes', oldValue: 'a', newValue: 'b', valueHidden: false, description: null }],
    }));
    renderInRouter(<ImportPreviewOverview plan={largePlan(updates)} spaceSlug="Spaces-1" />);

    expandFirstProject();

    const detail = screen.getByTestId('group-detail-Projects-1');
    expect(detail.querySelectorAll('[data-testid^="changes-Release-"]')).toHaveLength(50);
    fireEvent.click(within(detail).getByRole('button', { name: 'Show all 120' }));
    expect(detail.querySelectorAll('[data-testid^="changes-Release-"]')).toHaveLength(120);
  });

  it('expandedProject_ShowsTheFirstFiftySkips_AndShowAllListsEveryOne', () => {
    const skips = many(120, index => ({
      ...resource('ServerTask', `ServerTasks-${index}`, OctopusImportPreviewAction.Skip, 'Projects-1'),
      skipReason: { code: 'runbook', message: 'Runbook runs are not imported.' },
    }));
    renderInRouter(<ImportPreviewOverview plan={largePlan(skips)} spaceSlug="Spaces-1" />);

    expandFirstProject();

    const detail = screen.getByTestId('group-detail-Projects-1');
    expect(within(detail).getAllByText(/Runbook runs are not imported/)).toHaveLength(50);
    fireEvent.click(within(detail).getByRole('button', { name: 'Show all 120' }));
    expect(within(detail).getAllByText(/Runbook runs are not imported/)).toHaveLength(120);
  });

  it('notChosenRow_ListsTheFirstFifty_AndShowAllListsEveryOne', () => {
    const outside = many(120, index => ({
      ...resource('Lifecycle', `Lifecycles-${index}`, OctopusImportPreviewAction.Skip, null),
      skipReason: { code: 'octopus.preview.not_used_by_chosen_projects', message: 'Not used.' },
    }));
    renderInRouter(<ImportPreviewOverview plan={largePlan(outside)} spaceSlug="Spaces-1" />);

    const table = screen.getByTestId('preview-projects');
    const notChosen = within(table).getAllByRole('row').find(row => row.textContent?.includes('Not used by the chosen projects'))!;
    fireEvent.click(within(notChosen).getByRole('button', { name: /expand row/i }));

    const list = screen.getByTestId('not-chosen-resources');
    expect(within(list).getAllByRole('listitem')).toHaveLength(50);
    fireEvent.click(within(list.parentElement!).getByRole('button', { name: 'Show all 120' }));
    expect(within(screen.getByTestId('not-chosen-resources')).getAllByRole('listitem')).toHaveLength(120);
  });

  it('byProjectTable_ShowsOnePageOfAWholeSpace', () => {
    renderInRouter(<ImportPreviewOverview plan={largePlan([], 420)} spaceSlug="Spaces-1" />);

    const table = screen.getByTestId('preview-projects');
    expect(table.querySelectorAll('tr[data-row-key^="Projects-"]')).toHaveLength(50);
    expect(within(table.closest('section')!).getByTitle('9')).toBeInTheDocument();
  });

  it('withheldSecrets_ShowsOnePageOfTheTable', () => {
    const variables = many(120, index => ({
      ...resource('Variable', `Variables-${index}`, OctopusImportPreviewAction.Create, 'Projects-1'),
      requiredInputs: [{
        kind: OctopusImportRequiredInputKind.SensitiveVariableValue, inputKey: `k${index}`, sourceId: `v${index}`, sourceType: 'Variable',
        name: `Secret.${index}`, fieldName: 'Value', valueType: 'Sensitive', hasSourceValue: false, isRequired: false, fillable: true,
        withheldByServer: true, sourceScopes: {},
      }],
    }));
    renderInRouter(<WithheldSecretsPanel resources={variables} onFillFromFile={() => undefined} />);

    expect(screen.getByTestId('withheld-secrets').querySelectorAll('tr[data-row-key]')).toHaveLength(50);
  });

  it('derivesTheChoicesOncePerPlan_NotOnEveryRender', () => {
    const choices = vi.mocked(previewSummary.choiceGroups);
    const current = plan();
    const { rerender } = renderInRouter(<ImportPreviewOverview plan={current} spaceSlug="Spaces-1" />);
    const afterFirstRender = choices.mock.calls.filter(call => call[0] === current.resources).length;

    rerender(<MemoryRouter><ImportPreviewOverview plan={current} spaceSlug="Spaces-1" choicesPending /></MemoryRouter>);

    expect(afterFirstRender).toBe(1);
    expect(choices.mock.calls.filter(call => call[0] === current.resources)).toHaveLength(1);
  });

  it('withheldSecretsPanel_DerivesItsRowsOncePerResources_NotOnEveryRender', () => {
    const withheld = vi.mocked(previewSummary.withheldSecrets);
    const resources = plan().resources;
    const { rerender } = renderInRouter(<WithheldSecretsPanel resources={resources} onFillFromFile={() => undefined} />);

    rerender(<MemoryRouter><WithheldSecretsPanel resources={resources} onFillFromFile={() => undefined} disabled /></MemoryRouter>);

    expect(withheld.mock.calls.filter(call => call[0] === resources)).toHaveLength(1);
  });
});
