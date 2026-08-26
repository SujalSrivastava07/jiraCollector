import { useState } from 'react';
import { ArrowRight, GitBranch, AlertCircle } from 'lucide-react';
import logo from '../assets/logo.jpg';

export default function Login({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      onLoginSuccess(data.token, data.tenantId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Background glowing orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] opacity-30 bg-indigo-900 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="GeneiAI Logo" className="h-10 object-contain rounded-md mb-6" />
          <h2 className="text-2xl font-semibold m-0 tracking-wide text-white">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-white/50 text-sm mt-2 m-0 text-center">
            {isLogin ? 'Sign in to your GeneiAI account to continue' : 'Join GeneiAI and automate your Jira workflow'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Password</label>
              {isLogin && <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300">Forgot?</a>}
            </div>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="mt-4 flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white py-3 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')} <ArrowRight size={16} />
          </button>
        </form>

        <div className="relative flex items-center py-6">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink-0 mx-4 text-white/40 text-xs uppercase tracking-widest">Or</span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        <button 
          type="button"
          className="flex items-center justify-center gap-3 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-lg font-medium transition-all"
        >
          <GitBranch size={18} /> Continue with GitHub
        </button>

        <p className="text-center text-xs text-white/40 mt-8 mb-0">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => {setIsLogin(!isLogin); setError(null);}} className="text-indigo-400 hover:text-indigo-300 bg-transparent border-none p-0 cursor-pointer">
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
