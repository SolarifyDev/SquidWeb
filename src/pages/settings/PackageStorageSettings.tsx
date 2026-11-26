import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
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
import { findProvider, locationOf, providerDisplayName } from './packageStorage/storeDisplay'

type Notice = { type: 'success' | 'error'; text: string; warnings?: string[] }
type RowAction = 'test' | 'default' | 'delete'
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

  const [busyRows, setBusyRows] = useState<Record<number, RowAction>>({})
  const rowsInFlight = useRef(new Set<number>())
  const latestReload = useRef(0)

  // Only the most recently started reload may update the page: an older, slower one would show stale rows.
  const reload = useCallback(async () => {
    const ticket = ++latestReload.current
    try {
      const [nextStores, nextProviders] = await Promise.all([getPackageStores(), getPackageStoreProviders()])
      if (ticket !== latestReload.current) return
      setStores(nextStores)
      setProviders(nextProviders)
      setLoadError(null)
    } catch (error) {
      if (ticket === latestReload.current) setLoadError(errorMessage(error, 'Failed to load package stores.'))
    } finally {
      if (ticket === latestReload.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // One action per row at a time: a second click while one is in flight is ignored.
  const runRowAction = async (store: PackageStoreDto, action: RowAction, run: () => Promise<Notice>) => {
    if (rowsInFlight.current.has(store.id)) return
    rowsInFlight.current.add(store.id)
    setBusyRows((current) => ({ ...current, [store.id]: action }))
    try {
      setNotice(await run())
    } finally {
      rowsInFlight.current.delete(store.id)
      setBusyRows((current) => {
        const next = { ...current }
        delete next[store.id]
        return next
      })
    }
    await reload()
  }

  const mutate = (store: PackageStoreDto, action: RowAction, call: () => Promise<unknown>, successText: string, failureText: string) =>
    runRowAction(store, action, async () => {
      try {
        await call()
        return { type: 'success', text: successText }
      } catch (error) {
        return { type: 'error', text: errorMessage(error, failureText) }
      }
    })

  const makeDefault = (store: PackageStoreDto) => mutate(store, 'default', () => setDefaultPackageStore(store.id), `${store.name} is now the default store.`, 'Failed to set the default store.')

  const runStoreTest = (store: PackageStoreDto) =>
    runRowAction(store, 'test', async () => {
      try {
        const result = await testPackageStore(store.id)
        return { type: result.success ? 'success' : 'error', text: result.message, warnings: result.warnings ?? [] }
      } catch (error) {
        return { type: 'error', text: errorMessage(error, 'Failed to test the package store.') }
      }
    })

  const confirmDelete = (store: PackageStoreDto) =>
    Modal.confirm({
      title: `Delete ${store.name}?`,
      content: "This removes the store from Squid. A store that still holds packages can't be deleted.",
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => mutate(store, 'delete', () => deletePackageStore(store.id), `${store.name} deleted.`, 'Failed to delete the package store.'),
    })

  const moreMenu = (store: PackageStoreDto): MenuProps => ({
    items: [
      { key: 'default', label: 'Set as default', onClick: () => void makeDefault(store) },
      { key: 'delete', label: 'Delete', danger: true, onClick: () => confirmDelete(store) },
    ],
  })

  const showLocation = stores.some((store) => locationOf(store, findProvider(store, providers)) != null)
  const columnCount = showLocation ? 5 : 4

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-xl font-semibold text-slate-900">Built-in feed storage</h2>
          <p className="mt-1 mb-0 text-sm text-slate-600">Where the built-in feed keeps the packages you push to Squid. Packages from external feeds are not stored here. New packages go to the default store.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} disabled={providers.length === 0} onClick={() => setDialog({ mode: 'add' })}>
          Add store
        </Button>
      </div>

      {notice ? (
        <Alert
          className="mb-4"
          type={notice.type}
          showIcon
          closable
          message={notice.text}
          description={notice.warnings?.length ? notice.warnings.map((warning) => <div key={warning}>{warning}</div>) : undefined}
          onClose={() => setNotice(null)}
        />
      ) : null}
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
              {showLocation ? <th className="py-2 pr-3">Location</th> : null}
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
                {showLocation ? <td className="break-all py-3 pr-3 font-mono text-xs">{locationOf(store, findProvider(store, providers))}</td> : null}
                <td className="py-3 pr-3"><LastCheck store={store} /></td>
                <td className="py-3 text-right whitespace-nowrap">
                  <Button type="link" size="small" onClick={() => setDialog({ mode: 'edit', store })}>Edit</Button>
                  <Button type="link" size="small" loading={busyRows[store.id] === 'test'} disabled={busyRows[store.id] != null} onClick={() => runStoreTest(store)}>Test</Button>
                  {!store.isDefault ? (
                    <Dropdown trigger={['click']} placement="bottomRight" disabled={busyRows[store.id] != null} menu={moreMenu(store)}>
                      <Button type="text" size="small" aria-label="More actions" loading={busyRows[store.id] === 'default' || busyRows[store.id] === 'delete'} icon={<EllipsisOutlined />} />
                    </Dropdown>
                  ) : null}
                </td>
              </tr>
              {store.warnings.length > 0 ? (
                <tr data-testid={`store-warnings-${store.id}`} className="border-b border-slate-100">
                  <td colSpan={columnCount} className="pb-3">
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
              <tr><td colSpan={columnCount} className="py-6 text-center text-slate-500">No package stores.</td></tr>
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
