{
  "version": "3",
  "logVersion": 1,
  "date": "2024-01-28",
  "changes": [
    {
      "type": "feat",
      "scope": "platform",
      "description": "Initial Model Monitoring Studio release",
      "details": [
        "Monitoring-first architecture with 6 canonical governance stages",
        "AWS-managed compute (ECS Fargate, no Kubernetes)",
        "GitHub-native CI/CD with approval workflows",
        "Model registry with version control and governance",
        "Comprehensive drift detection and monitoring",
        "Full RBAC with audit logging",
        "Compliance and fairness tracking"
      ]
    },
    {
      "type": "feat",
      "scope": "frontend",
      "description": "React UI with all core pages",
      "details": [
        "Dashboard with KPI monitoring and alerts",
        "Projects governance workflow",
        "Model repository with version control",
        "Monitoring & drift detection views",
        "Model deployment and tracking",
        "Integration management",
        "Admin panel for RBAC and governance"
      ]
    },
    {
      "type": "feat",
      "scope": "backend",
      "description": "Express API with complete feature set",
      "details": [
        "Projects, pipelines, models, deployments APIs",
        "Immutable audit logging",
        "GitHub integration endpoints",
        "Monitoring and drift detection APIs",
        "Approval workflow management"
      ]
    },
    {
      "type": "feat",
      "scope": "infrastructure",
      "description": "Terraform IaC for AWS deployment",
      "details": [
        "VPC with public/private subnets",
        "RDS PostgreSQL for metadata",
        "ECR repositories for containers",
        "ECS Fargate for serverless compute",
        "ALB for load balancing",
        "S3 for data/models/artifacts",
        "CloudWatch for monitoring",
        "IAM roles with least privilege"
      ]
    },
    {
      "type": "feat",
      "scope": "ci-cd",
      "description": "GitHub Actions workflows",
      "details": [
        "Pipeline validation on PRs",
        "Auto-deploy to dev on main merge",
        "Staging promotion with canary",
        "Production promotion with blue-green",
        "Approval gates and audit logging"
      ]
    },
    {
      "type": "feat",
      "scope": "model-registry",
      "description": "MLflow-based model management",
      "details": [
        "Model registration API",
        "Version management",
        "Promotion workflows",
        "Artifact storage in S3"
      ]
    },
    {
      "type": "feat",
      "scope": "monitoring",
      "description": "Drift detection and observability",
      "details": [
        "Data drift detection (KS test)",
        "Concept drift detection",
        "Prediction drift detection",
        "CloudWatch metrics",
        "Alert rules with SNS"
      ]
    },
    {
      "type": "docs",
      "scope": "documentation",
      "description": "Comprehensive documentation",
      "details": [
        "Architecture overview",
        "Setup and deployment guides",
        "API reference",
        "Contributing guide",
        "Best practices"
      ]
    }
  ]
}
