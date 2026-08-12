import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, Clock, ShieldAlert } from 'lucide-react';

interface ReportData {
  id: number;
  ticket_id: string;
  description: string;
  status: string;
  category: string;
  priority_level: string;
  created_at: string;
}

export const MyReports: React.FC = () => {
  const { token } = useAuth();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMyReports = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/v1/reports', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to load reports.');
        }
        const data = await response.json();
        setReports(data);
      } catch (err: any) {
        setError(err.message || 'Error loading reports.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyReports();
  }, [token]);

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted': return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'verified': return 'bg-teal-500/10 text-accent-teal border-teal-500/20';
      case 'assigned': return 'bg-blue-500/10 text-accent-blue border-blue-500/20';
      case 'in_progress': return 'bg-violet-500/10 text-accent-violet border-violet-500/20';
      case 'resolved': return 'bg-emerald-500/10 text-accent-emerald border-emerald-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'CRITICAL': return 'bg-rose-500/10 text-accent-rose border-rose-500/20';
      case 'HIGH': return 'bg-amber-500/10 text-accent-amber border-amber-500/20';
      case 'MEDIUM': return 'bg-blue-500/10 text-accent-blue border-blue-500/20';
      case 'LOW': return 'bg-slate-800 text-slate-400 border-slate-700';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Submitted Reports</h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitor investigation status and submit citizen feedback once resolved.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Clock className="h-8 w-8 text-slate-500 animate-spin mx-auto mb-2" />
          <span className="text-sm text-slate-400">Loading your reports...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <ShieldAlert className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-md font-semibold text-white">No Reports Found</h3>
          <p className="text-slate-400 text-sm mt-1 mb-6">You haven't submitted any civic issue reports yet.</p>
          <Link to="/report" className="bg-accent-blue hover:bg-accent-blue/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-accent-blue/20">
            Submit First Report
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <th className="px-6 py-4">Ticket ID</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-accent-teal">{report.ticket_id}</td>
                    <td className="px-6 py-4 capitalize text-slate-300">{report.category}</td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate">{report.description}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getPriorityBadgeClass(report.priority_level)}`}>
                        {report.priority_level}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border capitalize ${getStatusBadgeClass(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(report.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/track/${report.ticket_id}`} className="flex items-center gap-1 text-accent-blue hover:text-white transition-colors">
                        <Eye className="h-4 w-4" />
                        Track
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
