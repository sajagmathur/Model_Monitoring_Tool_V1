/**
 * Banking Metrics Mock Data Generator
 * Generates realistic banking model monitoring data for demo/testing
 */

export interface BankingModel {
  model_id: string;
  portfolio: string;
  model_type: string;
  name: string;
  segments?: string[];
}

export interface BankingMetrics {
  model_id: string;
  portfolio: string;
  model_type: string;
  vintage: string;
  segment?: string;
  volume: number;
  metrics: {
    // Scorecard/ML metrics
    KS?: number;
    PSI?: number;
    AUC?: number;
    Gini?: number;
    CA_at_10?: number;
    bad_rate?: number;
    // Collections metrics
    roll_rate_30?: number;
    roll_rate_60?: number;
    roll_rate_90?: number;
    flow_rate?: number;
    recovery_rate?: number;
    cure_rate?: number;
    // Fraud metrics
    AUC_PR?: number;
    precision_at_5?: number;
    alert_rate?: number;
    fpr_at_threshold?: number;
    fraud_detection_rate?: number;
    fraud_rate_in_alerts?: number;
    // ML additional metrics
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
  };
  computed_at: string;
  rag_status?: 'green' | 'amber' | 'red';
}

export interface SegmentMetrics {
  model_id: string;
  vintage: string;
  segments: Array<{
    segment: 'thin_file' | 'thick_file';
    label: string;
    volume: number;
    metrics: BankingMetrics['metrics'];
  }>;
}

export interface VariableStability {
  variable: string;
  psi: number;
  status: 'stable' | 'warning' | 'unstable';
  baseline_distribution?: number[];
  current_distribution?: number[];
}

export interface DecileData {
  decile: number;
  count: number;
  bad_count: number;
  bad_rate: number;
  cumulative_goods: number;
  cumulative_bads: number;
  ks: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  rank: number;
  drift?: number;
}

// Constants
const PORTFOLIOS = ['Retail', 'Corporate', 'SME', 'Acquisition', 'ECM', 'Collections', 'Fraud'];
const MODEL_TYPES = ['Acquisition Scorecard', 'ECM Scorecard', 'Bureau', 'Collections', 'Fraud', 'ML'];
const VINTAGES = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12', '2025-01'];
const SEGMENTS = ['thin_file', 'thick_file'] as const;

// Seeded random number generator for consistent results
let seed = 42;
function seededRandom(): number {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function randBetween(min: number, max: number): number {
  return min + seededRandom() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max));
}

/**
 * Calculate RAG status based on KS and PSI thresholds
 */
export function calculateRAGStatus(ks?: number, psi?: number): 'green' | 'amber' | 'red' {
  // KS thresholds: Green > 0.35, Amber 0.25-0.35, Red < 0.25
  // PSI thresholds: Green < 0.10, Amber 0.10-0.25, Red > 0.25
  
  let ksStatus: 'green' | 'amber' | 'red' = 'green';
  let psiStatus: 'green' | 'amber' | 'red' = 'green';
  
  if (ks !== undefined) {
    if (ks < 0.25) ksStatus = 'red';
    else if (ks < 0.35) ksStatus = 'amber';
  }
  
  if (psi !== undefined) {
    if (psi > 0.25) psiStatus = 'red';
    else if (psi > 0.10) psiStatus = 'amber';
  }
  
  // Overall status is worst of both
  if (ksStatus === 'red' || psiStatus === 'red') return 'red';
  if (ksStatus === 'amber' || psiStatus === 'amber') return 'amber';
  return 'green';
}

/**
 * Generate banking models with realistic configurations
 */
export function generateBankingModels(count: number = 20): BankingModel[] {
  const models: BankingModel[] = [];
  seed = 42; // Reset seed for consistency
  
  const modelConfigs = [
    { portfolio: 'Retail', type: 'Acquisition Scorecard', segments: SEGMENTS },
    { portfolio: 'Retail', type: 'ECM Scorecard' },
    { portfolio: 'Retail', type: 'ML' },
    { portfolio: 'Corporate', type: 'Acquisition Scorecard', segments: SEGMENTS },
    { portfolio: 'Corporate', type: 'Bureau' },
    { portfolio: 'SME', type: 'Acquisition Scorecard', segments: SEGMENTS },
    { portfolio: 'SME', type: 'Bureau' },
    { portfolio: 'Collections', type: 'Collections' },
    { portfolio: 'Fraud', type: 'Fraud' },
    { portfolio: 'Acquisition', type: 'ML' },
    { portfolio: 'ECM', type: 'ECM Scorecard' },
  ];
  
  for (let i = 0; i < Math.min(count, modelConfigs.length); i++) {
    const config = modelConfigs[i];
    const modelNum = String(i + 1).padStart(3, '0');
    models.push({
      model_id: `${config.type.substring(0, 3).toUpperCase()}-${config.portfolio.substring(0, 3).toUpperCase()}-${modelNum}`,
      portfolio: config.portfolio,
      model_type: config.type,
      name: `${config.type} - ${config.portfolio} ${modelNum}`,
      segments: config.segments ? [...config.segments] : undefined,
    });
  }
  
  return models;
}

