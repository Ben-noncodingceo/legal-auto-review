import * as XLSX from 'xlsx';

export interface ExcelReviewItem {
  row: number;
  itemName: string;
  description: string;
  result?: string;
}

export interface ParsedExcelOutline {
  items: ExcelReviewItem[];
  originalWorkbook: XLSX.WorkBook;
  sheetName: string;
}

/**
 * 解析上传的审查纲要Excel文件
 * 提取所有需要审查的项目
 */
export async function parseExcelOutline(file: File): Promise<ParsedExcelOutline> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('无法读取文件内容');
        }

        const workbook = XLSX.read(data, { type: 'binary', cellStyles: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 将工作表转换为JSON格式
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          blankrows: false
        });

        const items: ExcelReviewItem[] = [];

        // 解析Excel内容，提取审查项目
        // 假设第一列是审查项目名称，第二列是说明，第三列是审查结果（待填写）
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];

          // 跳过空行和标题行
          if (!row || row.length === 0) continue;

          const itemName = String(row[0] || '').trim();
          const description = String(row[1] || '').trim();

          // 跳过标题行（包含"项目"、"说明"等关键词）或空行
          if (!itemName ||
              itemName.includes('审查项目') ||
              itemName.includes('项目') && itemName.length < 3 ||
              itemName.includes('说明')) {
            continue;
          }

          items.push({
            row: i,
            itemName,
            description,
            result: '' // 待填写
          });
        }

        resolve({
          items,
          originalWorkbook: workbook,
          sheetName
        });
      } catch (error) {
        reject(new Error(`解析Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * 将审查结果写入Excel文件
 */
export function generateExcelReport(
  _outline: ParsedExcelOutline,
  filledItems: ExcelReviewItem[]
): Blob {
  // 创建一个新的工作簿
  const workbook = XLSX.utils.book_new();

  // 准备数据
  const data: any[][] = [
    ['合同审查项目', '说明', '审查结果']
  ];

  // 添加所有审查项目及其结果
  filledItems.forEach(item => {
    data.push([
      item.itemName,
      item.description,
      item.result || ''
    ]);
  });

  // 创建工作表
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // 设置列宽
  const colWidths = [
    { wch: 30 }, // 审查项目
    { wch: 50 }, // 说明
    { wch: 80 }  // 审查结果
  ];
  worksheet['!cols'] = colWidths;

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, '审查结果');

  // 生成Excel文件
  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true
  });

  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * 下载Excel文件
 */
export function downloadExcel(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 从Excel中提取所有审查问题的文本描述，用于AI分析
 */
export function extractReviewQuestions(items: ExcelReviewItem[]): string {
  return items.map((item, index) =>
    `${index + 1}. ${item.itemName}${item.description ? `\n   说明：${item.description}` : ''}`
  ).join('\n\n');
}
