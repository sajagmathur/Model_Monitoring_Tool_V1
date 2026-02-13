import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

// Load environment variables
dotenv.config();

const logger = pino();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  logger.info({ requestId, method: req.method, path: req.path }, 'Incoming request');
  res.locals.requestId = requestId;
  next();
});

// ============ TYPES ============
interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  environment: 'dev' | 'staging' | 'prod';
  createdAt: Date;
  updatedAt: Date;
  githubRepo?: string;
  status: 'active' | 'inactive';
}

interface Pipeline {
  id: string;
  projectId: string;
  name: string;
  version: string;
  nodes: PipelineNode[];
  createdAt: Date;
  updatedAt: Date;
  lockedNodes: string[];
  githubPath: string;
  status: 'draft' | 'validated' | 'active';
}

interface PipelineNode {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  locked?: boolean;
  inputs?: string[];
  outputs?: string[];
}

interface Model {
  id: string;
  name: string;
  version: string;
  mlflowUri: string;
  registryPath: string;
  environment: 'dev' | 'staging' | 'prod';
  status: 'registered' | 'deployed' | 'retired';
  metrics: Record<string, number>;
  createdAt: Date;
}

interface Deployment {
  id: string;
  modelId: string;
  environment: 'dev' | 'staging' | 'prod';
  ecsTaskArn: string;
  ecsServiceName: string;
  containerImage: string;
  status: 'deploying' | 'active' | 'failed' | 'rolling_back';
  approvals: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============ IN-MEMORY STORAGE (Replace with RDS in production) ============
const projects = new Map<string, Project>();
const pipelines = new Map<string, Pipeline>();
const models = new Map<string, Model>();
const deployments = new Map<string, Deployment>();
const auditLogs: Array<{ id: string; action: string; user: string; resource: string; timestamp: Date; details: any }> = [];

// ============ PROJECTS ROUTES ============
app.get('/api/projects', (req: Request, res: Response) => {
  try {
    const projectList = Array.from(projects.values());
    res.json({ success: true, data: projectList });
    logger.info(`Retrieved ${projectList.length} projects`);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

app.post('/api/projects', (req: Request, res: Response) => {
  try {
    const { name, description, owner, environment, githubRepo } = req.body;
    
    if (!name || !owner) {
      return res.status(400).json({ error: 'Name and owner are required' });
    }

    const id = uuidv4();
    const project: Project = {
      id,
      name,
      description,
      owner,
      environment: environment || 'dev',
      githubRepo,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    projects.set(id, project);
    auditLog('CREATE', owner, 'project', id, { project });

    res.status(201).json({ success: true, data: project });
    logger.info({ projectId: id }, 'Project created');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.get('/api/projects/:id', (req: Request, res: Response) => {
  try {
    const project = projects.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve project' });
  }
});

app.put('/api/projects/:id', (req: Request, res: Response) => {
  try {
    const project = projects.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = { ...project, ...req.body, updatedAt: new Date() };
    projects.set(req.params.id, updated);
    auditLog('UPDATE', req.body.user || 'system', 'project', req.params.id, { changes: req.body });

    res.json({ success: true, data: updated });
    logger.info({ projectId: req.params.id }, 'Project updated');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', (req: Request, res: Response) => {
  try {
    if (!projects.has(req.params.id)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    projects.delete(req.params.id);
    auditLog('DELETE', req.body.user || 'system', 'project', req.params.id, {});
    res.json({ success: true, message: 'Project deleted' });
    logger.info({ projectId: req.params.id }, 'Project deleted');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ============ PIPELINES ROUTES ============
app.get('/api/pipelines/:projectId', (req: Request, res: Response) => {
  try {
    const projectPipelines = Array.from(pipelines.values())
      .filter(p => p.projectId === req.params.projectId);
    res.json({ success: true, data: projectPipelines });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve pipelines' });
  }
});

app.post('/api/pipelines', (req: Request, res: Response) => {
  try {
    const { projectId, name, nodes } = req.body;
    
    if (!projectId || !name || !nodes) {
      return res.status(400).json({ error: 'projectId, name, and nodes are required' });
    }

    const id = uuidv4();
    const pipeline: Pipeline = {
      id,
      projectId,
      name,
      version: '1.0.0',
      nodes,
      lockedNodes: [],
      githubPath: `pipelines/${projectId}/${name}/pipeline.json`,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    pipelines.set(id, pipeline);
    auditLog('CREATE', req.body.user || 'system', 'pipeline', id, { pipeline });

    res.status(201).json({ success: true, data: pipeline });
    logger.info({ pipelineId: id }, 'Pipeline created');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
});

app.get('/api/pipelines/:projectId/:pipelineId', (req: Request, res: Response) => {
  try {
    const pipeline = pipelines.get(req.params.pipelineId);
    if (!pipeline || pipeline.projectId !== req.params.projectId) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }
    res.json({ success: true, data: pipeline });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve pipeline' });
  }
});

app.post('/api/pipelines/:pipelineId/lock', (req: Request, res: Response) => {
  try {
    const pipeline = pipelines.get(req.params.pipelineId);
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    const { nodeIds, user } = req.body;
    if (!nodeIds || !Array.isArray(nodeIds)) {
      return res.status(400).json({ error: 'nodeIds array is required' });
    }

    pipeline.lockedNodes = [...new Set([...pipeline.lockedNodes, ...nodeIds])];
    pipeline.updatedAt = new Date();
    pipelines.set(req.params.pipelineId, pipeline);
    auditLog('LOCK_NODES', user || 'system', 'pipeline', req.params.pipelineId, { nodeIds });

    res.json({ success: true, data: { pipeline, message: 'Nodes locked' } });
    logger.info({ pipelineId: req.params.pipelineId, nodeIds }, 'Pipeline nodes locked');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to lock nodes' });
  }
});

app.post('/api/pipelines/:pipelineId/run', (req: Request, res: Response) => {
  try {
    const pipeline = pipelines.get(req.params.pipelineId);
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    const executionId = uuidv4();
    auditLog('RUN_PIPELINE', req.body.user || 'system', 'pipeline', req.params.pipelineId, { 
      executionId,
      trigger: req.body.trigger || 'manual'
    });

    res.json({ 
      success: true, 
      data: { 
        executionId,
        pipelineId: req.params.pipelineId,
        status: 'queued',
        message: 'Pipeline execution started'
      } 
    });
    logger.info({ pipelineId: req.params.pipelineId, executionId }, 'Pipeline execution started');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to run pipeline' });
  }
});

// ============ MODELS ROUTES ============
app.get('/api/models', (req: Request, res: Response) => {
  try {
    const modelList = Array.from(models.values());
    res.json({ success: true, data: modelList });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve models' });
  }
});

app.post('/api/models/register', (req: Request, res: Response) => {
  try {
    const { name, version, mlflowUri, metrics, user } = req.body;
    
    if (!name || !version || !mlflowUri) {
      return res.status(400).json({ error: 'name, version, and mlflowUri are required' });
    }

    const id = uuidv4();
    const model: Model = {
      id,
      name,
      version,
      mlflowUri,
      registryPath: `s3://mlops-studio-models/${name}/${version}`,
      environment: 'dev',
      status: 'registered',
      metrics: metrics || {},
      createdAt: new Date(),
    };

    models.set(id, model);
    auditLog('REGISTER_MODEL', user || 'system', 'model', id, { model });

    res.status(201).json({ success: true, data: model });
    logger.info({ modelId: id, name }, 'Model registered');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to register model' });
  }
});

app.post('/api/models/:id/promote', (req: Request, res: Response) => {
  try {
    const model = models.get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const { toEnvironment, approvals, user } = req.body;
    if (!toEnvironment) {
      return res.status(400).json({ error: 'toEnvironment is required' });
    }

    if (approvals && approvals.length < 2) {
      return res.status(400).json({ error: 'At least 2 approvals required for production promotion' });
    }

    const validEnvs = ['dev', 'staging', 'prod'];
    if (!validEnvs.includes(toEnvironment)) {
      return res.status(400).json({ error: 'Invalid environment' });
    }

    model.environment = toEnvironment;
    models.set(req.params.id, model);
    auditLog('PROMOTE_MODEL', user || 'system', 'model', req.params.id, { 
      toEnvironment, 
      approvals: approvals?.length || 0 
    });

    res.json({ 
      success: true, 
      data: { 
        model, 
        message: `Model promoted to ${toEnvironment}` 
      } 
    });
    logger.info({ modelId: req.params.id, toEnvironment }, 'Model promoted');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to promote model' });
  }
});

// ============ DEPLOYMENTS ROUTES ============
app.get('/api/deployments', (req: Request, res: Response) => {
  try {
    const deploymentList = Array.from(deployments.values());
    res.json({ success: true, data: deploymentList });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve deployments' });
  }
});

app.post('/api/deployments', (req: Request, res: Response) => {
  try {
    const { modelId, environment, containerImage, user } = req.body;
    
    if (!modelId || !environment || !containerImage) {
      return res.status(400).json({ error: 'modelId, environment, and containerImage are required' });
    }

    const model = models.get(modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const id = uuidv4();
    const deployment: Deployment = {
      id,
      modelId,
      environment,
      containerImage,
      ecsTaskArn: `arn:aws:ecs:us-east-1:123456789012:task/mlops-${environment}/${uuidv4()}`,
      ecsServiceName: `mlops-inference-${model.name}-${environment}`,
      status: 'deploying',
      approvals: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    deployments.set(id, deployment);
    auditLog('CREATE_DEPLOYMENT', user || 'system', 'deployment', id, { deployment });

    res.status(201).json({ success: true, data: deployment });
    logger.info({ deploymentId: id, modelId }, 'Deployment created');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to create deployment' });
  }
});

app.post('/api/deployments/:id/rollback', (req: Request, res: Response) => {
  try {
    const deployment = deployments.get(req.params.id);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    deployment.status = 'rolling_back';
    deployment.updatedAt = new Date();
    deployments.set(req.params.id, deployment);
    auditLog('ROLLBACK_DEPLOYMENT', req.body.user || 'system', 'deployment', req.params.id, { reason: req.body.reason });

    res.json({ success: true, data: { deployment, message: 'Rollback initiated' } });
    logger.info({ deploymentId: req.params.id }, 'Deployment rollback initiated');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to rollback deployment' });
  }
});

// ============ MONITORING ROUTES ============
app.get('/api/monitoring/drift/:modelId', (req: Request, res: Response) => {
  try {
    const model = models.get(req.params.modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const driftMetrics = {
      modelId: req.params.modelId,
      dataDrift: {
        detected: Math.random() > 0.7,
        score: Math.random() * 100,
        features: ['feature_1', 'feature_2'],
        lastCheck: new Date(),
      },
      conceptDrift: {
        detected: Math.random() > 0.8,
        score: Math.random() * 100,
        lastCheck: new Date(),
      },
      predictionDrift: {
        detected: Math.random() > 0.75,
        score: Math.random() * 100,
        lastCheck: new Date(),
      },
    };

    res.json({ success: true, data: driftMetrics });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve drift metrics' });
  }
});

app.get('/api/monitoring/alerts', (req: Request, res: Response) => {
  try {
    const alerts = [
      { id: uuidv4(), severity: 'warning', message: 'Data drift detected', timestamp: new Date() },
      { id: uuidv4(), severity: 'info', message: 'Pipeline execution completed', timestamp: new Date() },
    ];
    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

// ============ GITHUB INTEGRATIONS ROUTES ============
app.post('/api/integrations/github/connect', (req: Request, res: Response) => {
  try {
    const { code, state, user } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // In production, exchange code for token with GitHub
    const githubToken = `ghs_${uuidv4()}`;
    auditLog('GITHUB_CONNECT', user || 'system', 'integration', 'github', { code });

    res.json({ 
      success: true, 
      data: { 
        provider: 'github',
        status: 'connected',
        message: 'GitHub connected successfully'
      } 
    });
    logger.info({ user }, 'GitHub integration connected');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to connect GitHub' });
  }
});

app.get('/api/integrations/github/repos', (req: Request, res: Response) => {
  try {
    // In production, fetch from GitHub API
    const repos = [
      { id: '1', name: 'ml-models', owner: 'org', branch: 'main', lastSync: new Date() },
      { id: '2', name: 'data-pipelines', owner: 'org', branch: 'develop', lastSync: new Date() },
    ];
    res.json({ success: true, data: repos });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve repositories' });
  }
});

// ============ AUDIT LOG ROUTES ============
app.get('/api/audit-logs', (req: Request, res: Response) => {
  try {
    const logs = auditLogs.slice(-100); // Last 100 logs
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// ============ HEALTH CHECK ============
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// ============ ERROR HANDLING ============
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ============ HELPER FUNCTIONS ============
function auditLog(action: string, user: string, resource: string, resourceId: string, details: any) {
  auditLogs.push({
    id: uuidv4(),
    action,
    user,
    resource,
    timestamp: new Date(),
    details,
  });
}

// ============ SERVER STARTUP ============
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'MLOps Studio Backend started');
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`📊 API Docs: http://localhost:${PORT}/api`);
});

export default app;
