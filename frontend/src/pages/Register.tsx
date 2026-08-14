import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, UserPlus } from 'lucide-react';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  // const [role, setRole] = useState<'citizen' | 'officer'>('citizen');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed.');
      }

      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
        <div className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-accent-teal" />
          <h2 className="mt-6 text-3xl font-extrabold text-white">Create an Account</h2>
          <p className="mt-2 text-sm text-slate-400">
            Submit issues and track real-time AI classification resolutions.
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
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-teal focus:ring-1 focus:ring-accent-teal rounded-lg py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-teal focus:ring-1 focus:ring-accent-teal rounded-lg py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all"
                  placeholder="john@example.com"
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-teal focus:ring-1 focus:ring-accent-teal rounded-lg py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Account Role</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole('citizen')}
                  className={`py-2 px-4 rounded-lg border text-sm font-semibold transition-all ${
                    role === 'citizen'
                      ? 'bg-accent-teal/20 text-accent-teal border-accent-teal/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Citizen
                </button>
                <button
                  type="button"
                  onClick={() => setRole('officer')}
                  className={`py-2 px-4 rounded-lg border text-sm font-semibold transition-all ${
                    role === 'officer'
                      ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Field Officer
                </button>
              </div>
            </div> */}

          </div>
          <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm text-slate-400">
            New registrations are created as <span className="text-accent-teal font-semibold">Citizen</span> accounts.
            Field Officers are created only by the System Admin.
          </div>
          <div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-accent-teal hover:bg-accent-teal/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-teal disabled:opacity-50 transition-all shadow-lg shadow-accent-teal/20"
            >
              {loading ? 'Registering...' : 'Sign Up'}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-accent-blue hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
