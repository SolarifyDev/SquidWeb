import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, Spin, message } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageContainer from 'components/PageContainer';
import { useSpace } from 'contexts/SpaceContext';
import { getEnvironments } from 'pages/apis/environment';
import { DeploymentAccountDto, getDeploymentAccounts } from 'pages/apis/deploymentAccount';

type AccountGroupTitle =
  | 'Azure Accounts'
  | 'AWS Accounts'
  | 'Usernames/Passwords'
  | 'Tokens'
  | 'Client Certificates'
  | 'SSH Key Pairs'
  | 'Other Accounts';

type DeploymentAccountLike = DeploymentAccountDto & {
  description?: string;
  notes?: string;
  environmentNames?: unknown;
  environments?: unknown;
  environmentIds?: unknown;
  scopes?: unknown;
};

interface AccountViewModel {
  id: number;
  name: string;
  slug: string;
  accountType: number;
  description?: string;
  environments: string[];
}

const GROUP_ORDER: AccountGroupTitle[] = [
  'Azure Accounts',
  'AWS Accounts',
  'Usernames/Passwords',
  'Tokens',
  'Client Certificates',
  'SSH Key Pairs',
  'Other Accounts',
];

function getGroupTitle(accountType: number): AccountGroupTitle {
  switch (accountType) {
    case 4:
    case 5:
    case 9:
      return 'Azure Accounts';
    case 6:
    case 7:
    case 11:
      return 'AWS Accounts';
    case 1:
      return 'Usernames/Passwords';
    case 3:
      return 'Tokens';
    case 8:
      return 'Client Certificates';
    case 2:
      return 'SSH Key Pairs';
    default:
      return 'Other Accounts';
  }
}

function readStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'name' in item && typeof (item as { name?: unknown }).name === 'string') {
          return (item as { name: string }).name;
        }
        return '';
      })
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

function readNumberArray(input: unknown): number[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => Number(item))
      .filter((value) => Number.isFinite(value));
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
  }

  return [];
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function extractEnvironmentNames(account: DeploymentAccountLike, envById: Map<number, string>): string[] {
  const explicitNameCandidates: unknown[] = [
    account.environmentNames,
    account.environments,
  ];

  const explicitNames = explicitNameCandidates.flatMap((candidate) => readStringArray(candidate));
  if (explicitNames.length > 0) {
    return unique(explicitNames);
  }

  const environmentIdCandidates: unknown[] = [
    account.environmentIds,
  ];
  const ids = environmentIdCandidates.flatMap((candidate) => readNumberArray(candidate));
  if (ids.length > 0) {
    return unique(ids.map((id) => envById.get(id) ?? `Environment-${id}`));
  }

  if (Array.isArray(account.scopes)) {
    const scopeNames = (account.scopes as Array<Record<string, unknown>>)
      .filter((scope) => {
        const scopeType = scope.scopeType;
        if (typeof scopeType === 'string') {
          return scopeType.toLowerCase().includes('environment');
        }
        if (typeof scopeType === 'number') {
          return scopeType === 1;
        }
        return false;
      })
      .map((scope) => String(scope.scopeValue ?? '').trim())
      .filter(Boolean);
    return unique(scopeNames);
  }

  return [];
}

function extractDescription(account: DeploymentAccountLike): string | undefined {
  const directDescription = String(account.description ?? '').trim();
  if (directDescription) return directDescription;

  const notes = String(account.notes ?? '').trim();
  if (notes) return notes;

  const credentials = account.credentials as Record<string, unknown> | null | undefined;
  if (!credentials) return undefined;

  if (account.accountType === 1) {
    const username = String(credentials.username ?? '').trim();
    return username ? `Username: ${username}` : undefined;
  }
  if (account.accountType === 2) {
    const username = String(credentials.username ?? '').trim();
    return username ? `Username: ${username}` : undefined;
  }
  if (account.accountType === 6 || account.accountType === 7) {
    const accessKey = String(credentials.accessKey ?? '').trim();
    return accessKey ? `Access Key: ${accessKey}` : undefined;
  }
  if (account.accountType === 5 || account.accountType === 9) {
    const subscriptionNumber = String(credentials.subscriptionNumber ?? '').trim();
    return subscriptionNumber ? `Subscription: ${subscriptionNumber}` : undefined;
  }
  if (account.accountType === 10) {
    const jsonKeyHasValue = Boolean(credentials.jsonKeyHasValue);
    return jsonKeyHasValue ? 'JSON key file configured' : undefined;
  }

  return undefined;
}

const addAccountMenuLabelByKey: Record<string, string> = {
  '12': 'OpenClaw Gateway',
  '11': 'AWS OIDC',
  '10': 'Google Cloud',
  '9': 'Azure OIDC',
  '8': 'Client Certificate',
  '7': 'AWS Role',
  '6': 'AWS Account',
  '5': 'Azure Service Principal',
  '4': 'Azure Subscription',
  '2': 'SSH Key Pair',
  '1': 'Username/Password',
  '3': 'Token',
};

