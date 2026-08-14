import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ShieldAlert } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Connect to real endpoint
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Login failed.');
      }

      // Decode user role from JWT token payload
      const tokenParts = data.access_token.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));

      let userData = {
        id: parseInt(payload.sub),
        email: payload.email,
        full_name: payload.full_name || payload.email.split('@')[0],
        role: payload.role as 'citizen' | 'officer' | 'admin',
      };

      try {
        const meRes = await fetch('/api/v1/auth/me', {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          userData = {
            id: meData.id,
            email: meData.email,
            full_name: meData.full_name,
            role: meData.role,
          };
        }
      } catch (e) {
        // fallback to token payload
      }

      login(data.access_token, userData);

      if (userData.role === 'admin') {
        navigate('/admin/officers');
      } else if (userData.role === 'officer') {
        navigate('/officer/cases');
      } else {
        navigate('/report');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
        <div className="text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-accent-blue animate-pulse" />
          <h2 className="mt-6 text-3xl font-extrabold text-white">Login to CivicAI</h2>
          <p className="mt-2 text-sm text-slate-400">
            Access issue tracking or officer dispatch console.
          </p>
        </div>
        
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-lg py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all"
                  placeholder="citizen@example.com"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-lg py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-blue disabled:opacity-50 transition-all shadow-lg shadow-accent-blue/20"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-slate-400">
            Don't have a citizen account?{' '}
            <Link to="/register" className="font-medium text-accent-teal hover:underline">
              Register Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
