import axios from 'axios';
import { AIConfig, RiskType } from '../types';

const API_ENDPOINTS = {
  deepseek: '/api/deepseek/chat/completions',
  doubao: '/api/doubao/api/v3/chat/completions',
  tongyi: '/api/tongyi/compatible-mode/v1/chat/completions',
};

const MODELS = {
  deepseek: 'deepseek-chat',
  doubao: 'doubao-pro-32k', 
  tongyi: 'qwen-turbo',
};

export const callAIReview = async (
  config: AIConfig,
  text: string,
  risks: RiskType[],
  perspective: 'partyA' | 'partyB' = 'partyA',
  onProgress?: (log: string) => void
): Promise<string> => {
  const riskLabels = {
    policy: '政策风险',
    financial: '财务风险',
    execution: '执行风险'
  };
  
  const perspectiveLabel = perspective === 'partyA' ? '甲方（权利方/委托方）' : '乙方（义务方/受托方）';

  const selectedRisks = risks.map(r => riskLabels[r]).join('、');
  
  // 1. Chunking Strategy
  const MAX_CHUNK_SIZE = 8000; // Safe limit for most models
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
    chunks.push(text.substring(i, i + MAX_CHUNK_SIZE));
  }

  onProgress?.(`文档已拆分为 ${chunks.length} 个部分进行分析...`);

  let allReviews: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    onProgress?.(`正在分析第 ${i + 1}/${chunks.length} 部分...`);
    
    const prompt = `
    你是一位专业的法律审核助手。
    请站在【${perspectiveLabel}】的立场上，审核以下法律文件的内容片段。
    
    重點关注以下风险：${selectedRisks}。

    风险等级说明：
    - high (高风险): 改进空间很大，大概率出问题
    - medium (中等风险): 有一定的改进空间，类似情况小概率出问题
    - low (低风险): 大概率不会出现问题，有很小的改进空间
    
    文件内容片段：
    ${chunk}
    
    请以JSON格式输出结果，结构如下：
    {
      "reviews": [
        {
          "original_text_snippet": "引起问题的具体原文片段",
          "risk_type": "policy|financial|execution",
          "risk_level": "high|medium|low",
          "reason": "为什么这是一个风险",
          "suggestion": "如何修改"
        }
      ]
    }
    risk_type 字段请严格使用 "policy", "financial", "execution" 这三个英文枚举值。
    risk_level 字段请严格使用 "high", "medium", "low" 这三个英文枚举值。
    reason 和 suggestion 请使用中文。
    如果未发现风险，请返回 {"reviews": []}。
    
    重要：请确保输出的是合法的纯JSON字符串。
    1. 不要包含markdown代码块标记（如 \`\`\`json）。
    2. JSON字符串中不得包含未转义的控制字符（如换行符）。
    3. 如果内容中包含引号，请使用单引号或转义双引号。
    4. 不要添加任何注释。
    `;

    // Handle specific provider logic
    let model = config.model || MODELS[config.provider];
    let headers: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };

    try {
      const response = await axios.post(
        API_ENDPOINTS[config.provider],
        {
          model: model,
          messages: [
            { role: 'system', content: '你是一位乐于助人的专业法律助手。请输出合法的纯JSON数据。' },
            { role: 'user', content: prompt }
          ],
          stream: false, 
        },
        { headers }
      );

      const content = response.data.choices[0].message.content;
      
      // Parse chunk result
      try {
        let jsonStr = content;
        // Clean up markdown
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0];
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0];
        }
        
        // Trim whitespace
        jsonStr = jsonStr.trim();

        // Basic cleanup for common JSON errors
        // 1. Remove comments if any (simple regex, not perfect but helps)
        jsonStr = jsonStr.replace(/\/\/.*$/gm, '');
        
        // 2. Fix Chinese quotes to English quotes, but be careful not to break text
        // Ideally AI should output correct quotes. We only replace outer ones if they look wrong.
        // But replacing all is safer if we assume AI follows instructions to use single quotes inside.
        jsonStr = jsonStr.replace(/“|”/g, '"').replace(/‘|’/g, "'");
        
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }

        const result = JSON.parse(jsonStr);
        if (result.reviews && Array.isArray(result.reviews)) {
          allReviews = [...allReviews, ...result.reviews];
          onProgress?.(`第 ${i + 1} 部分分析完成，发现 ${result.reviews.length} 个风险点。`);
        }
      } catch (parseError) {
        console.error('JSON Parse Error for chunk:', parseError);
        console.log('Failed JSON content:', content); // For debugging
        onProgress?.(`第 ${i + 1} 部分解析失败 (格式错误)，已跳过。`);
      }

    } catch (error: any) {
      console.error('AI API Call Error:', error);
      let errorMsg = '调用AI服务失败。请检查您的API Key和网络连接。';
      
      if (error.response) {
        errorMsg += ` (状态码: ${error.response.status}, 错误信息: ${JSON.stringify(error.response.data)})`;
      } else if (error.request) {
        errorMsg += ' (无法连接到服务器，可能是跨域(CORS)限制或网络问题。请尝试安装CORS浏览器插件或使用支持跨域的API)';
      } else {
        errorMsg += ` (${error.message})`;
      }
      onProgress?.(`错误: ${errorMsg}`);
      // Don't throw immediately, try next chunks? 
      // Or maybe throw if all fail. For now, let's continue.
    }
  }

  onProgress?.(`分析全部完成，共发现 ${allReviews.length} 个风险点。正在汇总报告...`);
  
  // Return merged result as JSON string
  return JSON.stringify({ reviews: allReviews });
};

export const searchRelatedCompanies = async (config: AIConfig, companyName: string): Promise<string> => {
  const prompt = `请调查公司"${companyName}"。提供关于其注册信息、诉讼情况和行业资质的信息。请保持简洁。`;
  return simpleAICall(config, prompt);
};

export const searchSimilarCases = async (config: AIConfig, query: string): Promise<string> => {
  const prompt = `请查找关于"${query}"的相似法律案件。提供司法结果、裁判要点和法律依据。请保持简洁。`;
  return simpleAICall(config, prompt);
};

const simpleAICall = async (config: AIConfig, prompt: string): Promise<string> => {
  const model = config.model || MODELS[config.provider];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };

  try {
    const response = await axios.post(
      API_ENDPOINTS[config.provider],
      {
        model: model,
        messages: [{ role: 'user', content: prompt }],
      },
      { headers }
    );
    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error('AI API Call Error:', error);
    let errorMsg = '调用AI服务失败。';
    if (error.response) {
       errorMsg += ` (状态码: ${error.response.status})`;
    } else if (error.request) {
       errorMsg += ' (网络错误或跨域(CORS)限制)';
    }
    throw new Error(errorMsg);
  }
};