/**
 * Generate metrics for a specific model type
 */
function generateMetricsForType(modelType: string, baseKS: number = 0.4): BankingMetrics['metrics'] {
  const metrics: BankingMetrics['metrics'] = {};
  
  if (modelType === 'Acquisition Scorecard' || modelType === 'ECM Scorecard' || modelType === 'Bureau' || modelType === 'ML') {
    metrics.KS = Math.max(0.15, Math.min(0.65, baseKS + randBetween(-0.08, 0.08)));
    metrics.PSI = Math.max(0.01, randBetween(0.02, 0.20));
    metrics.AUC = Math.max(0.60, Math.min(0.95, 0.65 + metrics.KS * 0.5 + randBetween(-0.05, 0.05)));
    metrics.Gini = metrics.AUC * 2 - 1;
    metrics.CA_at_10 = Math.max(0.15, Math.min(0.45, metrics.KS * 0.7 + randBetween(-0.05, 0.05)));
    metrics.bad_rate = Math.max(0.02, Math.min(0.15, randBetween(0.04, 0.10)));
    
    if (modelType === 'ML') {
      metrics.accuracy = Math.max(0.75, Math.min(0.95, 0.85 + randBetween(-0.08, 0.08)));
      metrics.precision = Math.max(0.70, Math.min(0.92, 0.80 + randBetween(-0.08, 0.08)));
      metrics.recall = Math.max(0.65, Math.min(0.90, 0.75 + randBetween(-0.08, 0.08)));
      metrics.f1_score = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall);
    }
  } else if (modelType === 'Collections') {
    metrics.roll_rate_30 = Math.max(0.02, Math.min(0.12, randBetween(0.03, 0.09)));
    metrics.roll_rate_60 = Math.max(0.01, Math.min(0.08, randBetween(0.02, 0.06)));
    metrics.roll_rate_90 = Math.max(0.005, Math.min(0.05, randBetween(0.01, 0.04)));
    metrics.flow_rate = Math.max(0.10, Math.min(0.35, randBetween(0.15, 0.25)));
    metrics.recovery_rate = Math.max(0.15, Math.min(0.45, randBetween(0.20, 0.35)));
    metrics.cure_rate = Math.max(0.20, Math.min(0.55, randBetween(0.25, 0.45)));
  } else if (modelType === 'Fraud') {
    metrics.KS = Math.max(0.30, Math.min(0.75, randBetween(0.45, 0.65)));
    metrics.PSI = Math.max(0.01, randBetween(0.02, 0.15));
    metrics.AUC = Math.max(0.75, Math.min(0.98, randBetween(0.82, 0.95)));
    metrics.AUC_PR = Math.max(0.10, Math.min(0.40, randBetween(0.15, 0.30)));
    metrics.precision_at_5 = Math.max(0.10, Math.min(0.35, randBetween(0.15, 0.25)));
    metrics.alert_rate = Math.max(0.01, Math.min(0.08, randBetween(0.02, 0.05)));
    metrics.fpr_at_threshold = Math.max(0.005, Math.min(0.04, randBetween(0.01, 0.03)));
    metrics.fraud_detection_rate = Math.max(0.75, Math.min(0.95, randBetween(0.82, 0.92)));
    metrics.fraud_rate_in_alerts = Math.max(0.05, Math.min(0.25, randBetween(0.10, 0.18)));
    metrics.bad_rate = Math.max(0.005, Math.min(0.05, randBetween(0.01, 0.03)));
  }
  
  return metrics;
}

/**
 * Generate time series metrics for a model across vintages
 */
export function generateMetricsTimeSeries(
  model: BankingModel,
  vintages: string[] = VINTAGES
): BankingMetrics[] {
  const metrics: BankingMetrics[] = [];
  const baseKS = randBetween(0.35, 0.50);
  
  // Determine if this model will show a trend (70% chance)
  const hasTrend = seededRandom() > 0.3;
  const trendDirection = seededRandom() > 0.5 ? 1 : -1; // Positive or negative trend
  const trendStrength = randBetween(0.01, 0.03); // Per vintage
  
  vintages.forEach((vintage, idx) => {
    const segments = model.segments || [undefined];
    
    segments.forEach((segment) => {
      const adjustedKS = hasTrend 
        ? baseKS + (trendDirection * trendStrength * idx)
        : baseKS + randBetween(-0.02, 0.02);
      
      const modelMetrics = generateMetricsForType(model.model_type, adjustedKS);
      const volume = randInt(5000, 50000);
      
      const metricEntry: BankingMetrics = {
        model_id: model.model_id,
        portfolio: model.portfolio,
        model_type: model.model_type,
        vintage,
        segment: segment as string | undefined,
        volume,
        metrics: modelMetrics,
        computed_at: new Date(2024, idx, 15).toISOString(),
        rag_status: calculateRAGStatus(modelMetrics.KS, modelMetrics.PSI),
      };
      
      metrics.push(metricEntry);
    });
  });
  
  return metrics;
}

