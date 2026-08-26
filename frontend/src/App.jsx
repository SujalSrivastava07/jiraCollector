import { useEffect, useState } from 'react';
import { Activity, Settings, GitBranch, X, Users, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronRight, FolderGit2 } from 'lucide-react';
import Onboarding from './components/Onboarding';
import GeneiAIHero from './components/GeneiAIHero';
import Login from './components/Login';
import PipelineVisualization from './components/PipelineVisualization';
import './index.css';

const STAGES = [
  'INTAKE',
  'UNDERSTANDING',
  'GATHERING_CONTEXT',
  'PLANNING',
  'CODING',
  'APPLYING_PATCHES',
  'VALIDATING',
  'OPENING_PR',
  'COMPLETE'
];

const MOCK_TENANT_ID = '64f1b2c3e4d5a6b7c8d9e0f1';

export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('token') ? 'feed' : 'hero';
  }); // 'hero' | 'login' | 'onboarding' | 'feed'
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedRepos, setExpandedRepos] = useState({});
  
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [tenantId, setTenantId] = useState(localStorage.getItem('tenantId'));
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [githubConfig, setGithubConfig] = useState({ owner: '', repo: '', token: '' });

  useEffect(() => {
    if (!token) return;
    fetch('/api/config', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setGithubConfig({ owner: data.owner || '', repo: data.repo || '', token: data.token || '' });
      })
      .catch(e => console.error("Failed to fetch config", e));
  }, [token]);

  useEffect(() => {
    const fetchTickets = async () => {
      if (currentView !== 'feed' || !token) return;
      try {
        const res = await fetch('/api/tickets', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTickets(data);
          if (data.length > 0 && !selectedId) {
            setSelectedId(data[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch tickets", e);
      }
    };

    fetchTickets();
    const interval = setInterval(fetchTickets, 3000);
    return () => clearInterval(interval);
  }, [selectedId, currentView]);

  const selectedTicket = tickets.find(t => t.id === selectedId);

  const getNodeStatus = (stage, ticketState) => {
    if (ticketState === 'COMPLETE' || ticketState === 'CLARIFICATION_NEEDED') {
      if (stage === 'COMPLETE') return ticketState === 'COMPLETE' ? 'completed' : '';
      return 'completed';
    }
    
    const stageIdx = STAGES.indexOf(stage);
    const currentIdx = STAGES.indexOf(ticketState);
    
    if (stageIdx < currentIdx) return 'completed';
    if (stageIdx === currentIdx) return 'active';
    return 'pending';
  };

  const handleSaveConfig = async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(githubConfig)
      });
      setShowSettings(false);
    } catch (e) {
      console.error("Failed to save config", e);
    }
  };

  const handleLoginSuccess = (newToken, newTenantId) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('tenantId', newTenantId);
    setToken(newToken);
    setTenantId(newTenantId);
    setCurrentView('onboarding');
  };

  if (currentView === 'hero') {
    return (
      <div className="relative">
        <GeneiAIHero onSignUp={() => setCurrentView('login')} />
      </div>
    );
  }

  if (currentView === 'login') {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentView === 'onboarding') {
    return <Onboarding tenantId={tenantId} token={token} onComplete={() => setCurrentView('feed')} />;
  }

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-[350px] flex flex-col border-r border-white/10 bg-white/5 backdrop-blur-lg z-20 shadow-xl shrink-0">
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold m-0 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            Jira Agent Feed
          </h2>
          <div className="flex gap-2">
            <button 
              className="p-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-lg transition-colors shadow-[0_0_10px_rgba(99,102,241,0.2)] text-xs font-bold"
              onClick={async () => {
                await fetch('/api/webhook/jira', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    webhookEvent: 'jira:issue_created',
                    issue: { key: 'APG-1', fields: { labels: ['genie-ai'], summary: 'Fix the bug in the backend', description: 'The bug is causing issues.' } }
                  })
                });
              }}
              title="Simulate APG-1 Webhook"
            >
              Simulate Webhook
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white" onClick={() => setCurrentView('onboarding')} title="Onboarding">
              <Users size={18} />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white" onClick={() => setShowSettings(true)} title="Settings">
              <Settings size={18} />
            </button>
            <button 
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-white/70 hover:text-red-400" 
              title="Logout"
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('tenantId');
                setToken(null);
                setTenantId(null);
                setCurrentView('hero');
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-hide">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
              <p className="text-sm">Waiting for webhooks...</p>
            </div>
          ) : (
            Object.entries(
              tickets.reduce((acc, t) => {
                const config = t._activeConfig;
                const repoName = (config && config.owner && config.repo) ? `${config.owner}/${config.repo}` : 'Unmapped / Default';
                if (!acc[repoName]) acc[repoName] = [];
                acc[repoName].push(t);
                return acc;
              }, {})
            ).map(([repoName, repoTickets]) => {
              const isExpanded = expandedRepos[repoName] !== false; // true by default

              return (
                <div key={repoName} className="flex flex-col gap-2">
                  <div 
                    className="flex items-center gap-2 text-white/60 hover:text-white/90 cursor-pointer transition-colors py-1 group"
                    onClick={() => setExpandedRepos(prev => ({ ...prev, [repoName]: !isExpanded }))}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <FolderGit2 size={16} className="group-hover:text-indigo-400 transition-colors" />
                    <span className="text-sm font-semibold tracking-wide truncate">{repoName}</span>
                    <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-full">{repoTickets.length}</span>
                  </div>
                  
                  {isExpanded && (
                    <div className="flex flex-col gap-2 pl-4 border-l border-white/10 ml-2">
                      {repoTickets.map(t => {
                        const isActive = t.id === selectedId;
                        const isSuccess = t.status === 'success';
                        return (
                          <div 
                            key={t.id} 
                            onClick={() => setSelectedId(t.id)}
                            className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col gap-2 ${
                              isActive 
                                ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-indigo-400">{t.ticketKey}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isSuccess ? 'bg-emerald-500/20 text-emerald-400' : 
                                  t.status === 'WAITING' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/70'
                                }`}>
                                  {isSuccess ? 'SUCCESS' : t.status.toUpperCase()}
                                </span>
                                {isSuccess && (
                                  <button 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await fetch(`/api/tickets/${t.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                                      setTickets(prev => prev.filter(tick => tick.id !== t.id));
                                      if (selectedId === t.id) setSelectedId(null);
                                    }}
                                    className="p-1 text-white/30 hover:text-white hover:bg-white/10 rounded transition-colors"
                                    title="Dismiss Task"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <h3 className="text-sm font-medium leading-snug m-0 text-white/90 line-clamp-2">
                              {t.understanding?.extractedRequirements?.[0] || 'Processing...'}
                            </h3>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background">
        
        {/* Visualizer Panel */}
        <div className="flex-[3] flex flex-col items-center justify-center relative p-8">
          <h2 className="absolute top-6 left-6 text-sm font-medium text-white/50 tracking-wider m-0 uppercase">
            Pipeline Visualizer
          </h2>
          
          {selectedTicket ? (
            <div className="flex flex-col items-center justify-center w-full">
              {selectedTicket.status === 'WAITING' ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm flex items-center gap-2">
                    <AlertCircle size={18} />
                    Waiting for manual approval to start AI agents.
                  </div>
                  <button 
                    onClick={async () => {
                      await fetch(`/api/tickets/${selectedTicket.id}/start`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:-translate-y-1"
                  >
                    Start AI Pipeline
                  </button>
                </div>
              ) : (
                <PipelineVisualization ticket={selectedTicket} token={token} />
              )}
            </div>
          ) : (
            <div className="text-white/30 text-sm flex items-center gap-2">
              <Activity size={16} /> Select a ticket to view pipeline
            </div>
          )}
        </div>

        {/* Details Panel (JSON Payloads) */}
        <div className="flex-[2] bg-black/40 border-t border-white/10 p-6 overflow-y-auto z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
            <h3 className="text-xs font-mono text-white/40 ml-2 uppercase m-0">Agent Payloads</h3>
          </div>
          
          {selectedTicket ? (
            selectedTicket.status === 'error' ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-5">
                <h4 className="text-red-400 text-sm font-semibold mb-2 flex items-center gap-2 m-0">
                  <AlertCircle size={16} /> Pipeline Error
                </h4>
                <pre className="text-red-300/80 font-mono text-xs whitespace-pre-wrap word-break">
                  {selectedTicket.message || 'Unknown error occurred'}
                </pre>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 m-0 flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-500" /> Context Agent
                  </h4>
                  <pre className="bg-white/5 border border-white/10 rounded-lg p-4 font-mono text-xs text-indigo-300 overflow-x-auto">
                    {JSON.stringify(selectedTicket.context, null, 2) || 'N/A'}
                  </pre>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 m-0 flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-500" /> Planning Agent
                  </h4>
                  <pre className="bg-white/5 border border-white/10 rounded-lg p-4 font-mono text-xs text-indigo-300 overflow-x-auto">
                    {JSON.stringify(selectedTicket.plan, null, 2) || 'N/A'}
                  </pre>
                </div>
                <div className="md:col-span-2">
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 m-0">
                    PR URL
                  </h4>
                  {selectedTicket.prUrl ? (
                    <a href={selectedTicket.prUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4">
                      {selectedTicket.prUrl}
                    </a>
                  ) : (
                    <span className="text-white/30 text-sm italic">Not generated yet</span>
                  )}
                </div>
              </div>
            )
          ) : (
            <p className="text-white/30 text-sm italic">No payload data available.</p>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                  <GitBranch size={20} />
                </div>
                <h2 className="text-lg font-semibold m-0 text-white">GitHub Configuration</h2>
              </div>
              <button className="text-white/50 hover:text-white transition-colors" onClick={() => setShowSettings(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Repository Owner</label>
                <input 
                  type="text" 
                  value={githubConfig.owner} 
                  onChange={e => setGithubConfig({...githubConfig, owner: e.target.value})}
                  placeholder="e.g. sujal"
                  className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Repository Name</label>
                <input 
                  type="text" 
                  value={githubConfig.repo} 
                  onChange={e => setGithubConfig({...githubConfig, repo: e.target.value})}
                  placeholder="e.g. test-repoforAI"
                  className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Access Token (Optional)</label>
                <input 
                  type="password" 
                  value={githubConfig.token} 
                  onChange={e => setGithubConfig({...githubConfig, token: e.target.value})}
                  placeholder="Leave blank to use server default"
                  className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
            
            <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
              <button className="px-5 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors" onClick={handleSaveConfig}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
