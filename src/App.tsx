import { useState } from 'react';
import { ConfigProvider, Layout, Steps, message, Spin, Modal } from 'antd';

import ConfigPanel from './components/ConfigPanel';
import UploadPanel from './components/UploadPanel';
import ReviewBoard from './components/ReviewBoard';
import { AIConfig, RiskType } from './types';
import { ParsedFile } from './services/fileService';
import { callAIReview } from './services/aiService';
import { generateAndDownloadReport } from './services/reportService';
import './App.css';

const { Content, Header } = Layout;

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [parsedFile, setParsedFile] = useState<{ parsed: ParsedFile, file: File } | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<RiskType[]>([]);
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleConfigConfirm = (config: AIConfig) => {
    setAiConfig(config);
    message.success('AI 服务配置完成');
    setCurrentStep(1);
  };

  const handleFileParsed = (data: { parsed: ParsedFile, file: File }) => {
    setParsedFile(data);
  };

  const handleStartReview = async () => {
    if (!aiConfig || !parsedFile || selectedRisks.length === 0) {
      message.error('请完成所有设置');
      return;
    }

    setLoading(true);
    setLogs([]);
    try {
      const resultJson = await callAIReview(aiConfig, parsedFile.parsed.text, selectedRisks, (log) => {
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
      jsonStr = jsonStr.replace(/“|”/g, '"').replace(/‘|’/g, "'");
      
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
                onStartReview={handleStartReview}
                canReview={!!parsedFile && selectedRisks.length > 0}
              />
            )}

            {currentStep === 2 && parsedFile && aiConfig && (
              <ReviewBoard 
                fileData={parsedFile.parsed}
                reviewResult={reviewResult}
                aiConfig={aiConfig}
                onDownload={handleDownload}
              />
            )}
          </div>
        </Content>

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
