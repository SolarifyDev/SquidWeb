import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Input, Radio, Select, Spin, Tag, message } from 'antd';
import { SearchOutlined, PlusOutlined, DownOutlined, UploadOutlined, MoreOutlined } from '@ant-design/icons';
import { getEnvironments } from 'pages/apis/environment';
import { createCertificate, getCertificates, CertificateDto } from 'pages/apis/certificate';
import { useSpace } from 'contexts/SpaceContext';
import PageContainer from 'components/PageContainer';

const { TextArea, Password } = Input;

type CertificateFormat = 'PFX' | 'PEM' | 'DER';
type CertificateDataMode = 'upload-file' | 'paste-text' | 'create-self-signed';
type TenantedMode = 'untenanted' | 'tenanted' | 'both';

interface CertificateItem {
  id: number;
  name: string;
  notes: string;
  format: CertificateFormat;
  thumbprint: string;
  subject: string;
  issuer: string;
  subjectCommonName: string;
  selfSigned: boolean;
  hasPrivateKey: boolean;
  version: number;
  serialNumber: string;
  signatureAlgorithmName: string;
  notAfter?: string;
  notBefore?: string;
  environmentIds: number[];
  expires?: string;
}

interface CertificateDraft {
  name: string;
  notes: string;
  dataMode: CertificateDataMode;
  pfxFileName: string;
  pfxFileBase64: string;
  pfxPassword: string;
  certificateText: string;
  selfSignedCommonName: string;
  selfSignedKeyAlgorithm: string;
  restrictedEnvironments: number[];
  tenantedMode: TenantedMode;
}

interface FormPanelProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
  hasBorder?: boolean;
  children: React.ReactNode;
}

