import { Alert, Empty, Tag } from 'antd'
import type { PackageFacts, RecipeRecommendations } from 'pages/apis/builtInPackages'

const FACT_LABELS: Record<string, string> = {
  'archive.wrapped': 'Wrapped in one top-level folder',
  'archive.root': 'Top-level folder',
  'files.count': 'Files',
  'files.truncated': 'File list truncated',
  'files.oversized': 'Contains oversized files',
  'marker.dockerfile': 'Has a Dockerfile',
  'marker.compose': 'Has a Compose file',
  'marker.index-html': 'Has index.html',
  'marker.index-html.dir': 'index.html folder',
  'marker.squid-yaml': 'Has squid.yaml',
  'node.package-json': 'Has package.json',
  'node.build-script': 'Node build script',
  'node.start-script': 'Node start script',
  'node.engines': 'Node engines',
  'node.error': 'package.json problem',
  'squid.recipe': 'squid.yaml recipe',
  'squid.run.port': 'Run port',
  'squid.run.command': 'Run command',
  'squid.health.path': 'Health check path',
  'squid.error': 'squid.yaml problem',
}

const INSPECTOR_FAILED_PREFIX = 'inspector.failed.'

export function factLabel(key: string) {
  if (FACT_LABELS[key]) return FACT_LABELS[key]
  if (key.startsWith(INSPECTOR_FAILED_PREFIX)) return `Inspector failed: ${key.slice(INSPECTOR_FAILED_PREFIX.length)}`

  return key
}

export function factValue(value: string) {
  if (value === 'true') return 'Yes'
  if (value === 'false') return 'No'

  return value
}

/** Known keys first (in the order above), then the rest alphabetically. */
export function orderedFacts(facts: PackageFacts) {
  const known = Object.keys(FACT_LABELS)
  const rank = (key: string) => (known.includes(key) ? known.indexOf(key) : known.length)

  return Object.entries(facts.values ?? {}).filter(([, value]) => value != null && value.trim() !== '').sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
}

export function FactsView({ facts, inspected }: { facts?: PackageFacts | null; inspected: boolean }) {
  if (!inspected || !facts) return <div className="text-sm text-gray-500">Not inspected: this version was pushed before package inspection existed.</div>

  const rows = orderedFacts(facts)

  if (rows.length === 0) return <div className="text-sm text-gray-500">Inspection found nothing notable in this package.</div>

  return (
    <dl data-testid="package-facts" className="m-0 grid gap-x-4 gap-y-1 text-sm" style={{ gridTemplateColumns: 'max-content 1fr' }}>
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-gray-500">{factLabel(key)}</dt>
          <dd className="m-0 break-all font-medium text-gray-900">{factValue(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function RecipesView({ recommendations }: { recommendations: RecipeRecommendations }) {
  const { selection } = recommendations

  if (selection.unknownRecipe)
    return (
      <Alert
        type="warning"
        showIcon
        message={`squid.yaml asks for the recipe "${selection.unknownRecipe}", which does not exist`}
        description={selection.validKinds.length > 0 ? `Available recipes: ${selection.validKinds.join(', ')}` : undefined}
      />
    )

  if (selection.candidates.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recipe matched yet" />

  return (
    <ol data-testid="recipe-list" className="m-0 list-none space-y-3 p-0">
      {selection.candidates.map((candidate) => (
        <li key={candidate.kind} className="rounded border border-gray-200 p-3" data-testid="recipe-row">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{candidate.kind}</span>
            <Tag color="blue">Score {candidate.score}</Tag>
            {selection.requestedKind === candidate.kind && <Tag color="green">Requested by squid.yaml</Tag>}
          </div>
          <ul className="m-0 mt-2 list-disc pl-5 text-sm text-gray-600">
            {candidate.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
