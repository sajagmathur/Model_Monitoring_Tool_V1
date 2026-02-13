import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { themeClasses } from '../utils/themeClasses';

const Training: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className="space-y-8">
      <div>
        <h1 className={`text-4xl font-bold ${themeClasses.textPrimary(theme)} mb-2`}>Training & Tutorials</h1>
        <p className={themeClasses.textSecondary(theme)}>Learn how to use Model Monitoring Studio through step-by-step guides and governance best practices</p>
      </div>

      <div className="grid gap-6">
        {/* Quick Start */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-3`}>⚡ Quick Start Guide</h2>
          <div className={`space-y-4 ${themeClasses.textSecondary(theme)}`}>
            <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Step 1: Access Model Repository</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Navigate to the "Model Repository" tab</li>
              <li>Browse available models organized by business domain</li>
              <li>Select a model to view governance details</li>
              <li>Review version history and performance metrics</li>
            </ol>

            <h3 className={`font-semibold ${themeClasses.textPrimary(theme)} mt-4`}>Step 2: Monitor Model Health</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Go to the "Dashboard" for KPI overview</li>
              <li>Check performance metrics (AUC, Gini, KS Statistic)</li>
              <li>Review drift detection results (PSI, CSI)</li>
              <li>Examine fairness compliance scores</li>
              <li>Monitor business impact metrics</li>
            </ol>

            <h3 className={`font-semibold ${themeClasses.textPrimary(theme)} mt-4`}>Step 3: Set Up Alerts</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Navigate to Projects workflow</li>
              <li>Complete data ingestion and quality checks</li>
              <li>Configure alert thresholds for drift</li>
              <li>Set performance degradation triggers</li>
              <li>Define approval workflows for model changes</li>
            </ol>

            <h3 className={`font-semibold ${themeClasses.textPrimary(theme)} mt-4`}>Step 4: Review Compliance</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Access Admin panel for audit logs</li>
              <li>Review model approval workflows</li>
              <li>Verify fairness and bias metrics</li>
              <li>Check data lineage and governance</li>
              <li>Document model changes for compliance</li>
            </ol>

            <h3 className={`font-semibold ${themeClasses.textPrimary(theme)} mt-4`}>Step 5: Manage Model Lifecycle</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Track model versions from champion to archive</li>
              <li>Compare performance between versions</li>
              <li>Approve model promotions through workflows</li>
              <li>Monitor production model performance</li>
              <li>Plan retraining based on drift detection</li>
            </ol>
          </div>
        </div>

        {/* Governance Tutorial */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-3`}>🔐 Model Governance Workflow</h2>
          <div className={`space-y-4 ${themeClasses.textSecondary(theme)}`}>
            <p>Implement comprehensive model governance with Model Monitoring Studio. This tutorial demonstrates a complete governance workflow.</p>
            
            <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Example: Credit Risk Model Governance</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Register new Credit Risk Model v2.1 in Model Repository</li>
              <li>Run data quality validation on latest credit data</li>
              <li>Calculate performance metrics (AUC, Gini, KS)</li>
              <li>Measure fairness metrics (Demographic Parity, EOp)</li>
              <li>Check for data drift using PSI and CSI</li>
              <li>Generate compliance report for Risk team</li>
              <li>Submit for approval by risk stakeholders</li>
              <li>Monitor production performance post-deployment</li>
              <li>Set up retraining alerts if performance degrades</li>
            </ol>
          </div>
        </div>

        {/* Best Practices */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-3`}>✅ Monitoring Best Practices</h2>
          <div className={`space-y-3 ${themeClasses.textSecondary(theme)}`}>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>📊 Performance Monitoring</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Track AUC, Gini, KS metrics weekly</li>
                <li>Monitor approval rates and false positive rates</li>
                <li>Compare against business baselines</li>
                <li>Alert on significant performance drop (&gt;5%)</li>
              </ul>
            </div>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)} mt-3`}>🔍 Drift Detection</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Monitor population stability (PSI) for input features</li>
                <li>Track covariate shift index (CSI) between datasets</li>
                <li>Check for missing values and data quality issues</li>
                <li>Validate schema consistency</li>
              </ul>
            </div>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)} mt-3`}>⚖️ Fairness & Compliance</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Measure demographic parity across protected attributes</li>
                <li>Monitor equal opportunity metrics</li>
                <li>Calculate adverse impact ratios</li>
                <li>Document all model decisions for audit trails</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Common Workflows */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-3`}>🎯 Common Monitoring Scenarios</h2>
          <div className={`space-y-4 ${themeClasses.textSecondary(theme)}`}>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Scenario 1: Daily Model Performance Check</h3>
              <p className="ml-2">Set up automated dashboards showing daily KPI trends, drift detection results, and fairness metrics to catch issues early.</p>
            </div>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Scenario 2: Model Champion/Challenger Management</h3>
              <p className="ml-2">Run new model versions as challengers, compare performance against current champion, and promote only if metrics improve significantly.</p>
            </div>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Scenario 3: Compliance & Audit Reporting</h3>
              <p className="ml-2">Generate quarterly fairness reports, track model decisions for compliance reviewers, and maintain complete audit trails of all changes.</p>
            </div>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Scenario 4: Rapid Incident Response</h3>
              <p className="ml-2">Monitor production models for performance anomalies, automatically trigger rollback to previous version if critical metrics degrade.</p>
            </div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-3`}>🔧 Troubleshooting Guide</h2>
          <div className={`space-y-3 ${themeClasses.textSecondary(theme)}`}>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>High PSI/CSI detected?</h3>
              <p className="ml-2">Investigate if input data distribution has changed. Coordinate with data engineering to validate data quality and consider retraining.</p>
            </div>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Fairness metrics show disparities?</h3>
              <p className="ml-2">Review model decisions for protected attributes. Evaluate if features need recalibration or if business rules need adjustment.</p>
            </div>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Model approval workflow stuck?</h3>
              <p className="ml-2">Check stakeholder notifications and follow up with approvers. Ensure all governance documentation is complete.</p>
            </div>
            <div>
              <h3 className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Performance degradation alert triggered?</h3>
              <p className="ml-2">Analyze business Impact metrics and check for recent data distribution changes. Evaluate if immediate retraining is needed.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;
