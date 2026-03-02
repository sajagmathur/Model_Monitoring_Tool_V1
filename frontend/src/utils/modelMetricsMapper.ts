/**
 * Model Metrics Mapper
 * 
 * Bridges the gap between RegistryModel (from Projects workflow) and 
 * BankingModel/BankingMetrics (used in Dashboard).
 * 
 * Transforms registry models into dashboard-compatible format with
 * generated time series metrics and RAG status calculations.
 */

import { RegistryModel } from '../contexts/GlobalContext';
import { BankingModel, BankingMetrics } from './bankingMetricsMock';

/**
 * Map model stage to portfolio category
 */
function mapStageToPortfolio(stage: string): string {
  const portfolioMap: Record<string, string> = {
    'dev': 'Development Portfolio',
    'staging': 'Staging Portfolio',
    'production': 'Production Portfolio',
  };
  return portfolioMap[stage] || 'General Portfolio';
}

/**
 * Map model type to banking model type
 */
function mapModelType(modelType: string): string {
  const typeMap: Record<string, string> = {
    'classification': 'Risk-Based Pricing',
    'regression': 'Credit Decisioning',
    'clustering': 'Segmentation Model',
    'nlp': 'Text Analytics',
    'custom': 'Custom Scorecard',
  };
  return typeMap[modelType] || 'Predictive Model';
}

/**
 * Derive risk tier from model metrics
 */
function calculateRiskTier(metrics?: Record<string, number>): string {
  if (!metrics) return 'Tier 3';
  
  // Use AUC or accuracy to determine tier
  const auc = metrics.auc || metrics.accuracy || 0;
  
  if (auc >= 0.85) return 'Tier 1';
  if (auc >= 0.75) return 'Tier 2';
  return 'Tier 3';
}

/**
 * Generate clean model ID from name if not provided
 */
function generateModelIdFromName(name: string, fallbackId?: string): string {
  // If explicit model_id is provided, use it
  if (fallbackId && fallbackId.match(/^MODEL-\d+/)) {
    return fallbackId;
  }
  
  // Generate from name: take first 3 words, uppercase, join with dashes
  const words = name.trim().split(/\s+/).slice(0, 3);
  const slug = words
    .map(w => w.replace(/[^\w]/g, '').toUpperCase())
    .join('-');
  
  return slug || 'MODEL-000';
}

/**
 * Transform RegistryModel to BankingModel format
 */
export function mapRegistryModelToBankingModel(registryModel: RegistryModel): BankingModel {
  // Classification and regression models support thin/thick file segment analysis
  const supportsSegments = registryModel.modelType === 'classification' || registryModel.modelType === 'regression';
  return {
    // Use provided model_id, otherwise generate from name (never use internal UUID)
    model_id: registryModel.model_id || generateModelIdFromName(registryModel.name),
    name: registryModel.name,
    portfolio: mapStageToPortfolio(registryModel.stage),
    model_type: mapModelType(registryModel.modelType),
    segments: supportsSegments ? ['thin_file', 'thick_file'] : undefined,
    version: registryModel.version,
  };
}

/**
 * Calculate RAG status from metrics
 */
function calculateRAGStatus(metrics: {
  KS: number;
  PSI: number;
  AUC: number;
}): 'green' | 'amber' | 'red' {
  const { KS, PSI, AUC } = metrics;
  
  // Green thresholds: Good performance
  if (KS > 0.35 && PSI < 0.10 && AUC > 0.75) {
    return 'green';
  }
  
  // Red thresholds: Poor performance
  if (KS < 0.25 || PSI > 0.25 || AUC < 0.65) {
    return 'red';
  }
  
  // Amber: Between green and red
  return 'amber';
}

/**
 * Generate realistic metric value with drift over time
 */
function generateMetricWithDrift(
  baseValue: number,
  vintageIndex: number,
  driftRate: number,
  noise: number = 0.02
): number {
  // Apply drift over time
  const drift = driftRate * vintageIndex;
  
  // Add random noise
  const randomNoise = (Math.random() - 0.5) * noise;
  
  // Calculate value with bounds
  const value = baseValue + drift + randomNoise;
  
  return Math.max(0, Math.min(1, value)); // Clamp between 0 and 1
}

