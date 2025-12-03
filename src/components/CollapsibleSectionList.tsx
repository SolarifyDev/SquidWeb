import { useMemo, useRef, useState } from "react";
import { Button } from "antd";
import { DownOutlined } from "@ant-design/icons";

export interface CollapsibleSectionItem {
  key: string;
  label: React.ReactNode;
  summary?: React.ReactNode;
  detail?: React.ReactNode;
  expandable?: boolean;
  isSection?: boolean;
}

interface CollapsibleSectionListProps {
  items: CollapsibleSectionItem[];
  showExpandAll?: boolean;
  leftColumnWidthClassName?: string; // e.g. "w-56"
  className?: string;
}

function InnerCollapsibleSection({
  expanded,
  children,
}: {
  expanded: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  useMemo(() => {
    if (expanded && ref.current) {
      setHeight(ref.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [expanded, children]);

  return (
    <div
      style={{
        height: expanded ? height : 0,
        overflow: "hidden",
        transition: "height 200ms ease, opacity 200ms ease",
        opacity: expanded ? 1 : 0,
        marginTop: expanded ? 8 : 0,
      }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

/**
 * 通用折叠栏目列表组件
 * - 左侧固定 label 列
 * - 右侧 summary + 展开按钮
 * - 支持 EXPAND ALL / COLLAPSE ALL
 * - 带高度动画的展开区域
 */
export function CollapsibleSectionList({
  items,
  showExpandAll = true,
  leftColumnWidthClassName = "w-56",
  className,
}: CollapsibleSectionListProps) {
  const expandableKeys = items
    .filter((item) => item.expandable)
    .map((item) => item.key);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const allExpanded =
    expandableKeys.length > 0 &&
    expandableKeys.every((key) => expandedKeys.includes(key));

  const toggleItem = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedKeys([]);
    } else {
      setExpandedKeys(expandableKeys);
    }
  };

  return (
    <div className={className}>
      {showExpandAll && (
        <div className="flex justify-end mb-4">
          <Button
            type="link"
            className="text-gray-500 text-sm p-0"
            onClick={handleToggleAll}
          >
            {allExpanded ? "COLLAPSE ALL" : "EXPAND ALL"}
          </Button>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {items.map((item, index) => {
          const isExpanded = expandedKeys.includes(item.key);
          const isExpandable = item.expandable;

          return (
            <div
              key={item.key}
              className={index > 0 ? "border-t border-gray-200" : ""}
            >
              <div
                className={[
                  "flex items-start px-4 py-4",
                  isExpandable
                    ? "cursor-pointer bg-gray-50 hover:bg-gray-100"
                    : item.isSection
                    ? "bg-gray-50"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={
                  isExpandable ? () => toggleItem(item.key) : undefined
                }
              >
                <div className={`${leftColumnWidthClassName} shrink-0`}>
                  <span
                    className={[
                      "text-sm",
                      item.isSection
                        ? "font-semibold text-gray-900"
                        : "text-gray-700",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {item.label}
                  </span>
                </div>
                <div className="flex-1 text-sm text-gray-900">
                  {!item.isSection && item.summary}
                </div>
                {isExpandable && (
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <DownOutlined
                        className={`transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    }
                    className="text-blue-500 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItem(item.key);
                    }}
                  />
                )}
              </div>

              {isExpandable && (
                <InnerCollapsibleSection expanded={isExpanded}>
                  <div className="flex px-4 pb-4">
                    <div className={`${leftColumnWidthClassName} shrink-0`} />
                    <div className="flex-1">{item.detail}</div>
                  </div>
                </InnerCollapsibleSection>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
