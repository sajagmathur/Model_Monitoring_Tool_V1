# MIDAS Monitoring — One Slider Pitch
### **M**odel **I**ntelligence, **D**rift & **A**daptive **S**urveillance

---

## Business Problem

> **Production models are degrading undetected. Regulatory teams are scrambling. Risk committees are flying blind.**

Institutions manage **hundreds of AI/ML models** making real-time decisions on credit, fraud, collections, and pricing. Each model is monitored sporadically—often days or weeks after performance has already degraded, decisions have already been harmed, and losses have already materialized.

**The real business impact:**

- 💰 **Silent KPI Drift** — Model performance erodes gradually (accuracy drops 5–15%, approval rates shift, bad rates spike) with no early alert. By the time teams detect the problem manually, the model has already cost the organisation 10–30 days of degraded decisions and unexpected credit/fraud losses.
- 🚨 **No Portfolio Visibility** — Risk teams have zero real-time view across the model portfolio. They rely on fragmented dashboards, Excel files, and ad-hoc reports. When a critical model fails, the business finds out from customer complaints or regulators, not from monitoring.
- 📋 **Regulatory Evidence on Demand** — SR 11-7, Basel IV, and EBA AI Act require documented, time-stamped evidence that models are being monitored and validated. Today, teams manually assemble evidence days/weeks after the fact — and auditors question whether it's credible or complete.
- ⏱️ **Manual Reports = Slow Decisions** — Model risk teams spend 70–80% of time pulling data and formatting reports (SLAs are 5+ business days). Only 20–30% of time goes to actual analysis. Retraining decisions are delayed because the evidence package isn't ready yet.
- 🏛️ **Governance Gaps** — Model expiry dates are missed. Challenger models aren't tracked against champions. Approval workflows are email-based. When regulators ask "who approved this model for production and when," the answer is a 2-week email chain.

---

## Solution: MIDAS

> **Real-time portfolio visibility. AI-powered insights. Regulatory evidence on demand.**

MIDAS brings production models under constant, intelligent surveillance — enabling risk teams to detect degradation in real-time, understand root causes automatically, and generate compliance evidence with one click.

