import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Report } from './pages/Report';
import { MyReports } from './pages/MyReports';
import { Track } from './pages/Track';
import { OfficerCases } from './pages/OfficerCases';
import { OfficerCaseDetails } from './pages/OfficerCaseDetails';
import { AdminOfficerManagement } from './pages/AdminOfficerManagement';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
          <Header />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/report" element={<Report />} />
              <Route path="/my-reports" element={<MyReports />} />
              <Route path="/track/:ticketId" element={<Track />} />
              <Route path="/officer/cases" element={<OfficerCases />} />
              <Route path="/officer/cases/:id" element={<OfficerCaseDetails />} />
              <Route path="/admin/officers" element={<AdminOfficerManagement />} />
              <Route path="/admin" element={<Navigate to="/admin/officers" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
