import React, { useMemo, useEffect, useRef } from 'react';
import { ParsedFile } from '../services/fileService';
import ResultPanel from './ResultPanel';
import { AIConfig, ReviewMode, ExcelOutlineData } from '../types';
import { Button, Table } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { generateExcelReport, downloadExcel } from '../services/excelService';

interface Props {
  fileData: ParsedFile;
  reviewResult: any;
  aiConfig: AIConfig;
  onDownload: () => void;
  focusRiskIndex: number | null;
  onLocateRisk: (index: number) => void;
  reviewMode?: ReviewMode;
  outlineData?: ExcelOutlineData | null;
  filledOutlineItems?: any[] | null;
}

const ReviewBoard: React.FC<Props> = ({
  fileData,
  reviewResult,
  aiConfig,
  onDownload,
  focusRiskIndex,
  onLocateRisk,
  reviewMode = 'standard',
  outlineData,
  filledOutlineItems
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Highlight logic
  const highlightedHtml = useMemo(() => {
    let html = fileData.html;
    if (!reviewResult?.reviews) return html;

    reviewResult.reviews.forEach((item: any, index: number) => {
      const snippet = item.original_text_snippet;
      if (snippet && html.includes(snippet)) {
        // Simple replacement - replace first occurrence or all? First is safer usually.
        // We add a class for styling and maybe a tooltip
        // Also add an ID for scrolling
        html = html.replace(
          snippet, 
          `<mark id="risk-mark-${index}" class="bg-red-200 cursor-help" title="${item.reason}">${snippet}</mark>`
        );
      }
    });
    return html;
  }, [fileData.html, reviewResult]);

  // Scroll to focused risk
  useEffect(() => {
    if (focusRiskIndex !== null) {
      const markElement = document.getElementById(`risk-mark-${focusRiskIndex}`);
      if (markElement) {
        markElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a temporary highlight effect
        markElement.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
        setTimeout(() => {
          markElement.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
        }, 2000);
      }
    }
  }, [focusRiskIndex, highlightedHtml]);

  const handleExcelDownload = () => {
    if (filledOutlineItems && outlineData) {
      const blob = generateExcelReport(outlineData, filledOutlineItems);
      const filename = `${fileData.text.substring(0, 20)}_审查结果_${new Date().getTime()}.xlsx`;
      downloadExcel(blob, filename);
    }
  };

  // For outline mode, create table columns
  const outlineColumns = [
    {
      title: '序号',
      dataIndex: 'row',
      key: 'row',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '审查项目',
      dataIndex: 'itemName',
      key: 'itemName',
      width: 200,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
    },
    {
      title: '审查结果',
      dataIndex: 'result',
      key: 'result',
      ellipsis: true,
    },
  ];

  // 标准模式渲染
  if (reviewMode === 'standard') {
    return (
      <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-4">
        {/* Left: Document Viewer */}
        <div className="flex-1 bg-white border rounded shadow-md overflow-hidden flex flex-col">
          <div className="p-2 bg-gray-100 border-b font-medium">文档原文预览</div>
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto p-8 prose max-w-none"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </div>

        {/* Right: Results */}
        <div className="w-full md:w-1/3 min-w-[350px]">
          <ResultPanel
            result={reviewResult}
            aiConfig={aiConfig}
            onDownload={onDownload}
            onLocateRisk={onLocateRisk}
          />
        </div>
      </div>
    );
  }

  // 纲要模式渲染
  return (
    <div className="space-y-4">
      <div className="bg-white border rounded shadow-md p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">审查结果</h2>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExcelDownload}
          >
            下载Excel审查报告
          </Button>
        </div>

        <Table
          columns={outlineColumns}
          dataSource={filledOutlineItems || []}
          rowKey="row"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个审查项目`,
          }}
          scroll={{ x: 1000 }}
          bordered
        />
      </div>
    </div>
  );
};

export default ReviewBoard;
