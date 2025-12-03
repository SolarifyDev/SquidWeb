import { useMemo, useState } from "react";
import { Button, Dropdown, Tag } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
} from "@ant-design/icons";

interface VariableValue {
  id: string;
  value: string;
  scopes: string[];
}

interface ProjectVariable {
  id: string;
  name: string;
  values: VariableValue[];
}

const mockVariables: ProjectVariable[] = [
  {
    id: "v-aspnetcore-env",
    name: "ASPNETCORE_ENVIRONMENT",
    values: [
      {
        id: "prod",
        value: "Production",
        scopes: ["PRD"],
      },
      {
        id: "dev",
        value: "Development",
        scopes: ["TEST"],
      },
    ],
  },
  {
    id: "v-cpu-limits",
    name: "CpuLimits",
    values: [
      {
        id: "default",
        value: "1",
        scopes: [],
      },
    ],
  },
  {
    id: "v-cpu-requests",
    name: "CpuRequests",
    values: [
      {
        id: "default",
        value: "50m",
        scopes: [],
      },
    ],
  },
  {
    id: "v-ingress-domain",
    name: "IngressBaseDomainName",
    values: [
      {
        id: "prod",
        value: "squid.solarifyai.com",
        scopes: ["PRD"],
      },
      {
        id: "test",
        value: "test-squid.solarifyai.com",
        scopes: ["TEST"],
      },
    ],
  },
  {
    id: "v-memory-limits",
    name: "MemoryLimits",
    values: [
      {
        id: "default",
        value: "1024Mi",
        scopes: [],
      },
    ],
  },
  {
    id: "v-memory-requests",
    name: "MemoryRequests",
    values: [
      {
        id: "default",
        value: "50Mi",
        scopes: [],
      },
    ],
  },
];

function ProjectVariables() {
  const [filterText, setFilterText] = useState("");
  const [newVarName, setNewVarName] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [variables, setVariables] =
    useState<ProjectVariable[]>(mockVariables);

  const filteredVariables = useMemo(() => {
    const text = filterText.trim().toLowerCase();

    if (!text) {
      return variables;
    }

    return variables.filter((v: ProjectVariable) =>
      v.name.toLowerCase().includes(text)
    );
  }, [filterText, variables]);

  const handleDeleteValue = (variableId: string, valueId: string) => {
    setVariables((prev: ProjectVariable[]) =>
      prev
        .map((v: ProjectVariable) =>
          v.id === variableId
            ? {
                ...v,
                values: v.values.filter(
                  (val: VariableValue) => val.id !== valueId
                ),
              }
            : v
        )
        .filter((v: ProjectVariable) => v.values.length > 0)
    );
  };

  return (
    <div className="h-full w-full p-6">
      <div className="h-full w-full bg-white border border-gray-200 rounded shadow-sm px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Project Variables
          </h1>
          <div className="flex items-center gap-3">
            <Button
              type="primary"
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
            >
              Create Release
            </Button>
            <Button className="min-w-[80px]" disabled>
              Save
            </Button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-base text-gray-700 whitespace-nowrap">
              By variable name
            </div>
            <div className="relative w-64">
              <input
                className="w-full border-0 border-b border-blue-500 focus:outline-none focus:border-blue-600 text-base pr-7"
                placeholder="Enter variable name..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              <SearchOutlined className="absolute right-0 top-1.5 text-gray-500" />
            </div>
          </div>

          <button
            type="button"
            className="inline-flex items-center text-sm text-blue-600 hover:underline"
          >
            <FilterOutlined className="mr-1" />
            Show advanced filters
          </button>
        </div>

        {/* Table header */}
        <div className="border-t border-gray-200 text-sm">
          <div className="flex text-gray-500 py-3 px-2">
            <div className="w-1/3">Name</div>
            <div className="w-1/3">Value</div>
            <div className="flex-1">Scope</div>
          </div>

          {/* New variable row */}
          <div className="flex items-center bg-gray-50 border-y border-gray-200 text-base px-2 py-3">
            <div className="w-1/3 pr-4">
              <input
                className="w-full border-0 border-b border-blue-400 focus:outline-none focus:border-blue-600 text-base pb-1 bg-transparent"
                placeholder="Enter new variable"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
              />
            </div>
            <div className="w-1/3 pr-4">
              <input
                className="w-full border-0 border-b border-gray-300 focus:outline-none focus:border-blue-600 text-base pb-1 bg-transparent"
                placeholder="Enter value"
                value={newVarValue}
                onChange={(e) => setNewVarValue(e.target.value)}
              />
            </div>
            <div className="flex-1 flex justify-between items-center text-sm text-blue-600">
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 text-sm text-gray-700 bg-gray-100"
              >
                Add another value
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 text-sm text-gray-700 bg-gray-100 ml-2"
              >
                Add to list
              </button>
            </div>
          </div>

          {/* Variable rows */}
          <div>
            {filteredVariables.map((variable) => {
              const hasMultipleValues = variable.values.length > 1;
              const singleScopes: string[] = variable.values[0]?.scopes ?? [];

              return (
                <div
                  key={variable.id}
                  className="border-b border-gray-200 px-2hover:bg-gray-50"
                >
                  <div className="flex items-start">
                    {/* Name */}
                    <div className="w-1/3 my-auto text-base text-gray-900">
                      {variable.name}
                    </div>

                    {/* Value + Scope */}
                    {hasMultipleValues ? (
                      <div className="flex-1 flex flex-col">
                        <div className="flex pt-3 text-xs text-gray-500 mb-1">
                          <div className="w-1/2">Multiple values</div>
                          <div className="w-1/2">Multiple scopes</div>
                        </div>
                        <div className="flex-1 flex flex-col justify-evenly">
                          {variable.values.map((v, index) => (
                            <div
                              key={v.id}
                              className={`flex items-center py-2 ${
                                index > 0 ? "border-t border-gray-200" : ""
                              }`}
                            >
                              <div className="w-1/2 pr-4 text-base text-gray-900">
                                {v.value}
                              </div>
                              <div className="w-1/2 flex items-center justify-between">
                                <div className="text-base text-gray-700">
                                  {v.scopes.length === 0 ? (
                                    <span className="text-gray-400 text-xs">
                                      Define scope
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {v.scopes.map((scope: string) => (
                                        <Tag
                                          key={scope}
                                          className="bg-gray-100 border-gray-300 text-gray-700 text-xs"
                                        >
                                          {scope}
                                        </Tag>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <Dropdown
                                  trigger={["click"]}
                                  menu={{
                                    items: [
                                      {
                                        key: "delete",
                                        label: "Delete value",
                                        onClick: () =>
                                          handleDeleteValue(variable.id, v.id),
                                      },
                                    ],
                                  }}
                                >
                                  <Button
                                    type="text"
                                    icon={<MoreOutlined />}
                                    className="text-gray-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </Dropdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-between h-11">
                        <div className="flex-1 text-base text-gray-900">
                          {variable.values[0]?.value}
                        </div>
                        <div className="flex-1 flex items-start justify-between">
                          <div className="text-base text-gray-700 my-auto">
                            {singleScopes.length === 0 ? (
                              <span className="text-gray-400">Define scope</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {singleScopes.map((scope) => (
                                  <Tag
                                    key={scope}
                                    className="bg-gray-100 border-gray-300 text-gray-700 text-xs"
                                  >
                                    {scope}
                                  </Tag>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            type="text"
                            icon={<MoreOutlined />}
                            className="text-gray-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredVariables.length === 0 && (
              <div className="py-6 text-center text-gray-400 text-sm">
                No variables match the current filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectVariables;
