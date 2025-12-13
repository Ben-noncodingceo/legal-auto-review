export type AIProvider = 'deepseek' | 'doubao' | 'tongyi';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string; // Optional model/endpoint ID
}

export type RiskType = 'policy' | 'financial' | 'execution';

export type RiskLevel = 'high' | 'medium' | 'low';

export type ReviewPerspective = 'partyA' | 'partyB';

export interface ReviewResult {
  originalText: string;
  markedText: string; // HTML or structured text with markers
  risks: {
    type: RiskType;
    level: RiskLevel;
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

export type ReviewMode = 'standard' | 'outline';

export interface ExcelOutlineData {
  file: File;
  items: {
    row: number;
    itemName: string;
    description: string;
    result?: string;
  }[];
  originalWorkbook: any;
  sheetName: string;
}

export interface OutlineReviewProgress {
  currentItem: number;
  totalItems: number;
  itemName: string;
  status: 'processing' | 'completed' | 'error';
}
