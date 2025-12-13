import { useState } from 'react';
import { ConfigProvider, Layout, Steps, message, Spin, Modal } from 'antd';

import ConfigPanel from './components/ConfigPanel';
import UploadPanel from './components/UploadPanel';
import ReviewBoard from './components/ReviewBoard';
import { AIConfig, RiskType, ReviewPerspective, ReviewMode, ExcelOutlineData } from './types';
import { ParsedFile } from './services/fileService';
import { callAIReview, reviewByOutline } from './services/aiService';
import { generateAndDownloadReport } from './services/reportService';
import './App.css';

const { Content, Header, Footer } = Layout;

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [parsedFile, setParsedFile] = useState<{ parsed: ParsedFile, file: File } | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<RiskType[]>([]);
  const [perspective, setPerspective] = useState<ReviewPerspective>('partyA');
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [focusRiskIndex, setFocusRiskIndex] = useState<number | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('standard');
  const [outlineData, setOutlineData] = useState<ExcelOutlineData | null>(null);
  const [filledOutlineItems, setFilledOutlineItems] = useState<any[] | null>(null);

  const handleConfigConfirm = (config: AIConfig) => {
    setAiConfig(config);
    message.success('AI 服务配置完成');
    setCurrentStep(1);
  };

  const handleFileParsed = (data: { parsed: ParsedFile, file: File }) => {
    setParsedFile(data);
  };

  const handleReviewModeChange = (mode: ReviewMode) => {
    setReviewMode(mode);
    // 清除之前的审查结果
    setReviewResult(null);
    setFilledOutlineItems(null);
  };

  const handleOutlineParsed = (data: ExcelOutlineData) => {
    setOutlineData(data);
  };

  const handleStartReview = async () => {
    if (!aiConfig || !parsedFile) {
      message.error('请完成所有设置');
      return;
    }

    // 标准模式需要选择风险类型
    if (reviewMode === 'standard' && selectedRisks.length === 0) {
      message.error('请至少选择一个关注的风险类型');
      return;
    }

    // 纲要模式需要上传审查纲要
    if (reviewMode === 'outline' && !outlineData) {
      message.error('请上传审查纲要Excel文件');
      return;
    }

    setLoading(true);
    setLogs([]);

    try {
      if (reviewMode === 'standard') {
        // 标准审查模式
        const resultJson = await callAIReview(aiConfig, parsedFile.parsed.text, selectedRisks, perspective, (log) => {
           setLogs(prev => [...prev, log]);
        });
        console.log('AI Result:', resultJson);

        // Try to parse JSON. Sometimes AI returns markdown like ```json ... ```
        let jsonStr = resultJson;
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0];
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0];
        }

        // 修复: 替换中文智能引号为标准引号，并移除可能存在的非JSON字符
        jsonStr = jsonStr.replace(/"|"/g, '"').replace(/'|'/g, "'");

        // 尝试提取 JSON 对象 (从第一个 { 到最后一个 })
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }

        const result = JSON.parse(jsonStr);
        setReviewResult(result);
        setCurrentStep(2);
        message.success('智能审核完成');
      } else {
        // 纲要审查模式
        setLogs(['开始基于审查纲要进行逐项审查...']);
        const filled = await reviewByOutline(
          aiConfig,
          parsedFile.parsed.text,
          outlineData!.items,
          perspective,
          (current, total, itemName) => {
            setLogs(prev => [...prev, `[${current}/${total}] 正在审查: ${itemName}`]);
          }
        );

        setFilledOutlineItems(filled);
        setCurrentStep(2);
        message.success(`审查完成，共完成 ${filled.length} 个审查项目`);
      }
    } catch (error: any) {
      console.error(error);
      Modal.error({
        title: '审核失败',
        content: error.message || 'AI审核过程中发生未知错误。',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (parsedFile && reviewResult) {
      generateAndDownloadReport(parsedFile.parsed.text, reviewResult, parsedFile.file.name.split('.')[0] + '_审核报告');
    }
  };

  return (
    <ConfigProvider>
      <Layout className="min-h-screen bg-gray-50">
        <Header className="bg-white border-b flex items-center px-8 shadow-sm h-16">
          <div className="text-xl font-bold text-blue-600 flex items-center gap-2">
            ⚖️ 法律文件智能审核系统
          </div>
        </Header>
        
        <Content className="p-8 max-w-7xl mx-auto w-full">
          <Steps 
            current={currentStep} 
            className="mb-8 max-w-3xl mx-auto"
            items={[
              { title: 'AI 配置' },
              { title: '上传与设置' },
              { title: '审核结果' },
            ]}
          />

          <div className="content-area">
            {currentStep === 0 && (
              <div className="flex justify-center mt-12">
                <ConfigPanel onConfirm={handleConfigConfirm} />
              </div>
            )}

            {currentStep === 1 && (
              <UploadPanel
                onFileParsed={handleFileParsed}
                onRisksChange={setSelectedRisks}
                onPerspectiveChange={setPerspective}
                onStartReview={handleStartReview}
                onReviewModeChange={handleReviewModeChange}
                onOutlineParsed={handleOutlineParsed}
                canReview={
                  !!parsedFile &&
                  (reviewMode === 'standard' ? selectedRisks.length > 0 : !!outlineData)
                }
              />
            )}

            {currentStep === 2 && parsedFile && aiConfig && (
              <ReviewBoard
                fileData={parsedFile.parsed}
                reviewResult={reviewResult}
                aiConfig={aiConfig}
                onDownload={handleDownload}
                focusRiskIndex={focusRiskIndex}
                onLocateRisk={setFocusRiskIndex}
                reviewMode={reviewMode}
                outlineData={outlineData}
                filledOutlineItems={filledOutlineItems}
              />
            )}
          </div>
        </Content>

        <Footer className="text-center text-gray-500 bg-gray-50">
          联系作者： sunpeng@eduzhixin.com
        </Footer>

        {loading && (
           <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
             <Spin size="large" />
             <div className="mt-4 text-white text-lg font-medium">AI 正在审核文件中...</div>
             <div className="text-white/80 text-sm mb-4">根据文件大小，这可能需要一分钟左右。</div>
             
             {/* Log Console */}
             <div className="w-full max-w-2xl bg-black/80 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs text-green-400 border border-gray-700 shadow-2xl">
                {logs.map((log, i) => (
                  <div key={i} className="mb-1">
                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                  </div>
                ))}
                {logs.length === 0 && <div className="text-gray-500 animate-pulse">等待任务启动...</div>}
             </div>
           </div>
        )}
      </Layout>
    </ConfigProvider>
  );
}

export default App;
