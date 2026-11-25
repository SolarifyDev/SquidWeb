import type { PackageStoreDto, PackageStoreProviderDescriptor } from 'pages/apis/packageStore'

export function findProvider(store: PackageStoreDto, providers: PackageStoreProviderDescriptor[]) {
  return providers.find((provider) => provider.kind === store.kind)
}

export function providerDisplayName(store: PackageStoreDto, providers: PackageStoreProviderDescriptor[]) {
  return findProvider(store, providers)?.displayName ?? store.kind
}

/** The value of the field the descriptor marks as the location; null when the provider declares none or the store has no value for it. */
export function locationOf(store: PackageStoreDto, provider?: PackageStoreProviderDescriptor) {
  const field = provider?.fields.find((item) => item.isLocation)
  return (field && store.properties[field.key]) || null
}
