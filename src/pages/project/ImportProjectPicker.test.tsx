import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OctopusImportProjectList } from 'pages/apis/octopusImport';
import { ImportProjectPicker } from './ImportProjectPicker';

const list: OctopusImportProjectList = {
  groups: [{ id: 'ProjectGroups-1', name: 'Web apps' }, { id: 'ProjectGroups-2', name: 'Services' }],
  projects: [
    { id: 'Projects-1', name: 'Web', projectGroupId: 'ProjectGroups-1', isDisabled: false, previouslyImported: true },
    { id: 'Projects-2', name: 'Admin', projectGroupId: 'ProjectGroups-1', isDisabled: false, previouslyImported: false },
    { id: 'Projects-3', name: 'Api', projectGroupId: 'ProjectGroups-2', isDisabled: true, previouslyImported: false },
    { id: 'Projects-4', name: 'Loose', projectGroupId: null, isDisabled: false, previouslyImported: false },
  ],
  selectedProjectIds: null,
};

const Harness: React.FC<{ initial?: string[]; source?: OctopusImportProjectList; onChange?: (ids: string[]) => void }> = ({ initial = [], source = list, onChange }) => {
  const [selected, setSelected] = useState(initial);
  return (
    <ImportProjectPicker
      list={source}
      selected={selected}
      onChange={(ids) => {
        setSelected(ids);
        onChange?.(ids);
      }}
    />
  );
};

const checkbox = (name: string | RegExp) => screen.getByRole('checkbox', { name });
const count = () => screen.getByTestId('project-picker-count');
const search = (text: string) => fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: text } });

describe('ImportProjectPicker', () => {
  it('showsAListingSpinner_UntilTheListArrives', () => {
    render(<ImportProjectPicker list={null} selected={[]} onChange={vi.fn()} loading />);

    expect(screen.getByTestId('project-picker-loading')).toHaveTextContent('Listing projects in this space');
    expect(screen.queryByTestId('project-picker')).not.toBeInTheDocument();
  });

  it('groupsByProjectGroup_WithTheNoGroupBucket_AndCountsNothingChosen', () => {
    render(<Harness />);

    expect(checkbox('Services (0/1)')).toBeInTheDocument();
    expect(checkbox('Web apps (0/2)')).toBeInTheDocument();
    expect(checkbox('No project group (0/1)')).toBeInTheDocument();
    expect(count()).toHaveTextContent('0 of 4 projects chosen');
  });

  it('marksProjectsImportedBefore_AndDisabledInOctopus', () => {
    render(<Harness />);

    expect(within(screen.getByTestId('picker-project-Projects-1')).getByText('Imported before')).toBeInTheDocument();
    expect(within(screen.getByTestId('picker-project-Projects-2')).queryByText('Imported before')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('picker-project-Projects-3')).getByText('Disabled in Octopus')).toBeInTheDocument();
  });

  it('searchFiltersByProjectOrGroupName', () => {
    render(<Harness />);

    search('serv');

    expect(checkbox('Api')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Web' })).not.toBeInTheDocument();

    search('ADM');

    expect(checkbox('Admin')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Api' })).not.toBeInTheDocument();
  });

  it('groupCheckbox_TicksAndUnticksTheWholeGroup_AndIsIndeterminateWhenPartial', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(checkbox('Web'));
    expect(checkbox('Web apps (1/2)').closest('.ant-checkbox-wrapper')?.querySelector('.ant-checkbox-indeterminate')).not.toBeNull();

    fireEvent.click(checkbox('Web apps (1/2)'));
    expect(onChange).toHaveBeenLastCalledWith(['Projects-1', 'Projects-2']);
    expect(checkbox('Web apps (2/2)')).toBeChecked();

    fireEvent.click(checkbox('Web apps (2/2)'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('selectAll_ActsOnTheShownProjectsOnly', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    search('web');

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));

    expect(onChange).toHaveBeenLastCalledWith(['Projects-1', 'Projects-2']);
    expect(count()).toHaveTextContent('2 of 4 projects chosen');

    search('');
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(count()).toHaveTextContent('4 of 4 projects chosen');

    search('api');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith(['Projects-1', 'Projects-2', 'Projects-4']);
  });

  // A large space starts with its groups collapsed (nothing mounted per project); a search opens the groups it matches.
  it('largeSpace_GroupsStartCollapsed_ASearchOpensTheMatches', () => {
    const projects = Array.from({ length: 300 }, (_, index) => ({ id: `Projects-${index}`, name: `Service ${index}`, projectGroupId: index % 2 ? 'ProjectGroups-1' : 'ProjectGroups-2', isDisabled: false, previouslyImported: false }));
    render(<Harness source={{ ...list, projects }} />);

    expect(screen.queryByTestId('picker-project-Projects-7')).not.toBeInTheDocument();
    expect(checkbox('Web apps (0/150)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(count()).toHaveTextContent('300 of 300 projects chosen');

    search('Service 7');

    expect(checkbox('Service 7')).toBeChecked();
    expect(screen.queryByTestId('picker-project-Projects-8')).not.toBeInTheDocument();
  });
});
