export default function RunbookRunsPage() {
  return (
    <div className="min-h-full px-6 py-7 sm:px-9">
      <h2 className="m-0 text-[18px] font-semibold text-slate-900">Runs</h2>
      <div className="mt-6 overflow-hidden rounded border border-slate-200">
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Run</th>
              <th className="w-[180px] px-4 py-3">Started</th>
              <th className="w-[150px] px-4 py-3">Status</th>
            </tr>
          </thead>
        </table>
        <div className="border-t border-slate-200 px-4 py-16 text-center">
          <div className="text-sm font-semibold text-slate-800">No runs yet</div>
          <p className="mx-auto mb-0 mt-1 max-w-[460px] text-sm text-slate-500">
            Run history will appear here after Runbook execution is available.
          </p>
        </div>
      </div>
    </div>
  )
}
