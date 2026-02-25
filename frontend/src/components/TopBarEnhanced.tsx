import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { useNotification } from '../hooks/useNotification';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  MessageSquare,
  HelpCircle,
  User,
  Moon,
  Sun,
  Globe,
  LogOut,
  Settings,
  ChevronDown,
  X,
  Send,
  FileText,
  Zap,
  Database,
} from 'lucide-react';
import Logo from './Logo';

interface SearchResult {
  id: string;
  title: string;
  type: 'project' | 'pipeline' | 'job' | 'navigation';
  route?: string;
}

interface Notification {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const TopBarEnhanced: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatWelcomed, setChatWelcomed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [userSettings, setUserSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    dataCollection: true,
    twoFactor: false,
  });

  // Load notifications and user profile (avatar) on mount
  useEffect(() => {
    const stored = localStorage.getItem('notifications');
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch (e) {
        // ignore
      }
    }

    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setUserAvatar(profile.avatar);
      } catch (e) {
        // ignore
      }
    }

    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setUserSettings(settings);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Functional search across app items
  const performSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search navigation items
    const navItems = [
      { title: 'Dashboard', type: 'navigation' as const, route: '/' },
      { title: 'Projects', type: 'navigation' as const, route: '/projects' },
      { title: 'Data Ingestion', type: 'navigation' as const, route: '/data-ingestion' },
      { title: 'Data Preparation', type: 'navigation' as const, route: '/data-preparation' },
      { title: 'Model Registry', type: 'navigation' as const, route: '/model-registry' },
      { title: 'Deployment', type: 'navigation' as const, route: '/deployment' },
      { title: 'Inferencing', type: 'navigation' as const, route: '/inferencing' },
      { title: 'Monitoring', type: 'navigation' as const, route: '/monitoring' },
      { title: 'Pipelines', type: 'navigation' as const, route: '/pipelines' },
      { title: 'Manual Approval', type: 'navigation' as const, route: '/manual-approval' },
    ];

    navItems.forEach(item => {
      if (item.title.toLowerCase().includes(q)) {
        results.push({
          id: `nav-${item.route}`,
          title: item.title,
          type: 'navigation',
          route: item.route,
        });
      }
    });

    // Search projects from localStorage
    try {
      const projectsData = localStorage.getItem('projects');
      if (projectsData) {
        const projects = JSON.parse(projectsData);
        if (Array.isArray(projects)) {
          projects.forEach((p: any) => {
            if (p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)) {
              results.push({
                id: `project-${p.id}`,
                title: `Project: ${p.name}`,
                type: 'project',
                route: '/projects',
              });
            }
          });
        }
      }
    } catch (e) {
      // ignore
    }

    // Search pipelines from localStorage
    try {
      const pipelinesData = localStorage.getItem('pipelines');
      if (pipelinesData) {
        const pipelines = JSON.parse(pipelinesData);
        if (Array.isArray(pipelines)) {
          pipelines.forEach((p: any) => {
            if (p.name.toLowerCase().includes(q)) {
              results.push({
                id: `pipeline-${p.id}`,
                title: `Pipeline: ${p.name}`,
                type: 'pipeline',
                route: '/pipelines',
              });
            }
          });
        }
      }
    } catch (e) {
      // ignore
    }

    setSearchResults(results.slice(0, 8)); // Limit to 8 results
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    performSearch(query);
  };

  const handleSearchSelect = (result: SearchResult) => {
    if (result.route) {
      navigate(result.route);
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleSettingChange = (key: keyof typeof userSettings) => {
    const newSettings = {
      ...userSettings,
      [key]: !userSettings[key],
    };
    setUserSettings(newSettings);
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
  };

  const getBotReply = (message: string): string => {
    const msg = message.toLowerCase();

    if (msg.includes('attention') || (msg.includes('need') && msg.includes('monitor'))) {
      return '**Models requiring attention:**\n\n**ACQ-ML-003** — PSI = 0.052 (approaching 0.1 threshold). Distribution drift detected.\n\n**ECM-LIMIT-001** — PSI = 0.031 (moderate). KS = 0.388, slightly below peers.\n\n**Action items:**\n• Review ACQ-ML-003 input variable distributions\n• Consider recalibration if PSI exceeds 0.1\n• Monitor ECM model for further degradation';
    }
    if (msg.includes('rag') || (msg.includes('red') && msg.includes('amber')) || (msg.includes('status') && msg.includes('mean'))) {
      return '**RAG Status Indicators:**\n\n🟢 **Green** — Model performing well\n• KS > 0.4 AND PSI < 0.1\n\n🟡 **Amber** — Warning, needs monitoring\n• KS 0.3–0.4 OR PSI 0.1–0.25\n\n🔴 **Red** — Action required\n• KS < 0.3 OR PSI > 0.25\n\nMost models are currently Green. ECM-LIMIT-001 is Amber.';
    }
    if (msg.includes('compare') && msg.includes('portfolio')) {
      return '**Portfolio Comparison:**\n\n**Acquisition** (3 models)\n• Best: ACQ-RET-002 — KS: 0.523, AUC: 0.876\n• Watch: ACQ-ML-003 — PSI elevated at 0.052\n\n**ECM** (1 model)\n• ECM-LIMIT-001 — KS: 0.388, needs improvement\n\n**Collections** (1 model)\n• COL-RISK-001 — KS: 0.412\n\n**Fraud** (1 model)\n• FRD-TXN-001 — KS: 0.623, 89% detection rate\n\n**Winner:** Fraud portfolio leads in performance';
    }
    if ((msg.includes('explain') || msg.includes('what')) && msg.includes('ks') && msg.includes('psi')) {
      return '**KS (Kolmogorov-Smirnov):**\nMeasures how well the model separates good vs bad customers.\n• Target: > 0.4 (good), > 0.5 (excellent)\n\n**PSI (Population Stability Index):**\nMeasures how much the scored population has drifted.\n• < 0.1 stable, 0.1–0.25 monitor, > 0.25 action required\n\n**Together:** KS shows if model works, PSI shows if population changed. Both stable = healthy model!';
    }
    if (msg.includes('ks') && !msg.includes('psi')) {
      return 'KS (Kolmogorov-Smirnov) measures the maximum separation between cumulative distributions of good and bad customers. Values above 0.4 indicate good discrimination. Most portfolio models show KS between 0.38–0.62.';
    }
    if (msg.includes('psi') && !msg.includes('ks')) {
      return 'PSI (Population Stability Index) measures distribution drift. PSI < 0.1 is stable, 0.1–0.25 needs monitoring, > 0.25 requires action. Current models show PSI from 0.018 to 0.052 — stable populations overall.';
    }
    if (msg.includes('auc') || msg.includes('roc')) {
      return 'AUC (Area Under ROC Curve) ranges from 0.5 (random) to 1.0 (perfect). Values above 0.7 are acceptable, above 0.8 are good. The fraud model achieves 0.91 AUC — outstanding performance.';
    }
    if (msg.includes('gini')) {
      return 'Gini coefficient = 2×AUC − 1, ranging from 0 to 1. Values above 0.6 are good. It represents the area between the Lorenz curve and the diagonal, indicating model lift over random.';
    }
    if (msg.includes('rob_test')) {
      return '**ROB_test (Rank Order Break):**\nMeasures when a model\'s predictions deviate from expected rank ordering on new data. ROB_test indicates potential model degradation or distribution shift.\n\n• **Low ROB_test**: Model maintains consistent ranking\n• **High ROB_test**: Model predictions diverging from baseline behavior\n\nROB_test is critical for detecting when models no longer discriminate properly between good and bad cases.';
    }
    if ((msg.includes('model') || msg.includes('which')) && msg.includes('perform')) {
      return '**ACQ-RET-002** (ML) shows the best overall performance with KS=0.523 and AUC=0.876. **FRD-TXN-001** (Fraud) excels with KS=0.623 and 89% fraud detection rate. All models maintain stable PSI values.';
    }
    if (msg.includes('best') || msg.includes('top')) {
      return '**Top 3 Models:**\n1. **FRD-TXN-001** (Fraud) — KS: 0.623, AUC: 0.912\n2. **ACQ-RET-002** (ML) — KS: 0.523, AUC: 0.876\n3. **ACQ-ML-003** (ML) — KS: 0.499, AUC: 0.857 (watch PSI)\n\nAll three show strong discrimination with KS > 0.49';
    }
    if (msg.includes('worst') || msg.includes('poor')) {
      return '**Models needing improvement:**\n• **ECM-LIMIT-001** — KS: 0.388 (below 0.4 threshold)\n• Moderate discrimination, consider enhancement\n• PSI: 0.031 (acceptable)\n\nNot necessarily bad, but has room for optimisation.';
    }
    if (msg.includes('trend')) {
      return 'Trend analysis shows stable KS performance across vintages for most models. PSI has slightly increased for ACQ-ML-003, suggesting potential distribution drift that requires monitoring.';
    }
    if (msg.includes('segment')) {
      return 'Segment analysis shows that **thick_file** segments consistently outperform **thin_file** segments. For ACQ-RET-001: thick_file KS=0.492 vs thin_file KS=0.388 — highlighting the importance of segment-level monitoring.';
    }
    if (msg.includes('recommendation') || msg.includes('recommend') || msg.includes('action')) {
      return '**Key recommendations:**\n1. Monitor ACQ-ML-003 closely (PSI=0.052, approaching threshold)\n2. Investigate thick_file vs thin_file performance gaps\n3. Leverage FRD-TXN-001 as best-practice benchmark\n4. Consider ECM-LIMIT-001 enhancements to improve KS\n5. Maintain current strategies for all stable models';
    }
    if (msg.includes('fraud')) {
      return '**Fraud Model (FRD-TXN-001):**\n• KS: 0.623 (excellent)\n• AUC: 0.912 (outstanding)\n• Fraud detection rate: 89.45%\n• False positive rate: 2.34% (very low)\n• PSI: 0.019 (very stable)\n\nBest performing model in the portfolio.';
    }
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('help')) {
      return 'Hello! I am your Model Monitoring assistant. I can help you with:\n• **Metrics**: KS, PSI, AUC, Gini, ROB_test\n• **Models**: Which models need attention?\n• **RAG Status**: What do the colour indicators mean?\n• **Portfolios**: Compare portfolio performance\n• **Trends**: Drift and performance over time\n\nWhat would you like to know?';
    }
    return `I understand you are asking about "${message}". I can discuss:\n• KS, PSI, AUC, Gini, ROB_test metrics\n• Model performance comparisons\n• RAG status meanings\n• Portfolio analysis\n• Models needing attention\n\nTry: "Which models need attention?" or "What is ROB_test?"`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    const reply = getBotReply(userMsg);
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: reply },
    ]);
    setChatInput('');
    setTimeout(() => {
      const chatContainer = document.getElementById('chat-messages-panel');
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 0);
  };

  const handleSuggestion = (query: string) => {
    const reply = getBotReply(query);
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: query },
      { role: 'assistant', content: reply },
    ]);
    setTimeout(() => {
      const chatContainer = document.getElementById('chat-messages-panel');
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 0);
  };
  const unreadNotifications = notifications.filter(n => !localStorage.getItem(`read-${n.id}`)).length;

  return (
    <div className={`${theme === 'dark' ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white' : 'bg-gradient-to-r from-blue-50 to-gray-50 text-slate-900'} border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'} sticky top-0 z-40 shadow-sm`}>
      <div className="flex items-center justify-between px-6 py-3 gap-4">
        {/* Logo */}
        <Logo />

        {/* Search Bar - Functional */}
        <div className="flex-1 max-w-lg relative">
          <form onSubmit={(e) => { e.preventDefault(); performSearch(searchQuery); }}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50 border border-slate-600' : 'bg-white border border-gray-300'} transition-all hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                placeholder={t('search')}
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setShowSearch(true)}
                className={`flex-1 bg-transparent outline-none text-sm ${theme === 'dark' ? 'placeholder-gray-500' : 'placeholder-gray-400'}`}
              />
            </div>
          </form>

          {/* Search Results Dropdown */}
          {showSearch && searchResults.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-2 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'} rounded-lg shadow-lg overflow-hidden`}>
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSearchSelect(result)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                >
                  {result.type === 'navigation' && <Zap size={16} className="text-blue-400" />}
                  {result.type === 'project' && <FileText size={16} className="text-green-400" />}
                  {result.type === 'pipeline' && <Database size={16} className="text-purple-400" />}
                  <span className="text-sm">{result.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* LLM Chat */}
          <div className="relative">
            <button
              onClick={() => {
                const opening = !showChat;
                setShowChat(opening);
                if (opening && !chatWelcomed) {
                  setChatMessages([{ role: 'assistant', content: "Hi! I can help with model performance queries — status, KS, PSI, portfolios, trends, and RAG. Try a suggestion below or type your question." }]);
                  setChatWelcomed(true);
                }
              }}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
              title="Model Performance Assistant"
            >
              <MessageSquare size={20} />
            </button>

            {showChat && (
              <div className={`absolute right-0 top-12 w-96 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'} rounded-lg shadow-xl flex flex-col overflow-hidden`} style={{ height: '480px' }}>
                {/* Header */}
                <div className="p-3 flex items-center justify-between" style={{ background: '#1e3a8a' }}>
                  <h3 className="font-semibold flex items-center gap-2 text-sm" style={{ color: '#ffffff' }}>
                    <MessageSquare size={15} /> Model Performance Assistant
                  </h3>
                  <button onClick={() => setShowChat(false)} className="text-white hover:opacity-70">
                    <X size={16} />
                  </button>
                </div>

                {/* Messages */}
                <div id="chat-messages-panel" className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-blue-500 text-white rounded-br-sm'
                            : theme === 'dark'
                            ? 'bg-slate-700 text-slate-100 rounded-bl-sm'
                            : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: msg.role === 'assistant'
                            ? msg.content
                                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\n/g, '<br/>')
                            : msg.content,
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Suggestion chips */}
                <div className={`px-3 py-2 border-t flex flex-wrap gap-1 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                  <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-white'} w-full mb-1`}>Try asking:</span>
                  {[
                    'Which models need attention?',
                    'What does RAG status mean?',
                    'Compare portfolios',
                    'Explain KS and PSI',
                    'What is ROB_test?',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestion(q)}
                      className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                        theme === 'dark'
                          ? 'bg-slate-700 border-slate-600 text-blue-300 hover:bg-slate-600'
                          : 'bg-slate-600 border-slate-500 text-white hover:bg-slate-700'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className={`p-3 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about KS, PSI, RAG status, portfolios…"
                      className={`flex-1 px-3 py-1.5 rounded-lg text-sm outline-none ${theme === 'dark' ? 'bg-slate-700 border border-slate-600 text-white placeholder-slate-400' : 'bg-white border border-gray-300 text-slate-900 placeholder-slate-400'}`}
                    />
                    <button type="submit" className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                      <Send size={14} />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2 rounded-lg transition-colors relative ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
              title="Notifications"
            >
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className={`absolute right-0 top-12 w-96 max-h-96 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'} rounded-lg shadow-xl overflow-hidden flex flex-col`}>
                <div className={`${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'} p-4 border-b ${theme === 'dark' ? 'border-slate-600' : 'border-gray-200'}`}>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Bell size={16} /> {t('notifications')}
                  </h3>
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} p-4 text-center`}>
                      {t('noNotifications')}
                    </div>
                  ) : (
                    notifications.slice(0, 20).map((notif) => (
                      <div key={notif.id} className={`p-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'} text-sm`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${notif.type === 'success' ? 'bg-green-500' : notif.type === 'error' ? 'bg-red-500' : notif.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                          <div className="flex-1">
                            <p className="font-medium">{notif.action}</p>
                            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{notif.details}</p>
                            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} mt-1`}>{notif.timestamp}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Support */}
          <div className="relative">
            <button
              onClick={() => setShowSupport(!showSupport)}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
              title="Support"
            >
              <HelpCircle size={20} />
            </button>

            {showSupport && (
              <div className={`absolute right-0 top-12 w-48 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'} rounded-lg shadow-xl overflow-hidden`}>
                <button onClick={() => { navigate('/documentation'); setShowSupport(false); }} className={`block w-full text-left px-4 py-2 hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  📚 Documentation
                </button>
                <button onClick={() => { navigate('/training'); setShowSupport(false); }} className={`block w-full text-left px-4 py-2 hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  🎓 Training
                </button>
                <button onClick={() => { navigate('/support'); setShowSupport(false); }} className={`block w-full text-left px-4 py-2 hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  💬 Support Contacts
                </button>
                <button onClick={() => { navigate('/feedback'); setShowSupport(false); }} className={`block w-full text-left px-4 py-2 hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  📧 Send Feedback
                </button>
              </div>
            )}
          </div>

          {/* Account Menu */}
          <div className="relative">
            <button
              onClick={() => setShowAccount(!showAccount)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border overflow-hidden ${
                theme === 'dark' ? 'bg-blue-600 border-slate-600' : 'bg-blue-500 border-gray-300'
              }`}>
                {userAvatar ? (
                  <img src={userAvatar} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-sm">{user?.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <ChevronDown size={16} />
            </button>

            {showAccount && (
              <div className={`absolute right-0 top-12 w-56 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'} rounded-lg shadow-xl overflow-hidden`}>
                <div className={`p-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                  <p className="text-sm font-medium">{user?.email || 'User'}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Admin Role</p>
                </div>

                {/* Theme Toggle */}
                <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                    {t('theme')}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 px-3 py-1 rounded text-sm transition-all ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      <Sun size={14} className="inline mr-1" /> {t('lightMode')}
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 px-3 py-1 rounded text-sm transition-all ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      <Moon size={14} className="inline mr-1" /> {t('darkMode')}
                    </button>
                  </div>
                </div>

                {/* Language Selector */}
                <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Globe size={14} />
                    {t('language')}
                  </p>
                  <button
                    onClick={() => setShowLanguage(!showLanguage)}
                    className={`w-full px-3 py-1 rounded text-sm flex items-center justify-between ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >
                    <span>{language === 'en' ? '🇬🇧 English' : language === 'es' ? '🇪🇸 Español' : language === 'fr' ? '🇫🇷 Français' : '🇩🇪 Deutsch'}</span>
                    <ChevronDown size={14} />
                  </button>

                  {showLanguage && (
                    <div className={`mt-2 space-y-1 p-2 rounded ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
                      {[{ code: 'en' as const, label: '🇬🇧 English' }, { code: 'es' as const, label: '🇪🇸 Español' }, { code: 'fr' as const, label: '🇫🇷 Français' }, { code: 'de' as const, label: '🇩🇪 Deutsch' }].map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setShowLanguage(false);
                          }}
                          className={`w-full text-left px-2 py-1 rounded text-sm ${language === lang.code ? `${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'}` : `${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-300'}`}`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    navigate('/profile');
                    setShowAccount(false);
                  }}
                  className={`w-full text-left block px-4 py-2 flex items-center gap-2 hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}
                >
                  <User size={16} /> Profile Settings
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`w-full text-left block px-4 py-2 flex items-center justify-between hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}
                >
                  <span className="flex items-center gap-2">
                    <Settings size={16} /> {t('settings')}
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                </button>

                {showSettings && (
                  <div className={`px-2 py-2 space-y-1 border-t ${theme === 'dark' ? 'border-slate-700 bg-slate-700/50' : 'border-gray-200 bg-gray-50'}`}>
                    <label className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-100'}`}>
                      <input
                        type="checkbox"
                        checked={userSettings.emailNotifications}
                        onChange={() => handleSettingChange('emailNotifications')}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm flex-1">Email Notifications</span>
                    </label>

                    <label className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-100'}`}>
                      <input
                        type="checkbox"
                        checked={userSettings.pushNotifications}
                        onChange={() => handleSettingChange('pushNotifications')}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm flex-1">Push Notifications</span>
                    </label>

                    <label className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-100'}`}>
                      <input
                        type="checkbox"
                        checked={userSettings.twoFactor}
                        onChange={() => handleSettingChange('twoFactor')}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm flex-1">Two-Factor Auth</span>
                    </label>

                    <label className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-100'}`}>
                      <input
                        type="checkbox"
                        checked={userSettings.dataCollection}
                        onChange={() => handleSettingChange('dataCollection')}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm flex-1">Data Collection</span>
                    </label>
                  </div>
                )}
                <button
                  onClick={logout}
                  className={`w-full text-left px-4 py-2 flex items-center gap-2 border-t ${theme === 'dark' ? 'border-slate-700 text-red-400 hover:bg-slate-700' : 'border-gray-200 text-red-600 hover:bg-gray-100'}`}
                >
                  <LogOut size={16} /> {t('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBarEnhanced;
