import React from "react";
import { Button } from "antd";
import type { OctopusImportResumableSession } from "pages/apis/octopusImport";
import { resumeRowText } from "./importSessionResume";

/**
 * The import sessions this user can continue after the page was reloaded, above the steps (not a step itself). Continuing never asks for
 * anything here: a read from Octopus asks for its API key again in the Connect step.
 */
export const ImportResumeList: React.FC<{
  sessions: OctopusImportResumableSession[];
  disabled?: boolean;
  onContinue: (sessionId: string) => void;
}> = ({ sessions, disabled, onContinue }) =>
  sessions.length ? (
    <section data-testid="import-resume-list" aria-label="Continue an earlier import" className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <h2 className="m-0 text-sm font-semibold text-slate-900">Continue an earlier import</h2>
      </header>
      <ul className="m-0 list-none divide-y divide-slate-100 border-t border-slate-100 p-0">
        {sessions.map((row) => (
          <li key={row.sessionId} data-testid="import-resume-row" className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={resumeRowText(row)}>
              {resumeRowText(row)}
            </span>
            <Button size="small" disabled={disabled} onClick={() => onContinue(row.sessionId)}>
              Continue
            </Button>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