function FormPanel({ title, description, isOpen, onToggle, hasBorder = true, children }: FormPanelProps) {
  return (
    <div style={hasBorder ? { borderBottom: '1px solid #e5e7eb' } : {}}>
      <div
        className="grid items-start py-4 pl-6 pr-10 cursor-pointer select-none"
        style={{ gridTemplateColumns: '240px 1fr' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className="flex items-start justify-between gap-4">
          {description && <div className="text-sm text-gray-500 flex-1">{description}</div>}
          <DownOutlined
            style={{ fontSize: 11 }}
            className={`text-gray-400 flex-shrink-0 mt-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>
      {isOpen && (
        <div className="grid pl-6 pr-10 pb-5" style={{ gridTemplateColumns: '240px 1fr' }}>
          <div />
          <div>{children}</div>
        </div>
      )}
    </div>
  );
}

const createEmptyDraft = (): CertificateDraft => ({
  name: '',
  notes: '',
  dataMode: 'upload-file',
  pfxFileName: '',
  pfxFileBase64: '',
  pfxPassword: '',
  certificateText: '',
  selfSignedCommonName: '',
  selfSignedKeyAlgorithm: 'NIST P-256',
  restrictedEnvironments: [],
  tenantedMode: 'untenanted',
});

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function utf8ToBase64(value: string) {
  return bytesToBase64(new TextEncoder().encode(value));
}

function mapKeyAlgorithmToApiKeyType(value: string): number {
  switch (value) {
    case 'NIST P-256':
      return 2;
    case 'NIST P-384':
      return 3;
    case 'NIST P-521':
      return 4;
    default:
      return 3;
  }
}

function mapCertificateDto(dto: CertificateDto): CertificateItem {
  const formatMap: Record<number, CertificateFormat> = {
    0: 'PFX',
    1: 'DER',
    2: 'PEM',
  };

  return {
    id: dto.id,
    name: dto.name,
    notes: dto.notes ?? '',
    format: formatMap[dto.certificateDataFormat] ?? 'PFX',
    thumbprint: dto.thumbprint ?? '',
    subject: dto.subjectDistinguishedName || dto.subjectCommonName || '—',
    issuer: dto.issuerDistinguishedName || dto.issuerCommonName || '—',
    subjectCommonName: dto.subjectCommonName ?? '',
    selfSigned: !!dto.selfSigned,
    hasPrivateKey: !!dto.hasPrivateKey,
    version: dto.version ?? 0,
    serialNumber: dto.serialNumber ?? '',
    signatureAlgorithmName: dto.signatureAlgorithmName ?? '',
    notAfter: dto.notAfter,
    notBefore: dto.notBefore,
    environmentIds: dto.environmentIds ?? [],
    expires: dto.notAfter ? new Date(dto.notAfter).toISOString().slice(0, 10) : undefined,
  };
}

function mapCertificateToDraft(cert: CertificateItem): CertificateDraft {
  return {
    ...createEmptyDraft(),
    name: cert.name,
    notes: cert.notes,
    dataMode: cert.selfSigned ? 'create-self-signed' : 'upload-file',
    selfSignedCommonName: cert.subjectCommonName || cert.subject,
    restrictedEnvironments: cert.environmentIds ?? [],
  };
}

function formatCertificateDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function CertificateForm({
  onBack,
  onSave,
  initialValue,
  title = 'Add Certificate',
  saveDisabled = false,
  mode = 'create',
  certificateDetails,
}: {
  onBack: () => void;
  onSave: (draft: CertificateDraft) => Promise<void>;
  initialValue?: CertificateDraft;
  title?: string;
  saveDisabled?: boolean;
  mode?: 'create' | 'edit';
  certificateDetails?: CertificateItem;
}) {
  const { space } = useSpace();
  const [draft, setDraft] = useState<CertificateDraft>(initialValue ?? createEmptyDraft());
  const [activeKeys, setActiveKeys] = useState<string[]>(() =>
    mode === 'edit'
      ? ['displayName', 'notes', 'details', 'environments', 'tenanted']
      : ['displayName', 'notes', 'data', 'environments', 'tenanted'],
  );
  const pfxFileInputRef = useRef<HTMLInputElement>(null);
  const [environmentOptions, setEnvironmentOptions] = useState<{ value: number; label: string }[]>([]);
  const [loadingEnvironmentOptions, setLoadingEnvironmentOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const allKeys = mode === 'edit'
    ? ['displayName', 'notes', 'details', 'environments', 'tenanted']
    : ['displayName', 'notes', 'data', 'environments', 'tenanted'];
  const allExpanded = activeKeys.length === allKeys.length;

  const updateDraft = <K extends keyof CertificateDraft>(key: K, value: CertificateDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const togglePanel = (key: string) => {
    setActiveKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handlePickPfx = () => {
    pfxFileInputRef.current?.click();
  };

  const handlePfxFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    updateDraft('pfxFileName', file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    updateDraft('pfxFileBase64', bytesToBase64(bytes));
  };

  useEffect(() => {
    let mounted = true;
    if (!space?.id) return;

    setLoadingEnvironmentOptions(true);
    getEnvironments({ pageSize: 1000, spaceId: space.id })
      .then((res) => {
        if (!mounted) return;
        setEnvironmentOptions(
          (res.environments ?? []).map((env) => ({
            value: env.id,
            label: env.name,
          }))
        );
      })
      .catch(() => {
        if (!mounted) return;
        setEnvironmentOptions([]);
      })
      .finally(() => {
        if (mounted) setLoadingEnvironmentOptions(false);
      });

    return () => {
      mounted = false;
    };
  }, [space?.id]);

  const handleSave = async () => {
    if (!draft.name.trim()) {
      message.warning('Please enter a certificate name');
      return;
    }
    if (draft.dataMode === 'upload-file' && !draft.pfxFileBase64.trim()) {
      message.warning('Please select a PFX certificate file');
      return;
    }
    if (draft.dataMode === 'paste-text' && !draft.certificateText.trim()) {
      message.warning('Please paste the certificate text');
      return;
    }
    if (draft.dataMode === 'create-self-signed' && !draft.selfSignedCommonName.trim()) {
      message.warning('Please enter a common name for the self-signed certificate');
      return;
    }

    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const editOverflowItems = mode === 'edit' && certificateDetails
    ? [
        { key: 'download', label: 'Download' },
        { key: 'replace', label: 'Replace' },
        { key: 'archive', label: 'Archive' },
        { type: 'divider' as const },
        {
          key: 'audit',
          label: (
            <a href={`#/${space.slug}/configuration/audit?regardingAny=Certificates-${certificateDetails.id}`} target="_self">
              Audit Trail
            </a>
          ),
        },
      ]
    : [];

  return (
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
          <div className="sticky top-0 z-10 bg-white rounded-t-md border-b border-gray-200 px-6 pt-5 pb-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-squid-blue hover:underline bg-transparent border-0 cursor-pointer mb-3 p-0"
            >
              Certificates
            </button>
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">{title}</h1>
              <div className="flex items-center gap-2">
                <Button onClick={onBack} disabled={saving}>Cancel</Button>
                <Button
                  type="primary"
                  className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                  onClick={() => void handleSave()}
                  loading={saving}
                  disabled={saving || saveDisabled}
                >
                  Save
                </Button>
                {mode === 'edit' && certificateDetails && (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: editOverflowItems,
                      onClick: ({ key }) => {
                        if (key === 'download') message.info('Download is not wired to the API yet.');
                        if (key === 'replace') message.info('Replace is not wired to the API yet.');
                        if (key === 'archive') message.info('Archive is not wired to the API yet.');
                      },
                    }}
                  >
                    <Button type="text" icon={<MoreOutlined />} aria-label="Overflow Menu Button" />
                  </Dropdown>
                )}
              </div>
            </div>
            <div className="flex justify-end pb-2">
              <button
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => setActiveKeys(allExpanded ? [] : allKeys)}
              >
                {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>
          </div>

          <FormPanel
            title="Display Name"
            description="A short, memorable, unique name for this certificate."
            isOpen={activeKeys.includes('displayName')}
            onToggle={() => togglePanel('displayName')}
          >
            <label className="block text-sm text-gray-700 mb-1.5">Display name</label>
            <Input
              placeholder="Certificate name"
              value={draft.name}
              onChange={(e) => updateDraft('name', e.target.value)}
            />
          </FormPanel>

          <FormPanel
            title="Notes"
            description="Optional notes to describe where this certificate is used."
            isOpen={activeKeys.includes('notes')}
            onToggle={() => togglePanel('notes')}
          >
            <label className="block text-sm text-gray-700 mb-1.5">Notes</label>
            <TextArea
              rows={4}
              placeholder="Add notes for this certificate"
              value={draft.notes}
              onChange={(e) => updateDraft('notes', e.target.value)}
            />
          </FormPanel>

          {mode === 'edit' ? (
            <FormPanel
              title="Details"
              description="Certificate details."
              isOpen={activeKeys.includes('details')}
              onToggle={() => togglePanel('details')}
            >
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2 w-48 text-gray-500">Has Private Key</td>
                      <td className="px-3 py-2 text-gray-800">{certificateDetails?.hasPrivateKey ? 'Yes' : 'No'}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500">Subject</td>
                      <td className="px-3 py-2 text-gray-800 break-all">{certificateDetails?.subject || '—'}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500">Issuer</td>
                      <td className="px-3 py-2 text-gray-800 break-all">{certificateDetails?.issuer || '—'}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500">Not After</td>
                      <td className="px-3 py-2 text-gray-800">{formatCertificateDate(certificateDetails?.notAfter)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500">Not Before</td>
                      <td className="px-3 py-2 text-gray-800">{formatCertificateDate(certificateDetails?.notBefore)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500">Thumbprint</td>
                      <td className="px-3 py-2 text-gray-800 break-all">{certificateDetails?.thumbprint || '—'}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500">Version</td>
                      <td className="px-3 py-2 text-gray-800">{certificateDetails?.version ?? '—'}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500">Serial Number</td>
                      <td className="px-3 py-2 text-gray-800 break-all">{certificateDetails?.serialNumber || '—'}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-gray-500">Signature Algorithm</td>
                      <td className="px-3 py-2 text-gray-800">{certificateDetails?.signatureAlgorithmName || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </FormPanel>
          ) : (
            <FormPanel
              title="Certificate Data"
              description={
                draft.dataMode === 'upload-file'
                  ? 'Upload the certificate file and provide a password if required.'
                  : draft.dataMode === 'paste-text'
                    ? 'Paste the certificate text.'
                    : 'Create a self-signed certificate and private key.'
              }
              isOpen={activeKeys.includes('data')}
              onToggle={() => togglePanel('data')}
            >
              <Radio.Group
                value={draft.dataMode}
                onChange={(e) => updateDraft('dataMode', e.target.value)}
                className="flex flex-col gap-4"
              >
                <div>
                  <Radio value="upload-file">
                    <span className="text-base text-gray-800">Upload a File</span>
                  </Radio>
                </div>

                {draft.dataMode === 'upload-file' && (
                  <div className="ml-7 space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Certificate file</label>
                      <div className="flex items-center gap-2">
                        <Input value={draft.pfxFileName} placeholder="No file selected" readOnly />
                        <Button icon={<UploadOutlined />} onClick={handlePickPfx}>Upload</Button>
                      </div>
                      <input
                        ref={pfxFileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pfx,.p12,.cer,.crt,.pem"
                        onChange={(e) => void handlePfxFileChange(e)}
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        Select a `.pfx`, `.p12`, `.cer`, `.crt`, or `.pem` file. The file content is encoded to base64 before calling the API.
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Password</label>
                      <Password
                        value={draft.pfxPassword}
                        placeholder="Certificate password (if required)"
                        onChange={(e) => updateDraft('pfxPassword', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Radio value="paste-text">
                    <span className="text-base text-gray-800">Paste Text</span>
                  </Radio>
                </div>

                {draft.dataMode === 'paste-text' && (
                  <div className="ml-7 space-y-4">
                    <div className="text-sm text-gray-500">
                      Paste your certificate as text, either base64 encoded or in PEM format
                    </div>
                    <TextArea
                      rows={3}
                      value={draft.certificateText}
                      onChange={(e) => updateDraft('certificateText', e.target.value)}
                      placeholder="Paste certificate text"
                    />
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Password (optional)</label>
                      <Password
                        value={draft.pfxPassword}
                        placeholder="Certificate password"
                        onChange={(e) => updateDraft('pfxPassword', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Radio value="create-self-signed">
                    <span className="text-base text-gray-800">Create Self Signed</span>
                  </Radio>
                </div>

                {draft.dataMode === 'create-self-signed' && (
                  <div className="ml-7 space-y-4">
                    <div className="text-sm text-gray-500">
                      Create a new self signed certificate with the details below.
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Common Name (a FQDN or person's name)</label>
                      <Input
                        value={draft.selfSignedCommonName}
                        onChange={(e) => updateDraft('selfSignedCommonName', e.target.value)}
                      />
                    </div>
                    <div>
                      <Select
                        className="w-full"
                        value={draft.selfSignedKeyAlgorithm}
                        onChange={(value) => updateDraft('selfSignedKeyAlgorithm', value)}
                        options={[
                          { value: 'NIST P-256', label: 'NIST P-256' },
                          { value: 'NIST P-384', label: 'NIST P-384' },
                          { value: 'NIST P-521', label: 'NIST P-521' },
                        ]}
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        If this is left blank, P-384 will be used by default.
                        <br />
                        If you want to maximize interoperability with existing browsers and servers, select either P-256 and P-384
                      </div>
                    </div>
                  </div>
                )}
              </Radio.Group>
            </FormPanel>
          )}

          <FormPanel
            title="Environments"
            description="Choose the environments that are allowed to use this certificate."
            isOpen={activeKeys.includes('environments')}
            onToggle={() => togglePanel('environments')}
          >
            <div className="text-xs text-gray-400 mb-3">
              If this field is left blank, the certificate can be used for deployments to any environment. Specifying environment/s (especially for production certificates) is strongly recommended.
            </div>
            <label className="block text-sm text-gray-700 mb-1.5">Select environments</label>
            <Select
              mode="multiple"
              className="w-full"
              value={draft.restrictedEnvironments}
              onChange={(value) => updateDraft('restrictedEnvironments', value as number[])}
              options={environmentOptions}
              loading={loadingEnvironmentOptions}
              placeholder="Select environments"
            />
          </FormPanel>

          <FormPanel
            title="Tenanted Deployments"
            description="Choose the kind of deployments where this certificate should be included."
            isOpen={activeKeys.includes('tenanted')}
            onToggle={() => togglePanel('tenanted')}
            hasBorder={false}
          >
            <Radio.Group
              value={draft.tenantedMode}
              onChange={(e) => updateDraft('tenantedMode', e.target.value)}
              className="flex flex-col gap-3"
            >
              <div>
                <Radio value="untenanted">
                  Exclude from tenanted deployments <span className="text-gray-500">(default)</span>
                </Radio>
                <div className="text-xs text-gray-400 mt-1 ml-6">
                  The certificate will never be included in tenanted deployments.
                </div>
              </div>
              <div>
                <Radio value="tenanted">Include only in tenanted deployments</Radio>
                <div className="text-xs text-gray-400 mt-1 ml-6">
                  The certificate will only be available to associated tenants.
                </div>
              </div>
              <div>
                <Radio value="both">Include in both tenanted and untenanted deployments</Radio>
                <div className="text-xs text-gray-400 mt-1 ml-6">
                  The certificate will be available in both deployment modes.
                </div>
              </div>
            </Radio.Group>
          </FormPanel>
        </div>
    </PageContainer>
  );
}

const CertificatesPage: React.FC = () => {
  const { space } = useSpace();
  const [searchText, setSearchText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<CertificateItem | null>(null);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCertificates = () => {
    setLoading(true);
    getCertificates({ pageSize: 1000 })
      .then((res) => setCertificates((res.certificates ?? []).map(mapCertificateDto)))
      .catch((error) => {
        console.error('Failed to load certificates', error);
        message.error(error instanceof Error ? error.message : 'Failed to load certificates');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const filtered = useMemo(
    () =>
      certificates.filter((c) =>
        [c.name, c.subject, c.thumbprint].some((v) => (v ?? '').toLowerCase().includes(searchText.toLowerCase()))
      ),
    [certificates, searchText]
  );

  const handleCreate = async (draft: CertificateDraft) => {
    const isSelfSigned = draft.dataMode === 'create-self-signed';
    const certificateData = isSelfSigned
      ? null
      : draft.dataMode === 'upload-file'
        ? draft.pfxFileBase64
        : (draft.certificateText.includes('-----BEGIN')
          ? utf8ToBase64(draft.certificateText)
          : draft.certificateText.trim());

    await createCertificate({
      name: draft.name.trim(),
      commonName: isSelfSigned ? draft.selfSignedCommonName.trim() : undefined,
      notes: draft.notes.trim(),
      certificateData,
      password: isSelfSigned ? null : (draft.pfxPassword || ''),
      environmentIds: draft.restrictedEnvironments,
      spaceId: space.id,
      keyType: isSelfSigned ? mapKeyAlgorithmToApiKeyType(draft.selfSignedKeyAlgorithm) : undefined,
      validityDays: isSelfSigned ? 365 : undefined,
      subjectAlternativeNames: isSelfSigned ? [] : undefined,
    });

    message.success('Certificate created');
    setShowCreate(false);
    loadCertificates();
  };

  if (showCreate) {
    return (
      <CertificateForm
        onBack={() => setShowCreate(false)}
        onSave={handleCreate}
      />
    );
  }

  if (editingCertificate) {
    return (
      <CertificateForm
        title="Edit Certificate"
        saveDisabled
        mode="edit"
        certificateDetails={editingCertificate}
        initialValue={mapCertificateToDraft(editingCertificate)}
        onBack={() => setEditingCertificate(null)}
        onSave={async () => {
          message.info('Certificate update is not wired to the API yet.');
        }}
      />
    );
  }

  return (
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
          <div className="px-6 pt-5 pb-5 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Certificates</h1>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                onClick={() => setShowCreate(true)}
              >
                ADD CERTIFICATE
              </Button>
            </div>

            <Input
              placeholder="Filter by name, subject, or thumbprint..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 360 }}
            />
          </div>

          <div className="p-6">
            <Spin spinning={loading}>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {filtered.length === 0 && !loading && (
                  <div className="px-6 py-12 text-center text-gray-400 text-sm">
                    No certificates found.
                  </div>
                )}

                {filtered.map((cert, idx) => (
                  <div
                    key={cert.id}
                    className={[
                      'flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer',
                      idx < filtered.length - 1 ? 'border-b border-gray-200' : '',
                    ].join(' ')}
                    onClick={() => setEditingCertificate(cert)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditingCertificate(cert);
                      }
                    }}
                  >
                    <div className="w-10 h-10 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                      TLS
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{cert.name}</div>
                      <div className="text-sm text-gray-500 truncate">{cert.subject}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Tag color="default" className="m-0 text-xs">{cert.format}</Tag>
                        <span className="text-xs text-gray-400">Thumbprint: {cert.thumbprint || '—'}</span>
                        {cert.expires && <span className="text-xs text-gray-400">Expires: {cert.expires}</span>}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </Spin>
          </div>
        </div>
    </PageContainer>
  );
};

export default CertificatesPage;
