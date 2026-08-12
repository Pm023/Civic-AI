import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Clock, ShieldAlert, ChevronRight, MessageSquare } from 'lucide-react';

interface StatusHistoryItem {
  id: number;
  report_id: number;
  status: string;
  notes: string | null;
  changed_by_user_id: number;
  created_at: string;
}

interface ReportDetails {
  id: number;
  ticket_id: string;
  description: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  category: string;
  ai_confidence: number;
  severity: string;
  priority_score: number;
  priority_level: string;
  duplicate_of: number | null;
  master_case_id: number | null;
  department: string | null;
  assigned_officer: string | null;
  status: string;
  sla_hours: number;
  resolution_notes: string | null;
  resolution_image: string | null;
  resolved_at: string | null;
  citizen_feedback: string | null;
  status_history?: StatusHistoryItem[];
  created_at?: string;
}

export const Track: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { token } = useAuth();
  
  const [report, setReport] = useState<ReportDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Feedback states
  const [rating, setRating] = useState('positive');
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    const fetchReportDetails = async () => {
      if (!token || !ticketId) return;
      try {
        const response = await fetch(`/api/v1/reports/${ticketId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Could not retrieve report details.');
        }
        const data = await response.json();
        setReport(data);
      } catch (err: any) {
        setError(err.message || 'Error fetching report.');
      } finally {
        setLoading(false);
      }
    };

    fetchReportDetails();
  }, [ticketId, token]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !report) return;
    setSubmittingFeedback(true);
    setError('');

    try {
      const response = await fetch(`/api/v1/reports/${report.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating, comment })
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback.');
      }
      
      const updatedReport = await response.json();
      setReport(updatedReport);
      setFeedbackSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error submitting feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const getTimelineSteps = (status: string) => {
    const steps = ['submitted', 'verified', 'assigned', 'in_progress', 'resolved'];
    const currentIdx = steps.indexOf(status.toLowerCase());
    return steps.map((step, idx) => ({
      name: step.replace('_', ' '),
      completed: idx <= currentIdx,
      active: idx === currentIdx
    }));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Clock className="h-8 w-8 text-slate-500 animate-spin mx-auto mb-2" />
        <span className="text-sm text-slate-400">Loading case timeline...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <ShieldAlert className="h-10 w-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">Issue Tracking Error</h3>
          <p className="text-slate-400 text-sm mt-1 mb-6">{error || 'Case report could not be found.'}</p>
          <Link to="/my-reports" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
            Back to My Reports
          </Link>
        </div>
      </div>
    );
  }

  const timeline = getTimelineSteps(report.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8">
        <div>
          <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Case Tracking Ticket</span>
          <h1 className="text-2xl font-bold font-mono text-accent-teal mt-0.5">{report.ticket_id}</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Submitted on {new Date(report.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Current Status:</span>
          <span className="px-3 py-1 rounded bg-accent-blue/10 border border-accent-blue/20 text-accent-blue font-semibold text-xs capitalize">
            {report.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Visual Case Timeline */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl mb-8">
        <h2 className="text-md font-semibold text-white mb-6">Case Progression Timeline</h2>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative">
          {timeline.map((step, idx) => (
            <React.Fragment key={idx}>
              <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center md:flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${
                  step.active 
                    ? 'bg-accent-blue text-white border-accent-blue shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                    : step.completed
                    ? 'bg-accent-teal text-slate-950 border-accent-teal'
                    : 'bg-slate-950 text-slate-600 border-slate-800'
                }`}>
                  {idx + 1}
                </div>
                <div>
                  <span className={`text-xs font-semibold uppercase tracking-wider block ${step.completed ? 'text-white' : 'text-slate-500'}`}>
                    {step.name}
                  </span>
                </div>
              </div>
              {idx < timeline.length - 1 && (
                <ChevronRight className="hidden md:block h-5 w-5 text-slate-700" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Real-time Status History Log */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl mb-8 shadow-lg">
        <h2 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent-teal" />
          Detailed Verification & Progress Log
        </h2>
        <div className="space-y-4">
          {(!report.status_history || report.status_history.length === 0) ? (
            <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-xl text-xs text-slate-500 text-center">
              No detailed progress logs recorded yet.
            </div>
          ) : (
            [...report.status_history]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((log) => (
                <div key={log.id} className="relative flex items-start gap-4 p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all">
                  <div className="flex h-6 items-center">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue/10 border border-accent-blue/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]">
                      <div className="h-2 w-2 rounded-full bg-accent-blue animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        {log.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-medium bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-sans leading-relaxed">
                      {log.notes || `Case status changed to ${log.status}`}
                    </p>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Grid: AI Details & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Left Side: Report Details */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h2 className="text-md font-semibold text-white">Complaint Metadata</h2>
          
          <div>
            <span className="text-xs text-slate-500">Citizen Description</span>
            <p className="text-sm text-slate-300 mt-1">{report.description}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div>
              <span className="text-slate-500 block">Latitude</span>
              <span className="font-mono">{report.latitude}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Longitude</span>
              <span className="font-mono">{report.longitude}</span>
            </div>
          </div>

          <hr className="border-slate-800" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500">Assigned Department</span>
              <p className="text-sm font-semibold text-white mt-0.5">{report.department || 'Not routed yet'}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Assigned Officer</span>
              <p className="text-sm font-semibold text-white mt-0.5">{report.assigned_officer || 'Unassigned'}</p>
            </div>
          </div>
        </div>

        {/* Right Side: AI Assistant Predictions Audit */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-md font-semibold text-white">AI Classification Audit</h2>
            <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 uppercase">
              AI Verification
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block">AI Category</span>
              <span className="text-sm font-bold text-accent-teal capitalize">{report.category}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block">Confidence Rating</span>
              <span className="text-sm font-bold text-white">{(report.ai_confidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block">Calculated Severity</span>
              <span className="text-sm font-bold text-white capitalize">{report.severity}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block">Risk Score (Priority)</span>
              <span className="text-sm font-bold text-accent-amber">{report.priority_score.toFixed(0)} ({report.priority_level})</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            Note: This classification and routing represents AI suggestion. A human dispatcher can override this.
          </p>
        </div>
      </div>

      {/* Resolution Details */}
      {report.status === 'resolved' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8">
          <h2 className="text-md font-semibold text-accent-emerald mb-2">Resolution Log</h2>
          {report.resolved_at && (
            <p className="text-xs text-slate-500 mb-4">Completed on {new Date(report.resolved_at).toLocaleString()}</p>
          )}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-slate-300">
            {report.resolution_notes || 'No resolution logs provided by officer.'}
          </div>
        </div>
      )}

      {/* Citizen Feedback Form (Only visible once resolved) */}
      {report.status === 'resolved' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <h2 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent-blue" />
            Citizen Feedback Widget
          </h2>

          {report.citizen_feedback ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm">
              <span className="text-xs text-slate-500 block mb-1">Your Submitted Rating</span>
              <p className="text-slate-300 font-semibold">{report.citizen_feedback}</p>
            </div>
          ) : feedbackSuccess ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-accent-emerald p-4 rounded-xl text-sm text-center">
              Thank you for your feedback! It helps improve municipal operations.
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block">Rate Resolution Quality</label>
                <div className="flex gap-4">
                  {['positive', 'neutral', 'negative'].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setRating(rate)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg border uppercase transition-all ${
                        rating === rate
                          ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/40 shadow-sm'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      {rate}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block">Comment (Optional)</label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl p-3 text-white text-sm outline-none transition-all"
                  placeholder="Tell us about the speed or completeness of the repair."
                />
              </div>

              <button
                type="submit"
                disabled={submittingFeedback}
                className="bg-accent-blue hover:bg-accent-blue/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
