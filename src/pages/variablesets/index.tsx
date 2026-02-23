import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Typography, Tooltip, Spin } from 'antd';
import {
  SearchOutlined,
  BoldOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  CodeOutlined,
  FontSizeOutlined
} from '@ant-design/icons';
import { loadVariableSets, VariableSetItem } from 'pages/apis/variableSet';
import { useSpace } from 'contexts/SpaceContext';

const { Title, Text, Link } = Typography;
const { TextArea } = Input;


const VariableSets: React.FC = () => {
  const navigate = useNavigate();
  const { space } = useSpace();
  const [searchText, setSearchText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [showMarkdown, setShowMarkdown] = useState(false);
  const textAreaRef = useRef<any>(null);
  const [variableSets, setVariableSets] = useState<VariableSetItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchVariableSets = async () => {
      var items = await loadVariableSets(setLoading, space.id);
      setVariableSets(items);
    };

    fetchVariableSets();
  }, []);

  const filteredSets = variableSets.filter((set) =>
    set.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleAddVariableSet = () => {
    setShowAddModal(true);
  };

  const handleSaveVariableSet = () => {
    console.log('Saving:', { name: newSetName, description: newSetDescription });
    // 实现保存逻辑
    handleCancelModal();
  };

  const handleCancelModal = () => {
    setShowAddModal(false);
    setNewSetName('');
    setNewSetDescription('');
    setShowMarkdown(false);
  };

  const handleItemClick = (item: VariableSetItem) => {
    navigate(`/${space.slug}/variable/${item.id}`);
  };

  // Markdown formatting functions
  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textAreaRef.current?.resizableTextArea?.textArea;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newSetDescription.substring(start, end);
    const newText = 
      newSetDescription.substring(0, start) +
      before +
      selectedText +
      after +
      newSetDescription.substring(end);
    
    setNewSetDescription(newText);
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleBold = () => insertMarkdown('**', '**');
  const handleItalic = () => insertMarkdown('*', '*');
  const handleHeading = () => insertMarkdown('### ', '');
  const handleOrderedList = () => insertMarkdown('1. ', '');
  const handleUnorderedList = () => insertMarkdown('- ', '');
  const handleLink = () => insertMarkdown('[', '](url)');
  const handleImage = () => insertMarkdown('![alt text](', ')');
  const handleCode = () => insertMarkdown('`', '`');
  const handleCodeBlock = () => insertMarkdown('```\n', '\n```');

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="!mb-0">Variable Sets</Title>
        <Button 
          type="primary" 
          onClick={handleAddVariableSet}
          className="!bg-green-700 hover:!bg-green-800 !border-green-700"
        >
          Add Variable Set
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Filter by name..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* List */}
      <div className="border-t border-gray-200 min-h-[120px]">
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
              className="py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleItemClick(item)}
            >
              <div className="flex flex-col gap-1">
                <Link className="text-blue-500 hover:text-blue-600 font-medium text-sm">
                  {item.name}
                </Link>
                {item.description && (
                  <Text className="text-xs text-gray-500">
                    {item.description}
                  </Text>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Variable Set Modal */}
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
          {/* Variable Set Name */}
          <div>
            <Input
              placeholder="New variable set name"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Markdown Toolbar - Show when markdown is enabled */}
          {showMarkdown && (
            <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-200 rounded flex-wrap">
              <Tooltip title="Bold">
                <Button 
                  size="small" 
                  icon={<BoldOutlined />} 
                  onClick={handleBold}
                  className="hover:bg-gray-200"
                />
              </Tooltip>
              <Tooltip title="Italic">
                <Button 
                  size="small" 
                  icon={<ItalicOutlined />} 
                  onClick={handleItalic}
                  className="hover:bg-gray-200"
                />
              </Tooltip>
              <Tooltip title="Heading">
                <Button 
                  size="small" 
                  icon={<FontSizeOutlined />} 
                  onClick={handleHeading}
                  className="hover:bg-gray-200"
                />
              </Tooltip>
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <Tooltip title="Ordered List">
                <Button 
                  size="small" 
                  icon={<OrderedListOutlined />} 
                  onClick={handleOrderedList}
                  className="hover:bg-gray-200"
                />
              </Tooltip>
              <Tooltip title="Unordered List">
                <Button 
                  size="small" 
                  icon={<UnorderedListOutlined />} 
                  onClick={handleUnorderedList}
                  className="hover:bg-gray-200"
                />
              </Tooltip>
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <Tooltip title="Insert Image">
                <Button 
                  size="small" 
                  icon={<PictureOutlined />} 
                  onClick={handleImage}
                  className="hover:bg-gray-200"
                />
              </Tooltip>
              <Tooltip title="Insert Link">
                <Button 
                  size="small" 
                  icon={<LinkOutlined />} 
                  onClick={handleLink}
                  className="hover:bg-gray-200"
                />
              </Tooltip>
              <Tooltip title="Inline Code">
                <Button 
                  size="small" 
                  icon={<CodeOutlined />} 
                  onClick={handleCode}
                  className="hover:bg-gray-200"
                />
              </Tooltip>
              <Tooltip title="Code Block">
                <Button 
                  size="small" 
                  onClick={handleCodeBlock}
                  className="hover:bg-gray-200 text-xs px-2"
                >
                  {'</>'}
                </Button>
              </Tooltip>
            </div>
          )}

          {/* Variable Set Description */}
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

          {/* Show/Hide Markdown Controls Link */}
          <div className="flex items-center gap-3">
            <Link 
              onClick={() => setShowMarkdown(!showMarkdown)}
              className="text-blue-500 hover:text-blue-600 text-sm"
            >
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
  );
};

export default VariableSets;
