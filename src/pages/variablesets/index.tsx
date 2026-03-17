import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Modal, Typography, Tooltip, Spin, message } from 'antd'
import {
  SearchOutlined,
  BoldOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  CodeOutlined,
  FontSizeOutlined,
} from '@ant-design/icons'
import {
  CreateVariableSet,
  GetVariableSet,
  loadVariableSets,
  VariableSetItem,
  VariableSetOwnerType,
} from 'pages/apis/variableSet'
import { useSpace } from 'contexts/SpaceContext'

const { Title, Text, Link } = Typography
const { TextArea } = Input

function parseVariableSetId(rawId: unknown): number | null {
  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    return rawId
  }

  const text = String(rawId ?? '').trim()
  if (!text) return null

  const direct = Number(text)
  if (Number.isFinite(direct)) {
    return direct
  }

  const tailMatch = text.match(/(\d+)$/)
  if (!tailMatch) return null

  const parsed = Number(tailMatch[1])
  return Number.isFinite(parsed) ? parsed : null
}

const VariableSets: React.FC = () => {
  const navigate = useNavigate()
  const { space } = useSpace()

  const [searchText, setSearchText] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSetName, setNewSetName] = useState('')
  const [newSetDescription, setNewSetDescription] = useState('')
  const [showMarkdown, setShowMarkdown] = useState(false)
  const textAreaRef = useRef<any>(null)
  const [variableSets, setVariableSets] = useState<VariableSetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchVariableSets = async () => {
    const items = await loadVariableSets(setLoading, space.id)
    setVariableSets(items)
  }

  useEffect(() => {
    void fetchVariableSets()
  }, [space.id])

  const filteredSets = useMemo(
    () => variableSets.filter((set) => set.name.toLowerCase().includes(searchText.toLowerCase())),
    [searchText, variableSets],
  )

  const handleAddVariableSet = () => {
    setShowAddModal(true)
  }

  const handleSaveVariableSet = async () => {
    if (!newSetName.trim()) {
      message.warning('Please enter a variable set name')
      return
    }

    setSaving(true)
    try {
      await CreateVariableSet({
        ownerId: 0,
        ownerType: VariableSetOwnerType.LibraryVariableSet,
        spaceId: space.id,
        Name: newSetName.trim(),
        Description: newSetDescription.trim(),
        variables: [],
      })

      message.success('Variable set created')
      handleCancelModal()
      await fetchVariableSets()
    } catch (error) {
      console.error('Failed to create variable set', error)
      message.error('Failed to create variable set')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelModal = () => {
    setShowAddModal(false)
    setNewSetName('')
    setNewSetDescription('')
    setShowMarkdown(false)
  }

  const handleItemClick = (item: VariableSetItem) => {
    const parsedId = parseVariableSetId((item as unknown as { id?: unknown }).id)
    if (parsedId == null) {
      message.error('Invalid variable set id')
      return
    }

    GetVariableSet(parsedId)
      .then(() => {
        navigate(`/${space.slug}/library/variables/${parsedId}`)
      })
      .catch((error) => {
        console.error('Failed to load variable set detail', error)
        message.error('Failed to load variable set detail')
      })
  }

  const insertMarkdown = (before: string, after = '') => {
    const textarea = textAreaRef.current?.resizableTextArea?.textArea
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = newSetDescription.substring(start, end)
    const newText =
      newSetDescription.substring(0, start)
      + before
      + selectedText
      + after
      + newSetDescription.substring(end)

    setNewSetDescription(newText)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + before.length + selectedText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleBold = () => insertMarkdown('**', '**')
  const handleItalic = () => insertMarkdown('*', '*')
  const handleHeading = () => insertMarkdown('### ', '')
  const handleOrderedList = () => insertMarkdown('1. ', '')
  const handleUnorderedList = () => insertMarkdown('- ', '')
  const handleLink = () => insertMarkdown('[', '](url)')
  const handleImage = () => insertMarkdown('![alt text](', ')')
  const handleCode = () => insertMarkdown('`', '`')
  const handleCodeBlock = () => insertMarkdown('```\n', '\n```')

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-full p-6 gap-4 bg-white">
          <div className="px-0 pt-0">
            <div className="flex justify-between items-center mb-4">
              <Title level={3} className="!mb-0">Variable Sets</Title>
              <Button
                type="primary"
                onClick={handleAddVariableSet}
                className="!bg-green-700 hover:!bg-green-800 !border-green-700"
              >
                Add Variable Set
              </Button>
            </div>

            <Input
              placeholder="Filter by name..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Spin tip="Loading variable sets..." />
              </div>
            ) : filteredSets.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">
                No variable sets found
              </div>
            ) : (
              filteredSets.map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors last:border-b-0"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="m-0 text-base font-semibold text-gray-900 truncate">
                      {item.name}
                    </h3>
                    {item.description && (
                      <Text className="text-xs text-gray-500 line-clamp-2">
                        {item.description}
                      </Text>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal
        title="Add New Variable Set"
        open={showAddModal}
        onCancel={handleCancelModal}
        footer={[
          <Button
            key="cancel"
            onClick={handleCancelModal}
            className="!border-gray-300 !text-gray-700 hover:!border-gray-400 hover:!text-gray-800"
          >
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={handleSaveVariableSet}
            disabled={!newSetName.trim()}
            loading={saving}
            className="!bg-green-600 hover:!bg-green-700 !border-green-600 hover:!border-green-700 disabled:!bg-gray-300 disabled:!border-gray-300"
          >
            Save
          </Button>,
        ]}
        width={500}
        centered
        maskStyle={{
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
        }}
      >
        <div className="space-y-4">
          <div>
            <Input
              placeholder="New variable set name"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              className="text-sm"
            />
          </div>

          {showMarkdown && (
            <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-200 rounded flex-wrap">
              <Tooltip title="Bold">
                <Button size="small" icon={<BoldOutlined />} onClick={handleBold} className="hover:bg-gray-200" />
              </Tooltip>
              <Tooltip title="Italic">
                <Button size="small" icon={<ItalicOutlined />} onClick={handleItalic} className="hover:bg-gray-200" />
              </Tooltip>
              <Tooltip title="Heading">
                <Button size="small" icon={<FontSizeOutlined />} onClick={handleHeading} className="hover:bg-gray-200" />
              </Tooltip>
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <Tooltip title="Ordered List">
                <Button size="small" icon={<OrderedListOutlined />} onClick={handleOrderedList} className="hover:bg-gray-200" />
              </Tooltip>
              <Tooltip title="Unordered List">
                <Button size="small" icon={<UnorderedListOutlined />} onClick={handleUnorderedList} className="hover:bg-gray-200" />
              </Tooltip>
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <Tooltip title="Insert Image">
                <Button size="small" icon={<PictureOutlined />} onClick={handleImage} className="hover:bg-gray-200" />
              </Tooltip>
              <Tooltip title="Insert Link">
                <Button size="small" icon={<LinkOutlined />} onClick={handleLink} className="hover:bg-gray-200" />
              </Tooltip>
              <Tooltip title="Inline Code">
                <Button size="small" icon={<CodeOutlined />} onClick={handleCode} className="hover:bg-gray-200" />
              </Tooltip>
              <Tooltip title="Code Block">
                <Button size="small" onClick={handleCodeBlock} className="hover:bg-gray-200 text-xs px-2">
                  {'</>'}
                </Button>
              </Tooltip>
            </div>
          )}

          <div>
            <TextArea
              ref={textAreaRef}
              placeholder="Variable set description"
              value={newSetDescription}
              onChange={(e) => setNewSetDescription(e.target.value)}
              rows={showMarkdown ? 6 : 3}
              className="text-sm font-mono"
            />
          </div>

          <div className="flex items-center gap-3">
            <Link onClick={() => setShowMarkdown(!showMarkdown)} className="text-blue-500 hover:text-blue-600 text-sm">
              {showMarkdown ? 'Hide' : 'Show'} markdown controls
            </Link>
            {showMarkdown && (
              <>
                <span className="text-gray-300">|</span>
                <Link
                  href="https://www.markdownguide.org/basic-syntax/"
                  target="_blank"
                  className="text-blue-500 hover:text-blue-600 text-sm"
                >
                  Markdown instructions ↗
                </Link>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default VariableSets
