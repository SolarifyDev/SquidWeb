import { useMemo, useState } from "react";
import { Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";

interface Channel {
  id: string;
  name: string;
  isDefault: boolean;
  lifecycleName: string;
}

const mockChannels: Channel[] = [
  {
    id: "channels-1",
    name: "Default",
    isDefault: true,
    lifecycleName: "qas-prd",
  },
];

function Channels() {
  const navigate = useNavigate();
  const { projectName } = useParams<{ projectName: string }>();
  const [filterText, setFilterText] = useState("");

  const filteredChannels = useMemo(() => {
    const text = filterText.trim().toLowerCase();

    if (!text) {
      return mockChannels;
    }

    return mockChannels.filter(
      (c) =>
        c.name.toLowerCase().includes(text) ||
        c.lifecycleName.toLowerCase().includes(text)
    );
  }, [filterText]);

  return (
    <div className="h-full w-full p-6">
      <div className="h-full w-full bg-white border border-gray-200 rounded shadow-sm px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Channels</h1>
          <Button
            type="primary"
            className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
          >
            Add Channel
          </Button>
        </div>

        {/* Filter input */}
        <div className="mb-6 max-w-xs">
          <div className="relative">
            <input
              className="w-full border-0 border-b border-blue-500 focus:outline-none focus:border-blue-600 text-sm pb-1 pr-7"
              placeholder="Filter by name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <SearchOutlined className="absolute right-0 top-1.5 text-gray-500" />
          </div>
        </div>

        {/* Channel list */}
        <div className="space-y-1">
          {filteredChannels.map((channel) => (
            <div
              key={channel.id}
              className="space-y-2 cursor-pointer rounded p-6 -mx-2 hover:bg-gray-50"
              onClick={() =>
                navigate(
                  `/project/${projectName}/project-detail/channels/${channel.id}`
                )
              }
            >
              {/* Channel name row */}
              <div className="flex items-center gap-3">
                <span className="text-blue-600 font-semibold text-sm">
                  {channel.name}
                </span>
                {channel.isDefault && (
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs border border-gray-200">
                    Default
                  </span>
                )}
              </div>

              {/* Lifecycle row */}
              <div className="flex items-center text-sm text-gray-800 mb-2">
                <div className="w-24 font-semibold">Lifecycle</div>
                <div>{channel.lifecycleName}</div>
              </div>
            </div>
          ))}

          {filteredChannels.length === 0 && (
            <div className="text-sm text-gray-400 mt-4">
              No channels match the current filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Channels;
