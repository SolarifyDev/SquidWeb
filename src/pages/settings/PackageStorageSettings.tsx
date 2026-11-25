import { Fragment, useCallback, useEffect, useState } from 'react'
import { Alert, Button, Dropdown, Modal, Spin, Tag, type MenuProps } from 'antd'
import { EllipsisOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import {
  deletePackageStore,
  getPackageStoreProviders,
  getPackageStores,
  setDefaultPackageStore,
  testPackageStore,
  type PackageStoreDto,
  type PackageStoreProviderDescriptor,
} from 'pages/apis/packageStore'
import PackageStoreDialog from './packageStorage/PackageStoreDialog'
import { describeLocation, providerDisplayName } from './packageStorage/storeDisplay'

type Notice = { type: 'success' | 'error'; text: string }
type DialogState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; store: PackageStoreDto }

function errorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message || fallback
}

function LastCheck({ store }: { store: PackageStoreDto }) {
  if (store.lastTestSucceeded == null) return <span className="text-slate-400">Not checked</span>

  return (
    <div>
      <Tag color={store.lastTestSucceeded ? 'success' : 'error'} title={store.lastTestMessage ?? undefined}>
        {store.lastTestSucceeded ? 'Passed' : 'Failed'}
      </Tag>
      {store.lastTestedDate ? <div className="text-xs text-slate-500">{new Date(store.lastTestedDate).toLocaleString()}</div> : null}
      {!store.lastTestSucceeded && store.lastTestMessage ? <div className="break-words text-xs text-red-600">{store.lastTestMessage}</div> : null}
    </div>
  )
}

export function PackageStorageSettings() {
  const [stores, setStores] = useState<PackageStoreDto[]>([])
  const [providers, setProviders] = useState<PackageStoreProviderDescriptor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' })

  const reload = useCallback(async () => {
    try {
      const [nextStores, nextProviders] = await Promise.all([getPackageStores(), getPackageStoreProviders()])
      setStores(nextStores)
      setProviders(nextProviders)
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, 'Failed to load package stores.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const runAction = async (action: () => Promise<unknown>, successText: string, failureText: string) => {
    try {
      await action()
      setNotice({ type: 'success', text: successText })
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error, failureText) })
    }
    await reload()
  }

  const makeDefault = (store: PackageStoreDto) => runAction(() => setDefaultPackageStore(store.id), `${store.name} is now the default store.`, 'Failed to set the default store.')

  const runStoreTest = async (store: PackageStoreDto) => {
    try {
      const result = await testPackageStore(store.id)
      setNotice({ type: result.success ? 'success' : 'error', text: result.message })
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error, 'Failed to test the package store.') })
    }
    await reload()
  }

  const confirmDelete = (store: PackageStoreDto) =>
    Modal.confirm({
      title: `Delete ${store.name}?`,
      content: "This removes the store from Squid. A store that still holds packages can't be deleted.",
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => runAction(() => deletePackageStore(store.id), `${store.name} deleted.`, 'Failed to delete the package store.'),
    })

  const moreMenu = (store: PackageStoreDto): MenuProps => ({
    items: [
      { key: 'default', label: 'Set as default', onClick: () => void makeDefault(store) },
      { key: 'delete', label: 'Delete', danger: true, onClick: () => confirmDelete(store) },
    ],
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-xl font-semibold text-slate-900">Package storage</h2>
          <p className="mt-1 mb-0 text-sm text-slate-600">Where uploaded packages are kept. New packages go to the default store.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} disabled={providers.length === 0} onClick={() => setDialog({ mode: 'add' })}>
          Add store
        </Button>
      </div>

      {notice ? <Alert className="mb-4" type={notice.type} showIcon closable message={notice.text} onClose={() => setNotice(null)} /> : null}
      {loadError ? <Alert className="mb-4" type="error" showIcon message={loadError} /> : null}

      {loading ? (
        <Spin />
      ) : (
        <div data-testid="package-stores-scroll" className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="min-w-[8rem] py-2 pr-3">Name</th>
              <th className="min-w-[6rem] whitespace-nowrap py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Location</th>
              <th className="min-w-[6rem] py-2 pr-3">Last check</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <Fragment key={store.id}>
              <tr className={`align-top ${store.warnings.length > 0 ? '' : 'border-b border-slate-100'}`}>
                <td className="py-3 pr-3">
                  <span className="font-medium text-slate-900">{store.name}</span>
                  {store.isDefault ? <Tag className="ml-2" color="blue">Default</Tag> : null}
                </td>
                <td className="whitespace-nowrap py-3 pr-3">{providerDisplayName(store, providers)}</td>
                <td className="break-all py-3 pr-3 font-mono text-xs">{describeLocation(store, providers.find((provider) => provider.kind === store.kind))}</td>
                <td className="py-3 pr-3"><LastCheck store={store} /></td>
                <td className="py-3 text-right whitespace-nowrap">
                  <Button type="link" size="small" onClick={() => setDialog({ mode: 'edit', store })}>Edit</Button>
                  <Button type="link" size="small" onClick={() => runStoreTest(store)}>Test</Button>
                  {!store.isDefault ? (
                    <Dropdown trigger={['click']} placement="bottomRight" menu={moreMenu(store)}>
                      <Button type="text" size="small" aria-label="More actions" icon={<EllipsisOutlined />} />
                    </Dropdown>
                  ) : null}
                </td>
              </tr>
              {store.warnings.length > 0 ? (
                <tr data-testid={`store-warnings-${store.id}`} className="border-b border-slate-100">
                  <td colSpan={5} className="pb-3">
                    {store.warnings.map((warning) => (
                      <div key={warning} className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <WarningOutlined className="mt-0.5" />
                        <span className="min-w-0 break-all">{warning}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ) : null}
              </Fragment>
            ))}
            {stores.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-slate-500">No package stores.</td></tr>
            ) : null}
          </tbody>
        </table>
        </div>
      )}

      {dialog.mode !== 'closed' ? (
        <PackageStoreDialog providers={providers} store={dialog.mode === 'edit' ? dialog.store : undefined} onClose={() => setDialog({ mode: 'closed' })} onChanged={() => void reload()} />
      ) : null}
    </div>
  )
}
