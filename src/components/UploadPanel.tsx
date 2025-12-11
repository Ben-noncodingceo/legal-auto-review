import React, { useState } from 'react';
import { Card, Upload, Button, message, Checkbox, Radio } from 'antd';
import { UploadOutlined, FileTextOutlined } from '@ant-design/icons';
import { ParsedFile, parseFile } from '../services/fileService';
import { RiskType, ReviewPerspective } from '../types';

interface Props {
  onFileParsed: (fileData: { parsed: ParsedFile, file: File }) => void;
  onRisksChange: (risks: RiskType[]) => void;
  onPerspectiveChange: (perspective: ReviewPerspective) => void;
  onStartReview: () => void;
  canReview: boolean;
}

const UploadPanel: React.FC<Props> = ({ onFileParsed, onRisksChange, onPerspectiveChange, onStartReview, canReview }) => {
  const [fileName, setFileName] = useState<string>('');
  const [perspective, setPerspective] = useState<ReviewPerspective>('partyA');

  const handleUpload = async (file: File) => {
    try {
      const parsed = await parseFile(file);
      setFileName(file.name);
      onFileParsed({ parsed, file });
      message.success('文件解析成功');
    } catch (error: any) {
      message.error(error.message || '文件解析失败');
    }
    return false; // Prevent auto upload
  };

  const riskOptions = [
    { label: '政策风险', value: 'policy' },
    { label: '财务风险', value: 'financial' },
    { label: '执行风险', value: 'execution' },
  ];

  const handlePerspectiveChange = (e: any) => {
    const val = e.target.value;
    setPerspective(val);
    onPerspectiveChange(val);
  };

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
        <div className="flex flex-col h-full gap-6">
          <div>
            <p className="mb-2 font-medium text-gray-700">选择您的立场：</p>
            <Radio.Group value={perspective} onChange={handlePerspectiveChange} buttonStyle="solid">
              <Radio.Button value="partyA">甲方 (权利方/委托方)</Radio.Button>
              <Radio.Button value="partyB">乙方 (义务方/受托方)</Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <p className="mb-2 font-medium text-gray-700">重点关注风险：</p>
            <Checkbox.Group 
              options={riskOptions} 
              onChange={(vals) => onRisksChange(vals as RiskType[])}
              className="flex flex-col gap-2"
            />
          </div>
          
          <Button 
            type="primary" 
            size="large" 
            onClick={onStartReview} 
            disabled={!canReview}
            className="mt-auto"
          >
            开始智能审核
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default UploadPanel;
