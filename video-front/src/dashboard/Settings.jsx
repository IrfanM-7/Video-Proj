import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Sliders, Volume2, Layout, RotateCcw, HardDrive, Film, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/settings';

export default function Settings() {
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ projects: 0, clips: 0, avgTime: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/history');
        const history = res.data.history || [];
        const totalClips = history.reduce((acc, item) => acc + (item.segments?.length || 0), 0);
        const avgTime = history.length > 0
          ? (history.reduce((acc, item) => acc + (item.processing_time || 0), 0) / history.length).toFixed(1)
          : 0;
        setStats({ projects: history.length, clips: totalClips, avgTime });
      } catch (err) {
        console.error('Failed to fetch stats', err);
      }
    };
    fetchStats();
  }, []);

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (window.confirm('Reset all settings to defaults?')) {
      setSettings({ ...DEFAULT_SETTINGS });
      saveSettings({ ...DEFAULT_SETTINGS });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-5xl mx-auto block min-h-full"
    >
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 mb-2">Settings</h1>
          <p className="text-gray-500">Configure how the engine processes your videos.</p>
        </div>
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center space-x-2 text-emerald-400 text-sm font-medium bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20"
            >
              <CheckCircle size={16} />
              <span>Saved</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#111827] rounded-xl p-6 border border-[#1F2937]">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-[#D97706]/10 rounded-lg">
                <Sliders className="w-5 h-5 text-[#D97706]" />
              </div>
              <div>
                <h2 className="text-gray-200 font-medium">Processing Options</h2>
                <p className="text-gray-600 text-xs">Control how videos are analyzed and clipped.</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Target Clips */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-gray-300 text-sm font-medium">Target Number of Clips</label>
                  <span className="bg-[#0B0F19] text-[#D97706] px-3 py-1 rounded-md text-sm font-semibold border border-[#374151]">
                    {settings.maxClips}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={settings.maxClips}
                  onChange={(e) => update('maxClips', parseInt(e.target.value))}
                  className="w-full accent-[#D97706]"
                />
                <p className="text-gray-600 text-xs mt-1">
                  How many highlight segments the engine will try to extract from each video.
                </p>
              </div>

              <div className="h-px bg-[#1F2937]" />

              {/* Enable Audio */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Volume2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-gray-200 text-sm font-medium">Audio & Speech Analysis</h3>
                    <p className="text-gray-600 text-xs">Transcribe audio with Whisper for semantic scoring.</p>
                  </div>
                </div>
                <button
                  onClick={() => update('enableAudio', !settings.enableAudio)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${settings.enableAudio ? 'bg-[#D97706]' : 'bg-[#374151]'}`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.enableAudio ? 'translate-x-6' : 'translate-x-0'}`}
                  />
                </button>
              </div>

              <div className="h-px bg-[#1F2937]" />

              {/* Default Aspect Ratio */}
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Layout className="w-5 h-5 text-emerald-400" />
                  </div>
                  <label className="text-gray-200 text-sm font-medium">Default Output Format</label>
                </div>
                <div className="pl-12 grid grid-cols-3 gap-3">
                  {[
                    { value: '16:9', label: 'Landscape', desc: 'YouTube / Desktop' },
                    { value: '9:16', label: 'Portrait', desc: 'TikTok / Reels' },
                    { value: '1:1', label: 'Square', desc: 'Instagram' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('defaultAspect', opt.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        settings.defaultAspect === opt.value
                          ? 'bg-[#D97706]/10 border-[#D97706]/30 text-[#D97706]'
                          : 'bg-[#0B0F19] border-[#374151] text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              <RotateCcw size={14} />
              <span>Reset to Defaults</span>
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              className="bg-[#D97706] hover:bg-[#B45309] text-white font-medium px-6 py-2.5 rounded-lg transition-colors inline-flex items-center space-x-2 text-sm"
            >
              <Save size={16} />
              <span>Save Settings</span>
            </motion.button>
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#111827] rounded-xl p-6 border border-[#1F2937]">
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <HardDrive className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-gray-200 font-medium text-sm">App Stats</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Projects</span>
                <span className="text-gray-200 font-semibold">{stats.projects}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Total Clips</span>
                <span className="text-gray-200 font-semibold">{stats.clips}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Avg. Process Time</span>
                <span className="text-gray-200 font-semibold">{stats.avgTime}s</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111827] rounded-xl p-6 border border-[#1F2937]">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-[#D97706]/10 rounded-lg">
                <Film className="w-5 h-5 text-[#D97706]" />
              </div>
              <h2 className="text-gray-200 font-medium text-sm">About</h2>
            </div>
            <p className="text-gray-600 text-xs leading-relaxed">
              ClipStudio uses motion detection, audio transcription, and semantic analysis to find the best moments in your videos.
            </p>
            <div className="mt-4 pt-4 border-t border-[#1F2937]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Version</span>
                <span className="text-gray-400">1.0.0</span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-gray-600">Backend</span>
                <span className="text-gray-400">FastAPI + FFmpeg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