/**
 * Generate monthly vintage labels (last 13 months)
 */
function generateVintageLabels(count: number = 13): string[] {
  const vintages: string[] = [];
  const now = new Date();
  
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    vintages.push(`${year}-${month}`);
  }
  
  return vintages;
}

/**
 * Generate time series BankingMetrics from RegistryModel
 */
export function generateMetricsFromRegistryModel(
  registryModel: RegistryModel,
  vintages: number = 13
): BankingMetrics[] {
  const bankingModel = mapRegistryModelToBankingModel(registryModel);
  const vintageLabels = generateVintageLabels(vintages);
  const metrics: BankingMetrics[] = [];
  
  // Extract base metrics from registryModel or use defaults
  const baseAUC = registryModel.metrics?.auc || registryModel.metrics?.accuracy || 0.80;
  const baseKS = registryModel.metrics?.ks || (baseAUC - 0.30); // Rough KS approximation
  const basePSI = registryModel.metrics?.psi || 0.08;
  const baseGini = registryModel.metrics?.gini || (2 * baseAUC - 1);
  const baseBadRate = registryModel.metrics?.bad_rate || 0.05;
  
  // Determine drift characteristics based on model status
  const isHealthy = registryModel.status === 'active';
  const ksDrift = isHealthy ? -0.003 : -0.008; // KS degradation
  const psiDrift = isHealthy ? 0.002 : 0.006; // PSI increase (population shift)
  const aucDrift = isHealthy ? -0.002 : -0.005; // AUC degradation
  
  // Determine segments: classification/regression models generate thin_file + thick_file variants
  const supportsSegments = registryModel.modelType === 'classification' || registryModel.modelType === 'regression';
  const segmentsToGenerate: (string | undefined)[] = supportsSegments
    ? [undefined, 'thin_file', 'thick_file']
    : [undefined];

  // Generate metrics for each vintage × segment combination
  vintageLabels.forEach((vintage, index) => {
    segmentsToGenerate.forEach((segment) => {
      // Segment-specific performance adjustments (mirrors bankingMetricsMock.ts logic)
      let segKSAdjust = 0;
      let segPSIMult  = 1.0;
      let segVolMult  = 1.0;
      let segBRMult   = 1.0;
      if (segment === 'thin_file') {
        segKSAdjust = -0.08;  // limited credit history hurts discrimination
        segPSIMult  =  1.30;  // less stable population
        segVolMult  =  0.42;  // smaller segment
        segBRMult   =  1.35;  // higher bad rate
      } else if (segment === 'thick_file') {
        segKSAdjust = +0.06;  // rich credit history aids discrimination
        segPSIMult  =  0.80;  // more stable population
        segVolMult  =  0.65;
        segBRMult   =  0.75;  // lower bad rate
      }

      const KS = Math.max(0.05, Math.min(0.90,
        generateMetricWithDrift(baseKS + segKSAdjust, index, ksDrift, 0.015)));
      const PSI = Math.max(0.005, Math.min(0.50,
        generateMetricWithDrift(basePSI * segPSIMult, index, psiDrift * segPSIMult, 0.01)));
      const AUC = Math.max(0.50, Math.min(0.99,
        generateMetricWithDrift(baseAUC, index, aucDrift, 0.01)));
      const Gini = Math.max(0, Math.min(1,
        generateMetricWithDrift(baseGini, index, aucDrift * 2, 0.015)));
      const bad_rate = Math.max(0.005,
        generateMetricWithDrift(baseBadRate * segBRMult, index, 0.001, 0.005));

      // Volume with seasonal variation and segment scaling
      const baseVolume = 50000 + Math.floor(Math.random() * 30000);
      const seasonalFactor = 1 + 0.15 * Math.sin((index / 12) * 2 * Math.PI);
      const volume = Math.floor(baseVolume * seasonalFactor * segVolMult);

      const metricData: BankingMetrics['metrics'] = {
        KS:       Number(KS.toFixed(3)),
        PSI:      Number(PSI.toFixed(3)),
        AUC:      Number(AUC.toFixed(3)),
        Gini:     Number(Gini.toFixed(3)),
        bad_rate: Number(bad_rate.toFixed(4)),
      };

      // Add classification-specific metrics
      if (registryModel.modelType === 'classification') {
        const baseAccuracy  = registryModel.metrics?.accuracy  || 0.88;
        const basePrecision = registryModel.metrics?.precision || 0.82;
        const baseRecall    = registryModel.metrics?.recall    || 0.78;
        const baseF1        = registryModel.metrics?.f1_score  || 0.80;
        const baseCA10      = registryModel.metrics?.ca_at_10  || 0.42;
        const baseHRL       = registryModel.metrics?.hrl       || 0.65;

        metricData.accuracy   = Number(Math.max(0.50, generateMetricWithDrift(baseAccuracy,  index, aucDrift * 0.5,  0.008)).toFixed(3));
        metricData.precision  = Number(Math.max(0.40, generateMetricWithDrift(basePrecision, index, aucDrift * 0.6,  0.012)).toFixed(3));
        metricData.recall     = Number(Math.max(0.40, generateMetricWithDrift(baseRecall,    index, aucDrift * 0.4,  0.012)).toFixed(3));
        metricData.f1_score   = Number(Math.max(0.40, generateMetricWithDrift(baseF1,        index, aucDrift * 0.5,  0.010)).toFixed(3));
        metricData.CA_at_10   = Number(Math.max(0.10, generateMetricWithDrift(baseCA10,      index, aucDrift * 0.3,  0.012)).toFixed(3));
        metricData.HRL        = Number(Math.max(0.30, generateMetricWithDrift(baseHRL,       index, aucDrift * 0.4,  0.012)).toFixed(3));
      }

      metrics.push({
        model_id: bankingModel.model_id,
        portfolio: bankingModel.portfolio,
        model_type: bankingModel.model_type,
        vintage,
        segment,
        volume,
        computed_at: new Date().toISOString(),
        metrics: metricData,
        rag_status: calculateRAGStatus({ KS: metricData.KS ?? 0, PSI: metricData.PSI ?? 0, AUC: metricData.AUC ?? 0 }),
      });
    });
  });

  return metrics;
}

