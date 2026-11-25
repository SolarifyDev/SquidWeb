import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FactsView, RecipesView, factLabel, orderedFacts } from './FactsView'

describe('facts', () => {
  it('knownKeysGetFriendlyLabels_AndTrueReadsAsYes', () => {
    render(<FactsView inspected facts={{ values: { 'marker.dockerfile': 'true', 'squid.run.port': '8080' } }} />)

    expect(screen.getByText('Has a Dockerfile')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('Run port')).toBeInTheDocument()
    expect(screen.getByText('8080')).toBeInTheDocument()
  })

  it('unknownKeys_ShowTheRawKey_AndInspectorFailuresAreNamed', () => {
    expect(factLabel('something.new')).toBe('something.new')
    expect(factLabel('inspector.failed.NodeInspector')).toBe('Inspector failed: NodeInspector')
  })

  it('knownKeysComeFirstInDeclaredOrder_ThenTheRest', () => {
    const keys = orderedFacts({ values: { zeta: '1', 'squid.run.port': '1', 'marker.dockerfile': 'true', alpha: '1' } }).map(([key]) => key)

    expect(keys).toEqual(['marker.dockerfile', 'squid.run.port', 'alpha', 'zeta'])
  })

  it('notInspected_SaysSo', () => {
    render(<FactsView inspected={false} facts={null} />)

    expect(screen.getByText(/pushed before package inspection existed/)).toBeInTheDocument()
  })
})

describe('recipes', () => {
  const selection = (patch: object) => ({ inspected: true, facts: { values: {} }, selection: { candidates: [], validKinds: [], ...patch } })

  it('noCandidates_ShowsNoRecipeMatchedYet_NotAnError', () => {
    render(<RecipesView recommendations={selection({})} />)

    expect(screen.getByText('No recipe matched yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('candidates_ShowScoreAndReasons', () => {
    render(<RecipesView recommendations={selection({ candidates: [{ kind: 'static-site', score: 80, reasons: ['Has index.html', 'No server entry point'] }], requestedKind: 'static-site' })} />)

    expect(screen.getByText('static-site')).toBeInTheDocument()
    expect(screen.getByText('Score 80')).toBeInTheDocument()
    expect(screen.getByText('Has index.html')).toBeInTheDocument()
    expect(screen.getByText('Requested by squid.yaml')).toBeInTheDocument()
  })

  it('unknownRequestedRecipe_ListsTheValidOnes', () => {
    render(<RecipesView recommendations={selection({ unknownRecipe: 'rocket', validKinds: ['node', 'static-site'] })} />)

    expect(screen.getByText(/"rocket", which does not exist/)).toBeInTheDocument()
    expect(screen.getByText('Available recipes: node, static-site')).toBeInTheDocument()
  })
})
