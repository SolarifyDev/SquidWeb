import type { PackageStoreDto, PackageStoreProviderDescriptor } from 'pages/apis/packageStore'

export function findProvider(store: PackageStoreDto, providers: PackageStoreProviderDescriptor[]) {
  return providers.find((provider) => provider.kind === store.kind)
}

export function providerDisplayName(store: PackageStoreDto, providers: PackageStoreProviderDescriptor[]) {
  return findProvider(store, providers)?.displayName ?? store.kind
}

/**
 * Where the store keeps its packages: the location the server resolved (so a store with an empty folder setting shows the folder it
 * falls back to). Only for an older server that sends none, the value of the field the descriptor marks as the location; otherwise null.
 */
export function locationOf(store: PackageStoreDto, provider?: PackageStoreProviderDescriptor) {
  if (store.location) return store.location

  const field = provider?.fields.find((item) => item.isLocation)
  return (field && store.properties[field.key]) || null
}
