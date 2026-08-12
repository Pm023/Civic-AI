import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  BarChart2, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Smile, 
  PlusCircle, 
  ArrowRight, 
  MapPin, 
  User, 
  LogIn,
  CheckSquare
} from 'lucide-react';

// Custom circular markers based on priority levels
const getMarkerIcon = (priority: string) => {
  let color = '#3b82f6'; // default blue (LOW/MEDIUM)
  const upperPriority = (priority || '').toUpperCase();
  if (upperPriority === 'CRITICAL') color = '#f43f5e'; // rose
  else if (upperPriority === 'HIGH') color = '#f59e0b'; // amber
  else if (upperPriority === 'LOW') color = '#14b8a6'; // teal
  
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>`,
    className: 'custom-pin-icon',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

// Component to handle dynamic map centering when data or user geolocation loads
const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

export const Dashboard: React.FC = () => {
  const { user, token, isAuthenticated } = useAuth();
  
  // Dashboard stats state
  const [stats, setStats] = useState({
    totalReports: 0,
    openReports: 0,
    inProgress: 0,
    resolved: 0,
    avgSla: '0.0h',
    satisfaction: '100%',
    criticalAlerts: 0,
  });

  // Map markers & details state
  const [mapPoints, setMapPoints] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([19.0760, 72.8777]);
  const [workloads, setWorkloads] = useState<Record<string, number>>({});
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [criticalQueue, setCriticalQueue] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');
      try {
        if (isAuthenticated && user?.role === 'citizen') {
          // ==================== CITIZEN (USER) DASHBOARD FLOW ====================
          // Fetch citizen-specific reports (automatically filtered by backend based on JWT token)
          const response = await fetch('/api/v1/reports', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!response.ok) {
            throw new Error('Failed to load your complaints list.');
          }
          const reports = await response.json();
          
          // Calculate citizen stats
          const total = reports.length;
          const open = reports.filter((r: any) => ['submitted', 'verified', 'assigned'].includes(r.status)).length;
          const inProgress = reports.filter((r: any) => r.status === 'in_progress').length;
          const resolved = reports.filter((r: any) => r.status === 'resolved').length;
          const completionRate = total > 0 ? ((resolved / total) * 100).toFixed(0) : '100';
          const ratedReports = reports.filter((r: any) => r.citizen_feedback);
          const feedbackRate = total > 0 ? ((ratedReports.length / total) * 100).toFixed(0) : '0';

          setStats({
            totalReports: total,
            openReports: open,
            inProgress: inProgress,
            resolved: resolved,
            avgSla: `${completionRate}%`, // Repurposed as completion rate for citizen view
            satisfaction: `${feedbackRate}% Feedback`, // Repurposed as feedback rate for citizen view
            criticalAlerts: reports.filter((r: any) => r.priority_level === 'CRITICAL' && r.status !== 'resolved').length,
          });

          // Map points
          const points = reports.map((r: any) => ({
            id: r.id,
            ticket_id: r.ticket_id,
            category: r.category,
            status: r.status,
            priority_level: r.priority_level,
            latitude: r.latitude,
            longitude: r.longitude,
            description: r.description
          }));
          setMapPoints(points);
          setRecentReports(reports.slice(0, 5)); // show top 5 recent citizen reports

        } else if (isAuthenticated && user?.role === 'officer') {
          // ==================== OFFICER (ADMIN) DASHBOARD FLOW ====================
          // 1. Fetch global stats
          const statsResponse = await fetch('/api/v1/dashboard/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!statsResponse.ok) {
            throw new Error('Failed to retrieve system statistics.');
          }
          const statsData = await statsResponse.json();

          // 2. Fetch all reports to populate officer GIS map and critical alerts
          const reportsResponse = await fetch('/api/v1/reports', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!reportsResponse.ok) {
            throw new Error('Failed to retrieve active reports database.');
          }
          const allReports = await reportsResponse.json();

          setStats({
            totalReports: statsData.total_reports,
            openReports: statsData.open_reports,
            inProgress: statsData.in_progress_reports,
            resolved: statsData.resolved_reports,
            avgSla: `${statsData.avg_response_time_hours}h`,
            satisfaction: `${statsData.citizen_satisfaction_percentage}%`,
            criticalAlerts: statsData.critical_priority_alerts,
          });

          setWorkloads(statsData.department_workload || {});
          
          // Map points from all reports
          setMapPoints(allReports);
          setRecentReports(statsData.recent_reports || []);
          
          // Critical unresolved reports queue
          const criticals = allReports.filter((r: any) => r.priority_level === 'CRITICAL' && r.status !== 'resolved');
          setCriticalQueue(criticals.slice(0, 5));

        } else {
          // ==================== GUEST (PUBLIC) DASHBOARD FLOW ====================
          // Fetch public statistics
          const statsResponse = await fetch('/api/v1/dashboard/stats');
          if (!statsResponse.ok) {
            throw new Error('Failed to retrieve public municipal statistics.');
          }
          const statsData = await statsResponse.json();

          // Fetch public map points
          const mapResponse = await fetch('/api/v1/dashboard/map-data');
          if (!mapResponse.ok) {
            throw new Error('Failed to retrieve community GIS data.');
          }
          const mapData = await mapResponse.json();

          setStats({
            totalReports: statsData.total_reports,
            openReports: statsData.open_reports,
            inProgress: statsData.in_progress_reports,
            resolved: statsData.resolved_reports,
            avgSla: `${statsData.avg_response_time_hours}h`,
            satisfaction: `${statsData.citizen_satisfaction_percentage}%`,
            criticalAlerts: statsData.critical_priority_alerts,
          });

          setMapPoints(mapData);
          setRecentReports(statsData.recent_reports || []);
          setWorkloads(statsData.department_workload || {});
        }
      } catch (err: any) {
        setError(err.message || 'Error occurred while loading dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAuthenticated, token, user]);

  // Ask for browser geolocation to center map on local city
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.log("Geolocation error, using default center:", error);
        }
      );
    }
  }, []);

  // Recenter map on first complaint when complaints are loaded
  useEffect(() => {
    const validPoints = mapPoints.filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number');
    if (validPoints.length > 0) {
      setMapCenter([validPoints[0].latitude, validPoints[0].longitude]);
    }
  }, [mapPoints]);

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
    switch ((priority || '').toUpperCase()) {
      case 'CRITICAL': return 'bg-rose-500/10 text-accent-rose border-rose-500/20';
      case 'HIGH': return 'bg-amber-500/10 text-accent-amber border-amber-500/20';
      case 'MEDIUM': return 'bg-blue-500/10 text-accent-blue border-blue-500/20';
      case 'LOW': return 'bg-slate-800 text-slate-400 border-slate-700';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const validPoints = mapPoints.filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header and Welcome */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {isAuthenticated
              ? user?.role === 'officer'
                ? 'CIVIC CONTROL COMMAND CENTER'
                : 'MY CIVIC PORTAL'
              : 'CIVIC INTELLIGENCE COMMAND CENTER'}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {isAuthenticated
              ? user?.role === 'officer'
                ? `Logged in as Officer ${user?.full_name || ''} • Manage municipal workloads and check dispatch analytics.`
                : `Welcome back, ${user?.full_name || ''}. Track your filed issues, see live community reports, and submit new concerns.`
              : 'Real-time GIS mapping, AI classification auditing, and smart routing analytics.'}
          </p>
        </div>
        
        {isAuthenticated && user?.role === 'citizen' && (
          <Link
            to="/report"
            className="inline-flex items-center gap-2 bg-accent-teal hover:bg-accent-teal/90 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-accent-teal/20"
          >
            <PlusCircle className="h-4 w-4" />
            Report New Issue
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="underline font-semibold hover:text-white transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { 
            label: user?.role === 'citizen' ? 'My Reports' : 'Total Reports', 
            val: stats.totalReports.toString(), 
            icon: Activity, 
            color: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20' 
          },
          { 
            label: 'Open Reports', 
            val: stats.openReports.toString(), 
            icon: AlertTriangle, 
            color: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20' 
          },
          { 
            label: 'In Progress', 
            val: stats.inProgress.toString(), 
            icon: BarChart2, 
            color: 'text-accent-violet bg-accent-violet/10 border-accent-violet/20' 
          },
          { 
            label: user?.role === 'citizen' ? 'My Resolved' : 'Resolved Cases', 
            val: stats.resolved.toString(), 
            icon: CheckCircle, 
            color: 'text-accent-emerald bg-accent-emerald/10 border-accent-emerald/20' 
          },
          { 
            label: user?.role === 'citizen' ? 'Completion Rate' : 'Avg SLA Speed', 
            val: stats.avgSla, 
            icon: Clock, 
            color: 'text-accent-teal bg-accent-teal/10 border-accent-teal/20' 
          },
          { 
            label: user?.role === 'citizen' ? 'Feedback Status' : 'Citizen Sat', 
            val: stats.satisfaction, 
            icon: Smile, 
            color: 'text-accent-rose bg-accent-rose/10 border-accent-rose/20' 
          },
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 rounded-xl border ${stat.color.split(' ')[2]} bg-slate-900/60 backdrop-blur-sm shadow-sm flex flex-col justify-between`}>
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-semibold">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color.split(' ')[0]}`} />
            </div>
            <div className="mt-4 text-2xl font-bold tracking-tight text-white">{stat.val}</div>
          </div>
        ))}
      </div>

      {/* Map + Side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaflet Map Visualizer */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-xl">
          <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur-sm">
            <h2 className="text-md font-semibold text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent-teal" />
              GIS Map Visualizer
            </h2>
            <span className="text-xs text-accent-teal font-semibold px-2 py-0.5 rounded bg-accent-teal/10 border border-accent-teal/20 animate-pulse">
              Live Map Connected ({mapPoints.length} points)
            </span>
          </div>
          <div className="flex-1 bg-slate-950 min-h-[430px] relative z-10">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full border-2 border-accent-teal border-t-transparent animate-spin mx-auto mb-2" />
                  <span className="text-xs text-slate-400">Loading Leaflet Map...</span>
                </div>
              </div>
            ) : (
              <MapContainer center={mapCenter} zoom={12} style={{ height: '450px', width: '100%', borderRadius: '0 0 1rem 1rem' }}>
                <RecenterMap center={mapCenter} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {validPoints.map((pt) => (
                  <Marker key={pt.id} position={[pt.latitude, pt.longitude]} icon={getMarkerIcon(pt.priority_level)}>
                    <Popup>
                      <div className="text-slate-900 font-sans p-1">
                        <div className="font-bold border-b border-slate-200 pb-1 mb-1 text-sm flex justify-between gap-4">
                          <span className="text-blue-600 font-mono">{pt.ticket_id}</span>
                          <span className="capitalize text-slate-500 font-normal">{pt.status}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 uppercase">Category: {pt.category}</p>
                        <p className="text-xs text-slate-600 mt-1 max-w-[200px] line-clamp-2">{pt.description}</p>
                        <div className="mt-2 text-right">
                          {user?.role === 'officer' ? (
                            <Link to={`/officer/cases/${pt.id}`} className="text-xs text-blue-600 hover:underline font-semibold block">
                              Inspect Case &rarr;
                            </Link>
                          ) : (
                            <Link to={`/track/${pt.ticket_id}`} className="text-xs text-teal-600 hover:underline font-semibold block">
                              Track Status &rarr;
                            </Link>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        </div>

        {/* Sidebar Info Panels */}
        <div className="space-y-6">
          {/* USER / ROLE CONTEXT SPECIFIC SIDEBARS */}
          
          {/* Guest Sidebar */}
          {!isAuthenticated && (
            <>
              {/* Login / Register Callout */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/5 rounded-full blur-2xl" />
                <h3 className="text-md font-semibold text-white mb-2 flex items-center gap-2">
                  <User className="h-4 w-4 text-accent-blue" />
                  Get Involved
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Help improve your city's infrastructure. Login or register to file pothole, outage, sewage, or cleanliness complaints.
                </p>
                <div className="flex gap-2.5">
                  <Link
                    to="/login"
                    className="flex-1 text-center py-2 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="flex-1 text-center py-2 px-3 bg-accent-teal hover:bg-accent-teal/90 text-slate-950 rounded-lg text-xs font-bold transition-all"
                  >
                    Register
                  </Link>
                </div>
              </div>

              {/* Active Departments & SLA */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h3 className="text-md font-semibold text-white mb-4">City Departments & SLA</h3>
                <div className="space-y-3.5">
                  {[
                    { name: 'Public Works', sla: '12 - 48 hours' },
                    { name: 'Electrical Dept', sla: '4 - 48 hours' },
                    { name: 'Water & Drainage', sla: '12 - 48 hours' },
                    { name: 'Sanitation Dept', sla: '4 - 48 hours' }
                  ].map((dept, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium">{dept.name}</span>
                      <span className="text-slate-500 font-mono font-semibold bg-slate-950 px-2 py-0.5 border border-slate-800 rounded">
                        {dept.sla}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Citizen Sidebar */}
          {isAuthenticated && user?.role === 'citizen' && (
            <>
              {/* User Action Center Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <h3 className="text-md font-semibold text-white mb-2 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-accent-teal" />
                  My Actions
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
                  Use your account to quickly report municipal damage. Reports are classified instantly by our AI dispatching model.
                </p>
                <div className="space-y-2">
                  <Link
                    to="/report"
                    className="w-full text-center py-2.5 px-4 bg-accent-teal hover:bg-accent-teal/90 text-slate-950 rounded-lg text-xs font-bold transition-all block"
                  >
                    File New Complaint
                  </Link>
                  <Link
                    to="/my-reports"
                    className="w-full text-center py-2.5 px-4 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-all block"
                  >
                    View All My Reports
                  </Link>
                </div>
              </div>

              {/* Citizen Recent Submissions list */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h3 className="text-md font-semibold text-white mb-4">Recent Submissions</h3>
                <div className="space-y-3">
                  {loading ? (
                    <p className="text-xs text-slate-500">Loading history...</p>
                  ) : recentReports.length === 0 ? (
                    <p className="text-xs text-slate-500">You haven't submitted any complaints yet.</p>
                  ) : (
                    recentReports.map((r) => (
                      <div key={r.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-accent-teal font-bold">{r.ticket_id}</span>
                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border capitalize ${getStatusBadge(r.status)}`}>
                              {r.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate max-w-[170px]">{r.description}</p>
                        </div>
                        <Link to={`/track/${r.ticket_id}`} className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Officer (Admin) Sidebar */}
          {isAuthenticated && user?.role === 'officer' && (
            <>
              {/* Department Workloads */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h3 className="text-md font-semibold text-white mb-4">Department Workload</h3>
                <div className="space-y-3">
                  {Object.keys(workloads).length === 0 ? (
                    <p className="text-xs text-slate-500">No active workloads to display.</p>
                  ) : (
                    Object.entries(workloads).map(([dept, count], idx) => {
                      const maxCount = Math.max(...Object.values(workloads), 1);
                      const percentage = (count / maxCount) * 100;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300 font-medium">{dept}</span>
                            <span className="text-slate-400 font-bold">{count} cases</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80">
                            <div 
                              className="bg-gradient-to-r from-accent-blue to-accent-violet h-full rounded-full transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Critical Priority Alerts Queue */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h3 className="text-md font-semibold text-rose-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Priority Alerts
                </h3>
                <div className="space-y-3">
                  {criticalQueue.length === 0 ? (
                    <p className="text-xs text-slate-500">No unresolved critical complaints.</p>
                  ) : (
                    criticalQueue.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-rose-500/30 transition-all flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-accent-rose font-bold">{c.ticket_id}</span>
                            <span className={`text-[9px] uppercase font-bold border ${getPriorityBadge(c.priority_level)}`}>
                              CRITICAL
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate max-w-[160px]">{c.description}</p>
                        </div>
                        <Link to={`/officer/cases/${c.id}`} className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* GLOBAL RECENT REPORTS SECTION FOR GUEST AND OFFICER */}
      {(!isAuthenticated || (isAuthenticated && user?.role === 'officer')) && (
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-md font-semibold text-white">Recent City-wide Incidents</h2>
            {isAuthenticated && user?.role === 'officer' && (
              <Link to="/officer/cases" className="text-xs text-accent-blue font-semibold hover:underline flex items-center gap-1">
                Go to Dispatch Queue &rarr;
              </Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <th className="px-5 py-3">Ticket ID</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                      Loading data...
                    </td>
                  </tr>
                ) : recentReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                      No active tickets in system database.
                    </td>
                  </tr>
                ) : (
                  recentReports.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-3 font-mono font-semibold text-accent-teal">{r.ticket_id}</td>
                      <td className="px-5 py-3 uppercase tracking-wider font-bold text-[10px] text-slate-400">{r.category}</td>
                      <td className="px-5 py-3 truncate max-w-xs text-slate-400">{r.description}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getPriorityBadge(r.priority_level)}`}>
                          {r.priority_level}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize ${getStatusBadge(r.status)}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{new Date(r.created_at || r.timestamp).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        {user?.role === 'officer' ? (
                          <Link to={`/officer/cases/${r.id}`} className="text-accent-blue hover:text-white transition-colors font-semibold">
                            Inspect
                          </Link>
                        ) : (
                          <Link to={`/track/${r.ticket_id}`} className="text-accent-teal hover:text-white transition-colors font-semibold">
                            Track
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
