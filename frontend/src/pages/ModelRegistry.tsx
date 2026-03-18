import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  User,
  Trash2,
  Upload,
  Download,
  X,
  Edit,
  Save,
  FileJson,
  HardDrive,
  Info,
  FolderOpen,
  Folder,
  FolderPlus,
  List,
  LayoutGrid,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import type { ModelInventory, InventoryLevel } from '../contexts/GlobalContext';
import { useNotification } from '../hooks/useNotification';
import { Breadcrumb } from '../components/UIPatterns';
import { getCreationDescription, createCreationLogEntry } from '../utils/workflowLogger';

interface DisplayModel {
  id: string;
  name: string;
  description: string;
  modelType: string;
  versions: any[];
  lineage: string[];
}

const ModelVersionCard: React.FC<{ version: any; modelName: string; onEdit?: () => void; onDelete?: () => void }> = ({ version, modelName, onEdit, onDelete }) => {
  const { theme } = useTheme();

  // Derive status from stage
  const statusMap: Record<string, 'champion' | 'challenger' | 'archive' | 'deprecated'> = {
    production: 'champion',
    staging: 'challenger',
    dev: 'archive',
  };
  const status = statusMap[version.stage || 'dev'] || 'archive';

  const statusColors = {
    champion: {
      bg: theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100',
      text: theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700',
      border: 'border-yellow-500/30',
    },
    challenger: {
      bg: theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100',
      text: theme === 'dark' ? 'text-blue-400' : 'text-blue-700',
      border: 'border-blue-500/30',
    },
    archive: {
      bg: theme === 'dark' ? 'bg-slate-500/20' : 'bg-slate-100',
      text: theme === 'dark' ? 'text-slate-400' : 'text-slate-700',
      border: 'border-slate-500/30',
    },
    deprecated: {
      bg: theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100',
      text: theme === 'dark' ? 'text-red-400' : 'text-red-700',
      border: 'border-red-500/30',
    },
  };

  const colors = statusColors[status];
  const auc = version.metrics?.auc || 0;

  return (
    <div
      className={`p-4 rounded-lg border ${
        theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
      } hover:shadow-lg transition-all`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {version.version}
            </p>
            <span className={`text-xs font-medium px-2 py-1 rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
              {status}
            </span>
          </div>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            {modelName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-500" />
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Stage:</span>
          <span
            className={`font-medium ${
              version.stage === 'production'
                ? 'text-red-500'
                : version.stage === 'staging'
                ? 'text-yellow-500'
                : 'text-blue-500'
            }`}
          >
            {version.stage?.charAt(0).toUpperCase() + version.stage?.slice(1)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>AUC:</span>
          <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{auc.toFixed(3)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t pb-2 text-xs">
        <User size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
        <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Added from Projects</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Clock size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            {new Date(version.createdAt).toLocaleDateString()}
          </span>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-blue-400' : 'hover:bg-slate-100 text-blue-600'}`}
                title="Edit version"
              >
                <Edit size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-600'}`}
                title="Delete version"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Category sub-folder node (self-contained, stateful)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Recursive helper — counts all registry models under an inventory node (any depth)
function countModelsUnder(invId: string, allInventories: ModelInventory[], allRegistryModels: any[]): number {
  const direct = allRegistryModels.filter(m => m.inventoryId === invId).length;
  const kids = allInventories.filter(i => i.parentId === invId);
  return direct + kids.reduce((sum, child) => sum + countModelsUnder(child.id, allInventories, allRegistryModels), 0);
}

const CategoryNode: React.FC<{
  inventory: ModelInventory;
  allInventories: ModelInventory[];
  isDark: boolean;
  selectedModelId: string | null;
  groupedModels: DisplayModel[];
  registryModels: any[];
  onModelSelect: (id: string) => void;
}> = ({ inventory, allInventories, isDark, selectedModelId, groupedModels, registryModels, onModelSelect }) => {
  const [expanded, setExpanded] = useState(true);

  // Models assigned directly to THIS node (not descendants)
  const directModels = useMemo(() => {
    const names = new Set<string>();
    const result: DisplayModel[] = [];
    registryModels.filter(m => m.inventoryId === inventory.id).forEach(m => {
      if (!names.has(m.name)) {
        names.add(m.name);
        const g = groupedModels.find(g => g.name === m.name);
        if (g) result.push(g);
      }
    });
    return result;
  }, [registryModels, inventory.id, groupedModels]);

  // Direct child folders
  const children = useMemo(
    () => allInventories.filter(inv => inv.parentId === inventory.id),
    [allInventories, inventory.id]
  );

  const totalCount = countModelsUnder(inventory.id, allInventories, registryModels);
  const hasContent = totalCount > 0 || children.length > 0;

  return (
    <div>
      <div
        onClick={() => setExpanded(e => !e)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition ${isDark ? 'hover:bg-slate-700/50 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
      >
        {hasContent
          ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
          : <span className="w-3" />}
        {expanded ? <FolderOpen size={12} className="text-blue-400" /> : <Folder size={12} className="text-blue-400" />}
        <span className="text-xs flex-1 truncate">{inventory.name}</span>
        {inventory.type && !['portfolio','category'].includes(inventory.type) && (
          <span className={`text-[10px] px-1 py-0.5 rounded flex-shrink-0 font-medium ${isDark ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>{inventory.type}</span>
        )}
        <span className={`text-xs px-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>{totalCount}</span>
      </div>
      {expanded && hasContent && (
        <div className="ml-4 border-l pl-2 space-y-0.5" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          {directModels.map(m => (
            <button
              key={m.id}
              onClick={() => onModelSelect(m.id)}
              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left transition ${
                selectedModelId === m.id
                  ? isDark ? 'bg-blue-600/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                  : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Package size={10} className="flex-shrink-0" />
              <span className="truncate">{m.name}</span>
            </button>
          ))}
          {children.map(child => (
            <CategoryNode
              key={child.id}
              inventory={child}
              allInventories={allInventories}
              isDark={isDark}
              selectedModelId={selectedModelId}
              groupedModels={groupedModels}
              registryModels={registryModels}
              onModelSelect={onModelSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type DetailTab = 'overview' | 'artifacts' | 'metadata';

export default function ModelRegistry() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const {
    registryModels, clearRegistryModels, projects,
    createRegistryModel, deleteRegistryModel, updateRegistryModel, createWorkflowLog,
    modelInventories, createModelInventory, deleteModelInventory,
  } = useGlobal();
  const { showNotification } = useNotification();

  // â”€â”€ Left panel view mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [leftView, setLeftView] = useState<'inventory' | 'all'>('inventory');
  const [expandedPortfolios, setExpandedPortfolios] = useState<Set<string>>(new Set());
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  // â”€â”€ Detail tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('overview');

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelVersion, setModelVersion] = useState('v1.0');
  const [modelStage, setModelStage] = useState<'dev' | 'staging' | 'production'>('dev');
  const [importInvId, setImportInvId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const emptyImportForm = {
    modelId: '', domain: '', product: '',
    modelType: '', modelTypeOther: '',
    populationType: '', populationTypeOther: '',
    usage: '', usageOther: '',
    riskTier: '', riskTierOther: '',
    modelStatus: 'Active',
    geography: '', developer: '', segmentVariable: '',
    fullPerf: '', fullPerfBadDef: '',
    ew1: '', ew1BadDef: '',
    ew2: '', ew2BadDef: '',
    approvalDate: '', firstUseDate: '', owner: '',
    lastValidationDate: '', nextReviewDate: '',
    upstreamModels: '', downstreamModels: '',
  };
  const [importForm, setImportForm] = useState({ ...emptyImportForm });
  const setIF = (k: keyof typeof emptyImportForm, v: string) =>
    setImportForm(f => ({ ...f, [k]: v }));
  const closeImportModal = () => {
    setShowImportModal(false);
    setModelFile(null);
    setModelName('');
    setModelVersion('v1.0');
    setSelectedProjectId('');
    setImportInvId('');
    setImportForm({ ...emptyImportForm });
  };

  // â”€â”€ Create inventory modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showCreateInv, setShowCreateInv] = useState(false);
  const [newInvName, setNewInvName] = useState('');
  const [newInvType, setNewInvType] = useState<InventoryLevel>('geography');
  const [newInvParentId, setNewInvParentId] = useState('');
  const [newInvDesc, setNewInvDesc] = useState('');

  // â”€â”€ Assign inventory modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [assignModelId, setAssignModelId] = useState<string | null>(null);
  const [assignInvId, setAssignInvId] = useState('');

  // Auto-select first project when modal opens
  useEffect(() => {
    if (showImportModal && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [showImportModal, projects, selectedProjectId]);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    version: '',
    modelType: 'classification' as 'scorecard' | 'classification' | 'regression' | 'neural_network' | 'decision_tree' | 'ensemble' | 'time_series' | 'clustering' | 'nlp' | 'other' | 'custom',
    stage: 'dev' as 'dev' | 'staging' | 'production',
  });

  const handleClearAll = () => {
    if (registryModels.length === 0) return;
    if (confirm(`Are you sure you want to remove all ${registryModels.length} model(s) and all inventory folders from the repository? This cannot be undone.`)) {
      clearRegistryModels(); // also clears modelInventories (see GlobalContext)
      setSelectedModelId(null);
    }
  };
  const handleEditModel = (model: any) => {
    setEditingModel(model.id);
    setEditFormData({ name: model.name, version: model.version, modelType: model.modelType, stage: model.stage });
  };
  const handleUpdateModel = (modelId: string) => {
    updateRegistryModel(modelId, { name: editFormData.name, version: editFormData.version, modelType: editFormData.modelType, stage: editFormData.stage });
    setEditingModel(null);
    showNotification('âœ“ Model updated', 'success');
  };
  const handleDeleteModel = (modelId: string, name: string) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteRegistryModel(modelId);
      if (selectedModelId === modelId) setSelectedModelId(null);
      showNotification(`Deleted ${name}`, 'success');
    }
  };
  const handleCancelEdit = () => {
    setEditingModel(null);
    setEditFormData({ name: '', version: '', modelType: 'classification' as any, stage: 'dev' });
  };

  // â”€â”€ Inventory handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCreateInventory = () => {
    if (!newInvName.trim()) return;
    createModelInventory({ name: newInvName.trim(), type: newInvType, parentId: newInvParentId || undefined, description: newInvDesc || undefined });
    setShowCreateInv(false);
    setNewInvName(''); setNewInvType('geography'); setNewInvParentId(''); setNewInvDesc('');
    showNotification(`âœ“ Inventory "${newInvName}" created`, 'success');
  };

  const handleAssignInventory = () => {
    if (!assignModelId) return;
    const g = groupedModels.find(m => m.id === assignModelId);
    if (g) {
      registryModels.filter(m => m.name === g.name).forEach(m => {
        updateRegistryModel(m.id, { inventoryId: assignInvId || undefined });
      });
    }
    setAssignModelId(null); setAssignInvId('');
    showNotification('âœ“ Model assigned to inventory', 'success');
  };
  // Group models by name and organize versions
  const groupedModels = useMemo(() => {
    const groups: Record<string, DisplayModel> = {};

    registryModels.forEach((model) => {
      if (!groups[model.name]) {
        groups[model.name] = {
          id: model.id,
          name: model.name,
          description: `${model.modelType} model from project`,
          modelType: model.modelType.charAt(0).toUpperCase() + model.modelType.slice(1),
          versions: [],
          lineage: [],
        };
      }

      groups[model.name].versions.push({
        id: model.id,
        version: model.version,
        stage: model.stage,
        name: model.name,
        modelType: model.modelType,
        metrics: model.metrics,
        createdAt: model.createdAt,
        status: model.status,
      });

      // Build lineage from versions
      groups[model.name].lineage = groups[model.name].versions.map((v) => v.version);
    });

    return Object.values(groups);
  }, [registryModels]);

  // â”€â”€ Inventory computed values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const portfolios = useMemo(() => modelInventories.filter(i => !i.parentId), [modelInventories]);
  const categories = useMemo(() => modelInventories.filter(i => !!i.parentId), [modelInventories]);

  const modelsInInventory = (invId: string): DisplayModel[] => {
    const names = new Set<string>();
    const result: DisplayModel[] = [];
    registryModels.filter(m => m.inventoryId === invId).forEach(m => {
      if (!names.has(m.name)) { names.add(m.name); const g = groupedModels.find(g => g.name === m.name); if (g) result.push(g); }
    });
    return result;
  };

  const unassignedModels = useMemo(() => {
    const assignedNames = new Set(registryModels.filter(m => m.inventoryId).map(m => m.name));
    return groupedModels.filter(m => !assignedNames.has(m.name));
  }, [groupedModels, registryModels]);

  // Find selected model using stable ID lookup
  const selectedModel = useMemo(() => {
    if (!selectedModelId || groupedModels.length === 0) {
      return groupedModels.length > 0 ? groupedModels[0] : null;
    }
    const found = groupedModels.find((m) => m.id === selectedModelId);
    return found || (groupedModels.length > 0 ? groupedModels[0] : null);
  }, [selectedModelId, groupedModels]);

  // Auto-select first model only when it becomes available
  useEffect(() => {
    if (groupedModels.length > 0 && !selectedModelId) {
      setSelectedModelId(groupedModels[0].id);
    }
  }, [groupedModels.length, selectedModelId]);

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Model Repository' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Model Repository</h1>
          <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {registryModels.length} model(s) across {modelInventories.length} inventor{modelInventories.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
          >
            <Upload size={16} /> Import Model
          </button>
          {registryModels.length > 0 && (
            <button
              onClick={handleClearAll}
              title="Remove all models and start fresh"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium border ${isDark ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40 border-red-500/50' : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-300'}`}
            >
              <Trash2 size={16} /> Reset Repository
            </button>
          )}
        </div>
      </div>

      {/* â”€â”€ Two-Column Layout â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* â”€â”€ LEFT PANEL â”€â”€ */}
        <div className={`lg:col-span-1 rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          {/* View toggle */}
          <div className={`flex border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            {([['inventory', 'Inventories', <LayoutGrid size={12} key="ig"/>], ['all', 'All Models', <List size={12} key="li"/>]] as [string, string, React.ReactNode][]).map(([v, label, icon]) => (
              <button
                key={v}
                onClick={() => setLeftView(v as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition border-b-2 ${
                  leftView === v
                    ? isDark ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-blue-500 text-blue-600 bg-blue-50'
                    : isDark ? 'border-transparent text-slate-400 hover:text-slate-300' : 'border-transparent text-slate-600 hover:text-slate-700'
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 17rem)' }}>

            {/* â”€â”€ INVENTORY VIEW â”€â”€ */}
            {leftView === 'inventory' && (
              <>
                <button
                  onClick={() => setShowCreateInv(true)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition mb-2 ${isDark ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'}`}
                >
                  <FolderPlus size={13} /> New Inventory Folder
                </button>

                {portfolios.length === 0 && unassignedModels.length === 0 && (
                  <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Folder size={28} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No models yet</p>
                    <p className="text-xs mt-1 opacity-70">Import models from Projects to get started</p>
                  </div>
                )}

                {/* Portfolio folders */}
                {portfolios.map(portfolio => {
                  const childCats = categories.filter(c => c.parentId === portfolio.id);
                  const directModels = modelsInInventory(portfolio.id);
                  const isExpanded = expandedPortfolios.has(portfolio.id);
                  // Recursive count — walks the full Geography›Domain›Product›ModelType›ModelID›ModelVersion tree
                  const totalCount = countModelsUnder(portfolio.id, modelInventories, registryModels);

                  return (
                    <div key={portfolio.id}>
                      <div className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition ${
                        selectedInventoryId === portfolio.id && !selectedModelId
                          ? isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-700'
                          : isDark ? 'hover:bg-slate-700/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}>
                        <button onClick={() => setExpandedPortfolios(prev => { const s = new Set(prev); s.has(portfolio.id) ? s.delete(portfolio.id) : s.add(portfolio.id); return s; })} className="p-0.5 rounded flex-shrink-0">
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        <button onClick={() => { setSelectedInventoryId(portfolio.id); setSelectedModelId(null); }} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                          {isExpanded ? <FolderOpen size={13} className="flex-shrink-0 text-amber-400" /> : <Folder size={13} className="flex-shrink-0 text-amber-400" />}
                          <span className="text-xs font-medium truncate">{portfolio.name}</span>
                          {portfolio.type && !['portfolio','category'].includes(portfolio.type) && (
                            <span className={`text-[10px] px-1 py-0.5 rounded flex-shrink-0 font-medium ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{portfolio.type}</span>
                          )}
                          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>{totalCount}</span>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm(`Delete inventory "${portfolio.name}"? Models will be unassigned.`)) deleteModelInventory(portfolio.id); }}
                          className={`opacity-0 group-hover:opacity-100 p-0.5 rounded flex-shrink-0 ${isDark ? 'text-red-400 hover:bg-slate-700' : 'text-red-500 hover:bg-red-50'}`}
                          title="Delete folder"
                        ><Trash2 size={11} /></button>
                      </div>

                      {isExpanded && (
                        <div className="ml-5 border-l pl-2 space-y-0.5 mt-0.5" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                          {directModels.map(m => (
                            <button
                              key={m.id}
                              onClick={() => { setSelectedModelId(m.id); setSelectedInventoryId(null); setActiveDetailTab('overview'); }}
                              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left transition ${
                                selectedModelId === m.id
                                  ? isDark ? 'bg-blue-600/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                                  : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <Package size={11} className="flex-shrink-0" />
                              <span className="truncate">{m.name}</span>
                              <span className={`ml-auto flex-shrink-0 text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{m.versions.length}v</span>
                            </button>
                          ))}
                          {childCats.map(child => (
                            <CategoryNode
                              key={child.id}
                              inventory={child}
                              allInventories={modelInventories}
                              isDark={isDark}
                              selectedModelId={selectedModelId}
                              groupedModels={groupedModels}
                              registryModels={registryModels}
                              onModelSelect={id => { setSelectedModelId(id); setSelectedInventoryId(null); setActiveDetailTab('overview'); }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unfoldered models — no inventoryId assigned */}
                {unassignedModels.length > 0 && (
                  <div>
                    <div
                      onClick={() => setSelectedInventoryId(prev => prev === '__unassigned__' ? null : '__unassigned__')}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition ${
                        selectedInventoryId === '__unassigned__'
                          ? isDark ? 'bg-slate-600/30 text-slate-300' : 'bg-slate-100 text-slate-700'
                          : isDark ? 'hover:bg-slate-700/50 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Folder size={13} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                      <span className="text-xs font-medium flex-1">Unfoldered</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{unassignedModels.length}</span>
                    </div>
                    {selectedInventoryId === '__unassigned__' && (
                      <div className="ml-5 border-l pl-2 mt-0.5 space-y-0.5" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        {unassignedModels.map(m => (
                          <button
                            key={m.id}
                            onClick={() => { setSelectedModelId(m.id); setSelectedInventoryId(null); setActiveDetailTab('overview'); }}
                            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left transition ${
                              selectedModelId === m.id
                                ? isDark ? 'bg-blue-600/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                                : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Package size={11} className="flex-shrink-0" />
                            <span className="truncate">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* â”€â”€ ALL MODELS VIEW â”€â”€ */}
            {leftView === 'all' && (
              <>
                {groupedModels.length === 0 ? (
                  <div className={`p-4 rounded-lg border-2 border-dashed text-center mt-2 ${isDark ? 'border-slate-600 bg-slate-900/30' : 'border-slate-300 bg-slate-50'}`}>
                    <Package size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                    <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>No models yet</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Import models from Projects</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {groupedModels.map(model => {
                      const regModel = registryModels.find(r => r.id === model.id);
                      const invName = regModel?.inventoryId ? modelInventories.find(i => i.id === regModel.inventoryId)?.name : null;
                      return (
                        <button
                          key={model.id}
                          onClick={() => { setSelectedModelId(model.id); setActiveDetailTab('overview'); }}
                          className={`w-full text-left p-3 rounded-lg transition border ${
                            selectedModelId === model.id
                              ? isDark ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-blue-50 text-blue-600 border-blue-300'
                              : isDark ? 'text-slate-300 hover:bg-slate-700/30 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <p className="text-sm font-medium truncate">{model.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{model.versions.length}v Â· {model.modelType}</p>
                            {invName && <span className={`text-xs px-1.5 py-0.5 rounded-full ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>{invName}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lg:col-span-3">
          {selectedModel ? (
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              {/* Model header */}
              <div className={`p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedModel.name}
                    </h2>
                    <p className={`mt-0.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {selectedModel.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>{selectedModel.modelType}</span>
                      <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{selectedModel.versions.length} version{selectedModel.versions.length !== 1 ? 's' : ''}</span>
                      {(() => {
                        const regModel = registryModels.find(r => r.id === selectedModel.id);
                        const inv = regModel?.inventoryId ? modelInventories.find(i => i.id === regModel.inventoryId) : null;
                        return inv ? <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>{inv.name}</span> : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setAssignModelId(selectedModel.id); setAssignInvId(registryModels.find(r => r.id === selectedModel.id)?.inventoryId ?? ''); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <FolderOpen size={13} /> Assign to Inventory
                    </button>
                    {selectedModel.versions.length > 0 && (
                      <>
                        <button onClick={() => handleEditModel(selectedModel.versions[0])} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-blue-400' : 'hover:bg-slate-100 text-blue-600'}`} title="Edit">
                          <Edit size={15} />
                        </button>
                        <button onClick={() => handleDeleteModel(selectedModel.versions[0].id, selectedModel.name)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-600'}`} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Tab bar */}
              <div className={`flex border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                {(['overview', 'artifacts', 'metadata'] as DetailTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveDetailTab(tab)}
                    className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition ${
                      activeDetailTab === tab
                        ? isDark ? 'border-blue-500 text-blue-400' : 'border-blue-500 text-blue-600'
                        : isDark ? 'border-transparent text-slate-400 hover:text-slate-300' : 'border-transparent text-slate-600 hover:text-slate-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-5">

                {/* OVERVIEW TAB */}
                {activeDetailTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700/40' : 'bg-slate-50'}`}>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Model Type</p>
                        <p className={`text-base font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedModel.modelType}</p>
                      </div>
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700/40' : 'bg-slate-50'}`}>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Versions</p>
                        <p className={`text-base font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedModel.versions.length}</p>
                      </div>
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700/40' : 'bg-slate-50'}`}>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Lineage Steps</p>
                        <p className={`text-base font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedModel.lineage.length}</p>
                      </div>
                    </div>
                    <h3 className={`text-sm font-semibold pt-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model Versions</h3>
                    <div className="space-y-3">
                      {selectedModel.versions.length > 0 ? selectedModel.versions.map(version => (
                        <React.Fragment key={version.id}>
                          {editingModel === version.id ? (
                            <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Edit {version.version}</h4>
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model Name</label>
                                    <input type="text" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className={`w-full px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                                  </div>
                                  <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Version</label>
                                    <input type="text" value={editFormData.version} onChange={e => setEditFormData({...editFormData, version: e.target.value})} className={`w-full px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model Type</label>
                                    <select value={editFormData.modelType} onChange={e => setEditFormData({...editFormData, modelType: e.target.value as any})} className={`w-full px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                                      <option value="scorecard">Scorecard</option>
                                      <option value="classification">Classification</option>
                                      <option value="regression">Regression</option>
                                      <option value="neural_network">Neural Network</option>
                                      <option value="decision_tree">Decision Tree</option>
                                      <option value="ensemble">Ensemble</option>
                                      <option value="time_series">Time Series</option>
                                      <option value="clustering">Clustering</option>
                                      <option value="nlp">NLP</option>
                                      <option value="other">Other</option>
                                      <option value="custom">Custom</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Stage</label>
                                    <select value={editFormData.stage} onChange={e => setEditFormData({...editFormData, stage: e.target.value as any})} className={`w-full px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                                      <option value="dev">Development</option>
                                      <option value="staging">Staging</option>
                                      <option value="production">Production</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                  <button onClick={handleCancelEdit} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}>Cancel</button>
                                  <button onClick={() => handleUpdateModel(version.id)} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 font-medium ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                                    <Save size={14} /> Save
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <ModelVersionCard
                              version={version}
                              modelName={selectedModel.name}
                              onEdit={() => handleEditModel(version)}
                              onDelete={() => handleDeleteModel(version.id, `${selectedModel.name} ${version.version}`)}
                            />
                          )}
                        </React.Fragment>
                      )) : (
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No versions available.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ARTIFACTS TAB */}
                {activeDetailTab === 'artifacts' && (
                  <div className="space-y-4">
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Upload <code className={`px-1 rounded text-xs ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>model.pkl</code> and{' '}
                      <code className={`px-1 rounded text-xs ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>metrics.json</code> for each version.
                    </p>
                    {selectedModel.versions.map(version => {
                      const regModel = registryModels.find(r => r.id === version.id);
                      if (!regModel) return null;
                      return (
                        <div key={version.id} className={`p-4 rounded-lg border ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {selectedModel.name} — {version.version}
                            {regModel.model_id && <span className={`ml-2 text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>({regModel.model_id})</span>}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model File (.pkl / .onnx / .pmml)</p>
                              {regModel.modelPklFile ? (
                                <div className={`flex items-center gap-2 p-2.5 rounded border ${isDark ? 'bg-green-900/20 border-green-600/30' : 'bg-green-50 border-green-200'}`}>
                                  <HardDrive size={14} className="text-green-500 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium truncate ${isDark ? 'text-green-300' : 'text-green-700'}`}>{regModel.modelPklFile.name}</p>
                                    <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>{(regModel.modelPklFile.size / 1024).toFixed(1)} KB</p>
                                  </div>
                                  {regModel.modelPklFile.dataUrl && (
                                    <a href={regModel.modelPklFile.dataUrl} download={regModel.modelPklFile.name} className={`inline-flex items-center gap-1 cursor-pointer text-xs px-2 py-1 rounded border transition ${isDark ? 'border-blue-600 text-blue-300 hover:bg-blue-900/30' : 'border-blue-400 text-blue-700 hover:bg-blue-100'}`}>
                                      <Download size={12} />Download
                                    </a>
                                  )}
                                  <label className={`cursor-pointer text-xs px-2 py-1 rounded border transition ${isDark ? 'border-green-600 text-green-300 hover:bg-green-900/30' : 'border-green-400 text-green-700 hover:bg-green-100'}`}>
                                    Replace
                                    <input type="file" accept=".pkl,.pickle,.onnx,.pmml,.h5,.pt,.pth" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const dataUrl = URL.createObjectURL(f); updateRegistryModel(regModel.id, { modelPklFile: { name: f.name, path: `/models/${f.name}`, size: f.size, uploadedAt: new Date().toISOString(), dataUrl } }); showNotification(`Model file updated`, 'success'); }} />
                                  </label>
                                </div>
                              ) : (
                                <label className={`cursor-pointer flex items-center gap-2 p-2.5 rounded border-2 border-dashed transition ${isDark ? 'border-slate-600 hover:border-blue-500 hover:bg-blue-500/10' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                                  <Upload size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Upload model.pkl / .onnx / .pmml</span>
                                  <input type="file" accept=".pkl,.pickle,.onnx,.pmml,.h5,.pt,.pth" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const dataUrl = URL.createObjectURL(f); updateRegistryModel(regModel.id, { modelPklFile: { name: f.name, path: `/models/${f.name}`, size: f.size, uploadedAt: new Date().toISOString(), dataUrl } }); showNotification(`Model file uploaded`, 'success'); }} />
                                </label>
                              )}
                            </div>
                            <div>
                              <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Metrics File (metrics.json)</p>
                              {regModel.metricsJsonFile ? (
                                <div className={`flex items-center gap-2 p-2.5 rounded border ${isDark ? 'bg-green-900/20 border-green-600/30' : 'bg-green-50 border-green-200'}`}>
                                  <FileJson size={14} className="text-green-500 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium truncate ${isDark ? 'text-green-300' : 'text-green-700'}`}>{regModel.metricsJsonFile.name}</p>
                                    <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>{(regModel.metricsJsonFile.size / 1024).toFixed(1)} KB</p>
                                  </div>
                                  {regModel.metricsJsonFile.dataUrl && (
                                    <a href={regModel.metricsJsonFile.dataUrl} download={regModel.metricsJsonFile.name} className={`inline-flex items-center gap-1 cursor-pointer text-xs px-2 py-1 rounded border transition ${isDark ? 'border-blue-600 text-blue-300 hover:bg-blue-900/30' : 'border-blue-400 text-blue-700 hover:bg-blue-100'}`}>
                                      <Download size={12} />Download
                                    </a>
                                  )}
                                  <label className={`cursor-pointer text-xs px-2 py-1 rounded border transition ${isDark ? 'border-green-600 text-green-300 hover:bg-green-900/30' : 'border-green-400 text-green-700 hover:bg-green-100'}`}>
                                    Replace
                                    <input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const dataUrl = URL.createObjectURL(f); updateRegistryModel(regModel.id, { metricsJsonFile: { name: f.name, path: `/metrics/${f.name}`, size: f.size, uploadedAt: new Date().toISOString(), dataUrl } }); showNotification(`Metrics file updated`, 'success'); }} />
                                  </label>
                                </div>
                              ) : (
                                <label className={`cursor-pointer flex items-center gap-2 p-2.5 rounded border-2 border-dashed transition ${isDark ? 'border-slate-600 hover:border-green-500 hover:bg-green-500/10' : 'border-slate-300 hover:border-green-400 hover:bg-green-50'}`}>
                                  <Upload size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Upload metrics.json</span>
                                  <input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const dataUrl = URL.createObjectURL(f); updateRegistryModel(regModel.id, { metricsJsonFile: { name: f.name, path: `/metrics/${f.name}`, size: f.size, uploadedAt: new Date().toISOString(), dataUrl } }); showNotification(`Metrics file uploaded`, 'success'); }} />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {selectedModel.versions.some(v => { const rm = registryModels.find(r => r.id === v.id); return rm && (!rm.modelPklFile || !rm.metricsJsonFile); }) && (
                      <div className={`flex items-start gap-2 p-3 rounded-lg ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
                        <Info size={14} className={`flex-shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                        <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Upload artifact files to enable scoring and full monitoring capabilities.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* METADATA TAB */}
                {activeDetailTab === 'metadata' && (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                      <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Governance & Lineage</h3>
                      <div className="space-y-3">
                        <div>
                          <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Version Lineage</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {selectedModel.lineage.map((v, idx) => (
                              <React.Fragment key={v}>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>{v}</span>
                                {idx < selectedModel.lineage.length - 1 && <ChevronRight size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-green-500" />
                          <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Active in Repository</span>
                        </div>
                      </div>
                    </div>
                    {selectedModel.versions.map(version => {
                      const regModel = registryModels.find(r => r.id === version.id);
                      const meta = regModel?.metadata ?? regModel?.bulkMetadata;
                      if (!meta || Object.values(meta).every(v => !v)) return null;

                      const metaSection = (title: string, pairs: [string, string | undefined][]) => {
                        const filtered = pairs.filter(([, v]) => v);
                        if (filtered.length === 0) return null;
                        return (
                          <div key={title} className="mb-3">
                            <p className={`text-xs font-semibold mb-1.5 uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                              {filtered.map(([label, value]) => (
                                <div key={label}>
                                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}: </span>
                                  <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div key={version.id} className={`p-4 rounded-lg border ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <p className={`text-xs font-semibold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Model Metadata — {version.version}
                          </p>
                          {metaSection('Identity', [
                            ['Domain', meta.domain],
                            ['Product', meta.product],
                            ['Population Type', meta.populationType],
                            ['Usage', meta.usage],
                            ['Geography', meta.geography],
                            ['Segment Variable', meta.segmentVariable ?? (meta as any).segment],
                            ['Developer', meta.developer],
                            ['Risk Tier/MRR', meta.riskTier],
                            ['Model Status', meta.modelStatus],
                          ])}
                          {metaSection('Target Specification', [
                            ['Full Performance', meta.fullPerf],
                            ['Full Performance Bad Def', meta.fullPerfBadDef],
                            ['Early Warning 1', meta.ew1],
                            ['Early Warning 1 Bad Def', meta.ew1BadDef],
                            ['Early Warning 2', meta.ew2],
                            ['Early Warning 2 Bad Def', meta.ew2BadDef],
                          ])}
                          {metaSection('Governance', [
                            ['Approval Date', meta.approvalDate],
                            ['First Use Date', meta.firstUseDate],
                            ['Owner', meta.owner],
                            ['Last Validation', meta.lastValidationDate],
                            ['Next Review', meta.nextReviewDate],
                          ])}
                          {metaSection('Interconnectivity', [
                            ['Upstream Models', meta.upstreamModels],
                            ['Downstream Models', meta.downstreamModels],
                          ])}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`flex items-center justify-center h-64 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="text-center">
                <Package size={40} className={`mx-auto mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <p className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {groupedModels.length === 0 ? 'No models in repository' : 'Select a model'}
                </p>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  {groupedModels.length === 0 ? 'Import models from Projects or use bulk upload' : 'Click a model in the left panel'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE INVENTORY MODAL */}
      {showCreateInv && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-xl shadow-xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>New Inventory Folder</h2>
              <button onClick={() => setShowCreateInv(false)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Folder Name *</label>
                <input value={newInvName} onChange={e => setNewInvName(e.target.value)} placeholder="e.g., US Credit Cards" className={`w-full px-3 py-2 rounded-lg border text-sm ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Level *</label>
                <select value={newInvType} onChange={e => setNewInvType(e.target.value as InventoryLevel)} className={`w-full px-3 py-2 rounded-lg border text-sm ${inputCls}`}>
                  <option value="geography">Geography</option>
                  <option value="domain">Domain</option>
                  <option value="product">Product</option>
                  <option value="modelType">Model Type</option>
                  <option value="modelId">Model ID</option>
                  <option value="modelVersion">Model Version</option>
                </select>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Hierarchy: Geography › Domain › Product › Model Type › Model ID › Model Version</p>
              </div>
              {newInvType !== 'geography' && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Parent Folder <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(optional)</span></label>
                  <select value={newInvParentId} onChange={e => setNewInvParentId(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${inputCls}`}>
                    <option value="">-- No parent --</option>
                    {modelInventories.map(p => <option key={p.id} value={p.id}>{p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1) : ''}: {p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Description</label>
                <input value={newInvDesc} onChange={e => setNewInvDesc(e.target.value)} placeholder="Optional description" className={`w-full px-3 py-2 rounded-lg border text-sm ${inputCls}`} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateInv(false)} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>Cancel</button>
                <button onClick={handleCreateInventory} disabled={!newInvName} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${!newInvName ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed' : isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN TO INVENTORY MODAL */}
      {assignModelId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-xl shadow-xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Assign to Inventory</h2>
              <button onClick={() => setAssignModelId(null)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Choose an inventory folder for <span className="font-semibold">{groupedModels.find(m => m.id === assignModelId)?.name ?? assignModelId}</span>.
              </p>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Inventory Folder</label>
                <select value={assignInvId} onChange={e => setAssignInvId(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${inputCls}`}>
                  <option value="">-- Unassigned --</option>
                  {modelInventories.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.type === 'category' ? '  \u2514 ' : ''}{inv.name} ({inv.type})
                    </option>
                  ))}
                </select>
              </div>
              {modelInventories.length === 0 && (
                <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  No inventory folders yet — create one first using "New Inventory Folder".
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAssignModelId(null)} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>Cancel</button>
                <button onClick={handleAssignInventory} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODEL MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`sticky top-0 z-10 p-5 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Import Model</h2>
                <button onClick={closeImportModal} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-6">

              {/* ── SYSTEM ── */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>— System —</p>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Target Project <span className="text-red-400">*</span></label>
                    <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className={inputCls}>
                      <option value="">-- Select Project --</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Model File <span className={`text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>(Optional — upload later in Artifacts tab)</span>
                    </label>
                    <input type="file" accept=".pkl,.pmml,.onnx,.json,.h5" onChange={e => setModelFile(e.target.files?.[0] || null)} className={inputCls} />
                    {modelFile && <p className={`text-xs mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>✓ {modelFile.name} ({(modelFile.size / 1024).toFixed(1)} KB)</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Lifecycle Stage</label>
                      <select value={modelStage} onChange={e => setModelStage(e.target.value as any)} className={inputCls}>
                        <option value="dev">Development</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Assign to Inventory <span className={`text-xs font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(Optional)</span>
                      </label>
                      <select value={importInvId} onChange={e => setImportInvId(e.target.value)} className={inputCls}>
                        <option value="">-- No inventory folder --</option>
                        {modelInventories.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.type ? inv.type.charAt(0).toUpperCase() + inv.type.slice(1) : ''}: {inv.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── MODEL DETAILS ── */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>— Model Details —</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model Name <span className="text-red-400">*</span></label>
                      <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="e.g., Credit Risk Model" className={inputCls} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model ID <span className="text-red-400">*</span></label>
                      <input type="text" value={importForm.modelId} onChange={e => setIF('modelId', e.target.value)} placeholder="e.g., MODEL-001" className={inputCls} />
                    </div>
                  </div>
                  <div className="w-1/2 pr-1.5">
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model Version</label>
                    <input type="text" value={modelVersion} onChange={e => setModelVersion(e.target.value)} placeholder="e.g., v1.0" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* ── IDENTITY ── */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>— Identity —</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Domain <span className="text-red-400">*</span></label>
                      <input type="text" value={importForm.domain} onChange={e => setIF('domain', e.target.value)} placeholder="e.g., Credit Risk" className={inputCls} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Product <span className="text-red-400">*</span></label>
                      <input type="text" value={importForm.product} onChange={e => setIF('product', e.target.value)} placeholder="e.g., Mortgage" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model Type <span className="text-red-400">*</span></label>
                    <select value={importForm.modelType} onChange={e => setIF('modelType', e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      <option value="scorecard">Scorecard</option>
                      <option value="regression">Regression</option>
                      <option value="classification">Classification</option>
                      <option value="neural_network">Neural Network</option>
                      <option value="decision_tree">Decision Tree</option>
                      <option value="ensemble">Ensemble</option>
                      <option value="time_series">Time Series</option>
                      <option value="clustering">Clustering</option>
                      <option value="other">Other</option>
                    </select>
                    {importForm.modelType === 'other' && (
                      <input type="text" value={importForm.modelTypeOther} onChange={e => setIF('modelTypeOther', e.target.value)} placeholder="Specify model type…" className={`${inputCls} mt-1.5`} />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Population Type <span className="text-red-400">*</span></label>
                    <select value={importForm.populationType} onChange={e => setIF('populationType', e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      <option value="Retail">Retail</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Consumer">Consumer</option>
                      <option value="Corporate">Corporate</option>
                      <option value="SME">SME</option>
                      <option value="other">Other</option>
                    </select>
                    {importForm.populationType === 'other' && (
                      <input type="text" value={importForm.populationTypeOther} onChange={e => setIF('populationTypeOther', e.target.value)} placeholder="Specify population type…" className={`${inputCls} mt-1.5`} />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Usage <span className="text-red-400">*</span></label>
                    <select value={importForm.usage} onChange={e => setIF('usage', e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      <option value="Origination">Origination</option>
                      <option value="Account Management">Account Management</option>
                      <option value="Collections">Collections</option>
                      <option value="Pricing">Pricing</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Risk Monitoring">Risk Monitoring</option>
                      <option value="Stress Testing">Stress Testing</option>
                      <option value="other">Other</option>
                    </select>
                    {importForm.usage === 'other' && (
                      <input type="text" value={importForm.usageOther} onChange={e => setIF('usageOther', e.target.value)} placeholder="Specify usage…" className={`${inputCls} mt-1.5`} />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Risk Tier / MRR <span className="text-red-400">*</span></label>
                    <select value={importForm.riskTier} onChange={e => setIF('riskTier', e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      <option value="Tier 1">Tier 1</option>
                      <option value="Tier 2">Tier 2</option>
                      <option value="Tier 3">Tier 3</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="MRR-1">MRR-1</option>
                      <option value="MRR-2">MRR-2</option>
                      <option value="MRR-3">MRR-3</option>
                      <option value="other">Other</option>
                    </select>
                    {importForm.riskTier === 'other' && (
                      <input type="text" value={importForm.riskTierOther} onChange={e => setIF('riskTierOther', e.target.value)} placeholder="Specify risk tier…" className={`${inputCls} mt-1.5`} />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model Status <span className="text-red-400">*</span></label>
                    <select value={importForm.modelStatus} onChange={e => setIF('modelStatus', e.target.value)} className={inputCls}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="In Development">In Development</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Retired">Retired</option>
                      <option value="Deprecated">Deprecated</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Geography</label>
                      <input type="text" value={importForm.geography} onChange={e => setIF('geography', e.target.value)} placeholder="e.g., US, EMEA" className={inputCls} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Developer</label>
                      <input type="text" value={importForm.developer} onChange={e => setIF('developer', e.target.value)} placeholder="Name or team" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Segment Variable</label>
                    <input type="text" value={importForm.segmentVariable} onChange={e => setIF('segmentVariable', e.target.value)} placeholder="e.g., Prime, Near-Prime, Sub-Prime" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* ── TARGET SPECIFICATION ── */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>— Target Specification —</p>
                <p className={`text-xs mb-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>At least one of Full Performance or Early Warning 1 must be specified.</p>
                <div className="space-y-3">
                  {/* Full Performance */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Full Performance</label>
                    <select value={importForm.fullPerf} onChange={e => setIF('fullPerf', e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                    {importForm.fullPerf === 'Yes' && (
                      <div className="mt-2">
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bad Definition</label>
                        <input type="text" value={importForm.fullPerfBadDef} onChange={e => setIF('fullPerfBadDef', e.target.value)} placeholder="e.g., Ever 90+DPD in 12 months" className={inputCls} />
                      </div>
                    )}
                  </div>
                  {/* Early Warning 1 */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Early Warning 1</label>
                    <select value={importForm.ew1} onChange={e => setIF('ew1', e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                    {importForm.ew1 === 'Yes' && (
                      <div className="mt-2">
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bad Definition</label>
                        <input type="text" value={importForm.ew1BadDef} onChange={e => setIF('ew1BadDef', e.target.value)} placeholder="e.g., Ever 30+ in 3 months" className={inputCls} />
                      </div>
                    )}
                  </div>
                  {/* Early Warning 2 (Optional) */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Early Warning 2 <span className={`font-normal text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(Optional)</span></label>
                    <select value={importForm.ew2} onChange={e => setIF('ew2', e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                    {importForm.ew2 === 'Yes' && (
                      <div className="mt-2">
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bad Definition</label>
                        <input type="text" value={importForm.ew2BadDef} onChange={e => setIF('ew2BadDef', e.target.value)} placeholder="e.g., Ever 30+ in 3 months" className={inputCls} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── GOVERNANCE ── */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>— Governance (Optional) —</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Approval Date</label>
                      <input type="date" value={importForm.approvalDate} onChange={e => setIF('approvalDate', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>First Use Date</label>
                      <input type="date" value={importForm.firstUseDate} onChange={e => setIF('firstUseDate', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Owner</label>
                    <input type="text" value={importForm.owner} onChange={e => setIF('owner', e.target.value)} placeholder="Business or model owner name" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Last Validation Date</label>
                      <input type="date" value={importForm.lastValidationDate} onChange={e => setIF('lastValidationDate', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Next Review Date</label>
                      <input type="date" value={importForm.nextReviewDate} onChange={e => setIF('nextReviewDate', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── INTERCONNECTIVITY ── */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>— Interconnectivity (Optional) —</p>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Upstream Models</label>
                    <input type="text" value={importForm.upstreamModels} onChange={e => setIF('upstreamModels', e.target.value)} placeholder="Comma-separated Model IDs" className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Downstream Models</label>
                    <input type="text" value={importForm.downstreamModels} onChange={e => setIF('downstreamModels', e.target.value)} placeholder="Comma-separated Model IDs" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* ── ACTION BUTTONS ── */}
              <div className={`flex gap-3 pt-2 sticky bottom-0 pb-2 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <button onClick={closeImportModal} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}>Cancel</button>
                <button
                  onClick={() => {
                    const effectiveModelType = importForm.modelType === 'other' ? importForm.modelTypeOther : importForm.modelType;
                    const effectivePopType = importForm.populationType === 'other' ? importForm.populationTypeOther : importForm.populationType;
                    const effectiveUsage = importForm.usage === 'other' ? importForm.usageOther : importForm.usage;
                    const effectiveRiskTier = importForm.riskTier === 'other' ? importForm.riskTierOther : importForm.riskTier;
                    if (!selectedProjectId || !modelName || !importForm.modelId || !importForm.domain || !importForm.product || !effectiveModelType || !effectivePopType || !effectiveUsage || !effectiveRiskTier || !importForm.modelStatus) {
                      showNotification('Please fill in all required fields (marked *)', 'error'); return;
                    }
                    if (!importForm.fullPerf && !importForm.ew1) {
                      showNotification('At least one of Full Performance or Early Warning 1 must be specified', 'error'); return;
                    }
                    const project = projects.find(p => p.id === selectedProjectId);
                    if (project) {
                      createWorkflowLog(createCreationLogEntry(project.id, project.name, 'Model Created', getCreationDescription.model(modelName, modelVersion, effectiveModelType, modelStage)));
                    }
                    createRegistryModel({
                      name: modelName,
                      model_id: importForm.modelId || undefined,
                      version: modelVersion || 'v1.0',
                      projectId: selectedProjectId,
                      modelType: (importForm.modelType as any) || 'custom',
                      stage: modelStage,
                      status: 'active',
                      domain: importForm.domain || undefined,
                      metadata: {
                        modelVersion: modelVersion,
                        geography: importForm.geography,
                        domain: importForm.domain,
                        product: importForm.product,
                        populationType: effectivePopType,
                        usage: effectiveUsage,
                        segmentVariable: importForm.segmentVariable,
                        developer: importForm.developer,
                        owner: importForm.owner,
                        riskTier: effectiveRiskTier,
                        modelStatus: importForm.modelStatus,
                        fullPerf: importForm.fullPerf,
                        fullPerfBadDef: importForm.fullPerfBadDef,
                        ew1: importForm.ew1,
                        ew1BadDef: importForm.ew1BadDef,
                        ew2: importForm.ew2,
                        ew2BadDef: importForm.ew2BadDef,
                        approvalDate: importForm.approvalDate,
                        firstUseDate: importForm.firstUseDate,
                        lastValidationDate: importForm.lastValidationDate,
                        nextReviewDate: importForm.nextReviewDate,
                        upstreamModels: importForm.upstreamModels,
                        downstreamModels: importForm.downstreamModels,
                      },
                      inventoryId: importInvId || undefined,
                      ...(modelFile ? { modelPklFile: { name: modelFile.name, path: `/models/${modelFile.name}`, size: modelFile.size, uploadedAt: new Date().toISOString(), dataUrl: URL.createObjectURL(modelFile) } } : {}),
                    });
                    closeImportModal();
                    showNotification(`"${modelName} ${modelVersion}" imported successfully`, 'success');
                  }}
                  disabled={!selectedProjectId || !modelName || !importForm.modelId}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${(!selectedProjectId || !modelName || !importForm.modelId) ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed' : isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                >
                  Import Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

