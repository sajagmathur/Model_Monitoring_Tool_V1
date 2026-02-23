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
 * Transform RegistryModel to BankingModel format
 */
export function mapRegistryModelToBankingModel(registryModel: RegistryModel): BankingModel {
  return {
    model_id: registryModel.id,
    name: registryModel.name,
    portfolio: mapStageToPortfolio(registryModel.stage),
    model_type: mapModelType(registryModel.modelType),
    segments: undefined, // No segment data from registry model
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
  
  // Generate metrics for each vintage
  vintageLabels.forEach((vintage, index) => {
    const KS = generateMetricWithDrift(baseKS, index, ksDrift, 0.015);
    const PSI = generateMetricWithDrift(basePSI, index, psiDrift, 0.01);
    const AUC = generateMetricWithDrift(baseAUC, index, aucDrift, 0.01);
    const Gini = generateMetricWithDrift(baseGini, index, aucDrift * 2, 0.015);
    const bad_rate = generateMetricWithDrift(baseBadRate, index, 0.001, 0.005);
    
    // Calculate volume with seasonal variation
    const baseVolume = 50000 + Math.floor(Math.random() * 30000);
    const seasonalFactor = 1 + 0.15 * Math.sin((index / 12) * 2 * Math.PI);
    const volume = Math.floor(baseVolume * seasonalFactor);
    
    const metricData = {
      KS: Number(KS.toFixed(3)),
      PSI: Number(PSI.toFixed(3)),
      AUC: Number(AUC.toFixed(3)),
      Gini: Number(Gini.toFixed(3)),
      bad_rate: Number(bad_rate.toFixed(4)),
    };
    
    metrics.push({
      model_id: bankingModel.model_id,
      portfolio: bankingModel.portfolio,
      model_type: bankingModel.model_type,
      vintage,
      volume,
      computed_at: new Date().toISOString(),
      metrics: metricData,
      rag_status: calculateRAGStatus(metricData),
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
