import React from "react";
import { CloudServerOutlined, FileZipOutlined } from "@ant-design/icons";
import type { ImportSource } from "./importPreviewSummary";
import { ImportDisclosure } from "./ImportDisclosure";

interface SourceCard {
  source: ImportSource;
  title: string;
  icon: React.ReactNode;
  summary: string;
  input: string;
  imports: string;
  cannotImport: string;
}

export const IMPORT_SOURCE_CARDS: SourceCard[] = [
  {
    source: "file",
    title: "Export file",
    icon: <FileZipOutlined />,
    summary: "Configuration and secrets, no history",
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
    icon: <CloudServerOutlined />,
    summary: "Configuration and history, secrets marked missing",
    input: "The server URL and an API key. Read-only requests; the key is never stored.",
    imports:
      "The projects you choose, with what they use: the same configuration plus releases, deployments and task logs.",
    cannotImport:
      "Secret values (sensitive variables, feed passwords, account keys, certificate private keys): the API never returns them. "
      + "They are imported as missing and listed; importing the export file later fills sensitive variables and feed passwords, "
      + "account keys and certificate private keys are set in Squid.",
  },
];

export const REIMPORT_NOTE = "Importing again never overwrites Squid; it only adds what's missing.";

const SourceTile: React.FC<{ card: SourceCard; selected: boolean; disabled: boolean; onChange: (source: ImportSource) => void }> = ({ card, selected, disabled, onChange }) => (
  <label
    data-testid={`import-source-${card.source}`}
    className={[
      "flex items-start gap-3 rounded-lg border bg-white p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-200",
      selected ? "border-squid-blue ring-1 ring-squid-blue" : "border-slate-200 hover:border-slate-300",
      disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
    ].join(" ")}
  >
    <input
      type="radio"
      name="import-source"
      className="sr-only"
      aria-label={card.title}
      value={card.source}
      checked={selected}
      disabled={disabled}
      onChange={() => onChange(card.source)}
    />
    <span
      className={[
        "inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-base",
        selected ? "bg-blue-50 text-squid-blue" : "bg-slate-100 text-slate-500",
      ].join(" ")}
    >
      {card.icon}
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-slate-900">{card.title}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{card.summary}</span>
    </span>
  </label>
);

const SourceDetails: React.FC = () => (
  <div data-testid="import-source-details" className="grid grid-cols-1 gap-4 text-xs text-slate-600 sm:grid-cols-2">
    {IMPORT_SOURCE_CARDS.map((card) => (
      <div key={card.source} data-testid={`import-source-details-${card.source}`} className="space-y-1">
        <div className="text-sm font-semibold text-slate-900">{card.title}</div>
        <div>{card.input}</div>
        <div>
          <span className="font-medium text-slate-900">Imports: </span>
          {card.imports}
        </div>
        <div>
          <span className="font-medium text-slate-900">Cannot import: </span>
          {card.cannotImport}
        </div>
      </div>
    ))}
  </div>
);

/** Two mutually exclusive import sources as equal tiles; what each imports and cannot is one click away. */
export const ImportSourceCards: React.FC<{
  value: ImportSource;
  disabled: boolean;
  onChange: (source: ImportSource) => void;
}> = ({ value, disabled, onChange }) => (
  <div className="space-y-3">
    <div role="radiogroup" aria-label="Import source" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {IMPORT_SOURCE_CARDS.map((card) => (
        <SourceTile key={card.source} card={card} selected={card.source === value} disabled={disabled} onChange={onChange} />
      ))}
    </div>
    <ImportDisclosure summary="What each source imports" bordered={false}>
      <SourceDetails />
    </ImportDisclosure>
    <div className="text-xs text-slate-500">{REIMPORT_NOTE}</div>
  </div>
);
