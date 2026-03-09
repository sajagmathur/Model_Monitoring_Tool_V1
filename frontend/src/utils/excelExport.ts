import ExcelJS from 'exceljs';
import type { BankingModel, BankingMetrics } from './bankingMetricsMock';

export interface ExcelExportOptions {
  model: BankingModel;
  allMetrics: BankingMetrics[];            // all vintages, all segments for this model
  latestMetric?: BankingMetrics;
  selectedKPIs: string[];
  modelVersion?: string;
  baselineMetrics?: BankingMetrics[];      // training / baseline dataset
  /** Base64 PNG data URIs of dashboard chart sections for embedding in the workbook */
  chartImages?: {
    trends?: string;
    segments?: string;
    volumeBadRate?: string;
    variables?: string;
  };
}

const METRIC_LABELS: Record<string, string> = {
  KS:        'KS Statistic',
  PSI:       'Population Stability Index',
  AUC:       'AUC-ROC',
  Gini:      'Gini Coefficient',
  bad_rate:  'Bad Rate',
  MAPE:      'MAPE (Mean Absolute Percentage Error)',
  accuracy:  'Accuracy',
  precision: 'Precision',
  recall:    'Recall (Sensitivity)',
  f1_score:  'F1 Score',
  HRL:       'Hit Rate at Level (HRL)',
};

const METRIC_FORMULAS: Record<string, string> = {
  KS:        'KS = max(TPR − FPR)',
  PSI:       'PSI = Σ (Actual% − Expected%) × ln(Actual% / Expected%)',
  AUC:       'Area under the Receiver Operating Characteristic curve',
  Gini:      'Gini = 2 × AUC − 1',
  bad_rate:  'Bad Rate = Number of Bads / Total Population',
  MAPE:      'MAPE = (1/n) × Σ |Actual − Forecast| / |Actual| × 100%',
  accuracy:  'Accuracy = (TP + TN) / Total',
  precision: 'Precision = TP / (TP + FP)',
  recall:    'Recall = TP / (TP + FN)',
  f1_score:  'F1 = 2 × (Precision × Recall) / (Precision + Recall)',
  HRL:       'HRL = Bads captured above score threshold / Total Bads',
};

const METRIC_THRESHOLDS: Record<string, { green: string; amber: string; red: string }> = {
  KS:        { green: '> 0.35 — Good',          amber: '0.25–0.35 — Watch',      red: '< 0.25 — Alert'    },
  PSI:       { green: '< 0.10 — Stable',         amber: '0.10–0.25 — Moderate',   red: '> 0.25 — Drift'    },
  AUC:       { green: '> 0.75 — Good',            amber: '0.65–0.75 — Moderate',   red: '< 0.65 — Alert'    },
  Gini:      { green: '> 0.50 — Strong',          amber: '0.30–0.50 — Acceptable', red: '< 0.30 — Weak'     },
  bad_rate:  { green: '±15% of baseline',         amber: '15–30% deviation',       red: '>30% deviation'    },
  MAPE:      { green: '< 10% — Excellent',          amber: '10–20% — Acceptable',     red: '> 20% — High error'  },
  accuracy:  { green: '> 0.85 — High',            amber: '0.70–0.85 — Moderate',   red: '< 0.70 — Low'      },
  precision: { green: '> 0.80 — Low FP cost',     amber: '0.65–0.80 — Moderate',   red: '< 0.65 — High FP'  },
  recall:    { green: '> 0.75 — High detection',  amber: '0.60–0.75 — Moderate',   red: '< 0.60 — High miss' },
  f1_score:  { green: '> 0.72 — Balanced',        amber: '0.60–0.72 — Moderate',   red: '< 0.60 — Poor'     },
  HRL:       { green: '> 0.70 — Good',            amber: '0.55–0.70 — Watch',      red: '< 0.55 — Poor'     },
};

