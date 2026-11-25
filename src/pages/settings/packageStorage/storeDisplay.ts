import type { PackageStoreDto, PackageStoreProviderDescriptor } from 'pages/apis/packageStore'

const DEFAULT_LOCATION_LABEL = 'Default location'

/** The first path-like setting that has a value; an empty one means the provider's own default. */
export function describeLocation(store: PackageStoreDto, provider?: PackageStoreProviderDescriptor) {
  const locationField = provider?.fields.find((field) => (field.kind === 'Path' || field.kind === 'Text') && store.properties[field.key])
  return locationField ? store.properties[locationField.key] : DEFAULT_LOCATION_LABEL
}

export function providerDisplayName(store: PackageStoreDto, providers: PackageStoreProviderDescriptor[]) {
  return providers.find((provider) => provider.kind === store.kind)?.displayName ?? store.kind
}
