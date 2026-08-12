import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Clock, Eye, AlertTriangle } from 'lucide-react';

interface CaseSummary {
  id: number;
  ticket_id: string;
  category: string;
  description: string;
  priority_level: string;
  status: string;
  created_at: string;
  department: string | null;
}

export const OfficerCases: React.FC = () => {
  const { token } = useAuth();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    const fetchCases = async () => {
      if (!token) return;
      try {
        let url = '/api/v1/reports?';
        if (statusFilter) url += `status=${statusFilter}&`;
        if (priorityFilter) url += `priority_level=${priorityFilter}&`;

        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve cases list.');
        }
        const data = await response.json();
        setCases(data);
      } catch (err: any) {
        setError(err.message || 'Error fetching cases.');
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [token, statusFilter, priorityFilter]);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted': return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'verified': return 'bg-teal-500/10 text-accent-teal border-teal-500/20';
      case 'assigned': return 'bg-blue-500/10 text-accent-blue border-blue-500/20';
      case 'in_progress': return 'bg-violet-500/10 text-accent-violet border-violet-500/20';
      case 'resolved': return 'bg-emerald-500/10 text-accent-emerald border-emerald-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-accent-blue" />
            Officer Action Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dispatch work orders, update repair statuses, and audit civic case workloads.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      {/* Filters toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-accent-blue"
            >
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Priority Filter</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-accent-blue"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-400">
          Showing {cases.length} assigned tickets
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Clock className="h-8 w-8 text-slate-500 animate-spin mx-auto mb-2" />
          <span className="text-sm text-slate-400">Loading cases queue...</span>
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
          No cases matching criteria found in system database.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <th className="px-6 py-4">Ticket</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {cases.map((cs) => (
                  <tr key={cs.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-accent-teal">{cs.ticket_id}</td>
                    <td className="px-6 py-4 text-slate-300 font-medium">{cs.department || 'Not Assigned'}</td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate">{cs.description}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(cs.priority_level)}`}>
                        {cs.priority_level}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${getStatusBadge(cs.status)}`}>
                        {cs.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(cs.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/officer/cases/${cs.id}`} className="flex items-center gap-1 text-accent-blue hover:text-white transition-colors">
                        <Eye className="h-4 w-4" />
                        Inspect
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
