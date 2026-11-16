import React from "react";
import type { ImportSource } from "./importPreviewSummary";

interface SourceCard {
  source: ImportSource;
  title: string;
  input: string;
  imports: string;
  cannotImport: string;
}

export const IMPORT_SOURCE_CARDS: SourceCard[] = [
  {
    source: "file",
    title: "Export file",
    input: "The .zip from Octopus \"Export/Import Projects\" and its password.",
    imports:
      "Everything in the file: projects, processes, channels, project and library variable sets including secret values, "
      + "environments, lifecycles, feeds and accounts with their credentials, teams.",
    cannotImport:
      "Deployment history (releases, deployments, task logs): Octopus exports do not contain it. Use Octopus server for that.",
  },
  {
    source: "server",
    title: "Octopus server",
    input: "The server URL and an API key. Read-only requests; the key is never stored.",
    imports:
      "The projects you choose, with what they use: the same configuration plus releases, deployments and task logs.",
    cannotImport:
      "Secret values (sensitive variables, feed passwords, account keys, certificate private keys): the API never returns them. "
      + "They are imported as missing and listed; importing the export file later fills sensitive variables and feed passwords, "
      + "account keys and certificate private keys are set in Squid.",
  },
];

/** Two mutually exclusive import sources, each saying what it imports and what it cannot. */
export const ImportSourceCards: React.FC<{
  value: ImportSource;
  disabled: boolean;
  onChange: (source: ImportSource) => void;
}> = ({ value, disabled, onChange }) => (
  <div className="space-y-2">
    <div role="radiogroup" aria-label="Import source" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {IMPORT_SOURCE_CARDS.map((card) => {
        const selected = card.source === value;

        return (
          <label
            key={card.source}
            data-testid={`import-source-${card.source}`}
            className={[
              "block cursor-pointer rounded-md border p-4 text-sm",
              selected ? "border-squid-blue bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300",
              disabled ? "cursor-not-allowed opacity-70" : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="import-source"
                aria-label={card.title}
                value={card.source}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(card.source)}
              />
              <span className="text-base font-semibold text-slate-900">{card.title}</span>
            </div>
            <div className="mt-1 text-slate-600">{card.input}</div>
            <div className="mt-2">
              <span className="font-medium text-slate-900">Imports: </span>
              <span className="text-slate-700">{card.imports}</span>
            </div>
            <div className="mt-1">
              <span className="font-medium text-slate-900">Cannot import: </span>
              <span className="text-slate-700">{card.cannotImport}</span>
            </div>
          </label>
        );
      })}
    </div>
    <div className="text-xs text-slate-500">
      Importing again from either source never overwrites what is already in Squid, including anything you changed: it only adds what
      is missing, fills missing secret values and updates deployment history that changed in Octopus.
    </div>
  </div>
);
