import React from "react";
import { ImportDisclosure } from "./ImportDisclosure";

export interface ImportMetric {
  id: string;
  label: string;
  value: number;
  /** A details metric that must never be hidden while non-zero (e.g. blockers): it is shown in the main row, in the danger colour. */
  alwaysVisibleWhenNonZero?: boolean;
}

const formatValue = (value: number) => value.toLocaleString("en-US");

const isAlarm = (metric: ImportMetric) => Boolean(metric.alwaysVisibleWhenNonZero && metric.value > 0);

const MetricTile: React.FC<{ metric: ImportMetric; testIdPrefix: string }> = ({ metric, testIdPrefix }) => {
  const alarm = isAlarm(metric);

  return (
    <div
      data-testid={`${testIdPrefix}-${metric.id}`}
      className={["rounded-md border px-3 py-2.5", alarm ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"].join(" ")}
    >
      <div className={["text-xs", alarm ? "text-red-700" : "text-slate-500"].join(" ")}>{metric.label}</div>
      <div className={["mt-0.5 text-2xl font-semibold tabular-nums", alarm ? "text-red-700" : "text-slate-900"].join(" ")}>
        {formatValue(metric.value)}
      </div>
    </div>
  );
};

const MetricGrid: React.FC<{ metrics: ImportMetric[]; testIdPrefix: string }> = ({ metrics, testIdPrefix }) => (
  <div className={["grid grid-cols-2 gap-3", metrics.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"].join(" ")}>
    {metrics.map((metric) => (
      <MetricTile key={metric.id} metric={metric} testIdPrefix={testIdPrefix} />
    ))}
  </div>
);

/** The one metric strip of the import page: four headline numbers, the rest behind "Details"; an alarming detail is never hidden. */
export const ImportMetricTiles: React.FC<{
  metrics: ImportMetric[];
  details?: ImportMetric[];
  testIdPrefix: string;
  testId?: string;
}> = ({ metrics, details = [], testIdPrefix, testId }) => {
  const main = [...metrics, ...details.filter(isAlarm)];
  const rest = details.filter((metric) => !isAlarm(metric));

  return (
    <div data-testid={testId} className="space-y-2">
      <MetricGrid metrics={main} testIdPrefix={testIdPrefix} />
      {rest.length ? (
        <ImportDisclosure summary="Details" bordered={false} testId={`${testIdPrefix}-details`}>
          <MetricGrid metrics={rest} testIdPrefix={testIdPrefix} />
        </ImportDisclosure>
      ) : null}
    </div>
  );
};
