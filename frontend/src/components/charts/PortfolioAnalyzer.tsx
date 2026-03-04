/**
 * PortfolioAnalyzer — 14 analysis types with collapsible slicer panel,
 * AI summaries, PNG/CSV/PDF export, and "Add to Report" functionality.
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { BankingMetrics, BankingModel } from '../../utils/bankingMetricsMock';
import { Download, ChevronLeft, ChevronRight, Plus, FileText } from 'lucide-react';

Chart.register(...registerables);

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisSpec {
  id: string;
  label: string;
  category: string;
  description: string;
  icon: string;
  chartType: 'canvas' | 'table';
  relevantSlicers: string[];
}

interface SlicerState {
  primaryMetric: string;
  secondaryMetric: string;
  sizeMetric: string;
  selectedModels: string[];
  selectedMetrics: string[];
  portfolio: string;
  modelType: string;
  vintage: string;
  groupBy: string;
  colorBy: string;
  includeSegments: boolean;
  showThresholds: boolean;
}

export interface ReportItem {
  id: string;
  label: string;
  timestamp: string;
  chartBase64: string;
  csvRows: string[][];
  aiSummary: string;
}

export interface PortfolioAnalyzerProps {
  models: BankingModel[];
  metrics: BankingMetrics[];
  isDark?: boolean;
  onAddToReport?: (item: ReportItem) => void;
}

type ChartRow = { model: BankingModel; metric: BankingMetrics };

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  KS: 'KS Statistic', PSI: 'PSI', AUC: 'AUC', Gini: 'Gini',
  bad_rate: 'Bad Rate', CA_at_10: 'CA@10', accuracy: 'Accuracy',
  precision: 'Precision', recall: 'Recall', f1_score: 'F1 Score', HRL: 'Hit Rate Lift (HRL)',
};

const COLORS = [
  '#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7',
];

const DEFAULT_SLICERS: SlicerState = {
  primaryMetric: 'KS', secondaryMetric: 'AUC', sizeMetric: 'bad_rate',
  selectedModels: [], selectedMetrics: ['KS','PSI','AUC','Gini','bad_rate','f1_score','HRL'],
  portfolio: 'All', modelType: 'All', vintage: 'All',
  groupBy: 'portfolio', colorBy: 'rag',
  includeSegments: false, showThresholds: true,
};

const ANALYSES: AnalysisSpec[] = [
  { id: 'ranking',       label: 'Model Ranking',           category: 'Performance', description: 'Rank all models by a KPI — RAG-coloured bars sorted best to worst', icon: '🏆', chartType: 'canvas', relevantSlicers: ['primaryMetric','vintage','modelType'] },
  { id: 'comparison',    label: 'Multi-Model Comparison',  category: 'Performance', description: 'Compare selected models across multiple KPIs side-by-side', icon: '📊', chartType: 'canvas', relevantSlicers: ['selectedModels','selectedMetrics','vintage'] },
  { id: 'scatter',       label: 'KPI Scatter',             category: 'Performance', description: 'Plot two KPIs against each other; colour by RAG or model', icon: '🔵', chartType: 'canvas', relevantSlicers: ['primaryMetric','secondaryMetric','colorBy','modelType'] },
  { id: 'bubble',        label: 'Risk–Volume Bubble',      category: 'Risk',        description: 'Bubble size = volume; X/Y = risk metrics; colour = RAG or portfolio', icon: '⚪', chartType: 'canvas', relevantSlicers: ['primaryMetric','secondaryMetric','sizeMetric','colorBy'] },
  { id: 'heatmap',       label: 'Performance Heatmap',     category: 'Cross-Model', description: 'All models × selected metrics with RAG-aware cell colouring', icon: '🟥', chartType: 'table', relevantSlicers: ['selectedModels','selectedMetrics','vintage'] },
  { id: 'correlation',   label: 'Metric Correlation',      category: 'Cross-Model', description: 'Pearson r matrix — blue = positive, red = negative correlation', icon: '🔗', chartType: 'table', relevantSlicers: ['selectedMetrics','modelType'] },
  { id: 'trend',         label: 'Trend Analysis',          category: 'Trend',       description: 'Track a KPI over vintages for up to 8 models simultaneously', icon: '📈', chartType: 'canvas', relevantSlicers: ['selectedModels','primaryMetric','vintage'] },
  { id: 'vintage_cohort',label: 'Vintage Cohort',          category: 'Trend',       description: 'KPI per vintage for one model — optionally split by segment', icon: '📅', chartType: 'canvas', relevantSlicers: ['selectedModels','primaryMetric','includeSegments'] },
  { id: 'drift_monitor', label: 'Drift Monitor',           category: 'Risk',        description: 'PSI / KS over time with optional amber/red threshold bands', icon: '⚠️', chartType: 'canvas', relevantSlicers: ['selectedModels','primaryMetric','showThresholds'] },
  { id: 'rag_distribution', label: 'RAG Distribution',    category: 'Portfolio',   description: 'Stacked bar of Green/Amber/Red counts grouped by any dimension', icon: '🚦', chartType: 'canvas', relevantSlicers: ['groupBy','vintage'] },
  { id: 'volume_badrate',label: 'Volume vs Bad Rate',      category: 'Portfolio',   description: 'Volume bars with bad-rate line overlay (dual-axis)', icon: '📉', chartType: 'canvas', relevantSlicers: ['selectedModels','vintage'] },
  { id: 'segment_comparison', label: 'Segment Comparison', category: 'Cross-Model', description: 'Current vs Delinquent segment for a KPI across models', icon: '⚖️', chartType: 'canvas', relevantSlicers: ['selectedModels','primaryMetric','vintage'] },
  { id: 'type_benchmark',label: 'Model Type Benchmark',    category: 'Portfolio',   description: 'Average KPI per model type with min/max range tooltips', icon: '📐', chartType: 'canvas', relevantSlicers: ['primaryMetric','vintage'] },
  { id: 'percentile',    label: 'Percentile Distribution', category: 'Performance', description: 'P25–P75 range bar + median for each model across all vintages', icon: '📊', chartType: 'canvas', relevantSlicers: ['primaryMetric','modelType'] },
];

const CATEGORIES = Array.from(new Set(ANALYSES.map(a => a.category)));

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

const getVal = (m: BankingMetrics, key: string): number | undefined => {
  const v = (m.metrics as Record<string,unknown>)[key];
  return typeof v === 'number' ? v : undefined;
};

const ragColor = (key: string, val: number): string => {
  if (key === 'PSI')      return val < 0.10 ? '#10b981' : val < 0.25 ? '#f59e0b' : '#ef4444';
  if (key === 'KS')       return val >= 0.35 ? '#10b981' : val >= 0.25 ? '#f59e0b' : '#ef4444';
  if (key === 'AUC')      return val >= 0.75 ? '#10b981' : val >= 0.65 ? '#f59e0b' : '#ef4444';
  if (key === 'Gini')     return val >= 0.50 ? '#10b981' : val >= 0.30 ? '#f59e0b' : '#ef4444';
  if (key === 'HRL')      return val >= 0.70 ? '#10b981' : val >= 0.55 ? '#f59e0b' : '#ef4444';
  if (key === 'bad_rate') return val <= 0.05 ? '#10b981' : val <= 0.10 ? '#f59e0b' : '#ef4444';
  if (key === 'f1_score' || key === 'accuracy') return val >= 0.70 ? '#10b981' : val >= 0.50 ? '#f59e0b' : '#ef4444';
  return '#6366f1';
};

const cellBg = (key: string, val: number, isDark: boolean): string =>
  ragColor(key, val) + (isDark ? '40' : '28');

const pearsonR = (xs: number[], ys: number[]): number => {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.slice(0,n).reduce((a,b)=>a+b,0)/n;
  const my = ys.slice(0,n).reduce((a,b)=>a+b,0)/n;
  let num = 0, dx = 0, dy = 0;
  for (let i=0;i<n;i++) { num+=(xs[i]-mx)*(ys[i]-my); dx+=(xs[i]-mx)**2; dy+=(ys[i]-my)**2; }
  return Math.sqrt(dx*dy)===0 ? 0 : num/Math.sqrt(dx*dy);
};

const pctiles = (arr: number[]) => {
  const s = [...arr].sort((a,b)=>a-b);
  const at = (p: number) => { const i=(p/100)*(s.length-1); const lo=Math.floor(i); return s[lo]+(s[Math.ceil(i)]-s[lo])*(i-lo); };
  return { min:s[0], p25:at(25), median:at(50), p75:at(75), max:s[s.length-1] };
};

const PCT_METRICS = new Set(['KS','accuracy','precision','recall','f1_score','HRL','bad_rate']);
const fmtVal = (key: string, v: number): string =>
  PCT_METRICS.has(key) ? (v*100).toFixed(1)+'%' : v.toFixed(3);
const pctTick = (key: string) => (v: any) =>
  PCT_METRICS.has(key) ? ((v as number)*100).toFixed(1)+'%' : (v as number).toFixed(3);

// ─── Chart Render Functions ───────────────────────────────────────────────────

function destroyChart(ref: React.MutableRefObject<Chart | null>) {
  if (ref.current) { ref.current.destroy(); ref.current = null; }
}
function mkTheme(dark: boolean) {
  return { text: dark?'#94a3b8':'#475569', grid: dark?'rgba(148,163,184,0.1)':'rgba(0,0,0,0.06)' };
}

function renderRanking(rows: ChartRow[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const key=sl.primaryMetric;
  const s=[...rows].map(r=>({name:r.model.name.length>18?r.model.name.slice(0,16)+'…':r.model.name,val:getVal(r.metric,key)??0})).sort((a,b)=>key==='PSI'||key==='bad_rate'?a.val-b.val:b.val-a.val);
  ref.current=new Chart(cvs,{type:'bar',data:{labels:s.map(r=>r.name),datasets:[{label:METRIC_LABELS[key]??key,data:s.map(r=>r.val),backgroundColor:s.map(r=>ragColor(key,r.val)),borderRadius:6}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(item)=>`${METRIC_LABELS[key]??key}: ${fmtVal(key,item.parsed.x??0)}`}}},scales:{x:{ticks:{color:text,callback:(v:any)=>PCT_METRICS.has(key)?((v as number)*100).toFixed(1)+'%':(v as number).toFixed(3)},grid:{color:grid}},y:{ticks:{color:text,font:{size:11}},grid:{display:false}}}}});
}

function renderComparison(rows: ChartRow[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const keys=sl.selectedMetrics.slice(0,6);
  ref.current=new Chart(cvs,{type:'bar',data:{labels:keys.map(k=>METRIC_LABELS[k]??k),datasets:rows.slice(0,8).map((r,i)=>({label:r.model.name.slice(0,20),data:keys.map(k=>getVal(r.metric,k)??0),backgroundColor:COLORS[i%COLORS.length]+'cc',borderColor:COLORS[i%COLORS.length],borderWidth:1,borderRadius:3}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text,boxWidth:12}},tooltip:{mode:'index'}},scales:{x:{ticks:{color:text},grid:{color:grid}},y:{ticks:{color:text},grid:{color:grid}}}}});
}

function renderScatter(rows: ChartRow[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const kx=sl.primaryMetric,ky=sl.secondaryMetric;
  const getC=(r:ChartRow,i:number)=>sl.colorBy==='rag'?(r.metric.rag_status==='green'?'#10b981':r.metric.rag_status==='amber'?'#f59e0b':'#ef4444'):sl.colorBy==='portfolio'?COLORS[Array.from(new Set(rows.map(x=>x.model.portfolio))).indexOf(r.model.portfolio)%COLORS.length]:COLORS[i%COLORS.length];
  ref.current=new Chart(cvs,{type:'scatter',data:{datasets:rows.map((r,i)=>({label:r.model.name,data:[{x:getVal(r.metric,kx)??0,y:getVal(r.metric,ky)??0}],backgroundColor:getC(r,i)+'cc',borderColor:getC(r,i),borderWidth:1,pointRadius:8}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(item)=>`${item.dataset.label}: (${(item.parsed.x??0).toFixed(3)}, ${(item.parsed.y??0).toFixed(3)})`}}},scales:{x:{title:{display:true,text:METRIC_LABELS[kx]??kx,color:text},ticks:{color:text},grid:{color:grid}},y:{title:{display:true,text:METRIC_LABELS[ky]??ky,color:text},ticks:{color:text},grid:{color:grid}}}}});
}

function renderBubble(rows: ChartRow[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const kx=sl.primaryMetric,ky=sl.secondaryMetric;
  ref.current=new Chart(cvs,{type:'bubble',data:{datasets:rows.map((r,i)=>{const rr=Math.max(6,Math.min(30,Math.sqrt(r.metric.volume)/80));const c=sl.colorBy==='rag'?(r.metric.rag_status==='green'?'#10b981':r.metric.rag_status==='amber'?'#f59e0b':'#ef4444'):COLORS[i%COLORS.length];return{label:r.model.name,data:[{x:getVal(r.metric,kx)??0,y:getVal(r.metric,ky)??0,r:rr}],backgroundColor:c+'88',borderColor:c,borderWidth:1.5};})},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(item)=>`${item.dataset.label} | Vol: ${rows[item.datasetIndex]?.metric.volume.toLocaleString()}`}}},scales:{x:{title:{display:true,text:METRIC_LABELS[kx]??kx,color:text},ticks:{color:text},grid:{color:grid}},y:{title:{display:true,text:METRIC_LABELS[ky]??ky,color:text},ticks:{color:text},grid:{color:grid}}}}});
}

function renderTrend(allM: BankingMetrics[], models: BankingModel[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const key=sl.primaryMetric;
  const vins=[...new Set(allM.map(m=>m.vintage))].sort();
  const show=sl.selectedModels.length?models.filter(m=>sl.selectedModels.includes(m.model_id)):models.slice(0,6);
  ref.current=new Chart(cvs,{type:'line',data:{labels:vins,datasets:show.map((model,i)=>{const mets=allM.filter(m=>m.model_id===model.model_id&&!m.segment);return{label:model.name.slice(0,20),data:vins.map(v=>{const m=mets.find(x=>x.vintage===v);return m?(getVal(m,key)??null):null;}),borderColor:COLORS[i%COLORS.length],backgroundColor:COLORS[i%COLORS.length]+'22',fill:false,tension:0.3,spanGaps:true,pointRadius:4};})},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text,boxWidth:12}}},scales:{x:{ticks:{color:text,maxRotation:45},grid:{color:grid}},y:{title:{display:true,text:METRIC_LABELS[key]??key,color:text},ticks:{color:text},grid:{color:grid}}}}});
}

function renderVintageCohort(allM: BankingMetrics[], models: BankingModel[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const key=sl.primaryMetric;
  const modelId=sl.selectedModels[0]??models[0]?.model_id;
  const vins=[...new Set(allM.filter(m=>m.model_id===modelId).map(m=>m.vintage))].sort();
  const overall=allM.filter(m=>m.model_id===modelId&&!m.segment);
  const datasets: Record<string,unknown>[]=[{type:'bar',label:'Overall',data:vins.map(v=>{const m=overall.find(x=>x.vintage===v);return m?getVal(m,key)??0:0;}),backgroundColor:'#6366f1cc',borderRadius:4,yAxisID:'y'}];
  if(sl.includeSegments){const thin=allM.filter(m=>m.model_id===modelId&&m.segment==='thin_file'),thick=allM.filter(m=>m.model_id===modelId&&m.segment==='thick_file');datasets.push({type:'line',label:'Current',data:vins.map(v=>{const m=thin.find(x=>x.vintage===v);return m?getVal(m,key)??null:null;}),borderColor:'#10b981',fill:false,tension:0.3,spanGaps:true,yAxisID:'y'},{type:'line',label:'Delinquent',data:vins.map(v=>{const m=thick.find(x=>x.vintage===v);return m?getVal(m,key)??null:null;}),borderColor:'#ef4444',fill:false,tension:0.3,spanGaps:true,yAxisID:'y'});}
  ref.current=new Chart(cvs,{type:'bar',data:{labels:vins,datasets:datasets as any},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text,boxWidth:12}}},scales:{x:{ticks:{color:text,maxRotation:45},grid:{color:grid}},y:{title:{display:true,text:METRIC_LABELS[key]??key,color:text},ticks:{color:text,callback:pctTick(key)},grid:{color:grid}}}}});
}

function renderDriftMonitor(allM: BankingMetrics[], models: BankingModel[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const key=sl.primaryMetric;
  const vins=[...new Set(allM.map(m=>m.vintage))].sort();
  const show=sl.selectedModels.length?models.filter(m=>sl.selectedModels.includes(m.model_id)):models.slice(0,5);
  const datasets: Record<string,unknown>[]=show.map((model,i)=>{const mets=allM.filter(m=>m.model_id===model.model_id&&!m.segment);return{label:model.name.slice(0,20),data:vins.map(v=>{const m=mets.find(x=>x.vintage===v);return m?getVal(m,key)??null:null;}),borderColor:COLORS[i%COLORS.length],backgroundColor:'transparent',fill:false,tension:0.3,spanGaps:true,pointRadius:4};});
  if(sl.showThresholds){const T:Record<string,{amber:number,red:number}>={KS:{amber:0.25,red:0.15},PSI:{amber:0.10,red:0.25},AUC:{amber:0.65,red:0.55},Gini:{amber:0.30,red:0.20},HRL:{amber:0.55,red:0.45}};const t=T[key];if(t){datasets.push({label:'Amber threshold',data:vins.map(()=>t.amber),borderColor:'#f59e0b',borderDash:[5,5],borderWidth:1.5,pointRadius:0,fill:false},{label:'Red threshold',data:vins.map(()=>t.red),borderColor:'#ef4444',borderDash:[5,5],borderWidth:1.5,pointRadius:0,fill:false});}}
  ref.current=new Chart(cvs,{type:'line',data:{labels:vins,datasets:datasets as any},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text,boxWidth:12}}},scales:{x:{ticks:{color:text,maxRotation:45},grid:{color:grid}},y:{title:{display:true,text:METRIC_LABELS[key]??key,color:text},ticks:{color:text,callback:pctTick(key)},grid:{color:grid}}}}});
}

function renderRAGDistribution(rows: ChartRow[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const gk=sl.groupBy as keyof BankingModel;
  const groups=Array.from(new Set(rows.map(r=>String(r.model[gk]??'Other'))));
  const cnt=(g:string,rag:string)=>rows.filter(r=>String(r.model[gk]??'Other')===g&&r.metric.rag_status===rag).length;
  ref.current=new Chart(cvs,{type:'bar',data:{labels:groups,datasets:[{label:'Green',data:groups.map(g=>cnt(g,'green')),backgroundColor:'#10b981cc',borderRadius:4},{label:'Amber',data:groups.map(g=>cnt(g,'amber')),backgroundColor:'#f59e0bcc',borderRadius:4},{label:'Red',data:groups.map(g=>cnt(g,'red')),backgroundColor:'#ef4444cc',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text}}},scales:{x:{stacked:true,ticks:{color:text},grid:{color:grid}},y:{stacked:true,ticks:{color:text},grid:{color:grid}}}}});
}

function renderVolumeBadRate(rows: ChartRow[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark);
  const labels=rows.map(r=>r.model.name.slice(0,14));
  ref.current=new Chart(cvs,{type:'bar',data:{labels,datasets:[{type:'bar',label:'Volume',data:rows.map(r=>r.metric.volume),backgroundColor:'#6366f1cc',borderRadius:4,yAxisID:'y'},{type:'line',label:'Bad Rate %',data:rows.map(r=>(getVal(r.metric,'bad_rate')??0)*100),borderColor:'#ef4444',backgroundColor:'transparent',tension:0.3,pointRadius:5,yAxisID:'y1'}] as any},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text}}},scales:{x:{ticks:{color:text,maxRotation:45},grid:{color:grid}},y:{type:'linear',position:'left',title:{display:true,text:'Volume',color:text},ticks:{color:text},grid:{color:grid}},y1:{type:'linear',position:'right',title:{display:true,text:'Bad Rate %',color:text},ticks:{color:text},grid:{display:false}}}}});
}

function renderSegmentComparison(allM: BankingMetrics[], models: BankingModel[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const key=sl.primaryMetric;
  const vins=[...new Set(allM.map(m=>m.vintage))].sort().reverse();
  const show=sl.selectedModels.length?models.filter(m=>sl.selectedModels.includes(m.model_id)):models.slice(0,8);
  const sv=(mid:string,seg:string)=>{const lv=vins.find(v=>allM.some(m=>m.model_id===mid&&m.vintage===v&&m.segment===seg));const m=allM.find(x=>x.model_id===mid&&x.vintage===lv&&x.segment===seg);return m?getVal(m,key)??0:0;};
  ref.current=new Chart(cvs,{type:'bar',data:{labels:show.map(m=>m.name.slice(0,14)),datasets:[{label:'Current',data:show.map(m=>sv(m.model_id,'thin_file')),backgroundColor:'#10b981cc',borderRadius:4},{label:'Delinquent',data:show.map(m=>sv(m.model_id,'thick_file')),backgroundColor:'#ef4444cc',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text}}},scales:{x:{ticks:{color:text,maxRotation:45},grid:{color:grid}},y:{title:{display:true,text:METRIC_LABELS[key]??key,color:text},ticks:{color:text,callback:pctTick(key)},grid:{color:grid}}}}});
}

function renderTypeBenchmark(rows: ChartRow[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const key=sl.primaryMetric;
  const types=Array.from(new Set(rows.map(r=>r.model.model_type)));
  if (!types.length) return;
  const td=types.map(t=>{const vals=rows.filter(r=>r.model.model_type===t).map(r=>getVal(r.metric,key)??0);const avg=vals.reduce((a,b)=>a+b,0)/(vals.length||1);return{t,avg,min:Math.min(...vals),max:Math.max(...vals)};});
  ref.current=new Chart(cvs,{type:'bar',data:{labels:types,datasets:[{label:METRIC_LABELS[key]??key,data:td.map(d=>d.avg),backgroundColor:td.map((_,i)=>COLORS[i%COLORS.length]+'cc'),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:(item)=>{const d=td[item.dataIndex];return`Min: ${fmtVal(key,d.min)} | Max: ${fmtVal(key,d.max)}`;	}}}},scales:{x:{ticks:{color:text},grid:{color:grid}},y:{title:{display:true,text:METRIC_LABELS[key]??key,color:text},ticks:{color:text,callback:(v:any)=>fmtVal(key,v as number)},grid:{color:grid}}}}});
}

function renderPercentile(allM: BankingMetrics[], models: BankingModel[], sl: SlicerState, cvs: HTMLCanvasElement, ref: React.MutableRefObject<Chart|null>, dark: boolean) {
  destroyChart(ref); const {text,grid}=mkTheme(dark); const key=sl.primaryMetric;
  const show=models.slice(0,10);
  const pd=show.map(model=>{const vals=allM.filter(m=>m.model_id===model.model_id&&!m.segment).map(m=>getVal(m,key)).filter((v):v is number=>v!=null);return vals.length?pctiles(vals):{min:0,p25:0,median:0,p75:0,max:0};});
  ref.current=new Chart(cvs,{type:'bar',data:{labels:show.map(m=>m.name.slice(0,12)),datasets:[{label:'P25–P75 Range',data:pd.map(p=>[p.p25,p.p75] as unknown as number),backgroundColor:'#6366f155',borderColor:'#6366f1',borderWidth:1,borderRadius:2},{label:'Median',data:pd.map(p=>p.median),backgroundColor:'#6366f1',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text}},tooltip:{callbacks:{afterBody:(items)=>{const i=items[0]?.dataIndex;if(i==null)return[];const p=pd[i];return[`Min: ${p.min.toFixed(3)}`,`Max: ${p.max.toFixed(3)}`];}}}},scales:{x:{ticks:{color:text,maxRotation:45},grid:{color:grid}},y:{title:{display:true,text:METRIC_LABELS[key]??key,color:text},ticks:{color:text},grid:{color:grid}}}}});
}

// ─── AI Summary ───────────────────────────────────────────────────────────────

function generateAISummary(id: string, rows: ChartRow[], sl: SlicerState): string {
  if(!rows.length) return 'No data available for the current filter selection.';
  const key=sl.primaryMetric,lbl=METRIC_LABELS[key]??key;
  const vals=rows.map(r=>({name:r.model.name,val:getVal(r.metric,key)})).filter((v):v is{name:string,val:number}=>v.val!=null);
  if(!vals.length) return `No ${lbl} data available for selected models.`;
  vals.sort((a,b)=>b.val-a.val);
  const best=vals[0],worst=vals[vals.length-1],avg=vals.reduce((s,v)=>s+v.val,0)/vals.length;
  const red=rows.filter(r=>r.metric.rag_status==='red').length,amber=rows.filter(r=>r.metric.rag_status==='amber').length;
  switch(id){
    case 'ranking':    return `${lbl} ranking across ${rows.length} models. Best: ${best.name} (${best.val.toFixed(3)}). Weakest: ${worst.name} (${worst.val.toFixed(3)}). Average: ${avg.toFixed(3)}. ${red>0?`⚠️ ${red} Red-status model(s) require immediate review.`:'All models within acceptable thresholds.'}`;
    case 'comparison': return `Multi-model comparison for ${rows.length} models across ${sl.selectedMetrics.length} KPIs. ${lbl} ranges from ${worst.val.toFixed(3)} (${worst.name}) to ${best.val.toFixed(3)} (${best.name}). Average: ${avg.toFixed(3)}.`;
    case 'scatter':    return `Scatter of ${METRIC_LABELS[sl.primaryMetric]} vs ${METRIC_LABELS[sl.secondaryMetric]} for ${rows.length} models. ${red} Red, ${amber} Amber. Look for outliers deviating from the main cluster.`;
    case 'bubble':     return `Risk-Volume bubble: X=${METRIC_LABELS[sl.primaryMetric]}, Y=${METRIC_LABELS[sl.secondaryMetric]}, size=Volume. Models in the upper-right quadrant show favourable risk-volume profiles.`;
    case 'heatmap':    return `Performance heatmap — ${rows.length} models × ${sl.selectedMetrics.length} metrics. ${red} Red and ${amber} Amber cells detected. Rows with consistent red colouring require holistic remediation.`;
    case 'correlation':return `Metric correlation matrix across ${sl.selectedMetrics.length} KPIs. Highly correlated pairs (|r|>0.7) may indicate redundant metrics. Use this to rationalise your monitoring framework.`;
    case 'trend':      return `Trend for ${lbl} across available vintages. ${rows.length} model(s) tracked. Consistent downward trajectories may indicate concept drift. Latest average: ${avg.toFixed(3)}.`;
    case 'vintage_cohort': return `Vintage cohort for ${lbl}. Compare each vintage against the training reference. Divergence >20% from baseline warrants escalation.`;
    case 'drift_monitor':  return `Drift monitor for ${lbl}. ${red>0?`⚠️ ${red} model(s) breached Red threshold — immediate review required.`:amber>0?`${amber} model(s) in Amber zone — enhanced monitoring recommended.`:'All models within drift thresholds.'}`;
    case 'rag_distribution': return `RAG distribution by ${sl.groupBy}: ${rows.filter(r=>r.metric.rag_status==='green').length} Green, ${amber} Amber, ${red} Red. ${red>0?'Red models must be escalated within 5 business days.':'Portfolio is broadly healthy.'}`;
    case 'volume_badrate':   return `Volume vs Bad Rate for ${rows.length} models. Monitor models where rising volume coincides with rising bad rate — indicates adverse selection. Best ${lbl}: ${best.name} (${best.val.toFixed(3)}).`;
    case 'segment_comparison': return `Segment comparison (Current vs Delinquent) for ${lbl}. Divergence >15% between segments indicates differential model performance across risk tiers.`;
    case 'type_benchmark':   return `Model type benchmark for ${lbl}. Average: ${avg.toFixed(3)}. Min/max range available via tooltip on each bar.`;
    case 'percentile':       return `Percentile distribution of ${lbl} across vintages per model. Wide P25–P75 bands indicate high vintage volatility. ${worst.name} shows the lowest median performance.`;
    default: return `Analysis of ${rows.length} models. Portfolio average ${lbl}: ${avg.toFixed(3)}.`;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const PortfolioAnalyzer: React.FC<PortfolioAnalyzerProps> = ({ models, metrics, isDark = false, onAddToReport }) => {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [analysisId, setAnalysisId] = useState('ranking');
  const [slicers, setSlicers]       = useState<SlicerState>(DEFAULT_SLICERS);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [aiExpanded, setAiExpanded]   = useState(false);
  const [aiSummary, setAiSummary]     = useState('');

  const analysis = ANALYSES.find(a => a.id === analysisId) ?? ANALYSES[0];
  const has = (s: string) => analysis.relevantSlicers.includes(s);

  // ── Derived data ──────────────────────────────────────────────────────────
  const allVintages  = useMemo(() => [...new Set(metrics.map(m=>m.vintage))].sort().reverse(), [metrics]);
  const portfolios   = useMemo(() => ['All',...Array.from(new Set(models.map(m=>m.portfolio))).sort()], [models]);
  const modelTypes   = useMemo(() => ['All',...Array.from(new Set(models.map(m=>m.model_type))).sort()], [models]);

  const filteredModels = useMemo(() => {
    let ms = models;
    if (slicers.portfolio !== 'All') ms = ms.filter(m=>m.portfolio===slicers.portfolio);
    if (slicers.modelType !== 'All') ms = ms.filter(m=>m.model_type===slicers.modelType);
    return ms;
  }, [models, slicers.portfolio, slicers.modelType]);

  const latestPerModel = useMemo(() => {
    return filteredModels.map(model => {
      const mets = metrics.filter(m=>m.model_id===model.model_id&&!m.segment);
      const latestV = (slicers.vintage!=='All'?[slicers.vintage]:allVintages).find(v=>mets.some(m=>m.vintage===v));
      return { model, metric: mets.find(m=>m.vintage===latestV) };
    }).filter(r=>r.metric!=null) as ChartRow[];
  }, [filteredModels, metrics, allVintages, slicers.vintage]);

  const displayRows = useMemo(() =>
    slicers.selectedModels.length ? latestPerModel.filter(r=>slicers.selectedModels.includes(r.model.model_id)) : latestPerModel,
    [latestPerModel, slicers.selectedModels]
  );

  const setSlicer = <K extends keyof SlicerState>(k: K, v: SlicerState[K]) =>
    setSlicers(prev => ({ ...prev, [k]: v }));

  // ── Chart render effect ───────────────────────────────────────────────────
  useEffect(() => {
    if (analysis.chartType !== 'canvas') { destroyChart(chartInstance); return; }
    const canvas = canvasRef.current; if (!canvas) return;
    const frame = requestAnimationFrame(() => {
      switch (analysisId) {
        case 'ranking':           renderRanking(displayRows, slicers, canvas, chartInstance, isDark); break;
        case 'comparison':        renderComparison(displayRows, slicers, canvas, chartInstance, isDark); break;
        case 'scatter':           renderScatter(displayRows, slicers, canvas, chartInstance, isDark); break;
        case 'bubble':            renderBubble(displayRows, slicers, canvas, chartInstance, isDark); break;
        case 'trend':             renderTrend(metrics, filteredModels, slicers, canvas, chartInstance, isDark); break;
        case 'vintage_cohort':    renderVintageCohort(metrics, filteredModels, slicers, canvas, chartInstance, isDark); break;
        case 'drift_monitor':     renderDriftMonitor(metrics, filteredModels, slicers, canvas, chartInstance, isDark); break;
        case 'rag_distribution':  renderRAGDistribution(displayRows, slicers, canvas, chartInstance, isDark); break;
        case 'volume_badrate':    renderVolumeBadRate(displayRows, slicers, canvas, chartInstance, isDark); break;
        case 'segment_comparison':renderSegmentComparison(metrics, filteredModels, slicers, canvas, chartInstance, isDark); break;
        case 'type_benchmark':    renderTypeBenchmark(displayRows, slicers, canvas, chartInstance, isDark); break;
        case 'percentile':        renderPercentile(metrics, filteredModels, slicers, canvas, chartInstance, isDark); break;
      }
    });
    return () => { cancelAnimationFrame(frame); destroyChart(chartInstance); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId, JSON.stringify(slicers), JSON.stringify(filteredModels.map(m=>m.model_id)), metrics.length, isDark]);

  // ── AI summary ────────────────────────────────────────────────────────────
  useEffect(() => {
    setAiSummary(generateAISummary(analysisId, displayRows, slicers));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId, displayRows.length, slicers.primaryMetric, slicers.secondaryMetric]);

  // ── Export helpers ────────────────────────────────────────────────────────
  const buildCSV = () => {
    const headers = ['Model','Portfolio','Type','Vintage',...slicers.selectedMetrics];
    const rows = displayRows.map(r=>[r.model.name,r.model.portfolio,r.model.model_type,r.metric.vintage,...slicers.selectedMetrics.map(k=>(getVal(r.metric,k)??'').toString())]);
    return [headers,...rows];
  };
  const handleExportPNG = () => {
    if (!canvasRef.current) return;
    const a=document.createElement('a'); a.href=canvasRef.current.toDataURL('image/png'); a.download=`${analysisId}_${new Date().toISOString().slice(0,10)}.png`; a.click();
  };
  const handleExportCSV = () => {
    const csv=buildCSV().map(row=>row.map(c=>`"${c}"`).join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`${analysisId}.csv`; a.click();
  };
  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    doc.setFontSize(16); doc.text(`${analysis.icon} ${analysis.label}`,14,18);
    doc.setFontSize(9);  doc.text(aiSummary,14,26,{maxWidth:265});
    if (analysis.chartType==='canvas'&&canvasRef.current) doc.addImage(canvasRef.current.toDataURL('image/png'),'PNG',14,42,268,118);
    let y=170; doc.setFontSize(8);
    buildCSV().slice(0,22).forEach(row=>{doc.text(row.slice(0,9).join('   '),14,y);y+=6;});
    doc.save(`${analysisId}_report.pdf`);
  };
  const handleAddToReport = () => {
    if (!onAddToReport) return;
    const base64=analysis.chartType==='canvas'?(canvasRef.current?.toDataURL('image/png')??''):'';
    onAddToReport({id:`${analysisId}_${Date.now()}`,label:`${analysis.icon} ${analysis.label}`,timestamp:new Date().toLocaleString(),chartBase64:base64,csvRows:buildCSV(),aiSummary});
  };

  // ── Table renderers ───────────────────────────────────────────────────────
  const renderHeatmapTable = () => {
    const keys=slicers.selectedMetrics.slice(0,10);
    return (
      <div className="overflow-auto" style={{maxHeight:440}}>
        <table className="text-xs w-full border-collapse">
          <thead><tr>
            <th className={`sticky left-0 z-10 px-3 py-2 text-left font-semibold ${isDark?'bg-slate-800 text-slate-300':'bg-white text-slate-700'}`}>Model</th>
            {keys.map(k=><th key={k} className={`px-3 py-2 text-center whitespace-nowrap font-semibold ${isDark?'text-slate-300':'text-slate-700'}`}>{METRIC_LABELS[k]??k}</th>)}
          </tr></thead>
          <tbody>
            {displayRows.map(r=>(
              <tr key={r.model.model_id} className={`border-t ${isDark?'border-slate-700/50':'border-slate-100'}`}>
                <td className={`sticky left-0 z-10 px-3 py-2 font-medium max-w-[160px] truncate ${isDark?'bg-slate-800 text-slate-300':'bg-white text-slate-800'}`}>{r.model.name}</td>
                {keys.map(k=>{const v=getVal(r.metric,k);return(
                  <td key={k} className="px-3 py-2 text-center font-mono font-semibold"
                    style={{background:v!=null?cellBg(k,v,isDark):undefined,color:isDark?'#f1f5f9':'#0f172a'}}>
                    {v!=null?fmtVal(k,v):<span className="text-slate-400">—</span>}
                  </td>
                );})}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCorrelationTable = () => {
    const keys=slicers.selectedMetrics.slice(0,8);
    const gv=(k:string)=>displayRows.map(r=>getVal(r.metric,k)??0);
    return (
      <div className="overflow-auto" style={{maxHeight:440}}>
        <table className="text-xs w-full border-collapse">
          <thead><tr>
            <th className={`px-2 py-1.5 ${isDark?'text-slate-400':'text-slate-500'}`}></th>
            {keys.map(k=><th key={k} className={`px-2 py-1.5 text-center whitespace-nowrap ${isDark?'text-slate-300':'text-slate-700'}`}>{METRIC_LABELS[k]??k}</th>)}
          </tr></thead>
          <tbody>
            {keys.map(ky=>(
              <tr key={ky} className={`border-t ${isDark?'border-slate-700/50':'border-slate-100'}`}>
                <td className={`px-2 py-1.5 font-medium whitespace-nowrap ${isDark?'text-slate-300':'text-slate-700'}`}>{METRIC_LABELS[ky]??ky}</td>
                {keys.map(kx=>{const r=pearsonR(gv(kx),gv(ky));const bg=r>0?`rgba(59,130,246,${Math.abs(r)*0.65})`:`rgba(239,68,68,${Math.abs(r)*0.65})`;return(
                  <td key={kx} className="px-2 py-1.5 text-center font-mono font-bold" style={{background:bg,color:isDark?'#f8fafc':'#0f172a'}}>{r.toFixed(2)}</td>
                );})}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const cardBg  = isDark?'bg-slate-800/60 border-slate-700':'bg-white border-slate-200';
  const panelBg = isDark?'bg-slate-800 border-slate-700':'bg-slate-50 border-slate-200';
  const lblCls  = `text-xs font-semibold mb-1 block ${isDark?'text-slate-400':'text-slate-500'}`;
  const selCls  = `w-full text-xs px-2 py-1.5 rounded border ${isDark?'bg-slate-700 border-slate-600 text-slate-200':'bg-white border-slate-300 text-slate-800'} focus:outline-none focus:ring-1 focus:ring-blue-500`;
  const btnG    = `text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${isDark?'bg-slate-700 text-slate-300 hover:bg-slate-600':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;
  const icoBtn  = `p-1.5 rounded-lg ${isDark?'text-slate-400 hover:bg-slate-700':'text-slate-500 hover:bg-slate-100'}`;

  const chkRow = (lbl:string, checked:boolean, onChange:()=>void) => (
    <label className={`flex items-center gap-2 text-xs cursor-pointer py-0.5 ${isDark?'text-slate-300':'text-slate-700'}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded accent-blue-500"/>
      <span className="truncate">{lbl}</span>
    </label>
  );

  return (
    <div className={`rounded-xl border ${cardBg} overflow-hidden`}>

      {/* ── Toolbar ── */}
      <div className={`flex flex-wrap items-center gap-2 px-4 py-3 border-b ${isDark?'border-slate-700':'border-slate-200'}`}>
        <select
          value={analysisId}
          onChange={e=>{setAnalysisId(e.target.value);setSlicers(DEFAULT_SLICERS);}}
          className={`text-sm font-semibold px-3 py-2 rounded-lg border flex-shrink-0 ${isDark?'bg-slate-700 border-slate-600 text-white':'bg-white border-slate-300 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          style={{minWidth:230}}
        >
          {CATEGORIES.map(cat=>(
            <optgroup key={cat} label={cat}>
              {ANALYSES.filter(a=>a.category===cat).map(a=>(
                <option key={a.id} value={a.id}>{a.icon}  {a.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className={`text-xs flex-1 min-w-0 truncate hidden sm:block ${isDark?'text-slate-400':'text-slate-500'}`}>{analysis.description}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={()=>setAiExpanded(v=>!v)} className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 ${aiExpanded?'bg-indigo-600 text-white':btnG}`}>✨ AI</button>
          {onAddToReport&&<button onClick={handleAddToReport} className={`${btnG} flex items-center gap-1`}><Plus size={13}/>Report</button>}
          {analysis.chartType==='canvas'&&<button onClick={handleExportPNG} title="Export PNG" className={icoBtn}><Download size={14}/></button>}
          <button onClick={handleExportCSV} className={`${btnG} px-2`}>CSV</button>
          <button onClick={handleExportPDF} className={`${btnG} flex items-center gap-1`}><FileText size={13}/>PDF</button>
          <button onClick={()=>setIsPanelOpen(v=>!v)} className={icoBtn}>{isPanelOpen?<ChevronLeft size={15}/>:<ChevronRight size={15}/>}</button>
        </div>
      </div>

      {/* ── AI panel ── */}
      {aiExpanded&&(
        <div className={`px-4 py-3 border-b text-sm leading-relaxed ${isDark?'bg-indigo-950/40 border-indigo-700/40 text-indigo-200':'bg-indigo-50 border-indigo-100 text-indigo-800'}`}>
          <p className="flex gap-2"><span>✨</span><span>{aiSummary}</span></p>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex" style={{minHeight:480}}>

        {/* Left slicer panel */}
        {isPanelOpen&&(
          <div className={`w-56 flex-shrink-0 border-r ${panelBg} p-3 space-y-3 overflow-y-auto`} style={{maxHeight:540}}>
            <p className={`text-xs font-bold uppercase tracking-wider ${isDark?'text-slate-500':'text-slate-400'}`}>Filters</p>

            {has('primaryMetric')&&<div><label className={lblCls}>Primary Metric</label>
              <select value={slicers.primaryMetric} onChange={e=>setSlicer('primaryMetric',e.target.value)} className={selCls}>
                {Object.entries(METRIC_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select></div>}

            {has('secondaryMetric')&&<div><label className={lblCls}>Secondary Metric</label>
              <select value={slicers.secondaryMetric} onChange={e=>setSlicer('secondaryMetric',e.target.value)} className={selCls}>
                {Object.entries(METRIC_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select></div>}

            {has('sizeMetric')&&<div><label className={lblCls}>Bubble Size</label>
              <select value={slicers.sizeMetric} onChange={e=>setSlicer('sizeMetric',e.target.value)} className={selCls}>
                {Object.entries(METRIC_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select></div>}

            {has('colorBy')&&<div><label className={lblCls}>Color By</label>
              <select value={slicers.colorBy} onChange={e=>setSlicer('colorBy',e.target.value)} className={selCls}>
                <option value="rag">RAG Status</option><option value="portfolio">Portfolio</option><option value="model">Model</option>
              </select></div>}

            {has('groupBy')&&<div><label className={lblCls}>Group By</label>
              <select value={slicers.groupBy} onChange={e=>setSlicer('groupBy',e.target.value)} className={selCls}>
                <option value="portfolio">Portfolio</option><option value="model_type">Model Type</option>
              </select></div>}

            {has('vintage')&&<div><label className={lblCls}>Vintage</label>
              <select value={slicers.vintage} onChange={e=>setSlicer('vintage',e.target.value)} className={selCls}>
                <option value="All">All (Latest)</option>
                {allVintages.map(v=><option key={v} value={v}>{v}</option>)}
              </select></div>}

            {has('portfolio')&&<div><label className={lblCls}>Portfolio</label>
              <select value={slicers.portfolio} onChange={e=>setSlicer('portfolio',e.target.value)} className={selCls}>
                {portfolios.map(p=><option key={p} value={p}>{p}</option>)}
              </select></div>}

            {has('modelType')&&<div><label className={lblCls}>Model Type</label>
              <select value={slicers.modelType} onChange={e=>setSlicer('modelType',e.target.value)} className={selCls}>
                {modelTypes.map(t=><option key={t} value={t}>{t}</option>)}
              </select></div>}

            {has('selectedMetrics')&&<div><label className={lblCls}>Metrics</label>
              <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                {Object.entries(METRIC_LABELS).map(([k,v])=>chkRow(v,slicers.selectedMetrics.includes(k),()=>setSlicer('selectedMetrics',slicers.selectedMetrics.includes(k)?slicers.selectedMetrics.filter(x=>x!==k):[...slicers.selectedMetrics,k])))}
              </div></div>}

            {has('selectedModels')&&filteredModels.length>0&&<div><label className={lblCls}>Models</label>
              <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
                {filteredModels.map(m=>chkRow(m.name.slice(0,24),slicers.selectedModels.includes(m.model_id),()=>setSlicer('selectedModels',slicers.selectedModels.includes(m.model_id)?slicers.selectedModels.filter(x=>x!==m.model_id):[...slicers.selectedModels,m.model_id])))}
              </div>
              {slicers.selectedModels.length>0&&<button onClick={()=>setSlicer('selectedModels',[])} className={`text-xs mt-1 underline ${isDark?'text-blue-400':'text-blue-600'}`}>Clear</button>}
            </div>}

            {has('showThresholds')&&chkRow('Show Thresholds',slicers.showThresholds,()=>setSlicer('showThresholds',!slicers.showThresholds))}
            {has('includeSegments')&&chkRow('Show Segments',slicers.includeSegments,()=>setSlicer('includeSegments',!slicers.includeSegments))}

            <button onClick={()=>setSlicers(DEFAULT_SLICERS)}
              className={`w-full text-xs py-1 mt-1 rounded border ${isDark?'border-slate-600 text-slate-400 hover:bg-slate-700':'border-slate-300 text-slate-500 hover:bg-slate-100'}`}>
              Reset Filters
            </button>
          </div>
        )}

        {/* Chart / table area */}
        <div className="flex-1 p-4 min-w-0 flex flex-col">
          {displayRows.length===0?(
            <div className={`flex-1 flex items-center justify-center text-sm ${isDark?'text-slate-500':'text-slate-400'}`}>
              No models match the current filter selection.
            </div>
          ):analysis.chartType==='canvas'?(
            <canvas ref={canvasRef} style={{height:430,width:'100%'}}/>
          ):analysisId==='heatmap'?renderHeatmapTable():renderCorrelationTable()}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className={`px-4 py-2 border-t text-xs flex items-center gap-3 flex-wrap ${isDark?'border-slate-700 text-slate-500':'border-slate-200 text-slate-400'}`}>
        <span>{displayRows.length} model{displayRows.length!==1?'s':''} · {slicers.vintage!=='All'?`Vintage: ${slicers.vintage}`:'Latest vintage per model'}</span>
        {filteredModels.length!==models.length&&<span>· Filtered from {models.length} total</span>}
        {slicers.selectedModels.length>0&&<span>· {slicers.selectedModels.length} selected</span>}
      </div>
    </div>
  );
};

