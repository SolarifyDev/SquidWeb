import { useMemo, useRef, useState } from "react";
import { Button } from "antd";
import { DownOutlined, MoreOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

type ChannelSectionKey = "name" | "description" | "lifecycle" | "isDefault";

interface ChannelSection {
  key: ChannelSectionKey;
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

const channelSections: ChannelSection[] = [
  {
    key: "name",
    label: "Name",
    summary: (
      <>
        <span className="mr-2 text-gray-900">Default</span>
        <span className="text-gray-500">default</span>
      </>
    ),
    detail: (
      <div className="space-y-4 text-sm text-gray-700">
        <div>
          <div className="mb-1">Enter a name for your channel.</div>
          <div className="text-xs text-gray-500">
            A short, memorable, unique name for this channel. Example:{" "}
            <span className="italic">1.x Normal, 2.x Beta</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-blue-600 font-medium">Channel name</div>
          <input
            className="w-full border-0 border-b border-blue-500 focus:border-blue-600 focus:outline-none text-sm text-gray-900 bg-transparent pb-0.5"
            defaultValue="Default"
          />
          <div className="text-xs text-gray-500">
            A short, memorable, unique name for this channel.
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-gray-500">Channel slug</div>
          <input
            className="w-full border-0 border-b border-gray-300 focus:border-blue-600 focus:outline-none text-sm text-gray-900 bg-transparent pb-0.5"
            defaultValue="default"
          />
        </div>
      </div>
    ),
  },
  {
    key: "description",
    label: "Description",
    summary: (
      <span className="text-gray-500">No channel description provided</span>
    ),
    detail: (
      <div className="space-y-3 text-sm text-gray-700">
        <div>Enter a description for your channel.</div>
        <div>
          <textarea
            className="w-full border border-gray-300 rounded-md min-h-[140px] p-3 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
            defaultValue="Channel description"
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
    key: "lifecycle",
    label: "Lifecycle",
    summary: <span>qas-prd</span>,
    detail: (
      <div className="space-y-3 text-sm text-gray-700">
        <div>Select a lifecycle for your channel.</div>
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Lifecycle</div>
          <div className="border-b border-blue-500 pb-1 flex items-center justify-between text-sm text-gray-900">
            <span>qas-prd</span>
            <DownOutlined className="text-xs text-blue-500" />
          </div>
        </div>
        <div className="text-xs text-gray-500">
          The lifecycle defines how releases can be promoted between environments.
          Lifecycles can be defined here. If no lifecycle is selected, the default
          lifecycle for the project will be used.
        </div>
      </div>
    ),
  },
  {
    key: "isDefault",
    label: "Is Default Channel",
    summary: (
      <>
        <span className="font-semibold">This channel</span>
        <span className="text-gray-700">
          {" "}
          will be chosen by default when creating releases
        </span>
      </>
    ),
    detail: (
      <div className="space-y-3 text-sm text-gray-700">
        <div>
          This channel will be selected by default when creating releases.
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
            defaultChecked
          />
          <span>Default channel</span>
        </label>
      </div>
    ),
  },
];

function ChannelItem() {
  const navigate = useNavigate();
  const [expandedKeys, setExpandedKeys] = useState<ChannelSectionKey[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const allExpanded = channelSections.every((section) =>
    expandedKeys.includes(section.key)
  );

  const handleBackToList = () => {
    navigate(-1);
  };

  const toggleItem = (key: ChannelSectionKey) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedKeys([]);
    } else {
      setExpandedKeys(channelSections.map((section) => section.key));
    }
  };

  return (
    <div className="h-full w-full p-6" onChange={() => setIsDirty(true)}>
      <div className="h-full w-full bg-white border border-gray-200 rounded shadow-sm px-8 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <button
              type="button"
              onClick={handleBackToList}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Channels
            </button>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">Default</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="primary"
              disabled={!isDirty}
              className="min-w-[88px]"
              onClick={() => setIsDirty(false)}
            >
              Save
            </Button>
            <Button
              type="text"
              icon={<MoreOutlined />}
              className="text-gray-500 hover:text-gray-700"
            />
          </div>
        </div>

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
            {channelSections.map((section, index) => {
              const isExpanded = expandedKeys.includes(section.key);

              return (
                <div
                  key={section.key}
                  className={index > 0 ? "border-t border-gray-200" : ""}
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
                      <div className="flex-1">
                        {section.detail}
                      </div>
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

export default ChannelItem;
