import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import { BankingModel, BankingMetrics } from './bankingMetricsMock';

export interface ExportOptions {
  selectedModel?: BankingModel;
  modelMetrics?: BankingMetrics[];
  latestMetric?: BankingMetrics;
  includeSections: {
    kpis: boolean;
    ragStatus: boolean;
    trends: boolean;
    segments: boolean;
    deciles: boolean;
    variables: boolean;
  };
  format: 'pdf' | 'ppt';
}

function waitForRender(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureSection(elementId: string): Promise<string | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Export: element #${elementId} not found`);
    return null;
  }
  try {
    await waitForRender(200);
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
    });
    return canvas.toDataURL('image/png', 1.0);
  } catch (err) {
    console.error(`Export: failed to capture #${elementId}:`, err);
    return null;
  }
}

function addPDFSectionHeader(
  pdf: jsPDF, title: string, yPos: number, pageWidth: number, margin: number
): number {
  pdf.setFillColor(30, 58, 138);
  pdf.rect(margin, yPos - 4, 3, 7, 'F');
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 58, 138);
  pdf.text(title, margin + 6, yPos + 1);
  pdf.setDrawColor(219, 234, 254);
  pdf.setLineWidth(0.4);
  pdf.line(margin, yPos + 4, pageWidth - margin, yPos + 4);
  return yPos + 12;
}

