import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import {
  LayoutDashboard,
  Folder,
  Database,
  Package,
  Menu,
  FileText,
  BarChart3,
  Calendar,
  ClipboardList,
  Brain,
} from 'lucide-react';
import Logo from './Logo';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  requiredRoles?: string[];
  section?: string;
}

const LeftNavigation: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { ingestionJobs = [], projects = [], registryModels = [] } = useGlobal();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Define navigation items
  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: <LayoutDashboard size={20} />,
      section: 'main',
    },
    {
      id: 'projects',
      label: 'Projects',
      path: '/projects',
      icon: <Folder size={20} />,
      section: 'main',
    },
    {
      id: 'model-repository',
      label: 'Model Repository',
      path: '/model-repository',
      icon: <Package size={20} />,
      section: 'workflow',
    },
    {
      id: 'report-configuration',
      label: 'Report Configuration',
      path: '/report-configuration',
      icon: <FileText size={20} />,
      section: 'workflow',
    },
    {
      id: 'report-generation',
      label: 'Report Generation',
      path: '/report-generation',
      icon: <BarChart3 size={20} />,
      section: 'workflow',
    },
    {
      id: 'ai-insights',
      label: 'AI Insights',
      path: '/ai-insights',
      icon: <Brain size={20} />,
      section: 'workflow',
    },
    {
      id: 'datasets',
      label: 'Datasets',
      path: '/datasets',
      icon: <Database size={20} />,
      section: 'management',
    },
    {
      id: 'reports',
      label: 'Reports',
      path: '/reports',
      icon: <FileText size={20} />,
      section: 'management',
    },
    {
      id: 'scheduling',
      label: 'Scheduling',
      path: '/scheduling',
      icon: <Calendar size={20} />,
      section: 'management',
    },
    {
      id: 'logs',
      label: 'Logs',
      path: '/logs',
      icon: <ClipboardList size={20} />,
      section: 'management',
    },
  ];

  const visibleItems = navItems.filter(item => {
    if (!user) return false;
    if (item.requiredRoles && !item.requiredRoles.some(role => user.role === role)) {
      return false;
    }
    return true;
  });

  const isActive = (path: string) => location.pathname === path;

  // Render navigation items
  const renderNavItems = (section?: string) => {
    const items = section 
      ? visibleItems.filter(item => item.section === section)
      : visibleItems;

    return items.map(item => (
      <Link
        key={item.id}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
          isActive(item.path)
            ? theme === 'dark'
              ? 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 text-white border border-blue-400/50'
              : 'bg-gradient-to-r from-blue-400/20 to-purple-400/20 text-slate-900 border border-blue-400/50'
            : theme === 'dark'
            ? 'text-white/70 hover:bg-white/10 hover:text-white'
            : 'text-slate-700 hover:bg-slate-200/50 hover:text-slate-900'
        }`}
      >
        <div className="flex-shrink-0">{item.icon}</div>
        {!isCollapsed && (
          <>
            <span className="text-sm font-medium truncate">{item.label}</span>
            {isActive(item.path) && (
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r ${
                theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'
              }`} />
            )}
          </>
        )}
        {isCollapsed && (
          <div className={`absolute left-full ml-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none ${
            theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-slate-200 text-slate-900'
          }`}>
            {item.label}
          </div>
        )}
      </Link>
    ));
  };

  return (
    <div className={`fixed left-0 top-20 h-[calc(100vh-80px)] flex flex-col transition-all ${
      isCollapsed ? 'w-20' : 'w-64'
    } ${
      theme === 'dark' 
        ? 'bg-slate-900 border-r border-slate-800' 
        : 'bg-white border-r border-slate-200'
    } z-40`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
      }`}>
        {!isCollapsed && <Logo />}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 rounded-lg transition-colors ${
            theme === 'dark' 
              ? 'hover:bg-slate-800 text-white' 
              : 'hover:bg-slate-100 text-slate-900'
          }`}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto">
        {/* Main Section */}
        <div className="space-y-2 px-3 py-4">
          {renderNavItems('main')}
        </div>

        {/* Workflow Section */}
        {!isCollapsed && (
          <div className={`px-3 mb-2 text-xs font-semibold uppercase tracking-wider ${
            theme === 'dark' ? 'text-white/40' : 'text-slate-500'
          }`}>
            Workflow
          </div>
        )}
        <div className="space-y-2 px-3 pb-4">
          {renderNavItems('workflow')}
        </div>

        {/* Management Section */}
        {!isCollapsed && (
          <div className={`px-3 mb-2 text-xs font-semibold uppercase tracking-wider ${
            theme === 'dark' ? 'text-white/40' : 'text-slate-500'
          }`}>
            Management
          </div>
        )}
        <div className="space-y-2 px-3 pb-4">
          {renderNavItems('management')}
        </div>
      </div>

      {/* Footer */}
      <div className={`border-t p-4 transition-colors ${
        theme === 'dark' 
          ? 'border-slate-800 bg-slate-800/50' 
          : 'border-slate-200 bg-slate-50'
      }`}>
        {!isCollapsed && user && (
          <div className="text-xs text-center">
            <p className={`font-medium truncate ${
              theme === 'dark' ? 'text-white/80' : 'text-slate-900'
            }`}>
              {user.name}
            </p>
            <p className={`capitalize text-xs ${
              theme === 'dark' ? 'text-white/60' : 'text-slate-600'
            }`}>
              {user.role}
            </p>
          </div>
        )}
        {isCollapsed && user && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
            theme === 'dark' 
              ? 'bg-blue-600 text-white' 
              : 'bg-blue-500 text-white'
          }`}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftNavigation;
