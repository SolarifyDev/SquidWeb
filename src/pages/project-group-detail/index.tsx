import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dropdown, Input, Modal, Spin, Tooltip, message } from 'antd'
import type { MenuProps } from 'antd'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeftOutlined,
  BoldOutlined,
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  EditOutlined,
  ExportOutlined,
  ItalicOutlined,
  LinkOutlined,
  MoreOutlined,
  OrderedListOutlined,
  PictureOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { useSpace } from 'contexts/SpaceContext'
import {
  deleteProjectGroups,
  getProjectGroups,
  updateProjectGroup,
  type ProjectGroupDto,
} from 'pages/apis/projectGroup'
import { SettingsDetailPanel } from 'pages/settings/components/DetailFormTemplate'

type SectionKey = 'name' | 'description'

interface ProjectGroupFormState {
  name: string
  slug: string
  description: string
}

const DEFAULT_EXPANDED: Record<SectionKey, boolean> = {
  name: true,
  description: true,
}

function toFormState(group: ProjectGroupDto): ProjectGroupFormState {
  return {
    name: group.name ?? '',
    slug: group.slug ?? '',
    description: group.description ?? '',
  }
}

interface MarkdownToolbarProps {
  onBold: () => void
  onItalic: () => void
  onBulletedList: () => void
  onNumberedList: () => void
  onCodeBlock: () => void
  onQuote: () => void
  onImage: () => void
  onLink: () => void
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  onBold,
  onItalic,
  onBulletedList,
  onNumberedList,
  onCodeBlock,
  onQuote,
  onImage,
  onLink,
}) => (
  <div className="flex items-center justify-end gap-1 border border-b-0 border-slate-600 bg-slate-700 px-4 py-1.5">
    <Tooltip title="Bold">
      <Button
        size="small"
        type="text"
        className="h-8 w-8 !text-slate-100 hover:!bg-white/10 hover:!text-white"
        icon={<BoldOutlined />}
        aria-label="Bold"
        onClick={onBold}
      />
    </Tooltip>
    <Tooltip title="Bulleted list">
      <Button
        size="small"
        type="text"
        className="h-8 w-8 !text-slate-100 hover:!bg-white/10 hover:!text-white"
        icon={<UnorderedListOutlined />}
        aria-label="Bulleted list"
        onClick={onBulletedList}
      />
    </Tooltip>
    <Tooltip title="Code block">
      <Button
        size="small"
        type="text"
        className="h-8 w-8 !text-slate-100 hover:!bg-white/10 hover:!text-white"
        icon={<CodeOutlined />}
        aria-label="Code block"
        onClick={onCodeBlock}
      />
    </Tooltip>
    <Tooltip title="Insert link">
      <Button
        size="small"
        type="text"
        className="h-8 w-8 !text-slate-100 hover:!bg-white/10 hover:!text-white"
        icon={<LinkOutlined />}
        aria-label="Insert link"
        onClick={onLink}
      />
    </Tooltip>
    <Tooltip title="Numbered list">
      <Button
        size="small"
        type="text"
        className="h-8 w-8 !text-slate-100 hover:!bg-white/10 hover:!text-white"
        icon={<OrderedListOutlined />}
        aria-label="Numbered list"
        onClick={onNumberedList}
      />
    </Tooltip>
    <Tooltip title="Italic">
      <Button
        size="small"
        type="text"
        className="h-8 w-8 !text-slate-100 hover:!bg-white/10 hover:!text-white"
        icon={<ItalicOutlined />}
        aria-label="Italic"
        onClick={onItalic}
      />
    </Tooltip>
    <Tooltip title="Insert image">
      <Button
        size="small"
        type="text"
        className="h-8 w-8 !text-slate-100 hover:!bg-white/10 hover:!text-white"
        icon={<PictureOutlined />}
        aria-label="Insert image"
        onClick={onImage}
      />
    </Tooltip>
    <Tooltip title="Quote">
      <Button
        size="small"
        type="text"
        className="h-8 w-8 !text-slate-100 hover:!bg-white/10 hover:!text-white"
        icon={<span className="text-[19px] leading-none">“”</span>}
        aria-label="Quote"
        onClick={onQuote}
      />
    </Tooltip>
  </div>
)

const markdownPreviewComponents: Components = {
  p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="m-0 mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="m-0 mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="m-0 pl-1">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-squid-blue hover:underline"
    >
      {children}
      <ExportOutlined className="text-xs" />
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-slate-300 pl-3 text-slate-500">{children}</blockquote>
  ),
  code: ({ children, className }) => (
    <code className={className ? `${className} font-mono text-[13px]` : 'rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800'}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded bg-slate-100 p-2 text-[13px] last:mb-0">{children}</pre>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ''} className="my-2 max-h-40 max-w-full rounded border border-slate-200 object-contain" />
  ),
}

