import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSpace } from 'contexts/SpaceContext';

type MenuItem =
  | { type: 'link'; label: string; path: string }
  | { type: 'disabled'; label: string }
  | { type: 'group'; label: string }
  | { type: 'divider' };

function buildMenu(spaceSlug: string): MenuItem[] {
  return [
    { type: 'link', label: 'Projects', path: `/${spaceSlug}/projects` },

    { type: 'group', label: 'My Favorites' },
    { type: 'disabled', label: 'No favorite projects' },

    { type: 'divider' },

    { type: 'link', label: 'Variable Sets', path: `/${spaceSlug}/library/variables` },

    { type: 'divider' },

    { type: 'group', label: 'Infrastructure' },
    { type: 'link', label: 'Overview', path: `/${spaceSlug}/infrastructure/overview` },
    { type: 'link', label: 'Deployment Targets', path: `/${spaceSlug}/deployment/targets` },
    { type: 'link', label: 'Environments', path: `/${spaceSlug}/environments` },
    { type: 'link', label: 'Machine Policies', path: `/${spaceSlug}/infrastructure/machinepolicies` },

    { type: 'divider' },

    { type: 'group', label: 'Manage' },
    { type: 'link', label: 'Accounts', path: `/${spaceSlug}/infrastructure/accounts` },
    { type: 'link', label: 'Certificates', path: `/${spaceSlug}/library/certificates` },
    { type: 'link', label: 'External Feeds', path: `/${spaceSlug}/external/feeds` },
    { type: 'link', label: 'Lifecycles', path: `/${spaceSlug}/lifecycles` },

    { type: 'divider' },

    { type: 'group', label: 'Other' },
    { type: 'link', label: 'Chat', path: `/${spaceSlug}/chat` },
  ];
}

const DeploySidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { space } = useSpace();
  const menu = buildMenu(space.slug);

  return (
    <div className="h-full w-full bg-[#fbfcfd] border-r border-slate-200/70 flex flex-col overflow-y-auto">
      <nav className="px-3 py-4">
        {menu.map((item, idx) => {
          if (item.type === 'divider') {
            return <div key={idx} className="mx-3 my-3 h-px bg-slate-200/60" />;
          }

          if (item.type === 'group') {
            return (
              <div
                key={idx}
                className="px-3 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                {item.label}
              </div>
            );
          }

          if (item.type === 'disabled') {
            return (
              <div key={idx} className="px-3 py-1.5 text-[13px] italic text-slate-400">
                {item.label}
              </div>
            );
          }

          // Keep Projects active for project-level flows without highlighting every project detail page.
          const isActive = location.pathname === item.path ||
            (item.label === 'Projects' && (
              location.pathname.startsWith(`${item.path}/import`) ||
              location.pathname.startsWith(`${item.path}/project-groups/`)
            )) ||
            (item.label !== 'Projects' && location.pathname.startsWith(item.path));

          return (
            <div
              key={idx}
              onClick={() => navigate(item.path)}
              className={[
                'my-0.5 flex items-center rounded-lg px-3 py-2 text-[14px] cursor-pointer transition-colors select-none',
                isActive
                  ? 'bg-blue-50 text-squid-blue font-medium'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              {item.label}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default DeploySidebar;
