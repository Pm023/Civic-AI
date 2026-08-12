import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Clock, ShieldAlert, ArrowLeft, Check, Camera } from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

interface CaseDetails {
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
}

export const OfficerCaseDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [caseData, setCaseData] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status updates & routing states
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [department, setDepartment] = useState('');
  const [assignedOfficer, setAssignedOfficer] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchCaseDetails = async () => {
      if (!token) return;
      try {
        const response = await fetch(`/api/v1/reports/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve case details.');
        }
        const data = await response.json();
        setCaseData(data);
        setStatus(data.status);
        setNotes(data.resolution_notes || '');
        setDepartment(data.department || '');
        setAssignedOfficer(data.assigned_officer || '');
      } catch (err: any) {
        setError(err.message || 'Error fetching case.');
      } finally {
        setLoading(false);
      }
    };

    fetchCaseDetails();
  }, [id, token]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !caseData) return;
    setUpdating(true);
    setError('');

    try {
      let response;
      if (status === 'assigned') {
        response = await fetch(`/api/v1/reports/${caseData.id}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            department,
            assigned_officer: assignedOfficer
          })
        });
      } else {
        response = await fetch(`/api/v1/reports/${caseData.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            status,
            resolution_notes: notes
          })
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update work order.');
      }

      const updatedData = await response.json();
      setCaseData(updatedData);
      setStatus(updatedData.status);
      setNotes(updatedData.resolution_notes || '');
      setDepartment(updatedData.department || '');
      setAssignedOfficer(updatedData.assigned_officer || '');
      alert('Work order updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Error updating work order.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Clock className="h-8 w-8 text-slate-500 animate-spin mx-auto mb-2" />
        <span className="text-sm text-slate-400">Loading case details...</span>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <ShieldAlert className="h-10 w-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">Case Inspection Error</h3>
          <p className="text-slate-400 text-sm mt-1 mb-6">{error || 'Case records could not be found.'}</p>
          <Link to="/officer/cases" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
            Back to Case Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back button */}
      <Link to="/officer/cases" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Active Case Queue
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Title Panel */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">Case Inspector</span>
            <div className="flex flex-wrap items-center justify-between gap-4 mt-1">
              <h1 className="text-2xl font-bold font-mono text-accent-teal">{caseData.ticket_id}</h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold border border-slate-700 bg-slate-800 uppercase capitalize text-slate-300">
                {caseData.status}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-4 border-l-2 border-accent-blue pl-3 py-1 bg-slate-950/30 rounded-r">
              {caseData.description}
            </p>
          </div>

          {/* AI Predictor Summary Info */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h2 className="text-md font-semibold text-white">AI Classification Diagnostic Auditing</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Category Suggestion</span>
                <span className="text-sm font-bold text-accent-teal capitalize">{caseData.category}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Confidence Score</span>
                <span className="text-sm font-bold text-white">{(caseData.ai_confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Calculated Severity</span>
                <span className="text-sm font-bold text-white capitalize">{caseData.severity}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Risk Score (Priority)</span>
                <span className="text-sm font-bold text-accent-rose">{caseData.priority_score.toFixed(0)} ({caseData.priority_level})</span>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-300 mb-2">Priority Risk Calculation Explanatory Math</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Risk calculation: `0.40 * severity_score + 0.25 * report_volume_score + 0.20 * proximity_score + 0.15 * recency_score`.
                Proximity alerts are triggered based on coordinate overlaps within 200m of schools, hospitals, and transit stops.
              </p>
            </div>
          </div>

          {/* Location Panel */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h2 className="text-md font-semibold text-white mb-4">GPS Coordinates & Geography Context</h2>
            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Latitude</span>
                <span className="font-mono text-sm font-semibold">{caseData.latitude}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Longitude</span>
                <span className="font-mono text-sm font-semibold">{caseData.longitude}</span>
              </div>
            </div>
            {/* GIS Map Locator */}
            <div className="h-48 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative z-10">
              <MapContainer 
                center={[caseData.latitude, caseData.longitude]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <Marker 
                  position={[caseData.latitude, caseData.longitude]} 
                  icon={L.icon({
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34]
                  })}
                />
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Dispatch & Updates */}
        <div className="space-y-6">
          {/* Status Progression form */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h2 className="text-md font-semibold text-white mb-4">Work Order Actions</h2>
            
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block">Set Work Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl p-3 text-white text-sm outline-none transition-all"
                >
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified (AI Audited)</option>
                  <option value="assigned">Assigned to Dept</option>
                  <option value="in_progress">Work In Progress</option>
                  <option value="resolved">Resolved / Complete</option>
                </select>
              </div>

              {status === 'assigned' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-2 block">Target Department</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl p-3 text-white text-sm outline-none transition-all"
                    >
                      <option value="">-- Select Department --</option>
                      <option value="Public Works">Public Works</option>
                      <option value="Electrical Department">Electrical Department</option>
                      <option value="Water & Drainage">Water & Drainage</option>
                      <option value="Sanitation Department">Sanitation Department</option>
                      <option value="General Civic Services">General Civic Services</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-2 block">Assign Field Officer</label>
                    <input
                      type="text"
                      value={assignedOfficer}
                      onChange={(e) => setAssignedOfficer(e.target.value)}
                      placeholder="Officer Name (e.g. Officer John)"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl p-3 text-white text-sm outline-none transition-all"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block">Completion Notes / Log</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl p-3 text-white text-sm outline-none transition-all"
                  placeholder="Record resolution notes, repair team names, or next step timelines."
                />
              </div>

              {/* Upload photo placeholder */}
              {status === 'resolved' && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-2 block">Completion Photo</label>
                  <div className="border border-dashed border-slate-800 bg-slate-950/50 hover:bg-slate-950 rounded-xl p-4 text-center cursor-pointer transition-all">
                    <Camera className="h-5 w-5 text-slate-500 mx-auto mb-1" />
                    <span className="text-xs text-slate-400 font-semibold block">Attach Before/After Proof</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={updating}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue/90 focus:outline-none disabled:opacity-50 transition-all shadow-lg shadow-accent-blue/20"
              >
                <Check className="h-4 w-4" />
                {updating ? 'Saving Work Order...' : 'Submit Work Updates'}
              </button>
            </form>
          </div>

          {/* SLA Alerts */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">SLA Routing Status</h3>
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Hours Allowance:</span>
              <span className="text-sm font-bold text-white">{caseData.sla_hours} hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
