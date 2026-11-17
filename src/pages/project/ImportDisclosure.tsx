import React from "react";
import { RightOutlined } from "@ant-design/icons";

/** A quiet "show more" row: the summary line opens the details below it. Its content stays in the page (searchable, printable). */
export const ImportDisclosure: React.FC<{
  summary: React.ReactNode;
  children: React.ReactNode;
  bordered?: boolean;
  defaultOpen?: boolean;
  testId?: string;
}> = ({ summary, children, bordered = true, defaultOpen = false, testId }) => (
  <details
    data-testid={testId}
    open={defaultOpen}
    className={["group", bordered ? "rounded-md border border-slate-200" : ""].join(" ")}
  >
    <summary
      className={[
        "flex cursor-pointer list-none items-center gap-2 text-sm text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden",
        bordered ? "px-3 py-2" : "py-1",
      ].join(" ")}
    >
      <RightOutlined className="text-[10px] transition-transform group-open:rotate-90" />
      <span>{summary}</span>
    </summary>
    <div className={bordered ? "border-t border-slate-100 px-3 py-3" : "pt-2"}>{children}</div>
  </details>
);