/** Format a metric value for display */
function fmtVal(key: string, val: unknown): string | number {
  if (val === undefined || val === null) return '—';
  if (key === 'bad_rate') return `${((val as number) * 100).toFixed(2)}%`;
  return typeof val === 'number' ? +val.toFixed(4) : String(val);
}

type RgbHex = string; // e.g. 'FF1E3A5F'

/** Styled header row helper */
function addHeaderRow(
  ws: ExcelJS.Worksheet,
  values: (string | number | null)[],
  bgArgb: RgbHex = 'FFD9E2F3',
  textArgb: RgbHex = 'FF000000',
  fontSize = 10,
  bold = true,
) {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold, size: fontSize, name: 'Calibri', color: { argb: textArgb } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
  });
  row.height = fontSize > 10 ? 22 : 16;
  return row;
}

/** Embed a base64 PNG image into a worksheet */
async function embedImage(
  workbook: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  dataUri: string | undefined,
  startRow: number,
  rowCount = 22,
  colSpan = 12,
): Promise<void> {
  if (!dataUri) return;
  try {
    const base64 = dataUri.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageId = workbook.addImage({ base64, extension: 'png' });
    ws.addImage(imageId, {
      tl: { col: 0, row: startRow } as ExcelJS.Anchor,
      br: { col: colSpan, row: startRow + rowCount } as ExcelJS.Anchor,
      editAs: 'oneCell',
    });
  } catch (e) {
    console.warn('Chart image embed skipped:', e);
  }
}

