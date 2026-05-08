import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import DashboardHome from './dashboard/DashboardHome'
import Highlights from './dashboard/Highlights'
import Settings from './dashboard/Settings'
import Analytics from './dashboard/Analytics'
import { Video, ListVideo, Settings as SettingsIcon, BarChart3, Film } from 'lucide-react'

function Sidebar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const navLinkClass = (path) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
    isActive(path)
    ? 'bg-[#D97706]/10 text-[#D97706]'
    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
  }`;

  return (
    <div className="w-64 bg-[#0B0F19] flex flex-col border-r border-[#1F2937]">
      <div className="p-6 flex items-center space-x-3">
        <div className="bg-[#D97706] p-2 rounded-lg">
          <Film className="text-white" size={20} />
        </div>
        <div className="text-lg font-semibold text-gray-100 tracking-tight">
          ClipStudio
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <Link to="/" className={navLinkClass('/')}>
          <Video size={18} />
          <span>Projects</span>
        </Link>
        <Link to="/highlights" className={navLinkClass('/highlights')}>
          <ListVideo size={18} />
          <span>Library</span>
        </Link>
        <Link to="/analytics" className={navLinkClass('/analytics')}>
          <BarChart3 size={18} />
          <span>Reports</span>
        </Link>

        <div className="pt-6 pb-2 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Configuration</div>
        <Link to="/settings" className={navLinkClass('/settings')}>
          <SettingsIcon size={18} />
          <span>Settings</span>
        </Link>
      </nav>

      <div className="p-4 border-t border-[#1F2937]">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-8 h-8 rounded-full bg-[#1F2937] border border-[#374151] flex items-center justify-center">
            <span className="text-gray-400 text-sm font-medium">U</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-300">User</div>
            <div className="text-xs text-gray-500">Standard Plan</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-[#0B0F19] text-gray-100 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-auto bg-[#0B0F19]">
          <main className="h-full">
            <Routes>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/highlights" element={<Highlights />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App
