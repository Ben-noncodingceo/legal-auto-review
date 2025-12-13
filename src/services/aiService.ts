import axios from 'axios';
import { jsonrepair } from 'jsonrepair';
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
  const MAX_CHUNK_SIZE = 3000; 
  const OVERLAP_SIZE = 500; // Overlap to prevent context loss at boundaries
  const chunks = [];
  
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + MAX_CHUNK_SIZE, text.length);
    chunks.push(text.substring(i, end));
    if (end === text.length) break;
    i += (MAX_CHUNK_SIZE - OVERLAP_SIZE);
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
          max_tokens: 4000, // Ensure enough tokens for response
          messages: [
            { role: 'system', content: '你是一位乐于助人的专业法律助手。请输出合法的纯JSON数据。' },
            { role: 'user', content: prompt }
          ],
          stream: false, 
        },
        { headers }
      );

      // DeepSeek sometimes returns errors in 200 OK responses if not standard OpenAI format
      if (config.provider === 'deepseek' && !response.data.choices && (response.data as any).error) {
         throw new Error(`DeepSeek API Error: ${(response.data as any).error.message}`);
      }

      let content = '';
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        content = response.data.choices[0].message.content;
      } else {
        console.error('Unexpected API Response Structure:', response.data);
        throw new Error(`API返回结构异常: ${JSON.stringify(response.data)}`);
      }
      
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

        let result;
        try {
          result = JSON.parse(jsonStr);
        } catch (initialParseError) {
           console.warn('Initial JSON parse failed, attempting repair...', initialParseError);
           // Try to repair JSON
           const repairedJson = jsonrepair(jsonStr);
           result = JSON.parse(repairedJson);
           console.log('JSON repair successful');
        }

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

/**
 * 基于审查纲要逐项审查合同
 * @param config AI配置
 * @param contractText 合同全文
 * @param outlineItems 审查纲要项目列表
 * @param perspective 审查立场
 * @param onProgress 进度回调
 * @returns 填写完成的审查项目列表
 */
export const reviewByOutline = async (
  config: AIConfig,
  contractText: string,
  outlineItems: Array<{ row: number; itemName: string; description: string; result?: string }>,
  perspective: 'partyA' | 'partyB' = 'partyA',
  onProgress?: (current: number, total: number, itemName: string) => void
): Promise<Array<{ row: number; itemName: string; description: string; result: string }>> => {
  const perspectiveLabel = perspective === 'partyA' ? '甲方（权利方/委托方）' : '乙方（义务方/受托方）';
  const model = config.model || MODELS[config.provider];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };

  const filledItems = [];

  for (let i = 0; i < outlineItems.length; i++) {
    const item = outlineItems[i];
    onProgress?.(i + 1, outlineItems.length, item.itemName);

    const prompt = `
你是一位专业的法律审核助手。
请站在【${perspectiveLabel}】的立场上，根据以下合同内容，严格按照审查要求回答问题。

审查项目：${item.itemName}
${item.description ? `说明：${item.description}` : ''}

合同内容：
${contractText}

请针对上述审查项目，提供详细的审查结果。要求：
1. 如果审查项目要求填写具体信息（如名称、日期等），请从合同中提取相应内容
2. 如果审查项目要求判断是否存在某种条款或风险，请明确说明是否存在，并引用相关原文
3. 如果审查项目要求提供建议或意见，请基于合同内容和【${perspectiveLabel}】的利益提供专业建议
4. 如果合同中没有相关内容，请明确说明"未在合同中找到相关内容"

请直接输出审查结果，不要包含额外的格式标记。回答要清晰、准确、专业。
    `.trim();

    try {
      const response = await axios.post(
        API_ENDPOINTS[config.provider],
        {
          model: model,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: '你是一位专业的法律审核助手。请根据合同内容和审查要求，提供准确、专业的审查结果。' },
            { role: 'user', content: prompt }
          ],
          stream: false,
        },
        { headers }
      );

      // DeepSeek error handling
      if (config.provider === 'deepseek' && !response.data.choices && (response.data as any).error) {
        throw new Error(`DeepSeek API Error: ${(response.data as any).error.message}`);
      }

      let result = '';
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        result = response.data.choices[0].message.content.trim();
      } else {
        result = '审查失败：API返回结构异常';
        console.error('Unexpected API Response Structure:', response.data);
      }

      filledItems.push({
        ...item,
        result
      });

    } catch (error: any) {
      console.error(`审查项目 "${item.itemName}" 时出错:`, error);
      let errorMsg = '审查失败';
      if (error.response) {
        errorMsg += ` (HTTP ${error.response.status})`;
      } else if (error.request) {
        errorMsg += ' (网络错误)';
      } else if (error.message) {
        errorMsg += `: ${error.message}`;
      }

      filledItems.push({
        ...item,
        result: errorMsg
      });
    }

    // 避免API限流，每次调用后稍作延迟
    if (i < outlineItems.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return filledItems;
};