**Core Capabilities** (what's _actually_ missing from competitors):

### 1. **Real-Time Portfolio Health Dashboard** ← *Nobody else has this*
A single-screen view of ALL models with Red/Amber/Green health status. Risk officers open one dashboard and immediately see:
- Which models are degrading NOW (not found out days later in email)
- Which KPIs have shifted (accuracy down 3%, approval rate up 2%, bad rate trending)
- Portfolio-level anomalies (5+ models showing correlated drift = data pipeline issue, not individual model failure)
- Segment-aware analytics (thin-file vs. thick-file models analyzed separately, then portfolio-weighted)

This replaces the nightmare of checking 10 different spreadsheets and dashboards to get a portfolio view.

### 2. **AI-Powered Root Cause Analysis** ← *Competitors show metrics; MIDAS shows WHY*
When KPI drift is detected, MIDAS doesn't just flag it — it automatically investigates:
- Which features changed most (top 5 drift drivers highlighted)
- If this is economic drift (external macro event), data pipeline drift (schema change), or model degradation
- Portfolio patterns (are other similar models affected? suggests systemic issue)
- Recommended action (retrain now vs. monitor longer vs. investigate upstream)

No competitor offers this level of intelligence — Evidently, Arize, and SageMaker just say "drift detected." MIDAS tells you what to DO.

### 3. **Predictive Degradation Alerts** ← *Game-changing capability*
Based on trend analysis, MIDAS predicts when a model will breach thresholds:
- "At current degradation rate, this model will breach the RED threshold in 14 days. Recommend scheduling retraining now."
- Enables proactive retraining schedules instead of reactive firefighting
- Prevents 10–30 days of already-breached-threshold losses

### 4. **One-Click Regulatory Reports** ← *Currently a 5-day manual process*
Instead of assembling evidence manually in Excel/PowerPoint weeks after monitoring, risk teams generate audit-ready reports with one click:
- Timestamped metrics and trends
- Governance workflow history (who approved, when)
- Evidence of model validation at required cadence
- Compliant with SR 11-7, Basel IV, PRA SS1/23 assessment requirements

Reports are generated in < 2 minutes instead of 5–10 business days.

### 5. **Model Governance Automation** ← *Most competitors don't even address this*
- Automated expiry alerts (model review due in 30 days)
- Champion vs. Challenger tracking and promotion workflows
- Approval gates with audit trails (who approved, when, why)
- Model metadata versioning (track when risk tier changed, when next review date was updated, etc.)

Instead of email-based governance (which creates compliance risk), MIDAS enforces structured workflows with immutable audit logs.

### 6. **AI Insights Engine (Ready for LLM Upgrade)** ← *Proprietary architecture*
Pattern-based recommendations across drift, performance, data quality, and anomalies — architected to accept live LLM-generated narratives:
- Automatically detects when feature X drifted in 5 consecutive models (portfolio-level root cause)
- Flags governance calendar misses
- Suggests retraining cadence based on historical model volatility
- Ready to upgrade to LLM-generated natural-language event summaries and risk briefs

---

## Value Proposition

> **MIDAS turns the model monitoring function from a backwards-looking compliance obligation into a forward-looking, AI-driven risk intelligence capability.**

| Dimension | Without MIDAS | With MIDAS |
|---|---|---|
| **Detection Speed** | Drift noticed weeks after impact | Real-time RAG alert on vintage publication |
| **Time to Report** | 3–5 days of manual Excel/PPT assembly | Automated report generated in < 2 minutes |
| **Regulatory Evidence** | Ad-hoc, inconsistent, disputed | Structured, dated, workflow-logged, audit-ready |
| **Governance Visibility** | Siloed per-model, no portfolio view | Cross-portfolio RAG dashboard, C-suite ready |
| **Team Scalability** | 1 analyst per 5–8 models | 1 analyst per 30–50 models (automation handles the rest) |
| **Retraining Decisions** | Reactive, after losses materialise | Proactive, triggered by PSI/KS drift thresholds |
| **Regulatory Alignment** | Manually mapped post-hoc | SR 11-7, Basel IV, EBA AI Act workflows built-in |

**Quantified business case (indicative for a mid-tier bank with 80 production models):**

- **Credit loss reduction:** Early KS degradation detection enabling 30-day faster retraining response → estimated `£1.5–3M` annual credit loss avoidance
- **Analyst productivity:** 60% reduction in report preparation time across the model risk function → 2–3 FTE equivalent savings
- **Regulatory risk mitigation:** Structured audit trail eliminates the risk of MRM findings leading to model use restrictions → avoids potential `£500K–£2M` remediation cost

---

## Competitors

| Vendor | Primary Focus | Limitations vs. MIDAS |
|---|---|---|
| **Fiddler AI** | General ML explainability & monitoring | No banking-specific metric suite (KS, PSI, Gini, CA@10); no governance workflows; no scorecard/collections/fraud model support |
| **Arize AI** | LLM & ML observability for tech companies | Built for tech teams, not risk/compliance users; no regulatory report generation; no champion/challenger governance |
| **Evidently AI** | Open-source data/model quality reports | Report-only, no portfolio dashboard; no scheduling; no RBAC; no audit trail; no banking domain specifics |
| **WhyLabs** | Data quality monitoring | Limited performance metrics; no banking model types; no governance layer |
| **NannyML** | Post-deployment model monitoring (no labels) | Narrow scope (performance estimation only); no data ingestion, reporting, or governance |
| **DataRobot MLOps** | AutoML + MLOps for general use | Heavy, expensive platform; not banking-domain-specialised; requires DataRobot model building ecosystem |
| **AWS SageMaker Model Monitor** | AWS-native drift detection | No portfolio view; no banking metrics; no governance; requires deep AWS expertise to configure; no UI for risk teams |
| **Azure ML Model Monitoring** | Azure-native monitoring | Same limitations as SageMaker; infrastructure tool, not a risk-team product |
| **H2O.ai** | Enterprise MLOps | Complex setup; US-centric; no purpose-built banking model types |
| **Domino Data Lab** | Research & deployment platform | Broad MLOps platform, not monitoring-specialised; very high cost; no banking-specific reporting |

**The key gap across all competitors:** None are designed for **banking model risk teams**. They are all built for ML engineers and data scientists, not for model validators, risk officers, compliance teams, and model sponsors who need regulatory-grade evidence packages, banking-standard metrics, and governance workflows — not just monitoring dashboards.

---

## EXL Differentiation

> **MIDAS is the only model monitoring solution built by bankers for bankers — combining 25 years of EXL domain expertise in risk analytics with a modern, AI-native platform architecture.**

### 1. Banking-Domain Native (Not Adapted — Purpose-Built)
MIDAS natively supports the full banking model taxonomy:
- **Acquisition Scorecards** (KS, PSI, AUC, Gini, CA@10)
- **ECM / Bureau Scorecards** (PSI, Score Migration, Band Stability)
- **Collections Scorecards** (Roll Rate, Flow Rate, Recovery Rate, Cure Rate)
- **Fraud Models** (AUC-PR, Alert Rate, FPR, Precision@5, Fraud Rate in Alerts)
- **Retail Credit / Mortgage / Cards / SME / Commercial** portfolio segmentation
- **Thin File vs. Thick File** segment-level analysis with weighted portfolio aggregation

No competitor supports this breadth of banking model types out-of-the-box.

### 2. RAG Portfolio Intelligence
The portfolio-level Red/Amber/Green health framework is calibrated to **banking regulatory thresholds** (KS ≥ 35% = Green; PSI < 0.10 = Green) — not generic ML quality metrics. Risk Committees can read the dashboard without interpreting metric numbers.

### 3. Regulatory Governance Built-In
The workflow engine enforces the model lifecycle governance required by **SR 11-7 (Fed), Basel IV, and EBA AI Act**:
- Champion/Challenger/Benchmark role management
- Approver-gated promotion workflows (Dev → Staging → Production)
- Governance metadata: approval dates, expiry dates, next review dates, validator ownership
- Immutable, downloadable audit logs for every workflow action

### 4. Generative AI Advantage — Ready to Deploy
MIDAS has a pre-architected AI layer:
- The `insightsEngine` already classifies insights by category (performance, quality, drift, operations, anomaly) and severity — the hook exists to replace rule-based logic with live LLM calls
- Every chart section has an `aiSuggestion` slot for LLM-generated commentary
- The report pipeline can accept LLM-authored narratives without UI changes
- **EXL's investment in proprietary banking LLMs and domain-tuned models** means MIDAS can deliver narrative reports, regulatory summaries, and root-cause analysis written in the language of model risk — not generic tech commentary

### 5. AWS-Native, Zero Infrastructure Complexity
MIDAS runs on AWS ECS Fargate + Step Functions — **no Kubernetes, no in-house container orchestration**. It deploys into a client's existing AWS estate without specialist DevOps teams. This matters for regional banks and insurers who cannot staff a platform engineering team.

### 6. EXL's Embedded Domain Knowledge
EXL brings what no pure technology vendor can:
- **25+ years** of model development and validation experience across retail credit, collections, fraud, and insurance
- **Pre-built threshold calibrations** based on real-world banking model performance benchmarks
- **Report templates** aligned to regulatory expectations for SR 11-7, PRA SS1/23, and BCBS 239 submissions
- **Rapid deployment** — MIDAS connects to a client's model inventory and data warehouse, and delivers first insights within **4–6 weeks** using EXL's proven accelerated onboarding methodology

### 7. End-to-End Ownership — One Vendor, Full Lifecycle
MIDAS is not just a monitoring tool — it is a complete Model Operations platform:

```
[Model Registration] → [Data Ingestion] → [Quality Checks] → 
[Performance Monitoring] → [Drift Detection] → [AI Insights] → 
[Report Generation] → [Scheduling] → [Governance & Audit]
```

EXL owns the full stack, the domain expertise, and the client relationship — eliminating the multi-vendor fragmentation (separate tools for monitoring, reporting, governance, and audit) that most financial institutions currently manage.

---

*Prepared: March 9, 2026 | EXL Analytics | Model Risk & AI Governance Practice*