export async function exportDashboardAsPDF(options: ExportOptions): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkBreak = (needed: number) => {
    if (y + needed > pageHeight - margin - 10) {
      pdf.addPage();
      y = margin;
    }
  };

  // Cover header
  pdf.setFillColor(30, 58, 138);
  pdf.rect(0, 0, pageWidth, 55, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(255, 255, 255);
  pdf.text('Model Monitoring Report', margin, 25);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('ML Monitoring Studio', margin, 35);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 43);
  y = 65;

  if (options.selectedModel) {
    pdf.setFillColor(239, 246, 255);
    pdf.setDrawColor(147, 197, 253);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin, y, contentWidth, 42, 2, 2, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(30, 58, 138);
    pdf.text(options.selectedModel.name, margin + 6, y + 10);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(55, 65, 81);
    const col2X = margin + contentWidth / 2;
    pdf.text(`Portfolio:  ${options.selectedModel.portfolio}`, margin + 6, y + 20);
    pdf.text(`Model Type:  ${options.selectedModel.model_type}`, margin + 6, y + 28);
    if (options.latestMetric) {
      const ragLabel = options.latestMetric.rag_status === 'green' ? 'GREEN'
        : options.latestMetric.rag_status === 'amber' ? 'AMBER' : 'RED';
      const ragColor: [number, number, number] = options.latestMetric.rag_status === 'green'
        ? [22, 163, 74] : options.latestMetric.rag_status === 'amber' ? [217, 119, 6] : [220, 38, 38];
      pdf.text(`Latest Vintage:  ${options.latestMetric.vintage}`, col2X, y + 20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...ragColor);
      pdf.text(`RAG Status:  ${ragLabel}`, col2X, y + 28);
    }
    y += 52;
  }

  if (options.includeSections.kpis && options.latestMetric) {
    checkBreak(80);
    y = addPDFSectionHeader(pdf, '1. Current Performance Metrics', y, pageWidth, margin);
    const metrics = options.latestMetric.metrics;
    const kpis: Array<{ label: string; value: string; status: string; color: [number, number, number] }> = [];
    if (metrics.KS !== undefined) {
      const ok = metrics.KS >= 0.35;
      kpis.push({ label: 'KS Statistic', value: metrics.KS.toFixed(3),
        status: ok ? 'GREEN' : metrics.KS >= 0.25 ? 'AMBER' : 'RED',
        color: ok ? [22,163,74] : metrics.KS >= 0.25 ? [217,119,6] : [220,38,38] });
    }
    if (metrics.PSI !== undefined) {
      const ok = metrics.PSI <= 0.1;
      kpis.push({ label: 'PSI (Stability)', value: metrics.PSI.toFixed(3),
        status: ok ? 'GREEN' : metrics.PSI <= 0.25 ? 'AMBER' : 'RED',
        color: ok ? [22,163,74] : metrics.PSI <= 0.25 ? [217,119,6] : [220,38,38] });
    }
    if (metrics.AUC !== undefined) {
      kpis.push({ label: 'AUC', value: metrics.AUC.toFixed(3),
        status: metrics.AUC >= 0.75 ? 'GREEN' : 'AMBER',
        color: metrics.AUC >= 0.75 ? [22,163,74] : [217,119,6] });
    }
    if (metrics.Gini !== undefined)
      kpis.push({ label: 'Gini', value: metrics.Gini.toFixed(3), status: '', color: [107,114,128] });
    if (metrics.bad_rate !== undefined)
      kpis.push({ label: 'Bad Rate', value: (metrics.bad_rate*100).toFixed(2)+'%', status: '', color: [107,114,128] });
    if (options.latestMetric.volume)
      kpis.push({ label: 'Volume', value: options.latestMetric.volume.toLocaleString(), status: '', color: [107,114,128] });

    const colW = [70, 50, 40];
    const rowH = 8;
    const rx = margin;
    pdf.setFillColor(30, 58, 138);
    pdf.rect(rx, y, colW[0], rowH, 'F');
    pdf.rect(rx+colW[0], y, colW[1], rowH, 'F');
    pdf.rect(rx+colW[0]+colW[1], y, colW[2], rowH, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(255,255,255);
    pdf.text('Metric', rx+3, y+5.5);
    pdf.text('Value', rx+colW[0]+3, y+5.5);
    pdf.text('Status', rx+colW[0]+colW[1]+3, y+5.5);
    y += rowH;
    kpis.forEach((kpi, i) => {
      const bg: [number,number,number] = i%2===0 ? [249,250,251] : [255,255,255];
      pdf.setFillColor(...bg);
      pdf.rect(rx, y, colW[0]+colW[1]+colW[2], rowH, 'F');
      pdf.setDrawColor(229,231,235); pdf.setLineWidth(0.2);
      pdf.line(rx, y+rowH, rx+colW[0]+colW[1]+colW[2], y+rowH);
      pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(55,65,81);
      pdf.text(kpi.label, rx+3, y+5.5);
      pdf.text(kpi.value, rx+colW[0]+3, y+5.5);
      pdf.setFont('helvetica','bold'); pdf.setTextColor(...kpi.color);
      pdf.text(kpi.status, rx+colW[0]+colW[1]+3, y+5.5);
      y += rowH;
    });
    y += 10;
  }

  if (options.includeSections.ragStatus) {
    checkBreak(20);
    y = addPDFSectionHeader(pdf, '2. Portfolio RAG Status', y, pageWidth, margin);
    const img = await captureSection('export-rag-status');
    if (img) {
      const imgH = contentWidth * 0.55;
      checkBreak(imgH);
      pdf.addImage(img, 'PNG', margin, y, contentWidth, imgH);
      y += imgH + 10;
    }
  }

  if (options.includeSections.trends) {
    checkBreak(20);
    y = addPDFSectionHeader(pdf, '3. Performance Trends Over Time', y, pageWidth, margin);
    const img = await captureSection('export-trends');
    if (img) {
      const imgH = contentWidth * 0.42;
      checkBreak(imgH);
      pdf.addImage(img, 'PNG', margin, y, contentWidth, imgH);
      y += imgH + 10;
    }
  }

  if (options.includeSections.segments) {
    checkBreak(20);
    y = addPDFSectionHeader(pdf, '4. Segment Analysis', y, pageWidth, margin);
    const img = await captureSection('export-segments');
    if (img) {
      const imgH = contentWidth * 0.55;
      checkBreak(imgH);
      pdf.addImage(img, 'PNG', margin, y, contentWidth * 0.85, imgH * 0.85);
      y += imgH * 0.85 + 10;
    }
  }

  if (options.includeSections.deciles) {
    checkBreak(20);
    y = addPDFSectionHeader(pdf, '5. Decile Analysis', y, pageWidth, margin);
    const img = await captureSection('export-deciles');
    if (img) {
      const imgH = contentWidth * 0.55;
      checkBreak(imgH);
      pdf.addImage(img, 'PNG', margin, y, contentWidth * 0.85, imgH * 0.85);
      y += imgH * 0.85 + 10;
    }
  }

  if (options.includeSections.variables) {
    pdf.addPage(); y = margin;
    y = addPDFSectionHeader(pdf, '6. Variable Stability Analysis', y, pageWidth, margin);
    const img = await captureSection('export-variables');
    if (img) {
      pdf.addImage(img, 'PNG', margin, y, contentWidth, contentWidth * 1.1);
    }
  }

  const totalPages = (pdf.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(203,213,225); pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight-10, pageWidth-margin, pageHeight-10);
    pdf.setFontSize(8); pdf.setTextColor(148,163,184); pdf.setFont('helvetica','normal');
    pdf.text('ML Monitoring Studio  Confidential', margin, pageHeight-5);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth-margin-20, pageHeight-5);
  }

  const modelName = options.selectedModel?.name.replace(/\s+/g,'_') || 'Portfolio';
  const date = new Date().toISOString().split('T')[0];
  pdf.save(`${modelName}_Report_${date}.pdf`);
}