/**
 * Generate segment comparison metrics for Acquisition Scorecard
 */
export function generateSegmentMetrics(modelId: string, vintage: string): SegmentMetrics {
  return {
    model_id: modelId,
    vintage,
    segments: [
      {
        segment: 'thin_file',
        label: 'Thin file',
        volume: randInt(8000, 20000),
        metrics: generateMetricsForType('Acquisition Scorecard', randBetween(0.32, 0.42)),
      },
      {
        segment: 'thick_file',
        label: 'Thick file',
        volume: randInt(15000, 35000),
        metrics: generateMetricsForType('Acquisition Scorecard', randBetween(0.42, 0.52)),
      },
    ],
  };
}

/**
 * Generate variable-level stability analysis
 */
export function generateVariableStability(modelId: string, vintage: string): VariableStability[] {
  const variables = [
    'credit_score', 'debt_to_income', 'age', 'income', 'employment_length',
    'num_accounts', 'total_balance', 'credit_utilization', 'payment_history',
    'num_inquiries', 'mortgage_flag', 'revolving_balance', 'installment_balance',
    'num_open_accounts', 'num_delinquencies', 'account_age_months', 'bureau_score',
    'external_rating', 'income_verified', 'home_ownership', 'purpose', 'state',
    'num_collections', 'total_credit_limit', 'avg_account_balance'
  ];
  
  return variables.map((variable) => {
    const psi = Math.max(0.005, randBetween(0.01, 0.30));
    return {
      variable,
      psi: parseFloat(psi.toFixed(4)),
      status: psi < 0.10 ? 'stable' : psi < 0.25 ? 'warning' : 'unstable',
    };
  });
}

/**
 * Generate decile analysis data
 */
export function generateDecileAnalysis(modelId: string, vintage: string): DecileData[] {
  const totalGoods = randInt(8000, 12000);
  const totalBads = randInt(400, 1200);
  const deciles: DecileData[] = [];
  
  let cumGoods = 0;
  let cumBads = 0;
  let maxKS = 0;
  
  for (let i = 1; i <= 10; i++) {
    // Higher deciles should have higher bad rates
    const badRate = Math.max(0.01, Math.min(0.40, 0.02 + (i - 1) * 0.04 + randBetween(-0.01, 0.01)));
    const count = Math.floor((totalGoods + totalBads) / 10);
    const badCount = Math.floor(count * badRate);
    const goodCount = count - badCount;
    
    cumBads += badCount;
    cumGoods += goodCount;
    
    const pctBads = cumBads / totalBads;
    const pctGoods = cumGoods / totalGoods;
    const ks = Math.abs(pctBads - pctGoods);
    
    if (ks > maxKS) maxKS = ks;
    
    deciles.push({
      decile: i,
      count,
      bad_count: badCount,
      bad_rate: parseFloat(badRate.toFixed(4)),
      cumulative_goods: cumGoods,
      cumulative_bads: cumBads,
      ks: parseFloat(ks.toFixed(4)),
    });
  }
  
  return deciles;
}

/**
 * Generate ML explainability - feature importance
 */
export function generateMLExplainability(modelId: string): FeatureImportance[] {
  const features = [
    'credit_score', 'debt_to_income', 'income', 'employment_length', 'credit_utilization',
    'payment_history_score', 'num_open_accounts', 'total_balance', 'age', 'num_inquiries',
    'mortgage_flag', 'revolving_util', 'account_age', 'num_delinquencies', 'bureau_score',
  ];
  
  // Generate importances that sum to ~1.0
  const rawImportances = features.map(() => seededRandom());
  const sum = rawImportances.reduce((a, b) => a + b, 0);
  const normalized = rawImportances.map(v => v / sum);
  
  const importances = features
    .map((feature, idx) => ({
      feature,
      importance: parseFloat(normalized[idx].toFixed(4)),
      rank: idx + 1,
      drift: parseFloat(randBetween(-0.05, 0.05).toFixed(4)),
    }))
    .sort((a, b) => b.importance - a.importance)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
  
  return importances;
}

/**
 * Generate complete banking metrics dataset
 */
export function generateCompleteBankingDataset(): {
  models: BankingModel[];
  metrics: BankingMetrics[];
} {
  seed = 42; // Reset seed
  const models = generateBankingModels(12);
  const allMetrics: BankingMetrics[] = [];
  
  models.forEach(model => {
    const modelMetrics = generateMetricsTimeSeries(model, VINTAGES);
    allMetrics.push(...modelMetrics);
  });
  
  return { models, metrics: allMetrics };
}
