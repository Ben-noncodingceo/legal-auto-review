import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Use a local worker if possible or CDN as fallback. 
// For Vite, the best way is to import the worker URL.
// We'll use the CDN for simplicity in this environment to avoid complex worker bundling configuration issues in this chat context,
// but usually we should use: import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface ParsedFile {
  text: string; // Plain text for AI
  html: string; // HTML for display (preserving structure)
}

export const parseFile = async (file: File): Promise<ParsedFile> => {
  const fileType = file.name.split('.').pop()?.toLowerCase();

  if (fileType === 'pdf') {
    return parsePDF(file);
  } else if (fileType === 'docx' || fileType === 'doc') {
    return parseWord(file);
  } else {
    throw new Error('不支持的文件类型。请上传 PDF 或 Word 文档。');
  }
};

const parsePDF = async (file: File): Promise<ParsedFile> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  let html = '<div class="pdf-content space-y-4">';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    
    text += pageText + '\n\n';
    html += `<div class="pdf-page p-4 border-b" data-page="${i}"><p>${pageText}</p></div>`;
  }

  html += '</div>';
  return { text, html };
};

const parseWord = async (file: File): Promise<ParsedFile> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Extract raw text
  const textResult = await mammoth.extractRawText({ arrayBuffer });
  const text = textResult.value;

  // Extract HTML
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const html = `<div class="word-content prose">${htmlResult.value}</div>`;

  return { text, html };
};
