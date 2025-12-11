import React, { useState } from 'react';
import { Card, Collapse, Tag, Button, Input, Typography, Space } from 'antd';
import { SearchOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { AIConfig } from '../types';
import { searchRelatedCompanies, searchSimilarCases } from '../services/aiService';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

interface Props {
  result: any; // Parsed JSON from AI
  aiConfig: AIConfig;
  onDownload: () => void;
  onLocateRisk: (index: number) => void;
}

const ResultPanel: React.FC<Props> = ({ result, aiConfig, onDownload, onLocateRisk }) => {
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<string>('');
  const [caseInfo, setCaseInfo] = useState<string>('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [caseQuery, setCaseQuery] = useState('');

  const reviews = result?.reviews || [];

  const handleSearchCompany = async () => {
    if (!companyQuery) return;
    setLoadingCompany(true);
    try {
      const res = await searchRelatedCompanies(aiConfig, companyQuery);
      setCompanyInfo(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleSearchCase = async () => {
    if (!caseQuery) return;
    setLoadingCase(true);
    try {
      const res = await searchSimilarCases(aiConfig, caseQuery);
      setCaseInfo(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCase(false);
    }
  };

  const getRiskColor = (type: string) => {
    switch (type) {
      case 'policy': return 'red';
      case 'financial': return 'orange';
      case 'execution': return 'blue';
      default: return 'default';
    }
  };

  const getRiskLabel = (type: string) => {
    switch (type) {
      case 'policy': return '政策风险';
      case 'financial': return '财务风险';
      case 'execution': return '执行风险';
      default: return type.toUpperCase();
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getRiskLevelLabel = (level: string) => {
    switch (level) {
      case 'high': return '高风险';
      case 'medium': return '中等风险';
      case 'low': return '低风险';
      default: return level || '未知等级';
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto p-2">
      <Card title="审核结果" extra={<Button icon={<DownloadOutlined />} onClick={onDownload}>下载报告</Button>}>
        {reviews.length === 0 ? (
          <p>未发现明显风险。</p>
        ) : (
          <Collapse defaultActiveKey={['0']}>
            {reviews.map((item: any, idx: number) => (
              <Panel 
                header={
                  <Space>
                    <Tag color={getRiskColor(item.risk_type)}>{getRiskLabel(item.risk_type)}</Tag>
                    {item.risk_level && (
                      <Tag color={getRiskLevelColor(item.risk_level)}>{getRiskLevelLabel(item.risk_level)}</Tag>
                    )}
                    <Text strong>{item.risk_type === 'policy' ? '政策风险' : (item.risk_type === 'financial' ? '财务风险' : '条款风险')}</Text>
                  </Space>
                }
                key={idx}
                extra={
                  <Button 
                    type="text" 
                    icon={<EyeOutlined />} 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLocateRisk(idx);
                    }}
                    title="在原文中定位"
                  />
                }
              >
                <Paragraph><strong>原因：</strong> {item.reason}</Paragraph>
                <Paragraph><strong>建议：</strong> {item.suggestion}</Paragraph>
                <div className="bg-gray-100 p-2 rounded text-sm italic">
                  "{item.original_text_snippet}"
                </div>
              </Panel>
            ))}
          </Collapse>
        )}
      </Card>

      <Card title="辅助调查" size="small">
        <div className="mb-4">
          <Text strong>关联公司调查</Text>
          <div className="flex mt-2">
            <Input 
              placeholder="输入公司名称" 
              value={companyQuery} 
              onChange={e => setCompanyQuery(e.target.value)} 
              onPressEnter={handleSearchCompany}
            />
            <Button icon={<SearchOutlined />} onClick={handleSearchCompany} loading={loadingCompany} />
          </div>
          {companyInfo && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
              <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                {companyInfo}
              </Paragraph>
            </div>
          )}
        </div>

        <div>
          <Text strong>相似案件检索</Text>
          <div className="flex mt-2">
            <Input 
              placeholder="输入案件关键词" 
              value={caseQuery} 
              onChange={e => setCaseQuery(e.target.value)}
              onPressEnter={handleSearchCase}
            />
            <Button icon={<SearchOutlined />} onClick={handleSearchCase} loading={loadingCase} />
          </div>
          {caseInfo && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
              <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                {caseInfo}
              </Paragraph>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ResultPanel;
