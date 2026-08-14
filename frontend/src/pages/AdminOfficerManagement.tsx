import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  Badge,
  X,
  Lock,
  Mail,
  User,
  RefreshCw,
  Power
} from 'lucide-react';

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface OfficerDetail {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  role: string;
  department_id: number;
  department_name?: string;
  badge_number: string;
  is_active: boolean;
  created_at: string;
}

export const AdminOfficerManagement: React.FC = () => {
  const { token, user } = useAuth();

  const [officers, setOfficers] = useState<OfficerDetail[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<OfficerDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    department_id: 0,
    badge_number: '',
    is_active: true,
  });

  const fetchOfficers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/officers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch officers list');
      }
      const data = await res.json();
      setOfficers(data);
    } catch (err: any) {
      setError(err.message || 'Error loading officers');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/v1/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
        if (data.length > 0 && formData.department_id === 0) {
          setFormData(prev => ({ ...prev, department_id: data[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  useEffect(() => {
    fetchOfficers();
    fetchDepartments();
  }, []);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      password: '',
      department_id: departments.length > 0 ? departments[0].id : 0,
      badge_number: '',
      is_active: true,
    });
    setEditingOfficer(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (officer: OfficerDetail) => {
    setEditingOfficer(officer);
    setFormData({
      email: officer.email,
      full_name: officer.full_name,
      password: '', // Leave empty unless changing
      department_id: officer.department_id,
      badge_number: officer.badge_number,
      is_active: officer.is_active,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingOfficer) {
        // PUT update
        const payload: any = {
          full_name: formData.full_name,
          email: formData.email,
          department_id: Number(formData.department_id),
          badge_number: formData.badge_number,
          is_active: formData.is_active,
        };
        if (formData.password.trim()) {
          payload.password = formData.password;
        }

        const res = await fetch(`/api/v1/officers/${editingOfficer.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to update officer');
        }

        showNotification(`Officer ${data.full_name} updated successfully!`);
      } else {
        // POST create
        const res = await fetch('/api/v1/officers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            email: formData.email,
            full_name: formData.full_name,
            password: formData.password,
            department_id: Number(formData.department_id),
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to create officer');
        }

        showNotification(`Officer ${data.full_name} created successfully!`);
      }

      setIsAddModalOpen(false);
      resetForm();
      fetchOfficers();
    } catch (err: any) {
      showNotification(err.message || 'Operation failed', true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (officer: OfficerDetail) => {
    try {
      const res = await fetch(`/api/v1/officers/${officer.id}/toggle-status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to toggle officer status');
      }
      showNotification(`Officer ${data.full_name} is now ${data.is_active ? 'Active' : 'Inactive'}`);
      fetchOfficers();
    } catch (err: any) {
      showNotification(err.message || 'Error toggling status', true);
    }
  };

  const handleDeleteOfficer = async (officer: OfficerDetail) => {
    if (!window.confirm(`Are you sure you want to deactivate officer ${officer.full_name}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/officers/${officer.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to deactivate officer');
      }
      showNotification(`Officer ${officer.full_name} deactivated`);
      fetchOfficers();
    } catch (err: any) {
      showNotification(err.message || 'Deactivation failed', true);
    }
  };

  // Derived metrics
  const totalOfficersCount = officers.length;
  const activeOfficersCount = officers.filter(o => o.is_active).length;
  const inactiveOfficersCount = officers.filter(o => !o.is_active).length;

  // Filtered officers list
  const filteredOfficers = officers.filter(officer => {
    const matchesSearch =
      officer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      officer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      officer.badge_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept =
      selectedDeptFilter === 'all' ||
      officer.department_id.toString() === selectedDeptFilter;

    const matchesStatus =
      selectedStatusFilter === 'all' ||
      (selectedStatusFilter === 'active' && officer.is_active) ||
      (selectedStatusFilter === 'inactive' && !officer.is_active);

    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-blue/10 border border-accent-blue/20 rounded-xl">
              <Users className="h-6 w-6 text-accent-blue" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Officer & Personnel Management
            </h1>
          </div>
          <p className="text-sm text-slate-400 pl-11">
            Provision officer accounts, assign municipal departments, and manage access controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOfficers}
            className="p-2.5 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition-all"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-accent-blue/20 text-sm"
          >
            <UserPlus className="h-4 w-4" />
            Add New Officer
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Officers</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalOfficersCount}</h3>
          </div>
          <div className="p-3 bg-slate-800 border border-slate-700/50 rounded-xl text-accent-blue">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Officers</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{activeOfficersCount}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inactive Accounts</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{inactiveOfficersCount}</h3>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <XCircle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Departments</p>
            <h3 className="text-2xl font-bold text-accent-teal mt-1">{departments.length}</h3>
          </div>
          <div className="p-3 bg-accent-teal/10 border border-accent-teal/20 rounded-xl text-accent-teal">
            <Building2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-md flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search officer, email, badge..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl py-2 pl-10 pr-4 text-white text-sm outline-none transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 w-1/2 sm:w-auto">
            <Filter className="h-4 w-4 text-slate-500 shrink-0" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full sm:w-44 bg-slate-950 border border-slate-800 focus:border-accent-blue rounded-xl py-2 px-3 text-white text-sm outline-none"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id.toString()}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-1/2 sm:w-auto">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full sm:w-36 bg-slate-950 border border-slate-800 focus:border-accent-blue rounded-xl py-2 px-3 text-white text-sm outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Officers Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-4 px-6">Officer Name</th>
                <th className="py-4 px-6">Badge Number</th>
                <th className="py-4 px-6">Department</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Joined Date</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-accent-blue" />
                    Loading officers database...
                  </td>
                </tr>
              ) : filteredOfficers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No officer accounts match your query criteria.
                  </td>
                </tr>
              ) : (
                filteredOfficers.map((officer) => (
                  <tr
                    key={officer.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Name & Email */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-accent-blue shrink-0">
                          {officer.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{officer.full_name}</div>
                          <div className="text-xs text-slate-400">{officer.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Badge */}
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 font-mono text-xs font-medium text-slate-300">
                        <Badge className="h-3.5 w-3.5 text-accent-blue" />
                        {officer.badge_number}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 text-slate-300 text-xs bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                        <Building2 className="h-3.5 w-3.5 text-accent-teal" />
                        {officer.department_name || `Dept #${officer.department_id}`}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      {officer.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {new Date(officer.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(officer)}
                          className={`p-1.5 rounded-lg border transition-all ${officer.is_active
                              ? 'text-amber-400 border-amber-500/20 hover:bg-amber-500/10'
                              : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10'
                            }`}
                          title={officer.is_active ? 'Deactivate Account' : 'Activate Account'}
                        >
                          <Power className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(officer)}
                          className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                          title="Edit Officer Details"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteOfficer(officer)}
                          className="p-1.5 rounded-lg border border-rose-500/20 hover:border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition-all"
                          title="Deactivate Account"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Officer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-accent-blue/10 border border-accent-blue/20 rounded-lg text-accent-blue">
                  {editingOfficer ? <Edit3 className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                </div>
                <h3 className="text-lg font-bold text-white">
                  {editingOfficer ? 'Edit Officer Profile' : 'Provision New Officer'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOfficer} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue rounded-xl py-2 pl-9 pr-4 text-white text-sm outline-none transition-all"
                    placeholder="Officer Officer Name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue rounded-xl py-2 pl-9 pr-4 text-white text-sm outline-none transition-all"
                    placeholder="officer@city.gov"
                  />
                </div>
              </div>

              {/* Badge Number */}
              {/*<div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Badge Number</label>
                <div className="relative">
                  <Badge className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.badge_number}
                    onChange={(e) => setFormData({ ...formData, badge_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue rounded-xl py-2 pl-9 pr-4 text-white text-sm outline-none transition-all font-mono"
                    placeholder="BDG-1092"
                  />
                </div>
                </div>*/}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">
                  Badge Number
                </label>

                <input
                  disabled
                  value="Auto Generated"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-slate-400"
                />
              </div>

              {/* Department Dropdown */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Department</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue rounded-xl py-2 pl-9 pr-4 text-white text-sm outline-none transition-all"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">
                  {editingOfficer ? 'New Password (leave empty to keep unchanged)' : 'Initial Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required={!editingOfficer}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue rounded-xl py-2 pl-9 pr-4 text-white text-sm outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Status toggle (if editing) */}
              {editingOfficer && (
                <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-xs font-semibold text-slate-300">Account Active Status</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-accent-blue hover:bg-accent-blue/90 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-lg shadow-accent-blue/20 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingOfficer ? 'Update Officer' : 'Create Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
