import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DownOutlined, RightOutlined } from '@ant-design/icons';

type MenuSection =
  | { group: string; items: Array<{ label: string; path?: string; disabled?: boolean }> }
  | { divider: true };

const menu: MenuSection[] = [
  {
    group: '',
    items: [
      { label: 'Projects', path: '/project' }
    ]
  },
  {
    group: 'MY FAVORITES',
    items: [
      { label: 'No favorite projects', disabled: true }
    ]
  },
  {
    divider: true
  },
  {
    group: 'INFRASTRUCTURE',
    items: [
      { label: 'Deployment Targets', path: '/deployment/targets' },
      { label: 'Environments', path: '/environments' },
      { label: 'Machine Policies', path: '/machine/policies' }
    ]
  },
  {
    divider: true
  },
  {
    group: 'MANAGE',
    items: [
      { label: 'Variable Sets', path: '/variable' },
      { label: 'External Feeds', path: '/external/feeds' },
      { label: 'Lifecycles', path: '/lifecycles' }
    ]
  }
];

const DeploySidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>({
    'INFRASTRUCTURE': true,
    'MANAGE': true
  });

  const handleGroupClick = (group: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  return (
    <div className="w-full bg-white border-r h-full flex flex-col py-4">
      {menu.map((section, idx) => {
        if ("divider" in section) {
          return <hr key={idx} className="my-3 border-gray-200" />;
        }
        if (!section.group) {
          return section.items.map((item, i) => {
            const isActive = item.path && location.pathname.startsWith(item.path);
            return (
              <div
                key={i}
                className={[
                  "px-8 py-2 text-sm cursor-pointer transition-colors",
                  isActive
                    ? "border-l-3 border-squid-blue bg-blue-50 text-squid-blue font-semibold"
                    : "border-l-3 border-transparent hover:bg-gray-100",
                ].join(" ")}
                onClick={() => item.path && navigate(item.path)}
              >
                {item.label}
              </div>
            );
          });
        }
        return (
          <div key={section.group}>
            <div
              className="px-6 py-2 text-xs font-bold text-gray-400 cursor-pointer flex items-center justify-between transition-colors hover:text-gray-600"
              onClick={() => handleGroupClick(section.group)}
            >
              <span>{section.group}</span>
              <span className="text-gray-400 text-xs">
                {openGroups[section.group] !== false ? <DownOutlined /> : <RightOutlined />}
              </span>
            </div>
            {openGroups[section.group] !== false && (
              <div>
                {section.items.map((item, i) => {
                  if (item.disabled) {
                    return (
                      <div
                        key={i}
                        className="px-8 py-2 text-xs text-gray-400 italic"
                      >
                        {item.label}
                      </div>
                    );
                  }
                  const isActive = location.pathname === item.path;
                  return (
                    <div
                      key={i}
                      className={[
                        "px-8 py-2 text-sm cursor-pointer transition-colors",
                        isActive
                          ? "border-l-3 border-squid-blue bg-blue-50 text-squid-blue font-semibold"
                          : "border-l-3 border-transparent hover:bg-gray-100",
                      ].join(" ")}
                      onClick={() => item.path && navigate(item.path)}
                    >
                      {item.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DeploySidebar;
