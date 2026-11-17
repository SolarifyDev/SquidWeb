import React from "react";
import { Alert } from "antd";

/**
 * The page's one status line: an icon, one sentence and at most one action. Anything longer goes in `children`, under the sentence
 * (a hint, or a list the user must see such as blockers), or behind a disclosure the caller passes there.
 */
export const ImportStatusBanner: React.FC<{
  type: "success" | "info" | "warning" | "error";
  message: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  testId?: string;
}> = ({ type, message, action, children, testId }) => (
  <Alert
    data-testid={testId}
    type={type}
    showIcon
    message={message}
    description={children ? <div className="space-y-2 text-sm">{children}</div> : undefined}
    action={action}
    className={children ? "!py-2.5" : "!py-2"}
  />
);
