import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
    <div className="w-64 bg-white border-r h-full flex flex-col py-4">
      {menu.map((section, idx) => {
        if ("divider" in section) {
          return <hr key={idx} className="my-3 border-gray-200" />;
        }
        // section is group section
        // 如果没有 group 名称（如 Projects），直接渲染 items
        if (!section.group) {
          return section.items.map((item, i) =>
            <div
              key={i}
              className={`px-8 py-1 text-sm cursor-pointer rounded ${
                item.path && location.pathname.startsWith(item.path)
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => item.path && navigate(item.path)}
            >
              {item.label}
            </div>
          );
        }
        return (
          <div key={section.group}>
            <div
              className="px-6 py-1 text-xs font-bold text-gray-400 cursor-pointer flex items-center justify-between"
              onClick={() => handleGroupClick(section.group)}
            >
              <span>{section.group}</span>
              <span className="text-gray-400 text-sm">
                {openGroups[section.group] !== false ? '▼' : '▶'}
              </span>
            </div>
            {openGroups[section.group] !== false && (
              <div>
                {section.items.map((item, i) =>
                  item.disabled ? (
                    <div
                      key={i}
                      className="px-8 py-1 text-xs text-gray-400 italic"
                    >
                      {item.label}
                    </div>
                  ) : (
                    <div
                      key={i}
                      className={`px-8 py-1 text-sm cursor-pointer rounded ${
                        location.pathname === item.path
                          ? 'bg-blue-50 text-blue-600 font-semibold'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => item.path && navigate(item.path)}
                    >
                      {item.label}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DeploySidebar;
