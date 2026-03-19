Plan: Frontend UI Changes — Model Monitoring Tool
This plan covers 6 phases of frontend-only changes across 3 files: Projects.tsx, DataIngestionStep.tsx, and ModelRegistry.tsx.

Phase 1 — Model Import Changes
1.1 — Remove Segment Variable from Single Model Import form

Projects.tsx ~line 2231: Remove the entire <div> block with label "Segment Variable" and its <input> binding to metadata.segmentVariable
1.2 — Remove Segment Variable from Bulk Import column template

Projects.tsx lines 130–138: Remove 'Segment Variable' string from BULK_OPTIONAL_COLUMNS array
1.3 — Bulk Preview: all columns, 5 rows, always visible

Projects.tsx lines 584–618 (preview table): In <thead>, replace validationResult.presentRequired with a merged array of [...validationResult.presentRequired, ...(validationResult.presentOptional ?? [])] so all detected columns appear
Change .slice(0, 8) → .slice(0, 5) in <tbody> and update the trailing "more rows" message
Projects.tsx lines 505–531: Remove showPreview boolean gate and the "Preview Data / Hide" toggle button — always render the preview block when validationResult.rows.length > 0
1.4 — Full Performance Bad Definition always visible

Projects.tsx ~lines 2295–2301: Remove the {metadata.fullPerf === 'Yes' && (...)} conditional wrapper; render the "Bad Definition" input unconditionally
Phase 2 — Replace "Development" with "Reference"
2.1 — Projects.tsx line 362: environment: 'Development' → environment: 'Reference' (BulkModelUploadStep model creation)

2.2 — Projects.tsx line 5913: environment: 'Development' → environment: 'Reference' (SingleModelImportStep model creation)

2.3 — Projects.tsx ~line 4048: Change label "Development or training dataset" → "Reference dataset"

Phase 3 — Data Ingestion Step
3.1 — Remove "Observation" from Reference Vintage

DataIngestionStep.tsx ~line 356: Change text Observation Vintage Range → Reference Vintage Range
DataIngestionStep.tsx ~lines 979–984: Remove "observation" from the Step 2 sub-description (e.g., "Specify the observation vintage date range..." → "Specify the reference vintage date range...")
3.2 — Remove Minutes & Hours from Custom Performance Window

DataIngestionStep.tsx ~lines 1030–1040: Change the units array from ['Minutes', 'Hours', 'Days', 'Weeks', 'Months', 'Quarters', 'Years'] → ['Days', 'Weeks', 'Months', 'Quarters', 'Years']
3.3 — Remove "Number of Datasets" stat tile from Data Summary (conditional — verify first)

DataIngestionStep.tsx ~lines 1336–1412: Verify if a "Number of datasets" stat card exists. If found, remove it from the summary grid (current code shows Total Rows / Columns / Bad Count / Bad Rate only — may already be absent)
Phase 4 — KPI & Metrics Configuration
4.1 — Add 4 new metrics to KPI_METRICS array (Projects.tsx ~lines 792–990)

New ID	Label	Description	After
change_in_ks	Change in KS%	[(KS_Ref − KS_Val) / KS_Ref] × 100	after ks
r2	R²	R-Squared coefficient of determination	after f1_score
adjusted_r2	Adjusted R²	R-Squared adjusted for number of predictors	after r2
rmse	RMSE	Root Mean Squared Error	after adjusted_r2
4.2 — Update KS metric description to note the inner threshold formula: [(KS_Ref − KS_Val) / KS_Ref]%

4.3 — Redefine metrics shown per data type (Projects.tsx ~lines 1017–1030)

For scored data upload only (8 metrics):
ks, change_in_ks, auc, gini, psi, jsd, rob, mape

For account level data upload (18 metrics):
ks, change_in_ks, auc, gini, psi, jsd, rob, mape, type1_error, type2_error, accuracy, precision, recall, f1_score, r2, adjusted_r2, rmse, hrl

Replace the current showStandard / showFeature flag logic with explicit ID-allowlist filtering per data type. Feature-level metrics (univariate, csi_features, iv, feature_importance, etc.) are effectively removed from view since they don't appear in either list.

Phase 5 — KPI Generation Table
5.1 — Remove Status and Section columns from KPI Results table (Projects.tsx ~lines 5280–5315)

Remove 'Status' and 'Section' from the <thead> column header array
Remove corresponding <td> cells rendering {r.section} and {statusBadge(r.status)} from each row
Final table columns: Metric | Value | Primary KPI | Inner Threshold | Outer Threshold
Phase 6 — Model Repository
6.1 — Remove folder tree from left sidebar (ModelRegistry.tsx)

Find and remove the leftView toggle that switches between "All Models" and folder/tree view
Remove all rendering of the CategoryNode component from the sidebar
Keep only the flat "All Models" list with search
6.2 — Update model display format (ModelRegistry.tsx ~line 621)

Currently: {model_id} — {model.name}
Change to: {projectName} – {model_id} – {model.name}
Identify how project name is accessible from the model's context (via inventoryId, workflow, or global context)
Relevant Files
Projects.tsx — Phases 1, 2, 4, 5
DataIngestionStep.tsx — Phase 3
ModelRegistry.tsx — Phase 6
Verification
Bulk upload: Upload Excel file → preview appears immediately, shows all columns (required + optional), shows exactly 5 rows
Single model form: "Segment Variable" field is absent; "Bad Definition" renders unconditionally
Inspect created model objects: environment is 'Reference' not 'Development'
Custom performance window: only Days / Weeks / Months / Quarters / Years appear
Vintage section: reads "Reference Vintage Range" instead of "Observation Vintage Range"
KPI Module (scored upload only): exactly 8 metrics listed; no feature metrics visible
KPI Module (account level upload): exactly 18 metrics listed
KPI generation results table: no "Status" or "Section" column
ModelRegistry sidebar: no folder tree; models display as ProjectName – ModelID – ModelName
Decisions / Scope Boundaries

"Segment Variable" is removed from UI only, not from the TypeScript data model (non-breaking)
Feature-level metrics (univariate, CSI, IV, SHAP, etc.) are removed from KPI selection — if these are needed in future, they can be re-added to an account-level allowlist
change_in_ks is a new configurable KPI entry (not auto-computed) — the user sets inner/outer thresholds; actual computation is downstream
Phase 3.3 ("Number of datasets") requires confirming the field exists before removing 

Phase 4: In KPI Generation, instead of "Go To Report Configuration", Give Two Options "Complete Reference Data Ingestion" or "Do Ingeston for Another Model" If I select "Do Ingestoin for another model" ask me to choose a model and redo the ingestion + DQ Reporting + KPI & Metrics Config + KPI Generation Steps. 

Phase 5: Create a left navigation pane called Validation similar to Projects (Replicate Projects). Give same ability to create validation by giving validation Name, Descripton. Transfer Entire "Report Configuration", "Schedule Reports" to that tab. Also before these two, copy "Reference Data Ingestion" and rename it "Validation Data Ingestion", similarly copy "Data Quality Reporting" and "KPI & Metrics Configuration" and "KPI Generation" before Report Configuration. Do Not Include Model import in it. 