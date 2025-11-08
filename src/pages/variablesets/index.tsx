import React, { useState, CSSProperties } from 'react';
import { Button, Input, List, Typography, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Title, Text, Link } = Typography;

interface VariableSet {
  id: string;
  name: string;
  description?: string;
}

// 样式对象
const styles: { [key: string]: CSSProperties } = {
  container: {
    padding: '24px',
    backgroundColor: '#fff',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  searchSection: {
    marginBottom: '16px',
  },
  listItem: {
    padding: '16px 0',
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  itemContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  nameText: {
    color: '#1890ff',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
  },
  descriptionText: {
    fontSize: '12px',
    color: '#8c8c8c',
  },
};

const VariableSets: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  
  const variableSets: VariableSet[] = [
    { id: '6', name: 'K8S Template Variable' },
    { id: '8', name: 'PHP Team', description: 'PHP Team' },
    { id: '9', name: 'PickGoGo' },
    { id: '10', name: 'PocketStore' },
  ];

  const filteredSets = variableSets.filter(set =>
    set.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleAddVariableSet = () => {
    console.log('Add Variable Set clicked');
    // 实现添加变量集的逻辑
  };

  const handleItemClick = (item: VariableSet) => {
    console.log('Clicked:', item.name);
    // 实现点击项目的逻辑
  };

  // 自定义hover样式
  const hoverStyles = `
    .variable-set-item:hover {
      background-color: #fafafa;
    }
    .variable-set-item:last-child {
      border-bottom: none;
    }
  `;

  return (
    <div style={styles.container}>
      <style>{hoverStyles}</style>
      
      <div style={styles.header}>
        <Title level={3} style={{ margin: 0 }}>Variable Sets</Title>
        <Button 
          type="primary" 
          onClick={handleAddVariableSet}
          style={{ backgroundColor: '#2e7d32', borderColor: '#2e7d32' }}
        >
          Add Variable Set
        </Button>
      </div>

      <div style={styles.searchSection}>
        <Input
          placeholder="Filter by name..."
          prefix={<SearchOutlined style={{ color: '#999' }} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0' }}>
        {filteredSets.map((item) => (
          <div
            key={item.id}
            className="variable-set-item"
            style={styles.listItem}
            onClick={() => handleItemClick(item)}
          >
            <div style={styles.itemContent}>
              <Link style={styles.nameText}>
                {item.name}
              </Link>
              {item.description && (
                <Text style={styles.descriptionText}>
                  {item.description}
                </Text>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VariableSets;