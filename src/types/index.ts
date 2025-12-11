export type AIProvider = 'deepseek' | 'doubao' | 'tongyi';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string; // Optional model/endpoint ID
}

export type RiskType = 'policy' | 'financial' | 'execution';

export interface ReviewResult {
  originalText: string;
  markedText: string; // HTML or structured text with markers
  risks: {
    type: RiskType;
    details: string;
    suggestion: string;
    location?: string; // e.g., paragraph index or snippet
  }[];
  relatedCompanies?: string;
  similarCases?: string;
}

export interface FileData {
  name: string;
  content: string; // Extracted text
  originalFile: File;
  type: 'pdf' | 'docx';
}
