import React, { useState, useEffect } from 'react';
import { Card, Select, Input, Button, Form, Alert } from 'antd';
import { AIConfig, AIProvider } from '../types';
import { Settings } from 'lucide-react';

interface Props {
  onConfirm: (config: AIConfig) => void;
  initialConfig?: AIConfig;
}

const ConfigPanel: React.FC<Props> = ({ onConfirm, initialConfig }) => {
  const [form] = Form.useForm();
  const [provider, setProvider] = useState<AIProvider>(initialConfig?.provider || 'deepseek');

  useEffect(() => {
    if (initialConfig) {
      form.setFieldsValue(initialConfig);
      setProvider(initialConfig.provider);
    } else {
      // Load from local storage
      const savedConfig = localStorage.getItem('aiConfig');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        form.setFieldsValue(parsed);
        setProvider(parsed.provider);
      }
    }
  }, [initialConfig, form]);

  const handleSubmit = (values: any) => {
    const config: AIConfig = {
      provider: values.provider,
      apiKey: values.apiKey,
      model: values.model
    };
    localStorage.setItem('aiConfig', JSON.stringify(config));
    onConfirm(config);
  };

  return (
    <Card title={<><Settings className="inline mr-2" size={20}/>AI 服务配置</>} className="w-full max-w-md mx-auto shadow-lg">
      {import.meta.env.DEV ? (
        <Alert 
          message="开发环境：已启用代理" 
          description="本地开发使用 Vite 代理绕过 CORS 限制。" 
          type="info" 
          showIcon 
          className="mb-4 text-xs"
        />
      ) : (
        <Alert 
          message="生产环境 (GitHub Pages) 注意" 
          description="浏览器会拦截跨域请求。请务必安装浏览器插件 'Allow CORS' 才能正常使用，或者使用支持跨域的 API 代理。" 
          type="warning" 
          showIcon 
          className="mb-4 text-xs"
        />
      )}
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ provider: 'deepseek' }}>
        <Form.Item name="provider" label="AI 服务商" rules={[{ required: true }]}>
          <Select onChange={(val) => setProvider(val)}>
            <Select.Option value="deepseek">DeepSeek (深度求索)</Select.Option>
            <Select.Option value="doubao">豆包 (字节跳动)</Select.Option>
            <Select.Option value="tongyi">通义千问 (阿里云)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入您的 API Key' }]}>
          <Input.Password placeholder="请输入 API Key" />
        </Form.Item>

        {provider === 'doubao' && (
           <Form.Item name="model" label="接入点 ID (Endpoint ID)" rules={[{ required: true, message: '豆包需要接入点 ID (如 ep-2024...)' }]}>
             <Input placeholder="ep-20240604..." />
           </Form.Item>
        )}
        
        {provider !== 'doubao' && (
           <Form.Item name="model" label="自定义模型 (可选)">
             <Input placeholder="留空则使用默认模型" />
           </Form.Item>
        )}

        <Button type="primary" htmlType="submit" block>
          确认配置
        </Button>
      </Form>
    </Card>
  );
};

export default ConfigPanel;
