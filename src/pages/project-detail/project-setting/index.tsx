import { useMemo, useRef, useState } from "react";
import { Button } from "antd";
import {
  DownOutlined,
  InfoCircleOutlined,
  MoreOutlined,
} from "@ant-design/icons";

type SettingSectionKey =
  | "name"
  | "enabled"
  | "logo"
  | "description"
  | "projectGroup"
  | "lifecycle";

interface SettingSection {
  key: SettingSectionKey;
  label: string;
  summary: React.ReactNode;
  detail?: React.ReactNode;
}

function CollapsibleSection({
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

function ProjectSetting() {
  const [projectName, setProjectName] = useState("Squid");
  const [projectSlug, setProjectSlug] = useState("squid");
  const [enabled, setEnabled] = useState(true);
  const [description, setDescription] = useState("");
  const [projectGroup, setProjectGroup] = useState("Solar");
  const [lifecycle, setLifecycle] = useState("All");

  const [expandedKeys, setExpandedKeys] = useState<SettingSectionKey[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = () => setIsDirty(true);

  const sections: SettingSection[] = [
    {
      key: "name",
      label: "Name",
      summary: (
        <>
          <span className="mr-2 text-gray-900">{projectName}</span>
          <span className="text-gray-500">{projectSlug}</span>
        </>
      ),
      detail: (
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <div className="mb-1">Enter a name for your project.</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-blue-600 font-medium">
              Project name
            </div>
            <input
              className="w-full border-0 border-b border-blue-500 focus:border-blue-600 focus:outline-none text-sm text-gray-900 bg-transparent pb-0.5"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                markDirty();
              }}
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-gray-500">Project slug</div>
            <input
              className="w-full border-0 border-b border-gray-300 focus:border-blue-600 focus:outline-none text-sm text-gray-900 bg-transparent pb-0.5"
              value={projectSlug}
              onChange={(e) => {
                setProjectSlug(e.target.value);
                markDirty();
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "enabled",
      label: "Enabled",
      summary: (
        <span className="text-gray-900">
          {enabled ? "Yes" : "No"}
          {enabled && (
            <span className="text-gray-500"> (default)</span>
          )}
        </span>
      ),
      detail: (
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            Disable a project to prevent releases or deployments from being
            created.
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                markDirty();
              }}
            />
            <span>Enabled</span>
          </label>
        </div>
      ),
    },
    {
      key: "logo",
      label: "Logo",
      summary: (
        <div className="text-gray-800 text-lg">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-gray-100 border border-gray-300">
            <span className="text-sm">🏷️</span>
          </span>
        </div>
      ),
      detail: (
        <div className="space-y-2 text-sm text-gray-700">
          <div>Upload or change the logo for this project.</div>
          <Button className="border-gray-300">Change logo...</Button>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      summary: (
        <span className="text-gray-500">
          {description
            ? description
            : "No project description provided"}
        </span>
      ),
      detail: (
        <div className="space-y-3 text-sm text-gray-700">
          <div>Enter a description for your project.</div>
          <div>
            <textarea
              className="w-full border border-gray-300 rounded-md min-h-[140px] p-3 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              placeholder="Project description"
            />
            <div className="flex justify-between mt-1 text-xs">
              <button
                type="button"
                className="text-blue-600 hover:underline"
              >
                Hide markdown controls
              </button>
              <button
                type="button"
                className="text-blue-600 hover:underline"
              >
                Markdown instructions
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "projectGroup",
      label: "Project Group",
      summary: <span className="text-gray-900">{projectGroup}</span>,
      detail: (
        <div className="space-y-3 text-sm text-gray-700">
          <div>Select which project group this project belongs to.</div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Project group</div>
            <div className="border-b border-blue-500 pb-1 flex items-center justify-between text-sm text-gray-900">
              <input
                className="flex-1 border-none outline-none bg-transparent"
                value={projectGroup}
                onChange={(e) => {
                  setProjectGroup(e.target.value);
                  markDirty();
                }}
              />
              <DownOutlined className="text-xs text-blue-500" />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "lifecycle",
      label: "Lifecycle",
      summary: <span className="text-gray-900">{lifecycle}</span>,
      detail: (
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            Select the default lifecycle for this project.
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Lifecycle</div>
            <div className="border-b border-blue-500 pb-1 flex items-center justify-between text-sm text-gray-900">
              <input
                className="flex-1 border-none outline-none bg-transparent"
                value={lifecycle}
                onChange={(e) => {
                  setLifecycle(e.target.value);
                  markDirty();
                }}
              />
              <DownOutlined className="text-xs text-blue-500" />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            The lifecycle defines how releases can be promoted between
            environments.
          </div>
          <button
            type="button"
            className="text-blue-600 text-xs font-medium hover:underline"
          >
            Show Lifecycle
          </button>
        </div>
      ),
    },
  ];

  const allExpanded = sections.every((s) =>
    expandedKeys.includes(s.key)
  );

  const toggleItem = (key: SettingSectionKey) => {
    setExpandedKeys((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedKeys([]);
    } else {
      setExpandedKeys(sections.map((s) => s.key));
    }
  };

  const handleSave = () => {
    // 在这里接后端保存逻辑
    // 目前只做 UI 效果
    setIsDirty(false);
  };

  return (
    <div className="h-full w-full p-6">
      <div className="h-full w-full bg-white border border-gray-200 rounded shadow-sm px-8 py-0">
        {/* Header */}
        <div className="flex items-center justify-between py-4 mb-2">
          <h1 className="text-xl font-semibold text-gray-900">
            Project Settings
          </h1>
          <div className="flex items-center gap-3">
            <Button
              type="primary"
              disabled={!isDirty}
              className="min-w-[80px]"
              onClick={handleSave}
            >
              Save
            </Button>
            <Button
              type="text"
              icon={<MoreOutlined />}
              className="text-gray-500"
            />
          </div>
        </div>

        {/* Sections */}
        <div className="pt-2">
          <div className="flex justify-end mb-4">
            <Button
              type="link"
              className="text-gray-500 text-sm p-0"
              onClick={handleToggleAll}
            >
              {allExpanded ? "COLLAPSE ALL" : "EXPAND ALL"}
            </Button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {sections.map((section, index) => {
              const isExpanded = expandedKeys.includes(section.key);

              return (
                <div
                  key={section.key}
                  className={index > 0 ? "border-top border-gray-200" : ""}
                >
                  <div
                    className="flex items-start px-4 py-4 cursor-pointer bg-gray-50 hover:bg-gray-100"
                    onClick={() => toggleItem(section.key)}
                  >
                    <div className="w-56 shrink-0">
                      <span className="text-sm text-gray-700">
                        {section.label}
                      </span>
                    </div>
                    <div className="flex-1 text-sm text-gray-900">
                      {section.summary}
                    </div>
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
                        toggleItem(section.key);
                      }}
                    />
                  </div>

                  <CollapsibleSection expanded={isExpanded}>
                    <div className="flex px-4 pb-4">
                      <div className="w-56 shrink-0" />
                      <div className="flex-1">{section.detail}</div>
                    </div>
                  </CollapsibleSection>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectSetting;
