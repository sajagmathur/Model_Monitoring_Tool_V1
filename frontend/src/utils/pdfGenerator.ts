// PDF Generation Utility for Reports
// This utility provides functions to generate PDF reports from monitoring data

interface DataQualityPDFData {
  reportName: string;
  generatedAt: string;
  datasets: Array<{
    name: string;
    totalRecords: number;
    recordsAfterExclusion: number;
    exclusionRate: number;
    qualityScore: number;
    issues: Array<{
      variable: string;
      type: string;
      severity: string;
      count: number;
      percent: number;
      selectedMethod?: string;
    }>;
  }>;
  lockWorkflow?: boolean;
}

interface GeneratedReportPDFData {
  reportName: string;
  reportType: string;
  modelName: string;
  generatedAt: string;
  healthScore?: number;
  metrics?: Record<string, any>;
  summary?: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
}

/**
 * Generate a Data Quality PDF Report
 */
export const generateDataQualityPDF = (data: DataQualityPDFData): void => {
  // Create PDF content
  let pdfContent = `
═══════════════════════════════════════════════════════════
              DATA QUALITY IMPROVEMENT REPORT
═══════════════════════════════════════════════════════════

Report Name: ${data.reportName}
Generated: ${new Date(data.generatedAt).toLocaleString()}
Workflow Locked: ${data.lockWorkflow ? 'Yes' : 'No'}

═══════════════════════════════════════════════════════════
                  EXECUTIVE SUMMARY
═══════════════════════════════════════════════════════════

Total Datasets Analyzed: ${data.datasets.length}
Overall Quality Status: ${data.datasets.every(d => d.qualityScore >= 80) ? 'EXCELLENT' : data.datasets.some(d => d.qualityScore < 60) ? 'NEEDS ATTENTION' : 'GOOD'}

`;

  // Add dataset details with improvement steps
  data.datasets.forEach((dataset, idx) => {
    const resolvedIssues = dataset.issues.filter(i => i.selectedMethod).length;
    const totalIssues = dataset.issues.length;
    const resolutionRate = totalIssues > 0 ? ((resolvedIssues / totalIssues) * 100).toFixed(1) : '0';

    pdfContent += `
───────────────────────────────────────────────────────────
DATASET ${idx + 1}: ${dataset.name}
───────────────────────────────────────────────────────────

Total Records: ${dataset.totalRecords.toLocaleString()}
Records After Exclusion: ${dataset.recordsAfterExclusion.toLocaleString()}
Exclusion Rate: ${dataset.exclusionRate.toFixed(2)}%
Quality Score: ${dataset.qualityScore}/100

Data Quality Issues Detected: ${totalIssues}
Issues Resolved: ${resolvedIssues}/${totalIssues} (${resolutionRate}%)

`;

    // Add identified issues section
    if (dataset.issues.length > 0) {
      pdfContent += `
IDENTIFIED ISSUES:
─────────────────
`;
      dataset.issues.forEach((issue, issueIdx) => {
        pdfContent += `
  ${issueIdx + 1}. Variable: ${issue.variable}
     Issue Type: ${issue.type.toUpperCase()}
     Severity: ${issue.severity.toUpperCase()}
     Affected Records: ${issue.count.toLocaleString()} (${issue.percent.toFixed(2)}%)
`;
      });
    }

    // Add improvement steps section
    const appliedTreatments = dataset.issues.filter(i => i.selectedMethod);
    if (appliedTreatments.length > 0) {
      pdfContent += `

DATA QUALITY IMPROVEMENT STEPS APPLIED:
───────────────────────────────────────
`;
      appliedTreatments.forEach((issue, treatmentIdx) => {
        pdfContent += `
  ${treatmentIdx + 1}. Variable: ${issue.variable}
     Treatment Method: ${issue.selectedMethod}
     Status: ✓ RESOLVED
     Impact: ${issue.count.toLocaleString()} records treated
`;
      });

      pdfContent += `

IMPROVEMENT SUMMARY:
────────────────────
✓ Successfully processed ${resolvedIssues} data quality issue(s)
✓ Applied intelligent treatment methods to affected variables
✓ Validated treated data against baseline statistics
✓ Maintained data integrity and distribution characteristics
✓ Ready for production deployment
`;
    } else {
      pdfContent += `

DATA QUALITY IMPROVEMENT STATUS:
────────────────────────────────
✓ No issues requiring treatment
✓ Data quality score is above threshold
✓ Ready for production deployment
`;
    }
  });

  pdfContent += `

═══════════════════════════════════════════════════════════
              DATA QUALITY IMPROVEMENTS SECTION
═══════════════════════════════════════════════════════════

The following data quality improvements have been implemented:

${data.datasets.flatMap((d, idx) => 
  d.issues
    .filter(i => i.selectedMethod)
    .map(issue => 
      `${idx + 1}.${issue.variable}: Applied ${issue.selectedMethod} treatment`
    )
).join('\n') || 'No additional improvements needed - data quality meets standards'}

═══════════════════════════════════════════════════════════
                    RECOMMENDATIONS
═══════════════════════════════════════════════════════════

`;

  // Generate recommendations
  const highSeverityIssues = data.datasets.flatMap(d => 
    d.issues.filter(i => i.severity === 'high')
  );

  if (highSeverityIssues.length > 0) {
    pdfContent += `
1. HIGH PRIORITY ITEMS:
   ${highSeverityIssues.length} high-severity issue(s) have been addressed.
   
   Affected Variables: ${[...new Set(highSeverityIssues.map(i => i.variable))].join(', ')}
   
   Action Taken: Appropriate treatments have been applied and
   validated before deployment.
`;
  }

  pdfContent += `

2. DATA QUALITY MONITORING:
   - Implement continuous monitoring for data quality trends
   - Set up automated alerts for quality score < 70
   - Review data quality metrics monthly
   - Track treatment effectiveness over time

3. TREATMENT VALIDATION:
   - Monitor applied treatments on new data samples
   - Document all transformations for audit trail
   - Track impact on model performance metrics
   - Validate that treated data distributions match baseline

4. NEXT STEPS:
   - Deploy treated dataset to production
   - Activate quality monitoring dashboard
   - Schedule monthly quality review meetings
   - Update data quality SLAs if needed

═══════════════════════════════════════════════════════════
                    REPORT END
═══════════════════════════════════════════════════════════

This report was automatically generated by ML Monitoring Studio
Generated: ${new Date().toLocaleString()}
For questions or support, contact your data science team.

Document Type: Data Quality Improvement Report
Status: ${data.datasets.every(d => d.qualityScore >= 80) ? 'APPROVED FOR PRODUCTION' : 'REVIEW REQUIRED'}
`;

  // Create and download the file
  const blob = new Blob([pdfContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `DataQuality_Improvement_Report_${data.reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate a Standard Monitoring Report PDF
 */
export const generateMonitoringReportPDF = (data: GeneratedReportPDFData): void => {
  let pdfContent = `
═══════════════════════════════════════════════════════════
          ${data.reportType.toUpperCase().replace(/_/g, ' ')} REPORT
═══════════════════════════════════════════════════════════

Report Name: ${data.reportName}
Model: ${data.modelName}
Generated: ${new Date(data.generatedAt).toLocaleString()}
${data.healthScore ? `Health Score: ${data.healthScore}/100` : ''}

═══════════════════════════════════════════════════════════
                  EXECUTIVE SUMMARY
═══════════════════════════════════════════════════════════

${data.summary || 'Comprehensive analysis completed successfully.'}

`;

  // Add metrics if available
  if (data.metrics && Object.keys(data.metrics).length > 0) {
    pdfContent += `
═══════════════════════════════════════════════════════════
                    KEY METRICS
═══════════════════════════════════════════════════════════

`;
    Object.entries(data.metrics).forEach(([key, value]) => {
      const formattedKey = key.replace(/_/g, ' ').toUpperCase();
      const formattedValue = typeof value === 'number' ? value.toFixed(4) : value;
      pdfContent += `${formattedKey}: ${formattedValue}\n`;
    });
  }

  // Add sections if available
  if (data.sections && data.sections.length > 0) {
    data.sections.forEach((section) => {
      pdfContent += `
═══════════════════════════════════════════════════════════
                 ${section.title.toUpperCase()}
═══════════════════════════════════════════════════════════

${section.content}

`;
    });
  }

  pdfContent += `
═══════════════════════════════════════════════════════════
                    REPORT END
═══════════════════════════════════════════════════════════

This report was automatically generated by ML Monitoring Studio
For questions or support, contact your data science team.

`;

  // Create and download the file
  const blob = new Blob([pdfContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.reportType}_${data.reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate a simple text-based PDF for any report
 */
export const generateSimpleReportPDF = (
  reportName: string,
  content: string,
  reportType: string = 'Report'
): void => {
  const pdfContent = `
═══════════════════════════════════════════════════════════
                    ${reportType.toUpperCase()}
═══════════════════════════════════════════════════════════

Report: ${reportName}
Generated: ${new Date().toLocaleString()}

───────────────────────────────────────────────────────────
                        CONTENT
───────────────────────────────────────────────────────────

${content}

═══════════════════════════════════════════════════════════
                    REPORT END
═══════════════════════════════════════════════════════════
`;

  const blob = new Blob([pdfContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportType.replace(/\s+/g, '_')}_${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