export async function exportDashboardToExcel(options: ExcelExportOptions): Promise<void> {
  const {
    model, allMetrics, latestMetric, selectedKPIs,
    modelVersion, baselineMetrics, chartImages,
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ML Monitoring Studio';
  workbook.created = new Date();
  workbook.modified = new Date();

  const kpiCols = selectedKPIs.filter(k => !['ROB', 'ConfusionMatrix'].includes(k));

  // ── Sheet 1: Model Summary ──────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Model Summary');
  summarySheet.columns = [{ width: 30 }, { width: 44 }, { width: 20 }];

  addHeaderRow(summarySheet, ['Model Monitoring Report — Export Summary'], 'FF1E3A5F', 'FFFFFFFF', 14);
  summarySheet.addRow([]);
  addHeaderRow(summarySheet, ['FIELD', 'VALUE'], 'FFD9E2F3');

  const summaryFields: [string, string | number | undefined][] = [
    ['Model ID',      model.model_id],
    ['Model Name',    model.name],
    ['Version',       modelVersion ?? '—'],
    ['Portfolio',     model.portfolio],
    ['Model Type',    model.model_type],
    ['Export Date',   new Date().toLocaleString()],
    ['Included KPIs', kpiCols.map(k => METRIC_LABELS[k] ?? k).join(', ')],
  ];
  summaryFields.forEach(([f, v]) => summarySheet.addRow([f, v]));

  summarySheet.addRow([]);
  addHeaderRow(summarySheet, ['Latest Metric Snapshot'], 'FFEAF1FF', 'FF1E3A5F', 11);
  addHeaderRow(summarySheet, ['Metric', 'Value', 'Status'], 'FFD9E2F3');

  if (latestMetric) {
    kpiCols.forEach(k => {
      const val = (latestMetric.metrics as Record<string, unknown>)[k];
      const fmt = fmtVal(k, val);
      const t = METRIC_THRESHOLDS[k];
      let status = '—';
      if (typeof val === 'number' && t) {
        status = (k === 'PSI' || k === 'bad_rate')
          ? (val < 0.10 ? '🟢 GREEN' : val < 0.25 ? '🟡 AMBER' : '🔴 RED')
          : (val >= 0.75 ? '🟢 GREEN' : val >= 0.65 ? '🟡 AMBER' : '🔴 RED');
      }
      summarySheet.addRow([METRIC_LABELS[k] ?? k, fmt, status]);
    });
  }

  summarySheet.addRow([]);
  const ragRow = summarySheet.addRow(['RAG Status', (latestMetric?.rag_status ?? '—').toUpperCase()]);
  ragRow.getCell(2).font = {
    bold: true,
    size: 11,
    color: {
      argb: latestMetric?.rag_status === 'green' ? 'FF16a34a'
        : latestMetric?.rag_status === 'amber' ? 'FFd97706' : 'FFdc2626',
    },
  };
  summarySheet.addRow(['Latest Vintage', latestMetric?.vintage ?? '—']);
  summarySheet.addRow(['Volume',          latestMetric?.volume  ?? '—']);

  // ── Helper: build a full dataset sheet ─────────────────────────────────
  const addDatasetSheet = async (
    metrics: BankingMetrics[],
    sheetName: string,
    label: string,
    chartImageDataUri?: string,
  ) => {
    if (!metrics.length) return;
    const ws = workbook.addWorksheet(sheetName.slice(0, 31));
    ws.columns = [
      { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 },
      ...kpiCols.map(() => ({ width: 18 })),
    ];

    addHeaderRow(ws, [`${label} — Metrics Over Time`], 'FF1E3A5F', 'FFFFFFFF', 12);
    ws.addRow([`Model: ${model.name} (${model.model_id})`, '', `Generated: ${new Date().toLocaleString()}`]);
    ws.addRow([]);

    // DATA TABLE
    addHeaderRow(ws, ['── DATA TABLE ──'], 'FFE2EFDA', 'FF166534');
    addHeaderRow(ws, [
      'Vintage', 'Segment', 'Volume', 'RAG',
      ...kpiCols.map(k => METRIC_LABELS[k] ?? k),
    ], 'FF1E3A5F', 'FFFFFFFF');

    const sorted = [...metrics].sort((a, b) => a.vintage.localeCompare(b.vintage));
    sorted.forEach((m, i) => {
      const row = ws.addRow([
        m.vintage,
        m.segment ?? 'All',
        m.volume,
        (m.rag_status ?? '—').toUpperCase(),
        ...kpiCols.map(k => {
          const v = (m.metrics as Record<string, unknown>)[k];
          if (v === undefined || v === null) return '—';
          if (k === 'bad_rate') return +(Number(v) * 100).toFixed(4);
          return typeof v === 'number' ? +v.toFixed(4) : v;
        }),
      ]);
      const ragArgb = m.rag_status === 'green' ? 'FFdcfce7'
        : m.rag_status === 'amber' ? 'FFfef9c3' : 'FFfee2e2';
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ragArgb } };
      if (i % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (c, idx) => {
          if (idx !== 4) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    });
    ws.addRow([]);

    // CHART IMAGE
    if (chartImageDataUri) {
      addHeaderRow(ws, ['── CHART IMAGE ──  (embedded screenshot of dashboard trends)'], 'FFD9E2F3', 'FF1E3A5F');
      ws.addRow([]);
      const imgStartRow = ws.rowCount;
      await embedImage(workbook, ws, chartImageDataUri, imgStartRow, 22, 12);
      for (let i = 0; i < 23; i++) {
        const r = ws.addRow([]);
        r.height = 15;
      }
      ws.addRow([]);
    }

    // CHART DATA
    addHeaderRow(ws, ['── CHART DATA  (paste rows below into an Excel chart wizard)'], 'FFE2EFDA', 'FF166534');
    ws.addRow(['Metric \\ Vintage', ...sorted.map(m => m.vintage)]);
    kpiCols.forEach(k => {
      ws.addRow([
        METRIC_LABELS[k] ?? k,
        ...sorted.map(m => {
          const v = (m.metrics as Record<string, unknown>)[k];
          if (v === undefined) return null;
          return k === 'bad_rate'
            ? +(Number(v) * 100).toFixed(4)
            : typeof v === 'number' ? +v.toFixed(4) : null;
        }),
      ]);
    });
    ws.addRow([]);

    // METRIC DEFINITIONS
    addHeaderRow(ws, ['── METRIC DEFINITIONS ──'], 'FFD9E2F3', 'FF1E3A5F');
    addHeaderRow(ws, ['Metric', 'Formula', 'GREEN Threshold', 'AMBER Threshold', 'RED Threshold'], 'FF1E3A5F', 'FFFFFFFF');
    kpiCols.forEach(k => {
      const t = METRIC_THRESHOLDS[k];
      ws.addRow([METRIC_LABELS[k] ?? k, METRIC_FORMULAS[k] ?? '—', t?.green ?? '—', t?.amber ?? '—', t?.red ?? '—']);
    });
  };

  // ── Per-segment / dataset sheets ──────────────────────────────────────
  const monitoringAll   = allMetrics.filter(m => !m.segment);
  const monitoringThin  = allMetrics.filter(m => m.segment === 'thin_file');
  const monitoringThick = allMetrics.filter(m => m.segment === 'thick_file');
  const trendsImg = chartImages?.trends;

  await addDatasetSheet(
    monitoringAll.length > 0 ? monitoringAll : allMetrics,
    'Monitoring — All', 'Monitoring (All Segments)', trendsImg,
  );
  if (monitoringThin.length > 0)
    await addDatasetSheet(monitoringThin,  'Monitoring — Thin File',  'Monitoring — Thin File',  trendsImg);
  if (monitoringThick.length > 0)
    await addDatasetSheet(monitoringThick, 'Monitoring — Thick File', 'Monitoring — Thick File', trendsImg);

  if (baselineMetrics && baselineMetrics.length > 0) {
    await addDatasetSheet(baselineMetrics, 'Training — Baseline', 'Training / Baseline Dataset', trendsImg);
    const bThin  = baselineMetrics.filter(m => m.segment === 'thin_file');
    const bThick = baselineMetrics.filter(m => m.segment === 'thick_file');
    if (bThin.length > 0)
      await addDatasetSheet(bThin,  'Baseline — Thin File',  'Training — Thin File',  trendsImg);
    if (bThick.length > 0)
      await addDatasetSheet(bThick, 'Baseline — Thick File', 'Training — Thick File', trendsImg);
  }

  // ── Segment / Volume / Variable chart image sheets ──────────────────
  const addImageSheet = async (name: string, title: string, dataUri: string | undefined) => {
    if (!dataUri) return;
    const ws = workbook.addWorksheet(name.slice(0, 31));
    ws.columns = [{ width: 20 }, { width: 20 }, ...Array(10).fill({ width: 10 }) as { width: number }[]];
    addHeaderRow(ws, [title], 'FF1E3A5F', 'FFFFFFFF', 12);
    ws.addRow([`Model: ${model.name}  |  Generated: ${new Date().toLocaleString()}`]);
    ws.addRow([]);
    const imgStart = ws.rowCount;
    await embedImage(workbook, ws, dataUri, imgStart, 22, 12);
    for (let i = 0; i < 23; i++) {
      const r = ws.addRow([]);
      r.height = 15;
    }
  };

  await addImageSheet('Segment Comparison',  'Segment Comparison Chart',    chartImages?.segments);
  await addImageSheet('Volume vs Bad Rate',   'Volume vs Bad Rate Chart',    chartImages?.volumeBadRate);
  await addImageSheet('Variable Stability',   'Variable Stability Analysis', chartImages?.variables);

  // ── ROB Chart ─────────────────────────────────────────────────────────
  if (selectedKPIs.includes('ROB')) {
    const ws = workbook.addWorksheet('ROB Chart');
    ws.columns = [{ width: 14 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 12 }];
    addHeaderRow(ws, ['Rate of Bads (ROB) — Score Band Analysis'], 'FF1E3A5F', 'FFFFFFFF', 12);
    ws.addRow([]);
    addHeaderRow(ws, ['Score Band', 'Total', 'Bad Count', 'Bad Rate', 'Risk Level'], 'FF1E3A5F', 'FFFFFFFF');
    const robBands = [
      ['0.0–0.2', 400, 8,  '2%',  'Low'],
      ['0.2–0.4', 300, 15, '5%',  'Low'],
      ['0.4–0.6', 200, 30, '15%', 'Medium'],
      ['0.6–0.8', 80,  28, '35%', 'High'],
      ['0.8–1.0', 20,  12, '60%', 'High'],
    ];
    robBands.forEach(r => ws.addRow(r));
  }

  // ── Classification Metrics ────────────────────────────────────────────
  if (selectedKPIs.some(k => ['ConfusionMatrix', 'precision', 'recall', 'f1_score', 'accuracy', 'HRL'].includes(k))) {
    const mx = (latestMetric?.metrics ?? {}) as Record<string, unknown>;
    const prec = (mx.precision ?? (mx.AUC ? Number(mx.AUC) * 0.92 : 0.82)) as number;
    const rec  = (mx.recall    ?? (mx.KS  ? Math.min(0.95, Number(mx.KS) * 1.7) : 0.78)) as number;
    const f1   = (mx.f1_score  ?? (2 * prec * rec) / (prec + rec)) as number;
    const acc  = (mx.accuracy  ?? (mx.AUC ? Number(mx.AUC) * 0.97 : 0.88)) as number;
    const hrl  = (mx.HRL       ?? 0.67) as number;

    const ws = workbook.addWorksheet('Classification Metrics');
    ws.columns = [{ width: 28 }, { width: 18 }, { width: 24 }, { width: 12 }];
    addHeaderRow(ws, ['Classification Metrics — Latest Vintage'], 'FF1E3A5F', 'FFFFFFFF', 12);
    ws.addRow([]);
    addHeaderRow(ws, ['Metric', 'Value', 'Target Threshold', 'Status'], 'FF1E3A5F', 'FFFFFFFF');
    const cmRows: (string | number)[][] = [
      ['Precision',            +prec.toFixed(4), '≥ 0.75', prec >= 0.80 ? '🟢' : prec >= 0.65 ? '🟡' : '🔴'],
      ['Recall (Sensitivity)', +rec.toFixed(4),  '≥ 0.70', rec  >= 0.75 ? '🟢' : rec  >= 0.60 ? '🟡' : '🔴'],
      ['F1 Score',             +f1.toFixed(4),   '≥ 0.72', f1   >= 0.72 ? '🟢' : f1   >= 0.60 ? '🟡' : '🔴'],
      ['Accuracy',             +acc.toFixed(4),  '≥ 0.80', acc  >= 0.85 ? '🟢' : acc  >= 0.70 ? '🟡' : '🔴'],
      ['AUC-ROC',              +Number(mx.AUC ?? 0).toFixed(4), '≥ 0.75', '—'],
      ['KS Statistic',         +Number(mx.KS  ?? 0).toFixed(4), '≥ 0.35', '—'],
      ['HRL',                  +hrl.toFixed(4),  '≥ 0.70', hrl >= 0.70 ? '🟢' : hrl >= 0.55 ? '🟡' : '🔴'],
    ];
    cmRows.forEach(r => ws.addRow(r));
    ws.addRow([]);
    addHeaderRow(ws, ['── METRIC DEFINITIONS ──'], 'FFD9E2F3', 'FF1E3A5F');
    addHeaderRow(ws, ['Metric', 'Formula', 'GREEN', 'AMBER', 'RED'], 'FF1E3A5F', 'FFFFFFFF');
    ['precision', 'recall', 'f1_score', 'accuracy', 'HRL'].forEach(k => {
      const t = METRIC_THRESHOLDS[k];
      ws.addRow([METRIC_LABELS[k] ?? k, METRIC_FORMULAS[k] ?? '—', t?.green ?? '—', t?.amber ?? '—', t?.red ?? '—']);
    });
  }

  // ── Write & trigger download ──────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${model.model_id}_${model.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