export async function exportDashboardAsPPT(options: ExportOptions): Promise<void> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'ML Monitoring Studio';
  pptx.title = `${options.selectedModel?.name || 'Portfolio'} - Monitoring Report`;

  const W = 13.33;
  const H = 7.5;

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '1E3A8A' };
  titleSlide.addShape(pptx.ShapeType.rect, { x:0, y:H*0.68, w:W, h:H*0.32, fill:{color:'1E40AF'}, line:{color:'1E40AF'} });
  titleSlide.addText('Model Monitoring Report', { x:0.8, y:1.2, w:W-1.6, h:1.1, fontSize:44, bold:true, color:'FFFFFF', fontFace:'Calibri' });
  if (options.selectedModel) {
    titleSlide.addText(options.selectedModel.name, { x:0.8, y:2.5, w:W-1.6, h:0.7, fontSize:28, color:'BFDBFE', fontFace:'Calibri' });
    titleSlide.addText(`${options.selectedModel.portfolio}  |  ${options.selectedModel.model_type}`,
      { x:0.8, y:3.2, w:W-1.6, h:0.4, fontSize:16, color:'93C5FD' });
  }
  titleSlide.addText(`Generated: ${new Date().toLocaleString()}  |  ML Monitoring Studio`,
    { x:0.8, y:H-1.0, w:W-1.6, h:0.3, fontSize:11, color:'BFDBFE' });

  const addSlideHeader = (slide: pptxgen.Slide, title: string) => {
    slide.background = { color: 'F8FAFC' };
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:W, h:0.65, fill:{color:'1E3A8A'}, line:{color:'1E3A8A'} });
    slide.addText(title, { x:0.5, y:0.08, w:W-1, h:0.5, fontSize:20, bold:true, color:'FFFFFF', fontFace:'Calibri' });
    slide.addShape(pptx.ShapeType.rect, { x:0, y:H-0.35, w:W, h:0.35, fill:{color:'E2E8F0'}, line:{color:'E2E8F0'} });
    slide.addText('ML Monitoring Studio  |  Confidential', { x:0.5, y:H-0.28, w:W-1, h:0.22, fontSize:9, color:'64748B' });
  };

  if (options.includeSections.kpis && options.latestMetric) {
    const kpiSlide = pptx.addSlide();
    addSlideHeader(kpiSlide, 'Current Performance Metrics');
    const metrics = options.latestMetric.metrics;
    const rows: pptxgen.TableRow[] = [[
      { text:'Metric', options:{bold:true, fill:{color:'1E3A8A'}, color:'FFFFFF', align:'center'} },
      { text:'Value', options:{bold:true, fill:{color:'1E3A8A'}, color:'FFFFFF', align:'center'} },
      { text:'Status', options:{bold:true, fill:{color:'1E3A8A'}, color:'FFFFFF', align:'center'} },
      { text:'Threshold (Green)', options:{bold:true, fill:{color:'1E3A8A'}, color:'FFFFFF', align:'center'} },
    ]];
    const addRow = (label: string, value: string, status: string, threshold: string, odd: boolean) => {
      const bg = odd ? 'F0F9FF' : 'FFFFFF';
      const sc = status==='GREEN' ? '166534' : status==='AMBER' ? '92400E' : status==='RED' ? '991B1B' : '374151';
      rows.push([
        { text:label, options:{fill:{color:bg}, color:'1E293B'} },
        { text:value, options:{fill:{color:bg}, color:'1E293B', align:'center', bold:true} },
        { text:status, options:{fill:{color:bg}, color:sc, align:'center', bold:true} },
        { text:threshold, options:{fill:{color:bg}, color:'6B7280', align:'center'} },
      ]);
    };
    if (metrics.KS !== undefined) addRow('KS Statistic', metrics.KS.toFixed(3), metrics.KS>=0.35?'GREEN':metrics.KS>=0.25?'AMBER':'RED', '> 0.35', false);
    if (metrics.PSI !== undefined) addRow('PSI (Stability)', metrics.PSI.toFixed(3), metrics.PSI<=0.1?'GREEN':metrics.PSI<=0.25?'AMBER':'RED', '< 0.10', true);
    if (metrics.AUC !== undefined) addRow('AUC', metrics.AUC.toFixed(3), metrics.AUC>=0.75?'GREEN':'AMBER', '> 0.75', false);
    if (metrics.Gini !== undefined) addRow('Gini', metrics.Gini.toFixed(3), '', '', true);
    if (metrics.bad_rate !== undefined) addRow('Bad Rate', (metrics.bad_rate*100).toFixed(2)+'%', '', '', false);
    if (options.latestMetric.volume) addRow('Volume', options.latestMetric.volume.toLocaleString(), '', '', true);
    kpiSlide.addTable(rows, { x:1.0, y:0.8, w:W-2.0, colW:[3.5,2.2,2.0,3.0], fontSize:14,
      border:{pt:'1', color:'D1D5DB'}, rowH:0.55, align:'left', valign:'middle' });
  }

  if (options.includeSections.ragStatus) {
    const s = pptx.addSlide(); addSlideHeader(s, 'Portfolio RAG Status Distribution');
    const img = await captureSection('export-rag-status');
    if (img) s.addImage({ data:img, x:1.5, y:0.8, w:W-3.0, h:H-1.5 });
  }

  if (options.includeSections.trends) {
    const s = pptx.addSlide(); addSlideHeader(s, 'Performance Trends Over Time');
    const img = await captureSection('export-trends');
    if (img) s.addImage({ data:img, x:0.4, y:0.75, w:W-0.8, h:H-1.3 });
  }

  if (options.includeSections.segments) {
    const s = pptx.addSlide(); addSlideHeader(s, 'Segment Analysis');
    const img = await captureSection('export-segments');
    if (img) s.addImage({ data:img, x:1.0, y:0.8, w:W-2.0, h:H-1.4 });
  }

  if (options.includeSections.deciles) {
    const s = pptx.addSlide(); addSlideHeader(s, 'Decile Analysis');
    const img = await captureSection('export-deciles');
    if (img) s.addImage({ data:img, x:1.0, y:0.8, w:W-2.0, h:H-1.4 });
  }

  if (options.includeSections.variables) {
    const s = pptx.addSlide(); addSlideHeader(s, 'Variable Stability Analysis');
    const img = await captureSection('export-variables');
    if (img) s.addImage({ data:img, x:0.4, y:0.75, w:W-0.8, h:H-1.3 });
  }

  const modelName = options.selectedModel?.name.replace(/\s+/g,'_') || 'Portfolio';
  const date = new Date().toISOString().split('T')[0];
  await pptx.writeFile({ fileName: `${modelName}_Report_${date}.pptx` });
}

export async function exportDashboard(options: ExportOptions): Promise<void> {
  try {
    await waitForRender(500);
    if (options.format === 'pdf') {
      await exportDashboardAsPDF(options);
    } else {
      await exportDashboardAsPPT(options);
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${error}`);
  }
}