const addAccountMenuItems: MenuProps['items'] = [
  { key: '12', label: 'OpenClaw Gateway' },
  { key: '5', label: 'Azure Service Principal' },
  { key: '6', label: 'AWS Account' },
  { key: '7', label: 'AWS Role' },
  { key: '9', label: 'Azure OIDC' },
  { key: '11', label: 'AWS OIDC' },
  { key: '10', label: 'Google Cloud' },
  { key: '1', label: 'Username/Password' },
  { key: '3', label: 'Token' },
  { key: '8', label: 'Client Certificate' },
  { key: '2', label: 'SSH Key Pair' },
  { key: '4', label: 'Azure Subscription (not supported)' },
];

const ScopeChip: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white text-gray-700 text-xs mr-1 mb-1 pr-2 pl-1.5 py-0.5">
    <span className="inline-flex items-center justify-center rounded-full bg-gray-200 mr-1" style={{ width: 16, height: 16 }}>
      <svg viewBox="0 0 200 200" width="10" height="10" aria-hidden="true">
        <path
          fill="#4b5563"
          d="M14 30v35h172V30zm26 26H23V39h17zM14 83v35h95V83zm26 26H23V92h17zM14 134v35h172v-35zm26 26H23v-17h17z"
        />
      </svg>
    </span>
    {name}
  </span>
);

const AccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const { space } = useSpace();

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountViewModel[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [accountRes, envRes] = await Promise.all([
          getDeploymentAccounts({ pageSize: 1000, spaceId: space.id }),
          getEnvironments({ pageSize: 1000, spaceId: space.id }),
        ]);

        if (!mounted) return;

        const envById = new Map<number, string>();
        for (const env of envRes.environments ?? []) {
          envById.set(env.id, env.name);
        }

        const mapped: AccountViewModel[] = (accountRes.deploymentAccounts ?? []).map((item) => {
          const account = item as DeploymentAccountLike;
          return {
            id: account.id,
            name: account.name,
            slug: account.slug || `Accounts-${account.id}`,
            accountType: account.accountType,
            description: extractDescription(account),
            environments: extractEnvironmentNames(account, envById),
          };
        });

        setAccounts(mapped);
      } catch (error) {
        console.error('Failed to load accounts', error);
        if (mounted) {
          setAccounts([]);
          message.error('Failed to load accounts');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [space.id]);

  const groupedAccounts = useMemo(() => {
    const grouped = new Map<AccountGroupTitle, AccountViewModel[]>();
    for (const account of accounts) {
      const group = getGroupTitle(account.accountType);
      const list = grouped.get(group) ?? [];
      list.push(account);
      grouped.set(group, list);
    }

    const sections = GROUP_ORDER.map((title) => ({
      title,
      items: (grouped.get(title) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((section) => section.items.length > 0);

    return sections;
  }, [accounts]);

  const handleAddMenuClick: MenuProps['onClick'] = ({ key }) => {
    const accountTypeKey = String(key);
    if (
      accountTypeKey === '1'
      || accountTypeKey === '2'
      || accountTypeKey === '3'
      || accountTypeKey === '5'
      || accountTypeKey === '6'
      || accountTypeKey === '10'
      || accountTypeKey === '12'
    ) {
      navigate(`/${space.slug}/infrastructure/accounts/create?accountType=${accountTypeKey}`);
      return;
    }

    const label = addAccountMenuLabelByKey[accountTypeKey] ?? 'Account';
    message.info(`Add ${label} is not implemented yet.`);
  };

  return (
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
          <div className="px-6 pt-5 pb-5 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-semibold text-gray-900 m-0">Accounts</h1>
              <Dropdown menu={{ items: addAccountMenuItems, onClick: handleAddMenuClick }} trigger={['click']}>
                <Button type="primary" className="!bg-green-700 hover:!bg-green-800 !border-green-700">
                  Add Account <DownOutlined />
                </Button>
              </Dropdown>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-12 flex justify-center">
                <Spin tip="Loading accounts..." />
              </div>
            ) : groupedAccounts.length === 0 ? (
              <div className="text-sm text-gray-500 py-8">No accounts found.</div>
            ) : (
              groupedAccounts.map((section) => (
                <section key={section.title} className="mb-8 last:mb-0">
                  <div className="mb-2">
                    <h2 className="text-lg font-semibold text-gray-900 m-0">{section.title}</h2>
                  </div>
                  <ul className="border border-gray-200 rounded-md overflow-hidden bg-white">
                    {section.items.map((account) => (
                      <li key={account.id} className="border-b border-gray-200 last:border-b-0">
                        <button
                          type="button"
                          className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                          onClick={() => navigate(`/${space.slug}/infrastructure/accounts/${account.slug}`)}
                        >
                          <h3 className="m-0 text-base font-semibold text-gray-900">{account.name}</h3>
                          {account.environments.length > 0 && (
                            <div className="mt-2 flex flex-wrap">
                              {account.environments.map((env) => (
                                <ScopeChip key={`${account.id}-${env}`} name={env} />
                              ))}
                            </div>
                          )}
                          {account.description && (
                            <div className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">
                              {account.description}
                            </div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
    </PageContainer>
  );
};

export default AccountsPage;
