import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

export const generateAndDownloadReport = async (
  originalText: string,
  reviewResult: any,
  fileName: string = '法律文件审核报告'
) => {
  try {
    const reviews = reviewResult?.reviews || [];
    
    // 1. Create Report Section
    const reportHeader = new Paragraph({
      text: "法律文件审核报告",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    });

    const datePara = new Paragraph({
      text: `生成时间: ${new Date().toLocaleString()}`,
      alignment: AlignmentType.CENTER,
    });

    const riskHeader = new Paragraph({
      text: "风险分析摘要",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    });

    const riskParagraphs: Paragraph[] = [];
    
    if (reviews.length === 0) {
      riskParagraphs.push(new Paragraph({ text: "未发现明显风险。" }));
    } else {
      reviews.forEach((item: any, index: number) => {
        let riskLabel = item.risk_type;
        if(riskLabel === 'policy') riskLabel = '政策风险';
        if(riskLabel === 'financial') riskLabel = '财务风险';
        if(riskLabel === 'execution') riskLabel = '执行风险';

        let levelLabel = item.risk_level;
        if (levelLabel === 'high') levelLabel = '高风险';
        else if (levelLabel === 'medium') levelLabel = '中等风险';
        else if (levelLabel === 'low') levelLabel = '低风险';

        const titleText = `${index + 1}. [${riskLabel}]` + (levelLabel ? ` [${levelLabel}]` : '');

        riskParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: titleText,
                bold: true,
                color: item.risk_level === 'high' ? "FF0000" : "000000",
              }),
            ],
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "原因: ", bold: true }),
              new TextRun(item.reason || '未提供原因'),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "建议: ", bold: true }),
              new TextRun(item.suggestion || '未提供建议'),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "原文片段: ", italics: true }),
              new TextRun({ text: `"${item.original_text_snippet || ''}"`, italics: true }),
            ],
            spacing: { after: 200 },
          })
        );
      });
    }

    // 2. Create Original Document Section (with highlights)
    const docHeader = new Paragraph({
      text: "文档原文（含批注）",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 600, after: 200 },
      pageBreakBefore: true,
    });

    // Highlight logic
    interface TextSegment {
      text: string;
      highlight?: string;
    }

    const segments: TextSegment[] = [];
    const snippets = reviews.map((r: any) => ({
      text: r.original_text_snippet,
      reason: r.reason
    })).filter((s: any) => s.text && typeof s.text === 'string' && s.text.length > 0 && originalText.includes(s.text));

    let cursor = 0;
    
    // Sort snippets by position in text to ensure correct order
    snippets.sort((a: any, b: any) => originalText.indexOf(a.text) - originalText.indexOf(b.text));

    while (cursor < originalText.length) {
      let nextSnippet: any = null;
      let nextIndex = Infinity;

      // Find the first snippet that appears after current cursor
      for (const s of snippets) {
        const idx = originalText.indexOf(s.text, cursor);
        if (idx !== -1 && idx < nextIndex) {
          nextIndex = idx;
          nextSnippet = s;
        }
      }

      if (nextSnippet && nextIndex !== Infinity) {
        if (nextIndex > cursor) {
          segments.push({ text: originalText.substring(cursor, nextIndex) });
        }
        segments.push({
          text: nextSnippet.text,
          highlight: "yellow",
        });
        cursor = nextIndex + nextSnippet.text.length;
      } else {
        segments.push({ text: originalText.substring(cursor) });
        break;
      }
    }

    const finalParagraphs: Paragraph[] = [];
    let currentChildren: TextRun[] = [];

    segments.forEach(seg => {
      // Split by newline to handle paragraph breaks in original text
      const parts = seg.text.split('\n');
      parts.forEach((part, i) => {
        if (part) {
          currentChildren.push(new TextRun({
            text: part,
            highlight: seg.highlight as any,
            bold: !!seg.highlight,
          }));
        }
        
        // If there are more parts, it means there was a newline
        if (i < parts.length - 1) {
          if (currentChildren.length > 0) {
            finalParagraphs.push(new Paragraph({ children: currentChildren }));
            currentChildren = [];
          } else {
             // Empty line
             finalParagraphs.push(new Paragraph({ text: "" }));
          }
        }
      });
    });

    if (currentChildren.length > 0) {
      finalParagraphs.push(new Paragraph({ children: currentChildren }));
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            reportHeader,
            datePara,
            riskHeader,
            ...riskParagraphs,
            docHeader,
            ...finalParagraphs
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    saveAs(blob, `${fileName}_${timestamp}.docx`);
    console.log('Report generated successfully');
  } catch (error) {
    console.error('Failed to generate report:', error);
    alert('生成报告失败，请查看控制台错误信息。');
    throw error;
  }
};
