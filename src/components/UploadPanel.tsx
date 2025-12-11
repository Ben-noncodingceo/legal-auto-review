import React, { useState } from 'react';
import { Card, Upload, Button, message, Checkbox, Spin } from 'antd';
import { UploadOutlined, FileTextOutlined } from '@ant-design/icons';
import { ParsedFile, parseFile } from '../services/fileService';
import { RiskType } from '../types';

interface Props {
  onFileParsed: (fileData: { parsed: ParsedFile, file: File }) => void;
  onRisksChange: (risks: RiskType[]) => void;
  onStartReview: () => void;
  canReview: boolean;
}

const UploadPanel: React.FC<Props> = ({ onFileParsed, onRisksChange, onStartReview, canReview }) => {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<string>('');

  const handleUpload = async (file: File) => {
    setLoading(true);
    try {
      const parsed = await parseFile(file);
      setFileName(file.name);
      setPreview(parsed.text.substring(0, 500) + '...'); // Show first 500 chars as preview
      onFileParsed({ parsed, file });
      message.success('文件解析成功');
    } catch (error: any) {
      message.error(error.message || '文件解析失败');
    } finally {
      setLoading(false);
    }
    return false; // Prevent auto upload
  };

  const riskOptions = [
    { label: '政策风险', value: 'policy' },
    { label: '财务风险', value: 'financial' },
    { label: '执行风险', value: 'execution' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card title="1. 上传文档" className="shadow-md">
        <Upload.Dragger
          accept=".pdf,.docx,.doc"
          beforeUpload={handleUpload}
          showUploadList={false}
          maxCount={1}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
          <p className="ant-upload-hint">支持 PDF 和 Word 文档</p>
        </Upload.Dragger>

        {fileName && (
          <div className="mt-4 p-3 bg-gray-50 rounded border">
             <div className="font-medium flex items-center"><FileTextOutlined className="mr-2"/> {fileName}</div>
          </div>
        )}
      </Card>

      <Card title="2. 审核重点" className="shadow-md">
        <div className="flex flex-col h-full justify-between">
          <div>
            <p className="mb-4 text-gray-600">选择AI审核时重点关注的风险领域：</p>
            <Checkbox.Group 
              options={riskOptions} 
              onChange={(vals) => onRisksChange(vals as RiskType[])}
              className="flex flex-col gap-3"
            />
          </div>
          
          <Button 
            type="primary" 
            size="large" 
            onClick={onStartReview} 
            disabled={!canReview}
            className="mt-6"
          >
            开始智能审核
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default UploadPanel;