const MarkdownPreview: React.FC<{ content: string }> = ({ content }) => (
  <div className="project-group-markdown-preview break-words text-sm text-slate-600">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownPreviewComponents}>
      {content}
    </ReactMarkdown>
  </div>
)

const ProjectGroupDetail: React.FC = () => {
  const { space } = useSpace()
  const navigate = useNavigate()
  const { projectGroupId } = useParams<{ projectGroupId: string }>()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [group, setGroup] = useState<ProjectGroupDto | null>(null)
  const [form, setForm] = useState<ProjectGroupFormState>({ name: '', slug: '', description: '' })
  const [initialForm, setInitialForm] = useState<ProjectGroupFormState | null>(null)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>(DEFAULT_EXPANDED)
  const [slugEditable, setSlugEditable] = useState(false)
  const [showMarkdownControls, setShowMarkdownControls] = useState(true)
  const [urlModalMode, setUrlModalMode] = useState<'image' | 'link' | null>(null)
  const [urlValue, setUrlValue] = useState('http://')
  const [pendingLinkText, setPendingLinkText] = useState('')
  const textAreaRef = useRef<any>(null)

  const projectListPath = `/${space.slug}/projects`

  useEffect(() => {
    const numericId = Number(projectGroupId)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setGroup(null)
      setInitialForm(null)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const response = await getProjectGroups({ pageIndex: 1, pageSize: 1000, spaceId: space.id }, { silentLoading: true })
        if (cancelled) return

        const foundGroup = (response.projectGroups ?? []).find((item) => item.id === numericId) ?? null
        setGroup(foundGroup)

        if (!foundGroup) {
          setInitialForm(null)
          return
        }

        const nextForm = toFormState(foundGroup)
        setForm(nextForm)
        setInitialForm(nextForm)
        setSlugEditable(false)
        setExpanded({
          name: true,
          description: true,
        })
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load project group', error)
        setGroup(null)
        setInitialForm(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectGroupId, space.id])

  const isDirty = useMemo(() => {
    if (!initialForm) return false
    return (
      initialForm.name !== form.name
      || initialForm.slug !== form.slug
      || initialForm.description !== form.description
    )
  }, [form, initialForm])

  const handleSave = async () => {
    if (!group) return

    const nextName = form.name.trim()
    const nextSlug = form.slug.trim()

    if (!nextName) {
      message.warning('Project group name is required')
      return
    }
    if (!nextSlug) {
      message.warning('Project group slug is required')
      return
    }

    setSaving(true)
    try {
      const payload: ProjectGroupDto = {
        ...group,
        name: nextName,
        slug: nextSlug,
        description: form.description,
        spaceId: space.id,
      }

      const updated = await updateProjectGroup({ id: payload.id, projectGroup: payload })
      const normalized = updated && typeof updated === 'object' ? updated : payload
      const nextForm = toFormState(normalized)
      setGroup(normalized)
      setForm(nextForm)
      setInitialForm(nextForm)
      setSlugEditable(false)
      message.success('Project group saved')
    } catch (error) {
      console.error('Failed to save project group', error)
      message.error('Failed to save project group')
    } finally {
      setSaving(false)
    }
  }

  const handleCopySlug = async () => {
    const value = form.slug.trim()
    if (!value) return

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      }
      message.success('Slug copied')
    } catch {
      message.warning('Unable to copy slug')
    }
  }

  const handleToggleSlugEditing = () => {
    if (slugEditable) {
      setForm((previous) => ({ ...previous, slug: initialForm?.slug ?? previous.slug }))
      setSlugEditable(false)
      return
    }
    setSlugEditable(true)
  }

  const insertMarkdown = (before: string, after = '') => {
    const textarea = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined
    if (!textarea) {
      setForm((previous) => ({ ...previous, description: `${previous.description}${before}${after}` }))
      return
    }

    const start = textarea.selectionStart ?? form.description.length
    const end = textarea.selectionEnd ?? start
    const selectedText = form.description.substring(start, end)
    const nextDescription =
      form.description.substring(0, start)
      + before
      + selectedText
      + after
      + form.description.substring(end)

    setForm((previous) => ({ ...previous, description: nextDescription }))

    setTimeout(() => {
      textarea.focus()
      const cursor = start + before.length + selectedText.length
      textarea.setSelectionRange(cursor, cursor)
    }, 0)
  }

  const insertLinePrefix = (prefix: string) => {
    const textarea = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined
    if (!textarea) {
      setForm((previous) => ({ ...previous, description: `${previous.description}${prefix}` }))
      return
    }

    const value = form.description
    const selectionStart = textarea.selectionStart ?? value.length
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const lineEndIndex = value.indexOf('\n', selectionEnd)
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
    const target = value.substring(lineStart, lineEnd)
    const prefixed = target
      .split('\n')
      .map((line) => (line.trim() ? `${prefix}${line}` : line))
      .join('\n')
    const nextDescription = value.substring(0, lineStart) + prefixed + value.substring(lineEnd)

    setForm((previous) => ({ ...previous, description: nextDescription }))

    setTimeout(() => {
      textarea.focus()
      const cursor = selectionStart + prefix.length
      textarea.setSelectionRange(cursor, cursor)
    }, 0)
  }

  const getSelectedText = () => {
    const textarea = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined
    if (!textarea) return ''

    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? start
    return form.description.substring(start, end)
  }

  const handleOpenUrlModal = (mode: 'image' | 'link') => {
    if (mode === 'link') {
      setPendingLinkText(getSelectedText())
    } else {
      setPendingLinkText('')
    }
    setUrlValue('http://')
    setUrlModalMode(mode)
  }

  const normalizedUrl = urlValue.trim()
  const canInsertUrl = normalizedUrl.length > 0
    && normalizedUrl !== 'http://'
    && normalizedUrl !== 'https://'

  const handleInsertUrl = () => {
    if (!canInsertUrl || !urlModalMode) {
      message.warning(`Please enter a url for the ${urlModalMode ?? 'image'}`)
      return
    }

    if (urlModalMode === 'link') {
      insertMarkdown(`[${pendingLinkText || 'link'}](${normalizedUrl})`)
    } else {
      insertMarkdown(`![image](${normalizedUrl})`)
    }
    setUrlModalMode(null)
    setUrlValue('http://')
    setPendingLinkText('')
  }

  const handleDelete = () => {
    if (!group || deleting) return

    Modal.confirm({
      title: 'Are you sure you want to delete this project group?',
      content: 'Do you wish to continue?',
      icon: null,
      okText: 'Delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeleting(true)
        try {
          const result = await deleteProjectGroups({ ids: [group.id], spaceId: space.id })
          if ((result?.failIds ?? []).includes(group.id)) {
            throw new Error('Project group was not deleted')
          }
          message.success('Project group deleted')
          navigate(projectListPath)
        } catch (error) {
          console.error('Failed to delete project group', error)
          message.error('Failed to delete project group')
          throw error
        } finally {
          setDeleting(false)
        }
      },
    })
  }

  const overflowMenuItems: MenuProps['items'] = [
    {
      key: 'delete',
      label: 'Delete',
      danger: true,
      disabled: saving || deleting,
    },
    {
      key: 'audit',
      label: 'Audit Trail',
      disabled: saving || deleting,
    },
  ]

  const handleOverflowClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'delete') {
      handleDelete()
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-card">
          <div className="flex items-center justify-center py-16">
            <Spin tip="Loading project group..." />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!group) {
    return (
      <PageContainer>
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white px-6 py-14 text-center text-sm text-gray-400 shadow-card">
          Project group not found.
        </div>
      </PageContainer>
    )
  }

  const allExpanded = expanded.name && expanded.description

  const toggleAll = () => {
    const next = !allExpanded
    setExpanded({
      name: next,
      description: next,
    })
  }

  return (
    <PageContainer>
      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-card">
        <div className="border-b border-gray-200 px-6 pt-4 pb-3">
          <button
            type="button"
            onClick={() => navigate(projectListPath)}
            className="mb-3 inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-medium text-squid-blue hover:underline"
          >
            <ArrowLeftOutlined className="text-xs" />
            <span>Projects</span>
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="m-0 min-w-0 truncate text-2xl font-semibold text-gray-900">
              {form.name || group.name || 'Project Group'}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="primary"
                disabled={!isDirty || saving}
                loading={saving}
                onClick={handleSave}
                className="!bg-green-700 !border-green-700 hover:!bg-green-800 disabled:!border-gray-300 disabled:!bg-gray-300 disabled:!text-white"
              >
                Save
              </Button>
              <Dropdown
                menu={{ items: overflowMenuItems, onClick: handleOverflowClick }}
                trigger={['click']}
                placement="bottomRight"
                disabled={saving || deleting}
              >
                <Button
                  icon={<MoreOutlined />}
                  aria-label="Project group actions"
                  disabled={saving || deleting}
                />
              </Dropdown>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
              onClick={toggleAll}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>

        <SettingsDetailPanel
          title="Name"
          subtitle={!expanded.name && form.name.trim()
            ? form.name
            : 'A short, memorable, unique name for this project group.'}
          subtitlePlaceholder={!expanded.name && !form.name.trim()}
          isOpen={expanded.name}
          onToggle={() => setExpanded((previous) => ({ ...previous, name: !previous.name }))}
        >
          <div className="max-w-[720px] space-y-3">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-500">Name</label>
              <Input
                value={form.name}
                onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="Project group name"
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-500">Project group slug</label>
              <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <Input
                  value={form.slug}
                  disabled={!slugEditable}
                  onChange={(event) => setForm((previous) => ({ ...previous, slug: event.target.value }))}
                  placeholder="project-group-slug"
                />
                <div className="flex items-center gap-1">
                  <Tooltip title={slugEditable ? 'Cancel' : 'Change'}>
                    <Button
                      type="text"
                      size="small"
                      aria-label={slugEditable ? 'Cancel slug change' : 'Change slug'}
                      icon={slugEditable ? <CloseOutlined /> : <EditOutlined />}
                      className={slugEditable ? '!text-squid-blue' : undefined}
                      onClick={handleToggleSlugEditing}
                    />
                  </Tooltip>
                  <Tooltip title="Copy">
                    <Button
                      type="text"
                      size="small"
                      aria-label="Copy slug"
                      icon={<CopyOutlined />}
                      onClick={handleCopySlug}
                    />
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        </SettingsDetailPanel>

        <SettingsDetailPanel
          title="Description"
          subtitle={!expanded.description && form.description.trim()
            ? <MarkdownPreview content={form.description} />
            : 'Enter a description for your project group.'}
          subtitlePlaceholder={!expanded.description && !form.description.trim()}
          isOpen={expanded.description}
          onToggle={() => setExpanded((previous) => ({ ...previous, description: !previous.description }))}
          hasBorder={false}
        >
          <div className="max-w-[720px]">
            <label className="mb-2 block text-[13px] font-medium text-slate-500">Project group description</label>
            <div className="overflow-hidden rounded border border-slate-700">
              {showMarkdownControls && (
                <MarkdownToolbar
                  onBold={() => insertMarkdown('**', '**')}
                  onItalic={() => insertMarkdown('*', '*')}
                  onBulletedList={() => insertLinePrefix('- ')}
                  onNumberedList={() => insertLinePrefix('1. ')}
                  onCodeBlock={() => insertMarkdown('```\n', '\n```')}
                  onQuote={() => insertLinePrefix('> ')}
                  onImage={() => handleOpenUrlModal('image')}
                  onLink={() => handleOpenUrlModal('link')}
                />
              )}
              <Input.TextArea
                ref={textAreaRef}
                value={form.description}
                onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="Project group description"
                autoSize={{ minRows: 3, maxRows: 16 }}
                bordered={false}
                className="resize-none"
                style={{ padding: '12px' }}
              />
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <button
                type="button"
                onClick={() => setShowMarkdownControls((previous) => !previous)}
                className="border-0 bg-transparent p-0 text-squid-blue hover:underline"
              >
                {showMarkdownControls ? 'Hide' : 'Show'} markdown controls
              </button>
              <a
                href="https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax"
                className="inline-flex items-center gap-1 text-squid-blue hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Markdown instructions
                <ExportOutlined className="text-xs" />
              </a>
            </div>
          </div>
        </SettingsDetailPanel>
      </div>

      <Modal
        open={urlModalMode !== null}
        title={urlModalMode === 'link' ? 'Insert link' : 'Insert image'}
        okText="OK"
        cancelText="Cancel"
        onOk={handleInsertUrl}
        onCancel={() => {
          setUrlModalMode(null)
          setUrlValue('http://')
          setPendingLinkText('')
        }}
        destroyOnClose
      >
        <label className="mb-2 block text-sm text-slate-700">
          Please enter a url for the {urlModalMode === 'link' ? 'link' : 'image'}:
        </label>
        <Input
          autoFocus
          value={urlValue}
          onChange={(event) => setUrlValue(event.target.value)}
          onFocus={(event) => event.target.select()}
          placeholder="http://"
        />
      </Modal>
    </PageContainer>
  )
}

export default ProjectGroupDetail
