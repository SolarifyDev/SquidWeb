import React, { useState } from "react";
import { Input, Modal, Tabs } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { StepTemplate, stepTemplates } from "./types";
import { stepIconMap, stepColorMap } from "./constants";

interface StepTemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: StepTemplate) => void;
}

const filterTemplates = (
  templates: StepTemplate[],
  search: string
): StepTemplate[] =>
  templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

const TemplateGrid: React.FC<{
  templates: StepTemplate[];
  onSelect: (template: StepTemplate) => void;
}> = ({ templates, onSelect }) => (
  <div className="grid grid-cols-3 gap-4">
    {templates.map((template) => (
      <div
        key={template.type}
        className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer hover:border-squid-blue hover:shadow-sm transition-all"
        onClick={() => onSelect(template)}
      >
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-lg text-white text-lg shrink-0 ${stepColorMap[template.type]}`}
        >
          {stepIconMap[template.type]}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-gray-800">{template.name}</div>
          <div className="text-sm text-gray-500 mt-1">
            {template.description}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const StepTemplateSelector: React.FC<StepTemplateSelectorProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const [searchText, setSearchText] = useState("");

  const installed = filterTemplates(
    stepTemplates.filter((t) => t.category === "installed"),
    searchText
  );
  const community = filterTemplates(
    stepTemplates.filter((t) => t.category === "community"),
    searchText
  );

  const handleClose = () => {
    setSearchText("");
    onClose();
  };

  return (
    <Modal
      title="Choose Step Template"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
    >
      <Input
        placeholder="Search step templates..."
        prefix={<SearchOutlined className="text-gray-400" />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="mb-4"
        allowClear
      />
      <Tabs
        items={[
          {
            key: "installed",
            label: "Installed Step Templates",
            children: <TemplateGrid templates={installed} onSelect={onSelect} />,
          },
          {
            key: "community",
            label: "Community Step Templates",
            children: <TemplateGrid templates={community} onSelect={onSelect} />,
          },
        ]}
      />
    </Modal>
  );
};

export default StepTemplateSelector;
