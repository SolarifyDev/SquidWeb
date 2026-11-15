import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
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
  MissingSecretsAfterImport,
  WithheldSecretsPanel,
} from './ImportPreviewDetails';

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
        onDone={vi.fn()}
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
        onDone={vi.fn()}
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
});
