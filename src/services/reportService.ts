import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

export const generateAndDownloadReport = async (
  originalText: string,
  reviewResult: any,
  fileName: string = '法律文件审核报告'
) => {
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
            new TextRun(item.reason),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "建议: ", bold: true }),
            new TextRun(item.suggestion),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "原文片段: ", italics: true }),
            new TextRun({ text: `"${item.original_text_snippet}"`, italics: true }),
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

  // Simple highlighting logic:
  // We'll iterate through the text and split it by the snippets we need to highlight.
  // This is naive and assumes snippets don't overlap and are found.
  // To make it robust, we need to sort snippets by position.
  // But we don't have positions, only text. We'll search for them.
  
  const textRuns: TextRun[] = [];
  let remainingText = originalText;
  
  // We need to process snippets in order of appearance in the text
  // 1. Find all snippet indices
  const snippets = reviews.map((r: any) => ({
    text: r.original_text_snippet,
    reason: r.reason
  })).filter((s: any) => s.text && remainingText.includes(s.text));

  // Sort by index in text (greedy)
  // This is complex if snippets repeat. We'll just take the first occurrence for now.
  // Ideally we should track cursor.

  let cursor = 0;
  // We need to construct a list of {start, end, text, highlight}
  // But searching repeatedly is slow.
  // Let's just try to highlight strictly sequentially if possible, or just naive split.
  
  // Strategy:
  // 1. Find the first occurrence of any snippet after cursor.
  // 2. Add text before it as normal.
  // 3. Add snippet as highlighted.
  // 4. Move cursor.
  // 5. Repeat.

  // To do this, we need to find which snippet appears *earliest* after current cursor.
  
  while (cursor < originalText.length) {
    let nextSnippet: any = null;
    let nextIndex = Infinity;

    // Find nearest snippet
    for (const s of snippets) {
      const idx = originalText.indexOf(s.text, cursor);
      if (idx !== -1 && idx < nextIndex) {
        nextIndex = idx;
        nextSnippet = s;
      }
    }

    if (nextSnippet && nextIndex !== Infinity) {
      // Add text before
      if (nextIndex > cursor) {
        textRuns.push(new TextRun({ text: originalText.substring(cursor, nextIndex) }));
      }
      // Add highlighted snippet
      textRuns.push(new TextRun({
        text: nextSnippet.text,
        highlight: "yellow", // or "red"
        bold: true,
      }));
      cursor = nextIndex + nextSnippet.text.length;
    } else {
      // No more snippets
      textRuns.push(new TextRun({ text: originalText.substring(cursor) }));
      break;
    }
  }

  // Split textRuns into paragraphs (by newlines) to preserve some structure
  // This is tricky because TextRuns are inline. 
  // We can just add one huge paragraph or try to split.
  // For simplicity, we'll just add one paragraph with all runs, 
  // but Word handles newlines in TextRuns poorly (need \n or separate paragraphs).
  // Better: split the `textRuns` list where text contains `\n`.
  // Or just use `break: 1` in TextRun.
  
  // We will post-process textRuns to handle newlines.
  const finalParagraphs: Paragraph[] = [];
  let currentChildren: TextRun[] = [];

  textRuns.forEach(run => {
    const parts = (run as any).options.text.split('\n');
    parts.forEach((part: string, i: number) => {
      if (part) {
        currentChildren.push(new TextRun({ ... (run as any).options, text: part }));
      }
      if (i < parts.length - 1) {
        // Newline encountered, push paragraph
        if (currentChildren.length > 0) {
          finalParagraphs.push(new Paragraph({ children: currentChildren }));
          currentChildren = [];
        } else {
          // Empty line
          finalParagraphs.push(new Paragraph({ children: [new TextRun("")] }));
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
};
