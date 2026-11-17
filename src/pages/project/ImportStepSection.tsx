import React from "react";
import { CheckOutlined } from "@ant-design/icons";
import type { ImportSectionStatus } from "./importPreviewSummary";

const CIRCLE_CLASSES: Record<ImportSectionStatus, string> = {
  done: "bg-emerald-50 text-emerald-600",
  current: "bg-blue-50 text-squid-blue",
  error: "bg-red-50 text-red-600",
  future: "bg-slate-100 text-slate-400",
};

const STATUS_TEXT: Record<ImportSectionStatus, string> = {
  done: "Done",
  current: "Current step",
  error: "Failed",
  future: "Not started",
};

const StatusCircle: React.FC<{ number: number; status: ImportSectionStatus }> = ({ number, status }) => (
  <span
    data-testid="section-circle"
    className={["inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold", CIRCLE_CLASSES[status]].join(" ")}
  >
    {status === "done" ? <CheckOutlined className="text-[11px]" /> : number}
    <span className="sr-only">{STATUS_TEXT[status]}</span>
  </span>
);

/**
 * One step of the import: a header (status circle, title, a short status phrase on the right) and, unless the step is still ahead,
 * its body with the step's actions at the bottom right.
 */
export const ImportStepSection: React.FC<{
  id: string;
  number: number;
  title: string;
  status: ImportSectionStatus;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ id, number, title, status, summary, actions, children }) => {
  const future = status === "future";
  const hasBody = !future && Boolean(children || actions);

  return (
    <section
      data-testid={`import-section-${id}`}
      data-status={status}
      aria-label={title}
      className="rounded-lg border border-slate-200 bg-white"
    >
      <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <StatusCircle number={number} status={status} />
        <h2 className={["m-0 text-sm font-semibold", future ? "text-slate-400" : "text-slate-900"].join(" ")}>{title}</h2>
        {summary && !future ? (
          <span
            data-testid={`import-section-${id}-summary`}
            className={["ml-auto min-w-0 truncate text-right text-xs", status === "error" ? "text-red-600" : "text-slate-500"].join(" ")}
          >
            {summary}
          </span>
        ) : null}
      </header>
      {hasBody ? (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5">
          {children}
          {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </section>
  );
};
