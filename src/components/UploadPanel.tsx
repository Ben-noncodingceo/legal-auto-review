import React, { useState } from 'react';
import { Card, Upload, Button, message, Checkbox, Radio, Switch } from 'antd';
import { UploadOutlined, FileTextOutlined, FileExcelOutlined } from '@ant-design/icons';
import { ParsedFile, parseFile } from '../services/fileService';
import { RiskType, ReviewPerspective, ReviewMode, ExcelOutlineData } from '../types';
import { parseExcelOutline } from '../services/excelService';

interface Props {
  onFileParsed: (fileData: { parsed: ParsedFile, file: File }) => void;
  onRisksChange: (risks: RiskType[]) => void;
  onPerspectiveChange: (perspective: ReviewPerspective) => void;
  onStartReview: () => void;
  onReviewModeChange: (mode: ReviewMode) => void;
  onOutlineParsed: (data: ExcelOutlineData) => void;
  canReview: boolean;
}

const UploadPanel: React.FC<Props> = ({
  onFileParsed,
  onRisksChange,
  onPerspectiveChange,
  onStartReview,
  onReviewModeChange,
  onOutlineParsed,
  canReview
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [outlineFileName, setOutlineFileName] = useState<string>('');
  const [perspective, setPerspective] = useState<ReviewPerspective>('partyA');
  const [reviewMode, setReviewMode] = useState<ReviewMode>('standard');

  const handleUpload = async (file: File) => {
    try {
      const parsed = await parseFile(file);
      setFileName(file.name);
      onFileParsed({ parsed, file });
      message.success('合同文件解析成功');
    } catch (error: any) {
      message.error(error.message || '文件解析失败');
    }
    return false; // Prevent auto upload
  };

  const handleOutlineUpload = async (file: File) => {
    try {
      const parsed = await parseExcelOutline(file);
      setOutlineFileName(file.name);
      onOutlineParsed({
        file,
        items: parsed.items,
        originalWorkbook: parsed.originalWorkbook,
        sheetName: parsed.sheetName
      });
      message.success(`审查纲要解析成功，共 ${parsed.items.length} 个审查项目`);
    } catch (error: any) {
      message.error(error.message || '审查纲要解析失败');
    }
    return false; // Prevent auto upload
  };

  const handleReviewModeChange = (checked: boolean) => {
    const mode: ReviewMode = checked ? 'outline' : 'standard';
    setReviewMode(mode);
    onReviewModeChange(mode);
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
    <div className="space-y-6">
      {/* 审查模式切换 */}
      <Card className="shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg mb-1">审查模式</h3>
            <p className="text-gray-600 text-sm">
              {reviewMode === 'standard' ? '标准模式：AI自动识别合同风险' : '纲要模式：按照审查纲要逐项填写'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={reviewMode === 'standard' ? 'font-semibold' : 'text-gray-500'}>标准审查</span>
            <Switch checked={reviewMode === 'outline'} onChange={handleReviewModeChange} />
            <span className={reviewMode === 'outline' ? 'font-semibold' : 'text-gray-500'}>纲要审查</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="1. 上传合同文档" className="shadow-md">
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

        {reviewMode === 'outline' && (
          <Card title="2. 上传审查纲要 (Excel)" className="shadow-md">
            <Upload.Dragger
              accept=".xlsx,.xls"
              beforeUpload={handleOutlineUpload}
              showUploadList={false}
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <FileExcelOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽审查纲要到此处上传</p>
              <p className="ant-upload-hint">支持 Excel 文件 (.xlsx, .xls)</p>
            </Upload.Dragger>

            {outlineFileName && (
              <div className="mt-4 p-3 bg-gray-50 rounded border">
                 <div className="font-medium flex items-center"><FileExcelOutlined className="mr-2"/> {outlineFileName}</div>
              </div>
            )}
          </Card>
        )}

        <Card title={reviewMode === 'outline' ? '3. 审核设置' : '2. 审核设置'} className="shadow-md">
          <div className="flex flex-col h-full gap-6">
            <div>
              <p className="mb-2 font-medium text-gray-700">选择您的立场：</p>
              <Radio.Group value={perspective} onChange={handlePerspectiveChange} buttonStyle="solid">
                <Radio.Button value="partyA">甲方 (权利方/委托方)</Radio.Button>
                <Radio.Button value="partyB">乙方 (义务方/受托方)</Radio.Button>
              </Radio.Group>
            </div>

            {reviewMode === 'standard' && (
              <div>
                <p className="mb-2 font-medium text-gray-700">重点关注风险：</p>
                <Checkbox.Group
                  options={riskOptions}
                  onChange={(vals) => onRisksChange(vals as RiskType[])}
                  className="flex flex-col gap-2"
                />
              </div>
            )}

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
    </div>
  );
};

export default UploadPanel;
