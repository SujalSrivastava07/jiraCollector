import { useState, useEffect } from 'react';
import { GitBranch, Link, Settings, Server, Plus, CheckCircle, Trash2 } from 'lucide-react';

export default function Onboarding({ tenantId, token, onComplete }) {
  const [tenant, setTenant] = useState(null);
  const [repos, setRepos] = useState([]);
  const [mappings, setMappings] = useState([]);
  
  // Forms
  const [githubAppId, setGithubAppId] = useState('');
  const [jiraCloudId, setJiraCloudId] = useState('');
  const [newRepo, setNewRepo] = useState({ repoId: '', fullName: '', defaultBranch: 'main' });
  const [newMapping, setNewMapping] = useState({ jiraProjectKey: '', repoId: '' });

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    try {
      const [tRes, rRes, mRes] = await Promise.all([
        fetch(`/api/auth/tenant/${tenantId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/repos/${tenantId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/mappings/${tenantId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (tRes.ok) setTenant(await tRes.json());
      if (rRes.ok) setRepos(await rRes.json());
      if (mRes.ok) setMappings(await mRes.json());
    } catch (e) {
      console.error("Failed to fetch onboarding data", e);
    }
  };

  const handleConnectGithub = async () => {
    if (!githubAppId) return;
    await fetch('/api/auth/github/mock-connect', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ installationId: githubAppId, tenantId })
    });
    setGithubAppId('');
    fetchData();
  };

  const handleConnectJira = async () => {
    if (!jiraCloudId) return;
    await fetch('/api/auth/jira/mock-connect', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ cloudId: jiraCloudId, tenantId, accessToken: 'mock_token' })
    });
    setJiraCloudId('');
    fetchData();
  };

  const handleAddRepo = async () => {
    if (!newRepo.repoId || !newRepo.fullName) {
      alert('Please fill in both the Repo ID and the repository path (org/repo) before adding.');
      return;
    }
    await fetch('/api/repos', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ...newRepo, tenantId })
    });
    setNewRepo({ repoId: '', fullName: '', defaultBranch: 'main' });
    fetchData();
  };

  const handleAddMapping = async () => {
    const key = newMapping.jiraProjectKey.trim().toUpperCase();
    if (!key || !newMapping.repoId) {
      alert('Please fill in both the Jira Project Key and select a repository.');
      return;
    }
    const res = await fetch('/api/mappings', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tenantId, jiraProjectKey: key, repoIds: [newMapping.repoId] })
    });
    
    if (res.status === 409) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    
    setNewMapping({ jiraProjectKey: '', repoId: '' });
    fetchData();
  };

  const handleDeleteMapping = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;
    await fetch(`/api/mappings/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-20 px-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] opacity-20 bg-indigo-500 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-3xl w-full flex flex-col gap-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold tracking-wide text-white mb-3">Setup your Workspace</h1>
          <p className="text-white/50 text-base max-w-lg mx-auto">Connect your tools to enable GeneiAI's autonomous agent pipeline.</p>
        </div>

        {/* 1. Connect GitHub */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-lg transition-all hover:bg-white/10 hover:border-white/20">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl h-fit">
                <GitBranch size={24} />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-1">1. Connect GitHub</h3>
                <p className="text-sm text-white/50 mb-4">Authorize GeneiAI to read issues and open Pull Requests.</p>
                
                {tenant?.githubInstallationId ? (
                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg w-fit text-sm font-medium border border-emerald-500/20">
                    <CheckCircle size={16} /> Connected: {tenant.githubInstallationId}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      placeholder="Mock Installation ID (e.g. mock-github-app)" 
                      value={githubAppId} 
                      onChange={e => setGithubAppId(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-64 transition-colors"
                    />
                    <button 
                      onClick={handleConnectGithub}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                    >
                      Connect
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Connect Jira */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-lg transition-all hover:bg-white/10 hover:border-white/20">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl h-fit">
                <Link size={24} />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-1">2. Connect Jira</h3>
                <p className="text-sm text-white/50 mb-4">Link your issue tracker to listen for incoming webhooks.</p>
                
                {tenant?.jiraCloudId ? (
                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg w-fit text-sm font-medium border border-emerald-500/20">
                    <CheckCircle size={16} /> Connected: {tenant.jiraCloudId}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      placeholder="Mock Jira ID (e.g. mee)" 
                      value={jiraCloudId} 
                      onChange={e => setJiraCloudId(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 w-64 transition-colors"
                    />
                    <button 
                      onClick={handleConnectJira}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                    >
                      Connect
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Connected Repositories */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-lg transition-all hover:bg-white/10 hover:border-white/20">
          <div className="flex gap-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl h-fit">
              <Server size={24} />
            </div>
            <div className="w-full">
              <h3 className="text-lg font-medium text-white mb-1">3. Connected Repositories</h3>
              <p className="text-sm text-white/50 mb-6">Register repositories that the agent is allowed to access.</p>
              
              <div className="flex flex-col gap-4 mb-6">
                {repos.length === 0 ? (
                  <div className="text-sm text-white/30 italic py-4">No repositories added yet.</div>
                ) : (
                  repos.map(r => (
                    <div key={r.repoId} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <GitBranch size={16} className="text-purple-400" />
                        <span className="font-medium text-white">{r.fullName}</span>
                      </div>
                      <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-1 rounded">ID: {r.repoId}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-white/10">
                <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Add Repository</h4>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Repo ID (e.g. 123)" 
                    value={newRepo.repoId} 
                    onChange={e => setNewRepo({...newRepo, repoId: e.target.value})}
                    className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 w-32 transition-colors"
                  />
                  <input 
                    type="text" 
                    placeholder="org/repo (e.g. SujalSrivastava07/myrepo)" 
                    value={newRepo.fullName} 
                    onChange={e => setNewRepo({...newRepo, fullName: e.target.value})}
                    className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 flex-1 transition-colors"
                  />
                  <button 
                    onClick={handleAddRepo}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border border-white/5"
                  >
                    <Plus size={16} /> Add Repo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Project Mapping */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-lg transition-all hover:bg-white/10 hover:border-white/20">
          <div className="flex gap-4">
            <div className="p-3 bg-pink-500/20 text-pink-400 rounded-xl h-fit">
              <Link size={24} />
            </div>
            <div className="w-full">
              <h3 className="text-lg font-medium text-white mb-1">4. Project Mapping</h3>
              <p className="text-sm text-white/50 mb-6">Tell GeneiAI which Jira tickets belong to which GitHub repository.</p>
              
              <div className="flex flex-col gap-4 mb-6">
                {mappings.length === 0 ? (
                  <div className="text-sm text-white/30 italic py-4">No mappings added yet.</div>
                ) : (
                  mappings.map(m => (
                    <div key={m._id} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white font-mono">{m.jiraProjectKey}-***</span>
                        <span className="text-white/30 text-sm">&rarr;</span>
                        <span className="font-medium text-pink-400 text-sm">Repo ID: {m.repoIds[0]}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteMapping(m._id)}
                        className="text-white/40 hover:text-red-400 transition-colors p-1"
                        title="Delete Mapping"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-white/10">
                <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Add Mapping</h4>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Jira Key (e.g. APG)" 
                    value={newMapping.jiraProjectKey} 
                    onChange={e => setNewMapping({...newMapping, jiraProjectKey: e.target.value.toUpperCase()})}
                    className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 w-32 transition-colors"
                  />
                  <select 
                    value={newMapping.repoId}
                    onChange={e => setNewMapping({...newMapping, repoId: e.target.value})}
                    className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 flex-1 transition-colors appearance-none"
                  >
                    <option value="" disabled>Select Repository</option>
                    {repos.map(r => (
                      <option key={r.repoId} value={r.repoId}>{r.fullName} (ID: {r.repoId})</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAddMapping}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border border-white/5"
                  >
                    <Plus size={16} /> Map
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button 
            onClick={onComplete}
            className="bg-white text-black hover:bg-white/90 px-8 py-4 rounded-xl font-semibold transition-all shadow-xl hover:-translate-y-1"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