/**
 * Sync all RegistryModels to banking format
 * Returns both models and metrics arrays for GlobalContext
 */
export function syncRegistryModelsToDashboard(
  registryModels: RegistryModel[]
): {
  bankingModels: BankingModel[];
  bankingMetrics: BankingMetrics[];
} {
  const bankingModels: BankingModel[] = [];
  const bankingMetrics: BankingMetrics[] = [];
  
  registryModels.forEach((registryModel) => {
    // Transform model
    const bankingModel = mapRegistryModelToBankingModel(registryModel);
    bankingModels.push(bankingModel);
    
    // Generate metrics time series
    const metrics = generateMetricsFromRegistryModel(registryModel);
    bankingMetrics.push(...metrics);
  });
  
  console.log(`✓ Synced ${bankingModels.length} registry models to dashboard format`);
  console.log(`✓ Generated ${bankingMetrics.length} metric records`);
  
  return { bankingModels, bankingMetrics };
}

/**
 * Update existing banking data with new registry models
 * Merges new models while preserving existing mock data
 */
export function mergeRegistryModelsWithExisting(
  existingBankingModels: BankingModel[],
  existingBankingMetrics: BankingMetrics[],
  registryModels: RegistryModel[]
): {
  bankingModels: BankingModel[];
  bankingMetrics: BankingMetrics[];
} {
  const { bankingModels: newModels, bankingMetrics: newMetrics } = 
    syncRegistryModelsToDashboard(registryModels);
  
  // Get IDs of registry-based models
  const registryModelIds = new Set(newModels.map(m => m.model_id));
  
  // Keep existing models that aren't from registry
  const preservedModels = existingBankingModels.filter(
    m => !registryModelIds.has(m.model_id)
  );
  const preservedMetrics = existingBankingMetrics.filter(
    m => !registryModelIds.has(m.model_id)
  );
  
  return {
    bankingModels: [...preservedModels, ...newModels],
    bankingMetrics: [...preservedMetrics, ...newMetrics],
  };
}
