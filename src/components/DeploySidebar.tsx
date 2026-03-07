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
    { type: 'link', label: 'Machine Policies', path: `/${spaceSlug}/machine/policies` },

    { type: 'divider' },

    { type: 'group', label: 'Manage' },
    { type: 'link', label: 'Accounts', path: `/${spaceSlug}/infrastructure/accounts` },
    { type: 'link', label: 'Certificates', path: `/${spaceSlug}/library/certificates` },
    { type: 'link', label: 'External Feeds', path: `/${spaceSlug}/external/feeds` },
    { type: 'link', label: 'Lifecycles', path: `/${spaceSlug}/lifecycles` },
    { type: 'link', label: 'Packages', path: `/${spaceSlug}/library/packages` },
  ];
}

const DeploySidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { space } = useSpace();
  const menu = buildMenu(space.slug);

  return (
    <div className="h-full w-full border-r border-slate-200/80 bg-white/95 backdrop-blur flex flex-col overflow-y-auto">
      <div className="px-5 pt-4 pb-2 border-b border-slate-100">
        <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
          Deploy
        </div>
      </div>

      <nav className="py-3">
        {menu.map((item, idx) => {
          if (item.type === 'divider') {
            return <hr key={idx} className="my-3 border-slate-100 mx-4" />;
          }

          if (item.type === 'group') {
            return (
              <div
                key={idx}
                className="px-5 pt-3 pb-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-400 font-semibold"
              >
                {item.label}
              </div>
            );
          }

          if (item.type === 'disabled') {
            return (
              <div
                key={idx}
                className="mx-3 rounded-lg px-3 py-2 text-sm text-slate-400 italic bg-slate-50"
              >
                {item.label}
              </div>
            );
          }

          // "Projects" uses exact match; all others use startsWith
          const isActive = location.pathname === item.path ||
            (item.label !== 'Projects' && location.pathname.startsWith(item.path));

          return (
            <div
              key={idx}
              onClick={() => navigate(item.path)}
              className={[
                'group relative mx-3 my-0.5 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all select-none',
                isActive
                  ? 'text-squid-blue bg-blue-50/80 font-semibold shadow-sm ring-1 ring-blue-100'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-squid-blue" />
              )}
              {item.label}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default DeploySidebar;
