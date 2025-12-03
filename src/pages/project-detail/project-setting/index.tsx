import { useState } from "react";
import { Button } from "antd";
import { DownOutlined, MoreOutlined } from "@ant-design/icons";
import {
  CollapsibleSectionList,
  type CollapsibleSectionItem,
} from "components/CollapsibleSectionList";

function ProjectSetting() {
  const [projectName, setProjectName] = useState("Squid");
  const [projectSlug, setProjectSlug] = useState("squid");
  const [enabled, setEnabled] = useState(true);
  const [description, setDescription] = useState("");
  const [projectGroup, setProjectGroup] = useState("Solar");
  const [lifecycle, setLifecycle] = useState("All");

  const [isDirty, setIsDirty] = useState(false);

  const markDirty = () => setIsDirty(true);

  const sectionItems: CollapsibleSectionItem[] = [
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
      expandable: true,
    },
    {
      key: "enabled",
      label: "Enabled",
      summary: (
        <span className="text-gray-900">
          {enabled ? "Yes" : "No"}
          {enabled && <span className="text-gray-500"> (default)</span>}
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
      expandable: true,
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
      expandable: true,
    },
    {
      key: "description",
      label: "Description",
      summary: (
        <span className="text-gray-500">
          {description || "No project description provided"}
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
      expandable: true,
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
      expandable: true,
    },
    {
      key: "lifecycle",
      label: "Lifecycle",
      summary: <span className="text-gray-900">{lifecycle}</span>,
      detail: (
        <div className="space-y-3 text-sm text-gray-700">
          <div>Select the default lifecycle for this project.</div>
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
      expandable: true,
    },
  ];

  const handleSave = () => {
    // TODO: 接入后端保存逻辑
    setIsDirty(false);
  };

  return (
    <div className="h-full w-full p-6" onChange={markDirty}>
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
          <CollapsibleSectionList
            items={sectionItems}
            showExpandAll
            leftColumnWidthClassName="w-56"
          />
        </div>
      </div>
    </div>
  );
}

export default ProjectSetting;
