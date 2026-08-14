import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, FileText, BarChart2, CheckSquare, LogOut, LogIn, UserPlus, Users } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const navClass = (path: string) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
      isActive(path)
        ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
        : 'text-slate-300 hover:text-white hover:bg-slate-800'
    }`;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <Shield className="h-8 w-8 text-accent-teal group-hover:rotate-12 transition-transform duration-300" />
              <span className="text-xl font-bold bg-gradient-to-r from-accent-teal to-accent-blue bg-clip-text text-transparent tracking-wider">
                CIVICAI
              </span>
            </Link>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex space-x-2">
            <Link to="/dashboard" className={navClass('/dashboard')}>
              <BarChart2 className="h-4 w-4" />
              GIS Dashboard
            </Link>

            {isAuthenticated && user?.role === 'citizen' && (
              <>
                <Link to="/report" className={navClass('/report')}>
                  <FileText className="h-4 w-4" />
                  Report Issue
                </Link>
                <Link to="/my-reports" className={navClass('/my-reports')}>
                  <CheckSquare className="h-4 w-4" />
                  My Reports
                </Link>
              </>
            )}

            {isAuthenticated && user?.role === 'officer' && (
              <Link to="/officer/cases" className={navClass('/officer/cases')}>
                <CheckSquare className="h-4 w-4" />
                Officer Dashboard
              </Link>
            )}

            {isAuthenticated && user?.role === 'admin' && (
              <>
                <Link to="/admin/officers" className={navClass('/admin/officers')}>
                  <Users className="h-4 w-4" />
                  Officer Management
                </Link>
                <Link to="/officer/cases" className={navClass('/officer/cases')}>
                  <CheckSquare className="h-4 w-4" />
                  Dispatch Console
                </Link>
              </>
            )}
          </nav>

          {/* User Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-semibold text-slate-300">
                    {user?.full_name}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-400 hover:text-white hover:bg-rose-500/10 border border-rose-500/0 hover:border-rose-500/20 rounded-md transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all duration-200"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1 bg-accent-blue hover:bg-accent-blue/90 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 shadow-lg shadow-accent-blue/20"
                >
                  <UserPlus className="h-4 w-4" />
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
