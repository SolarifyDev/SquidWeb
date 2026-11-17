import { Link } from "react-router-dom";

export interface ReleaseWindowSummary {
  shown: number;
  total: number;
}

// The dashboard returns only a recent window of releases per channel (plus the releases currently
// deployed somewhere). Null when nothing is hidden, or when the backend does not report a total.
export function summarizeReleaseWindow(shown: number, total: number | undefined): ReleaseWindowSummary | null {
  if (total === undefined || total <= shown) return null;
  return { shown, total };
}

export function ReleaseWindowFooter({
  shown,
  total,
  releasesPath,
}: {
  shown: number;
  total: number | undefined;
  releasesPath: string;
}) {
  const summary = summarizeReleaseWindow(shown, total);
  if (!summary) return null;

  return (
    <div className="flex items-center gap-3 pt-3 text-sm text-slate-500">
      <span>{`Showing ${summary.shown.toLocaleString("en-US")} of ${summary.total.toLocaleString("en-US")} releases`}</span>
      <Link to={releasesPath} className="text-squid-blue font-medium no-underline hover:no-underline">
        View all releases
      </Link>
    </div>
  );
}
